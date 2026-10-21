// City classification used for HRA / TA / CCA. Default = Aligarh (current rates).
// Official sources:
//  - 7th CPC HRA: MoF OM No. 2/5/2017-E.II(B) dt 07.07.2017 — X/Y/Z = 24/16/8%,
//    27/18/9% when DA crosses 25%, 30/20/10% when DA crosses 50%; minimum 5400/3600/1800.
//  - 7th CPC TA: MoF OM No. 21/5/2017-E.II(B) dt 07.07.2017 & 02.08.2017 —
//    Annexure (higher TPTA) cities: L9+ 7200, L3–8 3600, L1–2 1350 (3600 if pay >= 24200);
//    other places: 3600 / 1800 / 900 (1800 if pay >= 24200). DA payable on TA.
//  - 6th CPC (w.e.f. 01.09.2008): HRA X/Y/Z = 30/20/10% of (pay + NPA);
//    TA A-1/A cities 3200 / 1600 / 600 (1600 if pay in PB >= 7440), other places 1600 / 800 / 400 (800).
//  - 5th CPC (w.e.f. 01.08.1997, Govt. Resolution No. 50(1)/IC/97): HRA A-1 30%, A/B-1/B-2 15%,
//    C 7.5%, Unclassified 5%; CCA A-1 90/125/200/300, A 65/95/150/240, B-1 45/65/100/180,
//    B-2 25/35/65/120 (nil in C / Unclassified); TA A-1/A cities 800/400/100.
import type { Rate } from "@/context/rates-context";

export type HraCityClass = "X" | "Y" | "Z";
export type TaCityType = "higher" | "other";
export type FifthCpcCityClass = "A-1" | "A" | "B-1" | "B-2" | "C" | "UC";

export const HRA_CITY_CLASSES: { value: HraCityClass; label: string }[] = [
  { value: "X", label: "X City" },
  { value: "Y", label: "Y City (Aligarh)" },
  { value: "Z", label: "Z City" },
];

export const TA_CITY_TYPES: { value: TaCityType; label: string }[] = [
  { value: "other", label: "Other places (Aligarh)" },
  { value: "higher", label: "Higher TA city" },
];

export const FIFTH_CPC_CITY_CLASSES: { value: FifthCpcCityClass; label: string }[] = [
  { value: "A-1", label: "A-1" },
  { value: "A", label: "A" },
  { value: "B-1", label: "B-1" },
  { value: "B-2", label: "B-2 (Aligarh)" },
  { value: "C", label: "C" },
  { value: "UC", label: "Unclassified" },
];

export interface CitySettings {
  hraCityClass: HraCityClass;
  taCityType: TaCityType;
  fifthCpcCityClass: FifthCpcCityClass;
}

/** Default = Aligarh. Old saved statements without city fields use this. */
export const DEFAULT_CITY_SETTINGS: CitySettings = {
  hraCityClass: "Y",
  taCityType: "other",
  fifthCpcCityClass: "B-2",
};

export const CITY_PRESETS: { id: string; label: string; settings: CitySettings }[] = [
  { id: "aligarh", label: "Aligarh (Default)", settings: DEFAULT_CITY_SETTINGS },
  { id: "delhi", label: "Delhi / Mumbai / Kolkata / Chennai", settings: { hraCityClass: "X", taCityType: "higher", fifthCpcCityClass: "A-1" } },
];

export const resolveCitySettings = (d: Partial<CitySettings> | undefined): CitySettings => ({
  hraCityClass: (d?.hraCityClass as HraCityClass) || DEFAULT_CITY_SETTINGS.hraCityClass,
  taCityType: (d?.taCityType as TaCityType) || DEFAULT_CITY_SETTINGS.taCityType,
  fifthCpcCityClass: (d?.fifthCpcCityClass as FifthCpcCityClass) || DEFAULT_CITY_SETTINGS.fifthCpcCityClass,
});

export const cityLabel = (c: CitySettings, includeFifth: boolean): string => {
  const ta = c.taCityType === "higher" ? "Higher TA City" : "Other Places";
  return `HRA: ${c.hraCityClass} City | TA: ${ta}` + (includeFifth ? ` | 5th CPC: ${c.fifthCpcCityClass === "UC" ? "Unclassified" : c.fifthCpcCityClass}` : "");
};

// ---------- 6th CPC ----------
export const DEFAULT_6TH_HRA_BY_CLASS: Record<HraCityClass, number> = { X: 30, Y: 20, Z: 10 };

// ---------- 5th CPC ----------
export const DEFAULT_5TH_HRA_BY_CLASS: Record<FifthCpcCityClass, number> = {
  "A-1": 30, A: 15, "B-1": 15, "B-2": 15, C: 7.5, UC: 5,
};

/** CCA slabs (revised pay): < 3000 | 3000–4499 | 4500–5999 | 6000 & above */
export const FIFTH_CPC_CCA_BY_CLASS: Record<FifthCpcCityClass, [number, number, number, number]> = {
  "A-1": [90, 125, 200, 300],
  A: [65, 95, 150, 240],
  "B-1": [45, 65, 100, 180],
  "B-2": [25, 35, 65, 120],
  C: [0, 0, 0, 0],
  UC: [0, 0, 0, 0],
};

// ---------- 7th CPC default master rows for the new classes ----------
const D = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const blank = { basicFrom: "", basicTo: "", daRateFrom: "", daRateTo: "", payLevelFrom: "", payLevelTo: "", minAmount: "" };

const hraRow = (cls: HraCityClass, i: number, rate: number, daFrom: number, daTo: number, min: number): Rate => ({
  ...blank,
  id: `default-hra-${cls}-${i}`,
  fromDate: D(2017, 7, 1),
  toDate: undefined,
  rate,
  daRateFrom: daFrom,
  daRateTo: daTo,
  minAmount: min,
  cityClass: cls,
});

export const defaultHraRowsFor = (cls: "X" | "Z"): Rate[] =>
  cls === "X"
    ? [hraRow("X", 0, 24, 0, 25, 5400), hraRow("X", 1, 27, 25, 50, 5400), hraRow("X", 2, 30, 50, 100, 5400)]
    : [hraRow("Z", 0, 8, 0, 25, 1800), hraRow("Z", 1, 9, 25, 50, 1800), hraRow("Z", 2, 10, 50, 100, 1800)];

const taRow = (i: number, rate: number, basicFrom: number, basicTo: number, lf: string, lt: string): Rate => ({
  ...blank,
  id: `default-ta-higher-${i}`,
  fromDate: D(2017, 7, 1),
  toDate: D(2030, 12, 31),
  rate,
  basicFrom,
  basicTo,
  payLevelFrom: lf,
  payLevelTo: lt,
  cityClass: "higher",
});

export const defaultHigherTaRows = (): Rate[] => [
  taRow(0, 1350, 18000, 24199, "1", "2"),
  taRow(1, 3600, 24200, 250000, "1", "2"),
  taRow(2, 3600, 18000, 250000, "3", "8"),
  taRow(3, 7200, 18000, 250000, "9", "15VC"),
];

/**
 * Existing master rows (no city class) are the Aligarh rates: HRA => "Y", TA => "other".
 * Adds official default rows for X / Z (HRA) and higher-TA cities when none exist yet.
 */
export const ensureCityRows = (hraRates: Rate[], taRates: Rate[]): { hraRates: Rate[]; taRates: Rate[] } => {
  const hra: Rate[] = hraRates.map((r) => ({ ...r, cityClass: r.cityClass || "Y" }));
  if (!hra.some((r) => r.cityClass === "X")) hra.push(...defaultHraRowsFor("X"));
  if (!hra.some((r) => r.cityClass === "Z")) hra.push(...defaultHraRowsFor("Z"));
  const ta: Rate[] = taRates.map((r) => ({ ...r, cityClass: r.cityClass || "other" }));
  if (!ta.some((r) => r.cityClass === "higher")) ta.push(...defaultHigherTaRows());
  return { hraRates: hra, taRates: ta };
};
