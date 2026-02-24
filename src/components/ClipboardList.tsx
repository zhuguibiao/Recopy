import { useMemo, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useClipboardStore } from "../stores/clipboard-store";
import { ClipboardCard } from "./ClipboardCard";
import { dateGroupLabel } from "../lib/time";
import { Clipboard } from "lucide-react";

import type { ClipboardItem } from "../lib/types";

interface DateGroup {
  label: string;
  items: { item: ClipboardItem; flatIndex: number }[];
}

export function ClipboardList() {
  const { t } = useTranslation();
  const items = useClipboardStore((s) => s.items);
  const selectedIndex = useClipboardStore((s) => s.selectedIndex);
  const setSelectedIndex = useClipboardStore((s) => s.setSelectedIndex);
  const loading = useClipboardStore((s) => s.loading);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Group items by date
  const groups = useMemo(() => {
    const result: DateGroup[] = [];
    let lastLabel = "";
    let currentGroup: DateGroup | null = null;

    items.forEach((item, flatIndex) => {
      const label = dateGroupLabel(item.updated_at);
      if (label !== lastLabel) {
        currentGroup = { label, items: [] };
        result.push(currentGroup);
        lastLabel = label;
      }
      currentGroup!.items.push({ item, flatIndex });
    });

    return result;
  }, [items]);

  // Auto-scroll selected card into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [selectedIndex]);

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        {t("list.loading")}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <Clipboard size={40} strokeWidth={1.5} />
        <p className="text-sm">{t("list.empty")}</p>
        <p className="text-xs">{t("list.emptyHint")}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto no-scrollbar">
      {groups.map((group) => (
        <div key={group.label} className="mb-1">
          <div className="text-[11px] font-medium text-muted-foreground px-1 py-1">
            {group.label}
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {group.items.map(({ item, flatIndex }) => (
              <div
                key={item.id}
                ref={flatIndex === selectedIndex ? selectedRef : undefined}
                className="shrink-0 w-[300px] h-[260px]"
              >
                <ClipboardCard
                  item={item}
                  selected={flatIndex === selectedIndex}
                  onClick={() => setSelectedIndex(flatIndex)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
