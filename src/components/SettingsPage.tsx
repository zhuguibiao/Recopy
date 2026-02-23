import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore, type Settings as AppSettings } from "../stores/settings-store";
import {
  Settings,
  Clock,
  Keyboard,
  Shield,
  Info,
  Trash2,
  Sun,
  Moon,
  Monitor,
  ChevronRight,
  Globe,
} from "lucide-react";

type SettingsTab = "general" | "history" | "privacy" | "about";

export function SettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const { settings, loaded, loadSettings, updateSetting, clearHistory } =
    useSettingsStore();

  useEffect(() => {
    if (!loaded) loadSettings();
  }, [loaded, loadSettings]);

  if (!loaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-foreground">
        <p className="text-muted-foreground">{t("settings.loading")}</p>
      </div>
    );
  }

  const tabs: { id: SettingsTab; i18nKey: string; icon: React.ReactNode }[] = [
    { id: "general", i18nKey: "settings.tabs.general", icon: <Settings size={16} /> },
    { id: "history", i18nKey: "settings.tabs.history", icon: <Clock size={16} /> },
    { id: "privacy", i18nKey: "settings.tabs.privacy", icon: <Shield size={16} /> },
    { id: "about", i18nKey: "settings.tabs.about", icon: <Info size={16} /> },
  ];

  return (
    <div className="h-screen flex bg-background text-foreground font-sans select-none">
      {/* Sidebar */}
      <div className="w-44 border-r border-border p-3 flex flex-col gap-1 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
              activeTab === tab.id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {tab.icon}
            {t(tab.i18nKey)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {activeTab === "general" && (
          <GeneralSettings settings={settings} updateSetting={updateSetting} />
        )}
        {activeTab === "history" && (
          <HistorySettings settings={settings} updateSetting={updateSetting} clearHistory={clearHistory} />
        )}
        {activeTab === "privacy" && <PrivacySettings />}
        {activeTab === "about" && <AboutSettings />}
      </div>
    </div>
  );
}

function GeneralSettings({
  settings,
  updateSetting,
}: {
  settings: AppSettings;
  updateSetting: (key: keyof AppSettings, value: string) => Promise<void>;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{t("settings.general.title")}</h2>

      {/* Theme */}
      <SettingRow label={t("settings.general.theme")} description={t("settings.general.themeDesc")}>
        <div className="flex gap-2">
          {([
            { value: "dark", icon: <Moon size={14} />, i18nKey: "settings.general.dark" },
            { value: "light", icon: <Sun size={14} />, i18nKey: "settings.general.light" },
            { value: "system", icon: <Monitor size={14} />, i18nKey: "settings.general.system" },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateSetting("theme", opt.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                settings.theme === opt.value
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.icon}
              {t(opt.i18nKey)}
            </button>
          ))}
        </div>
      </SettingRow>

      {/* Language */}
      <SettingRow label={t("settings.general.language")} description={t("settings.general.languageDesc")}>
        <div className="flex gap-2">
          {([
            { value: "en", label: "English" },
            { value: "zh", label: "中文" },
            { value: "system", label: t("settings.general.system") },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateSetting("language", opt.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                settings.language === opt.value
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Globe size={12} />
              {opt.label}
            </button>
          ))}
        </div>
      </SettingRow>

      {/* Shortcut */}
      <SettingRow label={t("settings.general.shortcut")} description={t("settings.general.shortcutDesc")}>
        <ShortcutRecorder
          value={settings.shortcut}
          onChange={(v) => updateSetting("shortcut", v)}
        />
      </SettingRow>

      {/* Auto Start */}
      <SettingRow label={t("settings.general.autoStart")} description={t("settings.general.autoStartDesc")}>
        <ToggleSwitch
          checked={settings.auto_start === "true"}
          onChange={(v) => updateSetting("auto_start", v ? "true" : "false")}
        />
      </SettingRow>

      {/* Close on Blur */}
      <SettingRow label={t("settings.general.closeOnBlur")} description={t("settings.general.closeOnBlurDesc")}>
        <ToggleSwitch
          checked={settings.close_on_blur === "true"}
          onChange={(v) => updateSetting("close_on_blur", v ? "true" : "false")}
        />
      </SettingRow>
    </div>
  );
}

function HistorySettings({
  settings,
  updateSetting,
  clearHistory,
}: {
  settings: AppSettings;
  updateSetting: (key: keyof AppSettings, value: string) => Promise<void>;
  clearHistory: () => Promise<number>;
}) {
  const { t } = useTranslation();
  const [confirmClear, setConfirmClear] = useState(false);
  const [cleared, setCleared] = useState<number | null>(null);

  const handleClear = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    const count = await clearHistory();
    setCleared(count);
    setConfirmClear(false);
    setTimeout(() => setCleared(null), 3000);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{t("settings.history.title")}</h2>

      <SettingRow label={t("settings.history.retention")} description={t("settings.history.retentionDesc")}>
        <select
          value={settings.retention_policy}
          onChange={(e) => updateSetting("retention_policy", e.target.value)}
          className="bg-muted text-foreground border border-border rounded-md px-3 py-1.5 text-sm cursor-pointer"
        >
          <option value="unlimited">{t("settings.history.unlimited")}</option>
          <option value="days">{t("settings.history.keepDays")}</option>
          <option value="count">{t("settings.history.keepCount")}</option>
        </select>
      </SettingRow>

      {settings.retention_policy === "days" && (
        <SettingRow label={t("settings.history.retentionDays")} description={t("settings.history.retentionDaysDesc")}>
          <input
            type="number"
            min="1"
            max="365"
            value={settings.retention_days}
            onChange={(e) => updateSetting("retention_days", e.target.value)}
            className="bg-muted text-foreground border border-border rounded-md px-3 py-1.5 text-sm w-20"
          />
        </SettingRow>
      )}

      {settings.retention_policy === "count" && (
        <SettingRow label={t("settings.history.maxItems")} description={t("settings.history.maxItemsDesc")}>
          <input
            type="number"
            min="10"
            max="100000"
            value={settings.retention_count}
            onChange={(e) => updateSetting("retention_count", e.target.value)}
            className="bg-muted text-foreground border border-border rounded-md px-3 py-1.5 text-sm w-24"
          />
        </SettingRow>
      )}

      <SettingRow label={t("settings.history.maxSize")} description={t("settings.history.maxSizeDesc")}>
        <input
          type="number"
          min="1"
          max="100"
          value={settings.max_item_size_mb}
          onChange={(e) => updateSetting("max_item_size_mb", e.target.value)}
          className="bg-muted text-foreground border border-border rounded-md px-3 py-1.5 text-sm w-20"
        />
      </SettingRow>

      <SettingRow label={t("settings.history.clear")} description={t("settings.history.clearDesc")}>
        <button
          onClick={handleClear}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
            confirmClear
              ? "bg-destructive text-white"
              : "bg-muted text-destructive hover:bg-destructive/10"
          }`}
        >
          <Trash2 size={14} />
          {confirmClear
            ? t("settings.history.confirmClear")
            : cleared !== null
              ? t("settings.history.cleared", { count: cleared })
              : t("settings.history.clearAll")}
        </button>
      </SettingRow>
    </div>
  );
}

function PrivacySettings() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{t("settings.privacy.title")}</h2>

      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Shield size={16} className="text-accent" />
          {t("settings.privacy.accessibility")}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t("settings.privacy.accessibilityDesc")}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-accent">
          <ChevronRight size={12} />
          {t("settings.privacy.accessibilityPath")}
        </p>
      </div>

      <SettingRow label={t("settings.privacy.exclusionList")} description={t("settings.privacy.exclusionListDesc")}>
        <span className="text-xs text-muted-foreground">{t("settings.privacy.comingSoon")}</span>
      </SettingRow>
    </div>
  );
}

function AboutSettings() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{t("settings.about.title")}</h2>

      <div className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4 text-center space-y-2">
          <h3 className="text-xl font-bold">{t("app.name")}</h3>
          <p className="text-sm text-muted-foreground">{t("app.version", { version: "0.1.0" })}</p>
          <p className="text-xs text-muted-foreground">{t("app.description")}</p>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1.5 border-b border-border">
            <span className="text-muted-foreground">{t("settings.about.license")}</span>
            <span>MIT</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-border">
            <span className="text-muted-foreground">{t("settings.about.framework")}</span>
            <span>Tauri v2</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-border">
            <span className="text-muted-foreground">{t("settings.about.frontend")}</span>
            <span>React + TypeScript</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-muted-foreground">{t("settings.about.database")}</span>
            <span>SQLite (sqlx)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Shared UI components ---

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="space-y-0.5">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <div className="shrink-0 ml-4">{children}</div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
        checked ? "bg-accent" : "bg-muted-foreground/30"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

function ShortcutRecorder({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    setDisplay(value);
  }, [value]);

  useEffect(() => {
    if (!recording) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const parts: string[] = [];
      if (e.metaKey || e.ctrlKey) parts.push("CommandOrControl");
      if (e.shiftKey) parts.push("Shift");
      if (e.altKey) parts.push("Alt");

      const key = e.key;
      if (key !== "Meta" && key !== "Control" && key !== "Shift" && key !== "Alt") {
        parts.push(key.length === 1 ? key.toUpperCase() : key);
        const shortcut = parts.join("+");
        setDisplay(shortcut);
        onChange(shortcut);
        setRecording(false);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [recording, onChange]);

  const formatShortcut = (s: string) =>
    s
      .replace("CommandOrControl", navigator.platform.includes("Mac") ? "\u2318" : "Ctrl")
      .replace("Shift", "\u21E7")
      .replace("Alt", "\u2325")
      .replace(/\+/g, " ");

  return (
    <button
      onClick={() => setRecording(!recording)}
      className={`px-3 py-1.5 rounded-md text-xs border transition-colors cursor-pointer min-w-28 text-center ${
        recording
          ? "border-accent bg-accent/10 text-accent animate-pulse"
          : "border-border bg-muted text-foreground hover:border-muted-foreground"
      }`}
    >
      <Keyboard size={12} className="inline mr-1.5" />
      {recording ? t("settings.general.pressKeys") : formatShortcut(display)}
    </button>
  );
}
