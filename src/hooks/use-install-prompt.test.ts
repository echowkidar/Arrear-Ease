import { describe, expect, it } from "vitest";
import { isIosSafari, isStandalone } from "./use-install-prompt";

const win = (displayModeStandalone: boolean, standalone?: boolean) => ({
  matchMedia: (q: string) => ({ matches: q === "(display-mode: standalone)" && displayModeStandalone }),
  navigator: { standalone },
});

describe("isStandalone", () => {
  it("is true in display-mode standalone", () => {
    expect(isStandalone(win(true))).toBe(true);
  });
  it("is true for iOS home-screen apps (navigator.standalone)", () => {
    expect(isStandalone(win(false, true))).toBe(true);
  });
  it("is false in a normal browser tab", () => {
    expect(isStandalone(win(false, false))).toBe(false);
    expect(isStandalone(win(false))).toBe(false);
  });
});

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

describe("isIosSafari", () => {
  it("shows the hint on iPhone Safari", () => {
    expect(isIosSafari({ userAgent: IPHONE_SAFARI, platform: "iPhone", maxTouchPoints: 5 })).toBe(true);
  });
  it("detects iPadOS Safari, which reports itself as a Mac", () => {
    expect(isIosSafari({ userAgent: MAC_SAFARI, platform: "MacIntel", maxTouchPoints: 5 })).toBe(true);
  });
  it("is false for Chrome on iOS, desktop Safari and Android", () => {
    expect(isIosSafari({ userAgent: IPHONE_CHROME, platform: "iPhone", maxTouchPoints: 5 })).toBe(false);
    expect(isIosSafari({ userAgent: MAC_SAFARI, platform: "MacIntel", maxTouchPoints: 0 })).toBe(false);
    expect(isIosSafari({ userAgent: ANDROID_CHROME, platform: "Linux armv8l", maxTouchPoints: 5 })).toBe(false);
  });
});
