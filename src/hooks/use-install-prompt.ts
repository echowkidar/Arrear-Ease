"use client";

import { useCallback, useEffect, useState } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type StandaloneWindow = {
  matchMedia: (query: string) => { matches: boolean };
  navigator: { standalone?: boolean };
};

type NavigatorLike = { userAgent: string; platform?: string; maxTouchPoints?: number };

/** True when the app is running as an installed PWA. */
export function isStandalone(win: StandaloneWindow): boolean {
  return win.matchMedia("(display-mode: standalone)").matches || win.navigator.standalone === true;
}

/** True on iOS/iPadOS Safari, which has no install prompt (users must use Share → Add to Home Screen). */
export function isIosSafari(nav: NavigatorLike): boolean {
  const ua = nav.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
  return ios && safari;
}

// Module-level so the event is kept even if it fires before any component mounts.
let deferred: BeforeInstallPromptEvent | null = null;
let justInstalled = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    justInstalled = true;
    notify();
  });
}

export function useInstallPrompt() {
  const [, rerender] = useState(0);
  const [env, setEnv] = useState({ standalone: false, ios: false });

  useEffect(() => {
    const update = () => rerender((n) => n + 1);
    const sync = () => setEnv({ standalone: isStandalone(window as unknown as StandaloneWindow), ios: isIosSafari(navigator) });
    const mq = window.matchMedia("(display-mode: standalone)");
    listeners.add(update);
    mq.addEventListener?.("change", sync);
    sync();
    return () => {
      listeners.delete(update);
      mq.removeEventListener?.("change", sync);
    };
  }, []);

  const install = useCallback(async () => {
    const e = deferred;
    if (!e) return "unavailable" as const;
    await e.prompt();
    const { outcome } = await e.userChoice;
    deferred = null; // a prompt event can only be used once
    notify();
    return outcome;
  }, []);

  const installed = env.standalone || justInstalled;
  return {
    canPrompt: !installed && deferred !== null,
    showIosHint: !installed && env.ios,
    installed,
    install,
  };
}
