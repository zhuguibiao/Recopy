import { create } from "zustand";
import type { Update, DownloadEvent } from "@tauri-apps/plugin-updater";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "error";

interface UpdateState {
  status: UpdateStatus;
  version: string | null;
  body: string | null;
  progress: number;
  _updateRef: Update | null;

  checkForUpdate: () => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  relaunch: () => Promise<void>;
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  status: "idle",
  version: null,
  body: null,
  progress: 0,
  _updateRef: null,

  checkForUpdate: async () => {
    if (get().status === "downloading") return;

    set({ status: "checking" });
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (update) {
        set({
          status: "available",
          version: update.version,
          body: update.body ?? null,
          _updateRef: update,
        });
      } else {
        set({ status: "idle", _updateRef: null });
      }
    } catch {
      // Plugin not available (App Store build) or network error — silent fail
      set({ status: "idle", _updateRef: null });
    }
  },

  downloadAndInstall: async () => {
    const update = get()._updateRef;
    if (!update || get().status !== "available") return;

    set({ status: "downloading", progress: 0 });
    try {
      let totalBytes = 0;
      let downloadedBytes = 0;
      await update.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === "Started") {
          totalBytes = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          const pct = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
          set({ progress: Math.min(pct, 100) });
        } else if (event.event === "Finished") {
          set({ progress: 100 });
        }
      });

      set({ status: "ready", progress: 100 });
    } catch (e) {
      console.error("Update download failed:", e);
      set({ status: "error" });
      setTimeout(() => set({ status: "idle", _updateRef: null }), 5000);
    }
  },

  relaunch: async () => {
    try {
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e) {
      console.error("Relaunch failed:", e);
    }
  },
}));
