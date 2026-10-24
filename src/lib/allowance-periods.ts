// Allowance periods that are shorter than the arrear period (HRA, NPA, TA, Other).
// Printed above the statement table as e.g. "HRA (Due): 01/04/2024 to 30/09/2026".
//
// Rule: an allowance is shown only when it has its own from / to date AND that
// period is shorter than the arrear period. No date, or a date equal to the arrear
// period, means "as it is" and nothing is printed.

import { startOfDay, format } from "date-fns";

type AnyDate = Date | string | number | null | undefined;

const toDay = (v: AnyDate): Date | null => {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : startOfDay(d);
};

/** Only the fields this helper reads (a subset of the statement form data). */
export interface AllowanceSide {
  hraApplicable?: boolean;
  hraFromDate?: AnyDate;
  hraToDate?: AnyDate;
  npaApplicable?: boolean;
  npaFromDate?: AnyDate;
  npaToDate?: AnyDate;
  taApplicable?: boolean;
  taFromDate?: AnyDate;
  taToDate?: AnyDate;
  otherAllowance?: number | string | null;
  otherAllowanceName?: string;
  otherAllowanceFromDate?: AnyDate;
  otherAllowanceToDate?: AnyDate;
}

export interface AllowancePeriodNote {
  label: string; // "HRA", "NPA", "TA", or the other allowance's name
  side: "Drawn" | "Due";
  from: Date;
  to: Date;
}

export interface ArrearPeriodForm {
  fromDate?: AnyDate;
  toDate?: AnyDate;
  paid?: AllowanceSide;
  toBePaid?: AllowanceSide;
}

const sideNotes = (side: AllowanceSide | undefined, periodFrom: Date, periodTo: Date, which: "Drawn" | "Due"): AllowancePeriodNote[] => {
  if (!side) return [];
  const out: AllowancePeriodNote[] = [];
  const check = (label: string, from: AnyDate, to: AnyDate) => {
    const f = toDay(from);
    const t = toDay(to);
    if (!f && !t) return; // no date entered: printed as it is
    const effFrom = f ?? periodFrom;
    const effTo = t ?? periodTo;
    if (effFrom.getTime() > periodFrom.getTime() || effTo.getTime() < periodTo.getTime()) {
      out.push({ label, side: which, from: effFrom, to: effTo });
    }
  };
  if (side.hraApplicable !== false) check("HRA", side.hraFromDate, side.hraToDate);
  if (side.npaApplicable === true) check("NPA", side.npaFromDate, side.npaToDate);
  if (side.taApplicable === true) check("TA", side.taFromDate, side.taToDate);
  if (Number(side.otherAllowance) > 0) {
    check((side.otherAllowanceName || "").trim() || "Other Allowance", side.otherAllowanceFromDate, side.otherAllowanceToDate);
  }
  return out;
};

/** Notes for one arrear period (both Drawn and Due sides). Empty when nothing is shorter. */
export function allowancePeriodNotes(form: ArrearPeriodForm | null | undefined): AllowancePeriodNote[] {
  if (!form) return [];
  const periodFrom = toDay(form.fromDate);
  const periodTo = toDay(form.toDate);
  if (!periodFrom || !periodTo) return [];
  return [
    ...sideNotes(form.toBePaid, periodFrom, periodTo, "Due"),
    ...sideNotes(form.paid, periodFrom, periodTo, "Drawn"),
  ].sort((a, b) => (a.side === b.side ? 0 : a.side === "Due" ? -1 : 1));
}

/** "HRA (Due): 01/04/2024 to 30/09/2026" */
export const allowanceNoteText = (n: AllowancePeriodNote) =>
  `${n.label} (${n.side}): ${format(n.from, "dd/MM/yyyy")} to ${format(n.to, "dd/MM/yyyy")}`;
