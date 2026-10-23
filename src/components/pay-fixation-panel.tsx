"use client";

// "Pay Fixation (original document)" box under an arrear statement.
// - Pages scanned for AI extraction, or added here, wait as "not saved yet" until
//   the statement is saved (the page then uploads them).
// - For a statement already saved online, a page added here is saved at once.
// - Thumbnails only are downloaded; the full page loads when opened in the viewer.

import * as React from "react";
import { Camera, Eye, Loader2, Paperclip, Printer, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DocumentScannerModal } from "@/components/document-scanner-modal";
import { PayFixationViewer, printImages, type ViewerPage } from "@/components/pay-fixation-viewer";
import { formatBytes, preparePayFixationImage, type PreparedPayFixation } from "@/lib/pay-fixation-image";
import {
  deletePayFixation,
  fetchFullImage,
  fetchThumbs,
  uploadPayFixation,
  type PayFixationThumb,
} from "@/lib/pay-fixation-data";

export interface PendingPayFixation {
  key: string;
  source: "scan" | "manual";
  prepared: PreparedPayFixation;
  thumbUrl: string;
}

export const makePending = async (file: Blob, source: PendingPayFixation["source"]): Promise<PendingPayFixation> => {
  const prepared = await preparePayFixationImage(file);
  return {
    key: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    source,
    prepared,
    thumbUrl: URL.createObjectURL(prepared.thumb),
  };
};

export const releasePending = (list: PendingPayFixation[]) => list.forEach((p) => URL.revokeObjectURL(p.thumbUrl));

/** Uploads waiting pages to a saved statement. Returns how many were saved. */
export async function uploadPending(list: PendingPayFixation[], statementId: string, ownerId: string, uploadedBy: string) {
  let n = 0;
  for (const p of list) {
    await uploadPayFixation({ statementId, ownerId, uploadedBy, page: n + 1, image: p.prepared });
    n++;
  }
  return n;
}

export function PayFixationPanel({
  statementId,
  ownerId,
  uid,
  isAdmin,
  userEmail,
  signedIn,
  employeeLabel,
  fileBase,
  pending,
  onPendingChange,
  refreshKey,
  onToast,
}: {
  /** saved online statement id, or null while not saved / only saved locally */
  statementId: string | null;
  ownerId: string;
  uid: string;
  isAdmin: boolean;
  userEmail: string;
  signedIn: boolean;
  employeeLabel: string;
  fileBase: string;
  pending: PendingPayFixation[];
  onPendingChange: (next: PendingPayFixation[]) => void;
  refreshKey: number;
  onToast: (t: { title: string; description?: string; variant?: "destructive" }) => void;
}) {
  const [saved, setSaved] = React.useState<PayFixationThumb[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [scanFile, setScanFile] = React.useState<File | null>(null);
  const [viewer, setViewer] = React.useState<{ open: boolean; index: number }>({ open: false, index: 0 });
  const [toDelete, setToDelete] = React.useState<PayFixationThumb | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    if (!statementId || !signedIn) {
      setSaved((old) => {
        old.forEach((t) => URL.revokeObjectURL(t.thumbUrl));
        return [];
      });
      return;
    }
    setLoading(true);
    try {
      const list = await fetchThumbs([statementId], uid, isAdmin);
      setSaved((old) => {
        old.forEach((t) => URL.revokeObjectURL(t.thumbUrl));
        return list;
      });
    } catch (e) {
      console.error("Pay fixation load failed:", e);
    }
    setLoading(false);
  }, [statementId, uid, isAdmin, signedIn]);

  React.useEffect(() => {
    load();
  }, [load, refreshKey]);

  React.useEffect(() => () => saved.forEach((t) => URL.revokeObjectURL(t.thumbUrl)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const addFile = async (file: File) => {
    setBusy(true);
    try {
      const p = await makePending(file, "manual");
      if (statementId && signedIn) {
        await uploadPayFixation({ statementId, ownerId, uploadedBy: userEmail, page: saved.length + 1, image: p.prepared });
        URL.revokeObjectURL(p.thumbUrl);
        onToast({ title: "Pay fixation saved", description: `${formatBytes(p.prepared.full.size)} after compression.` });
        await load();
      } else {
        onPendingChange([...pending, p]);
        onToast({ title: "Page added", description: "It will be saved with the arrear statement." });
      }
    } catch (e: any) {
      console.error(e);
      onToast({
        variant: "destructive",
        title: "Could not add the page",
        description: /permission/i.test(String(e?.code || e?.message || ""))
          ? "Database rules for pay fixation are not published yet (firestore.rules)."
          : e?.message || "Please try again.",
      });
    }
    setBusy(false);
  };

  const pages: ViewerPage[] = [
    ...saved.map<ViewerPage>((t) => ({ key: t.id, thumbUrl: t.thumbUrl, bytes: t.bytes, getFull: () => fetchFullImage(t.id) })),
    ...pending.map<ViewerPage>((p) => ({ key: p.key, thumbUrl: p.thumbUrl, bytes: p.prepared.full.size, getFull: async () => p.prepared.full })),
  ];

  const removePending = (key: string) => {
    const p = pending.find((x) => x.key === key);
    if (p) URL.revokeObjectURL(p.thumbUrl);
    onPendingChange(pending.filter((x) => x.key !== key));
  };

  const confirmDelete = async () => {
    const t = toDelete;
    setToDelete(null);
    if (!t) return;
    try {
      await deletePayFixation(t);
      onToast({ title: "Page deleted" });
      await load();
    } catch (e: any) {
      onToast({ variant: "destructive", title: "Could not delete", description: e?.message || "" });
    }
  };

  const printAll = async () => {
    setBusy(true);
    try {
      const blobs: Blob[] = [];
      for (const p of pages) blobs.push(await p.getFull());
      await printImages(blobs, employeeLabel);
    } catch (e: any) {
      onToast({ variant: "destructive", title: "Could not print", description: e?.message || "" });
    }
    setBusy(false);
  };

  const savedBytes = saved.reduce((a, t) => a + t.bytes + t.thumbBytes, 0);

  return (
    <Card className="no-print border-dashed shadow-none bg-muted/10" data-testid="pf-panel">
      <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-2 flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Paperclip className="h-4 w-4" /> Pay Fixation (original document)</CardTitle>
          <CardDescription className="text-xs mt-1">
            {saved.length > 0 && <>{saved.length} page(s) saved · {formatBytes(savedBytes)}. </>}
            {pending.length > 0 && (
              <span className="text-amber-700 dark:text-amber-400">
                {pending.length} page(s) not saved yet — {signedIn ? "they will be saved when you Save / Update the arrear." : "sign in and save the arrear to keep them."}
              </span>
            )}
            {saved.length === 0 && pending.length === 0 && !loading && "Attach the pay fixation so it can be seen, downloaded and printed later."}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            data-testid="pf-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) setScanFile(f);
            }}
          />
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()} data-testid="pf-add">
            {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Camera className="h-4 w-4 mr-1.5" />} Add page
          </Button>
          {pages.length > 0 && (
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => setViewer({ open: true, index: 0 })} data-testid="pf-view">
                <Eye className="h-4 w-4 mr-1.5" /> View
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={printAll}>
                <Printer className="h-4 w-4 mr-1.5" /> Print
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      {(pages.length > 0 || loading) && (
        <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
          {loading && pages.length === 0 ? (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>
          ) : (
            <div className="flex flex-wrap gap-3" data-testid="pf-thumbs">
              {pages.map((p, i) => {
                const savedThumb = saved.find((t) => t.id === p.key);
                return (
                  <div key={p.key} className="relative group">
                    <button
                      type="button"
                      onClick={() => setViewer({ open: true, index: i })}
                      className="block rounded-md border bg-white overflow-hidden hover:ring-2 hover:ring-primary"
                      aria-label={`Open page ${i + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.thumbUrl} alt={`Pay fixation page ${i + 1}`} className="h-28 w-auto object-contain" />
                    </button>
                    <div className="mt-1 flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
                      <span>Page {i + 1}</span>
                      {!savedThumb && <Badge variant="outline" className="text-[10px] py-0 border-amber-400 text-amber-700 dark:text-amber-400">not saved</Badge>}
                      <button
                        type="button"
                        className="text-rose-600 hover:text-rose-700"
                        aria-label={`Delete page ${i + 1}`}
                        onClick={() => (savedThumb ? setToDelete(savedThumb) : removePending(p.key))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}

      <DocumentScannerModal
        file={scanFile}
        onClose={() => setScanFile(null)}
        onUse={(f) => { setScanFile(null); addFile(f); }}
        onSkip={(f) => { setScanFile(null); addFile(f); }}
        onRetake={() => { setScanFile(null); inputRef.current?.click(); }}
      />

      <PayFixationViewer
        open={viewer.open}
        onOpenChange={(o) => setViewer((v) => ({ ...v, open: o }))}
        title={employeeLabel}
        fileBase={fileBase}
        pages={pages}
        initialIndex={viewer.index}
        onDelete={(p) => {
          const t = saved.find((x) => x.id === p.key);
          setViewer((v) => ({ ...v, open: false }));
          if (t) setToDelete(t);
          else removePending(p.key);
        }}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this pay fixation page?</AlertDialogTitle>
            <AlertDialogDescription>The saved image will be removed permanently. The arrear statement is not affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700 text-white" onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

