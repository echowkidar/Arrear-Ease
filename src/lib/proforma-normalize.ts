// Server-side checks on the AI's reading of a "Proforma for Fixation of Pay".
// The vision model sometimes (a) reads Indian dates DD.MM.YYYY as MM.DD.YYYY
// (01.07.2024 -> 7 Jan 2024) and (b) invents a "re-fixed" pay (often the existing
// basic pay) when Section 12(a) is not in the document. Fix both deterministically.

const pad = (n: number) => String(n).padStart(2, "0");

const isValidYmd = (y: number, m: number, d: number) => {
  if (y < 1950 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

/** Parses a date exactly as printed on an Indian document (day first). Returns YYYY-MM-DD or "". */
export function parseIndianDate(text: unknown): string {
  if (typeof text !== "string") return "";
  const t = text.trim();
  // Already ISO (YYYY-MM-DD) — check first so "2024-01-07" is not read as 24-01-07
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return isValidYmd(+m[1], +m[2], +m[3]) ? `${m[1]}-${pad(+m[2])}-${pad(+m[3])}` : "";
  // DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY (also 2-digit years)
  m = t.match(/(?<!\d)(\d{1,2})\s*[.\/\-]\s*(\d{1,2})\s*[.\/\-]\s*(\d{4}|\d{2})(?!\d)/);
  if (m) {
    const d = +m[1], mo = +m[2];
    let y = +m[3];
    if (m[3].length === 2) y += y >= 50 ? 1900 : 2000;
    return isValidYmd(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : "";
  }
  return "";
}

/**
 * For an ISO date coming from the model (no printed text available): pay fixation,
 * re-fixation and increments almost always fall on the 1st of a month, so a date
 * like 2024-01-07 is the classic day/month swap of 01.07.2024 -> correct it.
 */
export function fixLikelySwappedIso(iso: unknown): string {
  const p = parseIndianDate(typeof iso === "string" ? iso : "");
  if (!p) return "";
  const [y, mo, d] = p.split("-").map(Number);
  if (d !== 1 && d <= 12 && mo === 1 && isValidYmd(y, d, mo)) {
    return `${y}-${pad(d)}-${pad(mo)}`;
  }
  return p;
}

const pickDate = (printed: unknown, iso: unknown): string => parseIndianDate(printed) || fixLikelySwappedIso(iso);

const num = (v: unknown): number => {
  const m = typeof v === "number" ? null : String(v ?? "").replace(/,/g, "").match(/\d+(\.\d+)?/);
  const n = typeof v === "number" ? v : m ? parseFloat(m[0]) : NaN;
  return Number.isFinite(n) ? Math.round(n) : 0;
};

export interface NormalizeNotes { corrections: string[] }

export function normalizeProformaExtraction(raw: any): { data: any; notes: NormalizeNotes } {
  const data = raw && typeof raw === "object" ? { ...raw } : {};
  const notes: NormalizeNotes = { corrections: [] };
  data.paid = data.paid && typeof data.paid === "object" ? { ...data.paid } : {};
  data.toBePaid = data.toBePaid && typeof data.toBePaid === "object" ? { ...data.toBePaid } : {};

  // From date: prefer the date exactly as printed (day first)
  const from = pickDate(data.fromDateText, data.fromDate);
  if (from !== (data.fromDate || "")) notes.corrections.push(`fromDate ${data.fromDate || "(empty)"} -> ${from || "(empty)"}`);
  data.fromDate = from;

  const paidBasic = num(data.paid.basicPay);
  const dueBasic = num(data.toBePaid.basicPay);
  const hasSection = data.hasRefixationSection === true || data.hasRefixationSection === "true";

  for (const key of ["toBePaid", "paid"] as const) {
    const side = data[key];
    const amount = num(side.refixedBasicPay);
    const date = pickDate(side.refixedBasicPayDateText, side.refixedBasicPayDate);
    let reason = "";
    if (amount > 0) {
      if (!hasSection) reason = "no Section 12(a) re-fixation in the document";
      else if (amount === paidBasic) reason = "same as existing (already paid) basic pay";
      else if (amount === dueBasic) reason = "same as pay in the upgraded level";
      else if (!date) reason = "no valid re-fixation date";
    }
    if (amount > 0 && !reason) {
      side.refixedBasicPay = amount;
      side.refixedBasicPayDate = date;
    } else {
      if (amount > 0) notes.corrections.push(`${key}.refixedBasicPay ${amount} removed (${reason})`);
      side.refixedBasicPay = 0;
      side.refixedBasicPayDate = "";
    }
    delete side.refixedBasicPayDateText;
  }
  delete data.fromDateText;
  delete data.hasRefixationSection;
  return { data, notes };
}
