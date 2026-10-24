// "Appointed / Promoted as" (item 5 of the Pay Fixation proforma), e.g. "Professor (CAS)".
// Pure helpers, no React / Firebase.

/** Common values offered in the dropdown (the field also accepts any typed text). */
export const APPOINTED_OPTIONS = [
  "Professor (CAS)",
  "Associate Professor (CAS)",
  "Assistant Professor (CAS)",
  "Professor (Promotion)",
  "Associate Professor (Promotion)",
  "Assistant Professor (Promotion)",
  "MACP-I",
  "MACP-II",
  "MACP-III",
] as const;

const ROMAN: Record<string, string> = { "1": "I", "2": "II", "3": "III" };

/**
 * Short form for the summary Reason column.
 *  "Professor (CAS)"            -> "CAS"
 *  "Associate Professor (Promotion)" -> "Prom."
 *  "MACP-II" / "MACP 2"          -> "MACP-II"
 * Text with no known keyword is returned as typed (so nothing is lost).
 */
export function shortAppointedReason(text: unknown): string {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const macp = t.match(/MACP\s*[-–]?\s*(III|II|I|3|2|1)(?![a-z])/i);
  if (macp) {
    const n = macp[1].toUpperCase();
    return `MACP-${ROMAN[n] || n}`;
  }
  if (/\bMACP\b/i.test(t)) return "MACP";
  if (/\bCAS\b/i.test(t)) return "CAS";
  if (/prom/i.test(t)) return "Prom.";
  return t;
}
