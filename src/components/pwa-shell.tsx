"use client";

import { useEffect, useState } from "react";
import { Download, Share, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

const DISMISS_KEY = "pwa-install-banner-dismissed";

/** Registers the service worker (production only) and shows the offline and install banners. */
export function PwaShell() {
  const { canPrompt, showIosHint, installed, install } = useInstallPrompt();
  const [online, setOnline] = useState(true);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => console.error("SW registration failed", err));
    }
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  const showInstall = !installed && !dismissed && (canPrompt || showIosHint);

  return (
    <>
      {!online && (
        <div role="status" className="no-print fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-xs font-medium text-amber-950">
          <WifiOff className="h-3.5 w-3.5" />
          You&apos;re offline. Data can&apos;t be loaded or saved until you reconnect.
        </div>
      )}
      {showInstall && (
        <div className="no-print fixed bottom-4 inset-x-4 z-[90] mx-auto flex max-w-md items-center gap-3 rounded-lg border bg-card p-3 text-sm shadow-lg sm:inset-x-auto sm:right-4">
          <img src="/icons/icon-192.png" alt="" className="h-9 w-9 rounded-lg" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold leading-tight">Install Arrear Ease</p>
            {canPrompt ? (
              <p className="text-xs text-muted-foreground">Open it like an app from your home screen.</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Tap <Share className="inline h-3 w-3 align-[-2px]" aria-label="Share" /> Share, then Add to Home Screen.
              </p>
            )}
          </div>
          {canPrompt && (
            <Button size="sm" onClick={() => install()}>
              <Download className="mr-1.5 h-4 w-4" /> Install
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={dismiss} aria-label="Dismiss install banner">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  );
}
