// Arrear Summary: pure logic (no React / Firebase) so it can be tested on its own.
//
// A summary picks saved arrear statements and totals them.
//  - Statements come in through an optional created-date range (a rule) plus manual
//    additions; any statement can be excluded:  included = (range ∪ added) − excluded.
//  - Unlocked summary: figures are always read LIVE from the current statements, so a
//    statement that is recalculated and saved again is reflected automatically.
//  - Locked summary: a snapshot taken at lock time is used, so the figures never change.
//    Rows whose statement changed (or was deleted) after locking are only flagged.
//  - Per statement: difference = due − drawn. Positive = arrear payable,
//    negative = recovery. Net payable = total arrear − total recovery.

export const SUMMARY_REASONS = [
  "MACP-I",
  "MACP-II",
  "MACP-III",
  "CAS",
  "Promotion",
  "Re-Fixation",
  "Pay Revision",
  "Increment",
  "DA Arrear",
] as const;

export const DEFAULT_PRINT_SETTINGS = {
  headingLine1: "Aligarh Muslim University",
  headingLine2: "Finance & Accounts Department (Salary Section)",
  signatories: [
    "Dealing Assistant",
    "Section Officer",
    "Assistant Finance Officer (Salary)",
    "Joint Finance Officer (Salary)",
  ],
};
export type SummaryPrintSettings = typeof DEFAULT_PRINT_SETTINGS;

export const resolvePrintSettings = (d: any): SummaryPrintSettings => {
  const sig = Array.isArray(d?.signatories)
    ? d.signatories.map((s: any) => String(s ?? "").trim()).filter(Boolean)
    : [];
  return {
    headingLine1: (typeof d?.headingLine1 === "string" && d.headingLine1.trim()) || DEFAULT_PRINT_SETTINGS.headingLine1,
    headingLine2: typeof d?.headingLine2 === "string" ? d.headingLine2.trim() : DEFAULT_PRINT_SETTINGS.headingLine2,
    signatories: sig.length ? sig.slice(0, 6) : DEFAULT_PRINT_SETTINGS.signatories,
  };
};

/** The parts of a saved statement a summary needs. */
export interface StatementLite {
  id: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  createdAt?: string;
  savedAt?: string;
  employeeInfo?: {
    employeeId?: string;
    employeeName?: string;
    designation?: string;
    department?: string;
    fromDate?: any;
    toDate?: any;
  };
  totals?: { drawn?: { total?: number }; due?: { total?: number }; difference?: number };
  /** saved pay fixation pages (counters kept on the statement) */
  payFixation?: { count?: number; bytes?: number; updatedAt?: string };
}

/** One summary line (also what is stored in a locked snapshot). */
export interface SummaryRowValue {
  statementId: string;
  userId: string;
  userName: string;
  userEmail: string;
  employeeId: string;
  employeeName: string;
  designation: string;
  department: string;
  fromDate: string; // YYYY-MM-DD or ""
  toDate: string;
  due: number;
  drawn: number;
  difference: number;
  version: string; // statement's savedAt when the value was taken
}

export interface SummaryRange {
  from: string; // YYYY-MM-DD ("" = open)
  to: string;
  userId: string; // "all" or a user id (admin); for a normal user always their own id
}

export interface ArrearSummary {
  id: string;
  title: string;
  reasons: string[];
  orderNo: string;
  remark: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  createdAt: string;
  updatedAt: string;
  range: SummaryRange | null;
  addedIds: string[];
  excludedIds: string[];
  rowReasons: Record<string, string>;
  groupByUser: boolean;
  layout: "detailed" | "totals";
  locked: boolean;
  lockedAt: string;
  lockedBy: string;
  snapshot: SummaryRowValue[];
}

export const emptySummary = (owner: { uid: string; name?: string; email?: string }): ArrearSummary => {
  const now = new Date().toISOString();
  return {
    id: "",
    title: "",
    reasons: [],
    orderNo: "",
    remark: "",
    ownerId: owner.uid,
    ownerName: owner.name || "",
    ownerEmail: owner.email || "",
    createdAt: now,
    updatedAt: now,
    range: null,
    addedIds: [],
    excludedIds: [],
    rowReasons: {},
    groupByUser: false,
    layout: "detailed",
    locked: false,
    lockedAt: "",
    lockedBy: "",
    snapshot: [],
  };
};

/** Makes a summary read from Firestore / JSON safe to use (old or partial docs). */
export const normalizeSummary = (d: any, id?: string): ArrearSummary => {
  const arr = (v: any) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  const str = (v: any) => (typeof v === "string" ? v : v == null ? "" : toIsoString(v));
  const range =
    d?.range && typeof d.range === "object"
      ? { from: str(d.range.from), to: str(d.range.to), userId: str(d.range.userId) || "all" }
      : null;
  return {
    id: id || str(d?.id),
    title: str(d?.title),
    reasons: arr(d?.reasons),
    orderNo: str(d?.orderNo),
    remark: str(d?.remark),
    ownerId: str(d?.ownerId),
    ownerName: str(d?.ownerName),
    ownerEmail: str(d?.ownerEmail),
    createdAt: str(d?.createdAt),
    updatedAt: str(d?.updatedAt),
    range: range && (range.from || range.to) ? range : null,
    addedIds: arr(d?.addedIds),
    excludedIds: arr(d?.excludedIds),
    rowReasons: d?.rowReasons && typeof d.rowReasons === "object" ? { ...d.rowReasons } : {},
    groupByUser: d?.groupByUser === true,
    layout: d?.layout === "totals" ? "totals" : "detailed",
    locked: d?.locked === true,
    lockedAt: str(d?.lockedAt),
    lockedBy: str(d?.lockedBy),
    snapshot: Array.isArray(d?.snapshot) ? d.snapshot.map(normalizeRowValue) : [],
  };
};

const num = (v: any) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
};

const normalizeRowValue = (r: any): SummaryRowValue => ({
  statementId: String(r?.statementId ?? ""),
  userId: String(r?.userId ?? ""),
  userName: String(r?.userName ?? ""),
  userEmail: String(r?.userEmail ?? ""),
  employeeId: String(r?.employeeId ?? ""),
  employeeName: String(r?.employeeName ?? ""),
  designation: String(r?.designation ?? ""),
  department: String(r?.department ?? ""),
  fromDate: String(r?.fromDate ?? ""),
  toDate: String(r?.toDate ?? ""),
  due: num(r?.due),
  drawn: num(r?.drawn),
  difference: num(r?.difference),
  version: String(r?.version ?? ""),
});

const pad = (n: number) => String(n).padStart(2, "0");

/** Any date-ish value (Date, ISO string, Firestore Timestamp / {seconds}) -> ISO string or "". */
export function toIsoString(v: any): string {
  if (!v) return "";
  if (v instanceof Date) return isNaN(v.getTime()) ? "" : v.toISOString();
  if (typeof v === "string") return v;
  if (typeof v?.toDate === "function") {
    const d = v.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d.toISOString() : "";
  }
  if (typeof v?.seconds === "number") return new Date(v.seconds * 1000).toISOString();
  return "";
}

/** Local calendar day (YYYY-MM-DD) of a date-ish value. A plain YYYY-MM-DD stays as is. */
export function toLocalYmd(v: any): string {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const iso = toIsoString(v);
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The day a statement was first saved (old statements have no createdAt, so savedAt). */
export const statementCreatedYmd = (s: StatementLite) => toLocalYmd(s.createdAt || s.savedAt);

export const inYmdRange = (ymd: string, from: string, to: string) => {
  if (!ymd) return false;
  if (from && ymd < from) return false;
  if (to && ymd > to) return false;
  return true;
};

export const toRowValue = (s: StatementLite): SummaryRowValue => {
  const e = s.employeeInfo || {};
  const due = num(s.totals?.due?.total);
  const drawn = num(s.totals?.drawn?.total);
  const diff = s.totals?.difference;
  return {
    statementId: s.id,
    userId: s.userId || "",
    userName: s.userName || "",
    userEmail: s.userEmail || "",
    employeeId: String(e.employeeId ?? ""),
    employeeName: String(e.employeeName ?? ""),
    designation: String(e.designation ?? ""),
    department: String(e.department ?? ""),
    fromDate: toLocalYmd(e.fromDate),
    toDate: toLocalYmd(e.toDate),
    due,
    drawn,
    difference: typeof diff === "number" || typeof diff === "string" ? num(diff) : due - drawn,
    version: s.savedAt || "",
  };
};

/** Ids that the range rule brings in. */
export function rangeMatchIds(statements: StatementLite[], range: SummaryRange | null): Set<string> {
  const out = new Set<string>();
  if (!range || (!range.from && !range.to)) return out;
  for (const s of statements) {
    if (range.userId && range.userId !== "all" && s.userId !== range.userId) continue;
    if (inYmdRange(statementCreatedYmd(s), range.from, range.to)) out.add(s.id);
  }
  return out;
}

export type RowSource = "range" | "added";

/** Resolves which statements are in an (unlocked) summary. */
export function resolveIncluded(summary: Pick<ArrearSummary, "range" | "addedIds" | "excludedIds">, statements: StatementLite[]) {
  const byId = new Map(statements.map((s) => [s.id, s]));
  const fromRange = rangeMatchIds(statements, summary.range);
  const excluded = new Set(summary.excludedIds);
  const source = new Map<string, RowSource>();
  fromRange.forEach((id) => source.set(id, "range"));
  for (const id of summary.addedIds) if (!source.has(id)) source.set(id, "added");
  const included: string[] = [];
  const missing: string[] = [];
  source.forEach((_, id) => {
    if (excluded.has(id)) return;
    if (byId.has(id)) included.push(id);
    else missing.push(id);
  });
  return { included, missing, fromRange, excluded, source };
}

/** Row toggle in the builder: works out the new added / excluded lists. */
export function toggleStatement(
  summary: Pick<ArrearSummary, "range" | "addedIds" | "excludedIds">,
  statements: StatementLite[],
  id: string,
  include: boolean
): { addedIds: string[]; excludedIds: string[] } {
  const inRange = rangeMatchIds(statements, summary.range).has(id);
  let added = summary.addedIds.filter((x) => x !== id);
  let excluded = summary.excludedIds.filter((x) => x !== id);
  if (include) {
    if (!inRange) added = [...added, id];
  } else if (inRange) {
    excluded = [...excluded, id];
  }
  return { addedIds: added, excludedIds: excluded };
}

export interface SummaryRow extends SummaryRowValue {
  reason: string;
  source: RowSource | "snapshot";
  /** Locked summary only: the statement was changed or deleted after locking. */
  changedSinceLock: boolean;
  deletedSinceLock: boolean;
  liveDifference: number | null;
}

export const reasonText = (summary: Pick<ArrearSummary, "reasons">) => summary.reasons.join(", ");

const rowReason = (summary: Pick<ArrearSummary, "reasons" | "rowReasons">, id: string) =>
  (summary.rowReasons?.[id] || "").trim() || reasonText(summary);

const sortRows = <T extends SummaryRowValue>(rows: T[], byUser: boolean) =>
  [...rows].sort((a, b) => {
    if (byUser) {
      const u = (a.userName || a.userEmail || a.userId).localeCompare(b.userName || b.userEmail || b.userId);
      if (u) return u;
    }
    return (
      a.employeeName.localeCompare(b.employeeName) ||
      a.employeeId.localeCompare(b.employeeId) ||
      a.fromDate.localeCompare(b.fromDate)
    );
  });

/** The rows of a summary: snapshot when locked, live statement values otherwise. */
export function computeSummaryRows(summary: ArrearSummary, statements: StatementLite[]): { rows: SummaryRow[]; missing: string[] } {
  const byId = new Map(statements.map((s) => [s.id, s]));
  if (summary.locked) {
    const rows = summary.snapshot.map<SummaryRow>((snap) => {
      const live = byId.get(snap.statementId);
      const liveVal = live ? toRowValue(live) : null;
      return {
        ...snap,
        reason: rowReason(summary, snap.statementId),
        source: "snapshot",
        deletedSinceLock: statements.length > 0 && !live,
        changedSinceLock: !!liveVal && (liveVal.difference !== snap.difference || liveVal.due !== snap.due || liveVal.drawn !== snap.drawn),
        liveDifference: liveVal ? liveVal.difference : null,
      };
    });
    return { rows: sortRows(rows, summary.groupByUser), missing: [] };
  }
  const { included, missing, source } = resolveIncluded(summary, statements);
  const rows = included.map<SummaryRow>((id) => ({
    ...toRowValue(byId.get(id)!),
    reason: rowReason(summary, id),
    source: source.get(id) || "added",
    changedSinceLock: false,
    deletedSinceLock: false,
    liveDifference: null,
  }));
  return { rows: sortRows(rows, summary.groupByUser), missing };
}

/** Values to freeze when a summary is locked. */
export const buildSnapshot = (summary: ArrearSummary, statements: StatementLite[]): SummaryRowValue[] =>
  computeSummaryRows({ ...summary, locked: false }, statements).rows.map((r) => normalizeRowValue(r));

export interface SummaryTotals {
  count: number;
  due: number;
  drawn: number;
  arrear: number;
  recovery: number;
  net: number;
}

export function totalsOf(rows: Pick<SummaryRowValue, "due" | "drawn" | "difference">[]): SummaryTotals {
  const t: SummaryTotals = { count: 0, due: 0, drawn: 0, arrear: 0, recovery: 0, net: 0 };
  for (const r of rows) {
    t.count++;
    t.due += r.due;
    t.drawn += r.drawn;
    if (r.difference >= 0) t.arrear += r.difference;
    else t.recovery += -r.difference;
  }
  t.net = t.arrear - t.recovery;
  return t;
}

export interface UserGroup<T extends SummaryRowValue = SummaryRow> {
  key: string;
  userName: string;
  userEmail: string;
  rows: T[];
  totals: SummaryTotals;
}

export function groupRowsByUser<T extends SummaryRowValue>(rows: T[]): UserGroup<T>[] {
  const map = new Map<string, UserGroup<T>>();
  for (const r of rows) {
    const key = r.userId || r.userEmail || "(unknown)";
    if (!map.has(key)) map.set(key, { key, userName: r.userName, userEmail: r.userEmail, rows: [], totals: totalsOf([]) });
    map.get(key)!.rows.push(r);
  }
  const groups = [...map.values()];
  groups.forEach((g) => (g.totals = totalsOf(g.rows)));
  return groups.sort((a, b) => (a.userName || a.userEmail).localeCompare(b.userName || b.userEmail));
}

/** For each statement id, the titles of OTHER summaries that include it. */
export function statementUsage(summaries: ArrearSummary[], statements: StatementLite[], exceptId?: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const s of summaries) {
    if (exceptId && s.id === exceptId) continue;
    const ids = s.locked ? s.snapshot.map((r) => r.statementId) : resolveIncluded(s, statements).included;
    for (const id of ids) {
      if (!out.has(id)) out.set(id, []);
      out.get(id)!.push(s.title || "Untitled summary");
    }
  }
  return out;
}

// ---------------- amounts ----------------
export const formatINR = (n: number) => Math.round(n).toLocaleString("en-IN");

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const twoDigits = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`);
const threeDigits = (n: number) => {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? twoDigits(r) : ""].filter(Boolean).join(" ");
};

/** Indian numbering: 1234567 -> "Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Only". */
export function amountInWords(value: number): string {
  let n = Math.floor(Math.abs(Math.round(value)));
  if (n === 0) return "Zero Only";
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${crore >= 100 ? amountInWords(crore).replace(/ Only$/, "") : twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  return `${parts.join(" ").replace(/\s+/g, " ").trim()} Only`;
}

// ---------------- CSV ----------------
const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const ymdToDisplay = (ymd: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};

export function summaryToCsv(summary: ArrearSummary, rows: SummaryRow[], showUser: boolean): string {
  const head = ["S.No", ...(showUser ? ["User", "User Email"] : []), "Employee ID", "Employee Name", "Designation", "Department", "From", "To", "Reason", "Arrear (Rs.)", "Recovery (Rs.)"];
  const lines = [head.map(csvCell).join(",")];
  rows.forEach((r, i) => {
    lines.push(
      [
        i + 1,
        ...(showUser ? [r.userName, r.userEmail] : []),
        r.employeeId,
        r.employeeName,
        r.designation,
        r.department,
        ymdToDisplay(r.fromDate),
        ymdToDisplay(r.toDate),
        r.reason,
        r.difference > 0 ? r.difference : 0,
        r.difference < 0 ? -r.difference : 0,
      ]
        .map(csvCell)
        .join(",")
    );
  });
  const t = totalsOf(rows);
  const pre = showUser ? 2 : 0;
  const blank = (k: number) => Array(k).fill("");
  lines.push(["", ...blank(pre), "", "TOTAL", "", "", "", "", "", t.arrear, t.recovery].map(csvCell).join(","));
  lines.push(["", ...blank(pre), "", "NET PAYABLE", "", "", "", "", "", t.net, ""].map(csvCell).join(","));
  const meta = [`Summary,${csvCell(summary.title)}`, `Reason,${csvCell(reasonText(summary))}`];
  if (summary.orderNo) meta.push(`Order / Ref,${csvCell(summary.orderNo)}`);
  return "﻿" + [...meta, "", ...lines].join("\r\n");
}
