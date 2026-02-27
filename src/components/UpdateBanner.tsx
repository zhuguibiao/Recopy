import { useTranslation } from "react-i18next";
import { useUpdateStore } from "../stores/update-store";
import { Download, RotateCcw } from "lucide-react";

export function UpdateBanner() {
  const { t } = useTranslation();
  const { status, version, progress, downloadAndInstall, relaunch } =
    useUpdateStore();

  if (status === "idle" || status === "checking") {
    return null;
  }

  if (status === "error") {
    return (
      <span className="text-xs text-destructive/70">
        {t("update.failed")}
      </span>
    );
  }

  if (status === "available") {
    return (
      <button
        onClick={downloadAndInstall}
        className="flex items-center gap-1.5 text-xs text-primary/90 hover:text-primary transition-colors cursor-pointer"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>
        <Download size={11} />
        <span>{t("update.available", { version })}</span>
      </button>
    );
  }

  if (status === "downloading") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="w-20 h-1.5 rounded-full bg-muted/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="tabular-nums">{progress}%</span>
      </div>
    );
  }

  if (status === "ready") {
    return (
      <button
        onClick={relaunch}
        className="flex items-center gap-1.5 text-xs text-primary animate-pulse hover:opacity-80 transition-opacity cursor-pointer"
      >
        <RotateCcw size={11} />
        <span>{t("update.restart")}</span>
      </button>
    );
  }

  return null;
}
