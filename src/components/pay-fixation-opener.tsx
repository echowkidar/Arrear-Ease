"use client";

// Opens the pay fixation viewer for any saved statement (used by Arrear Summaries
// and the gallery). Thumbnails are fetched on demand; full pages when shown.

import * as React from "react";
import { PayFixationViewer, type ViewerPage } from "@/components/pay-fixation-viewer";
import { fetchFullImage, fetchThumbs, type PayFixationThumb } from "@/lib/pay-fixation-data";

export function usePayFixationOpener(uid: string, isAdmin: boolean, onError?: (msg: string) => void) {
  const [state, setState] = React.useState<{ open: boolean; title: string; fileBase: string; thumbs: PayFixationThumb[]; index: number }>({
    open: false,
    title: "",
    fileBase: "",
    thumbs: [],
    index: 0,
  });
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  const openFor = React.useCallback(
    async (statementId: string, title: string, fileBase: string, preloaded?: PayFixationThumb[]) => {
      setLoadingId(statementId);
      try {
        const thumbs = preloaded?.length ? preloaded : await fetchThumbs([statementId], uid, isAdmin);
        if (!thumbs.length) {
          onError?.("No pay fixation is saved for this statement.");
        } else {
          setState({ open: true, title, fileBase, thumbs, index: 0 });
        }
      } catch (e: any) {
        onError?.(e?.message || "Could not load the pay fixation.");
      }
      setLoadingId(null);
    },
    [uid, isAdmin, onError]
  );

  const pages: ViewerPage[] = React.useMemo(
    () => state.thumbs.map((t) => ({ key: t.id, thumbUrl: t.thumbUrl, bytes: t.bytes, getFull: () => fetchFullImage(t.id) })),
    [state.thumbs]
  );

  const element = (
    <PayFixationViewer
      open={state.open}
      onOpenChange={(o) => setState((s) => ({ ...s, open: o }))}
      title={state.title}
      fileBase={state.fileBase}
      pages={pages}
      initialIndex={state.index}
    />
  );

  return { openFor, loadingId, element };
}
