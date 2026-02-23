import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import type { ClipboardItem } from "../lib/types";
import { useClipboardStore } from "../stores/clipboard-store";
import { copyToClipboard } from "../lib/paste";
import { TextCard } from "./TextCard";
import { RichTextCard } from "./RichTextCard";
import { ImageCard } from "./ImageCard";
import { FileCard } from "./FileCard";
import { ItemContextMenu } from "./ItemContextMenu";

interface ClipboardCardProps {
  item: ClipboardItem;
  selected: boolean;
  onClick: () => void;
}

export function ClipboardCard({ item, selected, onClick }: ClipboardCardProps) {
  const copiedId = useClipboardStore((s) => s.copiedId);
  const showCopied = useClipboardStore((s) => s.showCopied);
  const isCopied = copiedId === item.id;

  const handleDoubleClick = () => {
    copyToClipboard(item);
    showCopied(item.id);
  };

  const card = (() => {
    switch (item.content_type) {
      case "plain_text":
        return <TextCard item={item} selected={selected} onClick={onClick} />;
      case "rich_text":
        return <RichTextCard item={item} selected={selected} onClick={onClick} />;
      case "image":
        return <ImageCard item={item} selected={selected} onClick={onClick} />;
      case "file":
        return <FileCard item={item} selected={selected} onClick={onClick} />;
      default:
        return <TextCard item={item} selected={selected} onClick={onClick} />;
    }
  })();

  return (
    <ItemContextMenu item={item}>
      <div className="relative h-full" onDoubleClick={handleDoubleClick}>
        {card}
        {isCopied && <CopiedOverlay />}
      </div>
    </ItemContextMenu>
  );
}

function CopiedOverlay() {
  const { t } = useTranslation();
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 rounded-lg animate-in fade-in duration-150 pointer-events-none">
      <Check className="text-green-400" size={28} strokeWidth={2.5} />
      <span className="text-white text-xs font-medium mt-1">{t("context.copyToClipboard")}</span>
    </div>
  );
}
