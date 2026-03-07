use std::sync::{
    atomic::{AtomicBool, AtomicIsize, Ordering},
    OnceLock,
};
use tauri::{Emitter, Manager};

// ---------------------------------------------------------------------------
// Win32 FFI declarations (raw, no external crate dependency)
// ---------------------------------------------------------------------------

#[allow(non_snake_case, non_upper_case_globals)]
mod win32 {
    // Types – match Win32 on x64
    pub type HWND = isize;
    pub type HHOOK = isize;
    pub type HINSTANCE = isize;
    pub type WPARAM = usize;
    pub type LPARAM = isize;
    pub type LRESULT = isize;

    // ShowWindow commands
    pub const SW_HIDE: i32 = 0;
    pub const SW_SHOWNOACTIVATE: i32 = 4;

    // SetWindowPos constants
    pub const HWND_TOPMOST: isize = -1;
    pub const SWP_NOMOVE: u32 = 0x0002;
    pub const SWP_NOSIZE: u32 = 0x0001;
    pub const SWP_NOACTIVATE: u32 = 0x0010;

    // Hook
    pub const WH_KEYBOARD_LL: i32 = 13;
    pub const WM_KEYDOWN: u32 = 0x0100;

    // Virtual-key codes
    pub const VK_BACK: u32 = 0x08;
    pub const VK_TAB: u32 = 0x09;
    pub const VK_RETURN: u32 = 0x0D;
    pub const VK_SHIFT: i32 = 0x10;
    pub const VK_CONTROL: i32 = 0x11;
    pub const VK_ESCAPE: u32 = 0x1B;
    pub const VK_SPACE: u32 = 0x20;
    pub const VK_LEFT: u32 = 0x25;
    pub const VK_UP: u32 = 0x26;
    pub const VK_RIGHT: u32 = 0x27;
    pub const VK_DOWN: u32 = 0x28;
    pub const VK_DELETE: u32 = 0x2E;
    pub const VK_C: u32 = 0x43;
    pub const VK_F: u32 = 0x46;
    pub const VK_V: u32 = 0x56;
    pub const VK_OEM_COMMA: u32 = 0xBC;

    // SendInput constants
    pub const INPUT_KEYBOARD: u32 = 1;
    pub const KEYEVENTF_KEYUP: u32 = 0x0002;

    /// KBDLLHOOKSTRUCT – passed via LPARAM in WH_KEYBOARD_LL callback.
    #[repr(C)]
    pub struct KBDLLHOOKSTRUCT {
        pub vk_code: u32,
        pub scan_code: u32,
        pub flags: u32,
        pub time: u32,
        pub dw_extra_info: usize,
    }

    /// Flat representation of INPUT with KEYBDINPUT union variant.
    /// Layout matches `sizeof(INPUT) == 40` on x64 Windows.
    #[repr(C)]
    pub struct KeyboardInputRaw {
        pub input_type: u32,      // offset 0
        pub _pad0: u32,           // offset 4  (alignment for union)
        pub wvk: u16,             // offset 8
        pub wscan: u16,           // offset 10
        pub dw_flags: u32,        // offset 12
        pub time: u32,            // offset 16
        pub _pad1: u32,           // offset 20 (alignment for usize)
        pub dw_extra_info: usize, // offset 24
        pub _pad2: [u8; 8],       // offset 32 (pad to MOUSEINPUT union size)
    }

    impl KeyboardInputRaw {
        pub fn new(vk: u16, flags: u32) -> Self {
            Self {
                input_type: INPUT_KEYBOARD,
                _pad0: 0,
                wvk: vk,
                wscan: 0,
                dw_flags: flags,
                time: 0,
                _pad1: 0,
                dw_extra_info: 0,
                _pad2: [0; 8],
            }
        }
    }

    unsafe extern "system" {
        pub fn ShowWindow(hwnd: HWND, n_cmd_show: i32) -> i32;
        pub fn SetWindowPos(
            hwnd: HWND,
            hwnd_after: HWND,
            x: i32,
            y: i32,
            cx: i32,
            cy: i32,
            flags: u32,
        ) -> i32;
        pub fn IsWindowVisible(hwnd: HWND) -> i32;
        pub fn GetForegroundWindow() -> HWND;
        pub fn SetForegroundWindow(hwnd: HWND) -> i32;
        pub fn SetWindowsHookExW(
            id_hook: i32,
            lpfn: Option<unsafe extern "system" fn(i32, WPARAM, LPARAM) -> LRESULT>,
            hmod: HINSTANCE,
            thread_id: u32,
        ) -> HHOOK;
        pub fn UnhookWindowsHookEx(hhk: HHOOK) -> i32;
        pub fn CallNextHookEx(hhk: HHOOK, code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT;
        pub fn GetAsyncKeyState(vkey: i32) -> i16;
        pub fn SendInput(c_inputs: u32, p_inputs: *const KeyboardInputRaw, cb_size: i32) -> u32;
        pub fn GetModuleHandleW(name: *const u16) -> HINSTANCE;
        pub fn GetCurrentProcessId() -> u32;
        pub fn GetWindowThreadProcessId(hwnd: HWND, pid: *mut u32) -> u32;
    }
}

// ---------------------------------------------------------------------------
// Module-level statics
// ---------------------------------------------------------------------------

/// App handle for the keyboard hook callback to emit Tauri events.
static APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();

/// Handle of the installed WH_KEYBOARD_LL hook (0 = no hook).
static HOOK_HANDLE: AtomicIsize = AtomicIsize::new(0);

/// HWND of the previous foreground window (saved before showing Recopy).
static PREV_FOREGROUND: AtomicIsize = AtomicIsize::new(0);

/// HWND of Recopy's main window (cached for the hook callback).
static MAIN_HWND: AtomicIsize = AtomicIsize::new(0);

/// Preview focus guard: skip main's blur while preview is opening.
static PREVIEW_FOCUS_GUARD: AtomicBool = AtomicBool::new(false);

/// Set before programmatically hiding preview, prevents blur → close-all.
static PREVIEW_PROGRAMMATIC_HIDE: AtomicBool = AtomicBool::new(false);

// ---------------------------------------------------------------------------
// HWND helper
// ---------------------------------------------------------------------------

fn get_hwnd(window: &tauri::WebviewWindow) -> Option<isize> {
    #[cfg(target_os = "windows")]
    {
        window.hwnd().ok().map(|h| h.0 as isize)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = window;
        None
    }
}

fn is_hook_active() -> bool {
    HOOK_HANDLE.load(Ordering::SeqCst) != 0
}

// ---------------------------------------------------------------------------
// Platform API (same interface as macos.rs / fallback.rs)
// ---------------------------------------------------------------------------

pub fn init_platform(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    APP_HANDLE.set(app.handle().clone()).ok();
    if let Some(window) = app.get_webview_window("main") {
        if let Some(hwnd) = get_hwnd(&window) {
            MAIN_HWND.store(hwnd, Ordering::SeqCst);
        }
    }
    Ok(())
}

/// Show the main window **without activating** (previous app keeps focus).
/// Installs a global keyboard hook so arrow/Enter/Space/Escape still work.
pub fn platform_show_window(app: &tauri::AppHandle, _panel_position: &str) {
    if let Some(window) = app.get_webview_window("main") {
        if let Some(hwnd) = get_hwnd(&window) {
            MAIN_HWND.store(hwnd, Ordering::SeqCst);
            unsafe {
                // Remember who currently owns the foreground
                let prev = win32::GetForegroundWindow();
                PREV_FOREGROUND.store(prev, Ordering::SeqCst);

                // Show without stealing focus
                win32::ShowWindow(hwnd, win32::SW_SHOWNOACTIVATE);
                win32::SetWindowPos(
                    hwnd,
                    win32::HWND_TOPMOST,
                    0,
                    0,
                    0,
                    0,
                    win32::SWP_NOMOVE | win32::SWP_NOSIZE | win32::SWP_NOACTIVATE,
                );
            }
            install_keyboard_hook();
        }
    }
}

pub fn platform_hide_window(app: &tauri::AppHandle) {
    remove_keyboard_hook();
    if let Some(window) = app.get_webview_window("main") {
        if let Some(hwnd) = get_hwnd(&window) {
            unsafe {
                win32::ShowWindow(hwnd, win32::SW_HIDE);
            }
        }
        // Also tell Tauri so its internal state stays consistent
        let _ = window.hide();
    }
    restore_foreground();
}

pub fn platform_is_visible(app: &tauri::AppHandle) -> bool {
    if let Some(window) = app.get_webview_window("main") {
        if let Some(hwnd) = get_hwnd(&window) {
            return unsafe { win32::IsWindowVisible(hwnd) != 0 };
        }
    }
    false
}

/// Before paste: remove the keyboard hook so subsequent SendInput Ctrl+V
/// reaches the still-foreground previous app (we never stole focus).
pub fn platform_resign_before_paste(_app: &tauri::AppHandle) {
    remove_keyboard_hook();
}

/// Called from the `Focused(true)` handler when the user clicks on Recopy.
/// The webview now owns keyboard focus, so the hook is no longer needed.
pub fn on_window_focused() {
    remove_keyboard_hook();
}

// ---------------------------------------------------------------------------
// Keyboard hook
// ---------------------------------------------------------------------------

fn install_keyboard_hook() {
    // Already installed?
    if is_hook_active() {
        return;
    }
    unsafe {
        let hmod = win32::GetModuleHandleW(std::ptr::null());
        let hook =
            win32::SetWindowsHookExW(win32::WH_KEYBOARD_LL, Some(keyboard_hook_proc), hmod, 0);
        if hook != 0 {
            HOOK_HANDLE.store(hook, Ordering::SeqCst);
        }
    }
}

fn remove_keyboard_hook() {
    let handle = HOOK_HANDLE.swap(0, Ordering::SeqCst);
    if handle != 0 {
        unsafe {
            win32::UnhookWindowsHookEx(handle);
        }
    }
}

/// Low-level keyboard hook procedure.
/// Intercepts navigation keys and forwards them as `platform-keydown` Tauri
/// events so the frontend can drive the same logic as native keydown.
unsafe extern "system" fn keyboard_hook_proc(
    code: i32,
    wparam: win32::WPARAM,
    lparam: win32::LPARAM,
) -> win32::LRESULT {
    if code >= 0 && wparam as u32 == win32::WM_KEYDOWN {
        // Safety-check: only intercept when the foreground window does NOT
        // belong to Recopy (e.g. settings window open → let keys through).
        let fg = win32::GetForegroundWindow();
        let mut fg_pid: u32 = 0;
        win32::GetWindowThreadProcessId(fg, &mut fg_pid);
        let our_pid = win32::GetCurrentProcessId();
        if fg_pid == our_pid {
            return win32::CallNextHookEx(0, code, wparam, lparam);
        }

        let kbd = &*(lparam as *const win32::KBDLLHOOKSTRUCT);
        let vk = kbd.vk_code;
        let ctrl = win32::GetAsyncKeyState(win32::VK_CONTROL) < 0;
        let shift = win32::GetAsyncKeyState(win32::VK_SHIFT) < 0;

        // Map VK to DOM key name (matching KeyboardEvent.key)
        let key: Option<&str> = match vk {
            win32::VK_UP => Some("ArrowUp"),
            win32::VK_DOWN => Some("ArrowDown"),
            win32::VK_LEFT => Some("ArrowLeft"),
            win32::VK_RIGHT => Some("ArrowRight"),
            win32::VK_RETURN => Some("Enter"),
            win32::VK_SPACE => Some(" "),
            win32::VK_ESCAPE => Some("Escape"),
            win32::VK_TAB => Some("Tab"),
            win32::VK_DELETE => Some("Delete"),
            win32::VK_BACK => Some("Backspace"),
            win32::VK_C if ctrl => Some("c"),
            win32::VK_OEM_COMMA if ctrl => Some(","),
            win32::VK_F if ctrl => {
                // Ctrl+F → activate the window so the SearchBar can receive
                // real keyboard input, then forward the event.
                remove_keyboard_hook();
                let main = MAIN_HWND.load(Ordering::SeqCst);
                if main != 0 {
                    win32::SetForegroundWindow(main);
                }
                if let Some(app) = APP_HANDLE.get() {
                    let _ = app.emit(
                        "platform-keydown",
                        serde_json::json!({"key":"f","ctrlKey":true,"shiftKey":false}),
                    );
                }
                return 1; // consumed
            }
            _ => None,
        };

        if let Some(key_name) = key {
            if let Some(app) = APP_HANDLE.get() {
                let _ = app.emit(
                    "platform-keydown",
                    serde_json::json!({
                        "key": key_name,
                        "ctrlKey": ctrl,
                        "shiftKey": shift,
                    }),
                );
            }
            return 1; // consumed – don't forward to previous app
        }
    }

    win32::CallNextHookEx(0, code, wparam, lparam)
}

// ---------------------------------------------------------------------------
// Simulate paste (Ctrl+V) via SendInput
// ---------------------------------------------------------------------------

pub fn simulate_paste_keys() {
    std::thread::sleep(std::time::Duration::from_millis(50));
    let inputs = [
        win32::KeyboardInputRaw::new(0x11, 0), // Ctrl down
        win32::KeyboardInputRaw::new(win32::VK_V as u16, 0), // V down
        win32::KeyboardInputRaw::new(win32::VK_V as u16, win32::KEYEVENTF_KEYUP), // V up
        win32::KeyboardInputRaw::new(0x11, win32::KEYEVENTF_KEYUP), // Ctrl up
    ];
    unsafe {
        win32::SendInput(
            4,
            inputs.as_ptr(),
            std::mem::size_of::<win32::KeyboardInputRaw>() as i32,
        );
    }
}

// ---------------------------------------------------------------------------
// Foreground restore
// ---------------------------------------------------------------------------

fn restore_foreground() {
    let prev = PREV_FOREGROUND.swap(0, Ordering::SeqCst);
    if prev != 0 {
        unsafe {
            win32::SetForegroundWindow(prev);
        }
    }
}

// ---------------------------------------------------------------------------
// Preview window (non-activating in floating mode, focus-dance in active mode)
// ---------------------------------------------------------------------------

pub fn init_preview_panel(_app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}

pub fn platform_show_preview(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("preview") {
        if is_hook_active() {
            // Floating mode: show preview without activating (no focus change)
            if let Some(hwnd) = get_hwnd(&window) {
                unsafe {
                    win32::ShowWindow(hwnd, win32::SW_SHOWNOACTIVATE);
                    win32::SetWindowPos(
                        hwnd,
                        win32::HWND_TOPMOST,
                        0,
                        0,
                        0,
                        0,
                        win32::SWP_NOMOVE | win32::SWP_NOSIZE | win32::SWP_NOACTIVATE,
                    );
                }
            }
        } else {
            // Activated mode: standard focus-dance (show preview → return focus to main)
            PREVIEW_FOCUS_GUARD.store(true, Ordering::SeqCst);
            let _ = window.show();
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.set_focus();
            }
        }
    }
}

pub fn platform_hide_preview(app: &tauri::AppHandle) {
    if is_hook_active() {
        // Floating mode: just hide, no focus dance needed
        if let Some(window) = app.get_webview_window("preview") {
            if let Some(hwnd) = get_hwnd(&window) {
                unsafe {
                    win32::ShowWindow(hwnd, win32::SW_HIDE);
                }
            }
            let _ = window.hide();
        }
    } else {
        // Activated mode: standard hide with guard
        PREVIEW_FOCUS_GUARD.store(false, Ordering::SeqCst);
        if let Some(window) = app.get_webview_window("preview") {
            PREVIEW_PROGRAMMATIC_HIDE.store(true, Ordering::SeqCst);
            let _ = window.hide();
        }
    }
}

pub fn is_preview_focus_guard() -> bool {
    PREVIEW_FOCUS_GUARD.load(Ordering::SeqCst)
}

pub fn set_preview_focus_guard(val: bool) {
    PREVIEW_FOCUS_GUARD.store(val, Ordering::SeqCst);
}

pub fn take_preview_programmatic_hide() -> bool {
    PREVIEW_PROGRAMMATIC_HIDE.swap(false, Ordering::SeqCst)
}

// ---------------------------------------------------------------------------
// HUD window
// ---------------------------------------------------------------------------

pub fn init_hud_panel(_app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}

pub fn platform_show_hud(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("hud") {
        let _ = window.show();
    }
}

pub fn platform_hide_hud(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("hud") {
        let _ = window.hide();
    }
}
