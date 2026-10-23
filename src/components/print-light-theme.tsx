"use client";

// Printouts must always look like the light theme. While printing (Ctrl+P or the
// Print button), the "dark" class is removed from <html> so every dark: style and
// dark CSS variable is switched off, and it is restored right after printing.

import { useEffect } from "react";

export function PrintLightTheme() {
  useEffect(() => {
    const root = document.documentElement;
    let wasDark = false;

    const toLight = () => {
      if (root.classList.contains("dark")) {
        wasDark = true;
        root.classList.remove("dark");
        root.style.colorScheme = "light";
      }
    };
    const restore = () => {
      if (wasDark) {
        root.classList.add("dark");
        root.style.colorScheme = "dark";
        wasDark = false;
      }
    };

    const mql = window.matchMedia("print");
    const onMediaChange = (e: MediaQueryListEvent) => (e.matches ? toLight() : restore());

    window.addEventListener("beforeprint", toLight);
    window.addEventListener("afterprint", restore);
    mql.addEventListener?.("change", onMediaChange);
    return () => {
      window.removeEventListener("beforeprint", toLight);
      window.removeEventListener("afterprint", restore);
      mql.removeEventListener?.("change", onMediaChange);
    };
  }, []);

  return null;
}
