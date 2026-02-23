import { useTranslation } from "react-i18next";
import { useClipboardStore } from "../stores/clipboard-store";
import type { ViewMode } from "../lib/types";
import { Clock, Star } from "lucide-react";

const TABS: { i18nKey: string; value: ViewMode; icon: typeof Clock }[] = [
  { i18nKey: "tabs.history", value: "history", icon: Clock },
  { i18nKey: "tabs.pins", value: "pins", icon: Star },
];

export function ViewTabs() {
  const { t } = useTranslation();
  const viewMode = useClipboardStore((s) => s.viewMode);
  const setViewMode = useClipboardStore((s) => s.setViewMode);

  return (
    <div className="flex gap-0.5">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.value}
            onClick={() => setViewMode(tab.value)}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md transition-colors cursor-pointer
              ${
                viewMode === tab.value
                  ? "text-foreground bg-white/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
          >
            <Icon size={13} />
            {t(tab.i18nKey)}
          </button>
        );
      })}
    </div>
  );
}
