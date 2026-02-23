import { invoke } from "@tauri-apps/api/core";
import type { ClipboardItem } from "./types";

/**
 * Write clipboard item content back to the system clipboard,
 * then optionally simulate Cmd+V to paste into the frontmost app.
 */
export async function pasteItem(item: ClipboardItem, autoPaste = true): Promise<void> {
  try {
    await invoke("paste_clipboard_item", {
      id: item.id,
      autoPaste,
    });
  } catch (e) {
    console.error("Failed to paste item:", e);
  }
}

/**
 * Copy item content to clipboard without pasting.
 */
export async function copyToClipboard(item: ClipboardItem): Promise<void> {
  return pasteItem(item, false);
}

/**
 * Paste item as plain text (strip rich formatting).
 */
export async function pasteAsPlainText(item: ClipboardItem): Promise<void> {
  try {
    await invoke("paste_as_plain_text", {
      id: item.id,
    });
  } catch (e) {
    console.error("Failed to paste as plain text:", e);
  }
}
