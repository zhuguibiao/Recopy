import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

// Module-level cache: prevents re-fetching when virtual scroll remounts cards
const thumbnailCache = new Map<string, string>();

/**
 * Lazily load a thumbnail for a clipboard item.
 * Pass null to skip fetching.
 * Returns an object URL or null while loading.
 */
export function useThumbnail(id: string | null): string | null {
  const [url, setUrl] = useState<string | null>(
    () => (id && thumbnailCache.get(id)) ?? null,
  );

  useEffect(() => {
    if (!id) return;

    if (thumbnailCache.has(id)) {
      setUrl(thumbnailCache.get(id)!);
      return;
    }

    let cancelled = false;

    invoke<number[] | null>("get_thumbnail", { id }).then((data) => {
      if (cancelled || !data || data.length === 0) return;
      const bytes = new Uint8Array(data);
      const blob = new Blob([bytes], { type: "image/png" });
      const objectUrl = URL.createObjectURL(blob);
      thumbnailCache.set(id, objectUrl);
      setUrl(objectUrl);
    });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return url;
}
