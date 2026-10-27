// Firestore access for Arrear Summaries. Kept apart from the page so it is easy to
// test and the page stays UI-only. Access rules (firestore.rules):
//  - savedStatements: admin reads all, a user reads only their own.
//  - arrearSummaries: admin reads/writes all, a user only their own (ownerId).
//  - configurations/summary_print_settings: everyone reads, admin writes.
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  normalizeSummary,
  resolvePrintSettings,
  toIsoString,
  type ArrearSummary,
  type StatementLite,
  type SummaryPrintSettings,
} from "@/lib/summary-engine";

const STATEMENTS = "savedStatements";
const SUMMARIES = "arrearSummaries";
const PRINT_SETTINGS_DOC = ["configurations", "summary_print_settings"] as const;

const need = () => {
  if (!db) throw new Error("Database is not configured.");
  return db;
};

const toStatementLite = (id: string, d: any): StatementLite => ({
  id,
  userId: d?.userId,
  userName: d?.userName,
  userEmail: d?.userEmail,
  createdAt: toIsoString(d?.createdAt),
  savedAt: toIsoString(d?.savedAt),
  employeeInfo: {
    employeeId: d?.employeeInfo?.employeeId,
    employeeName: d?.employeeInfo?.employeeName,
    designation: d?.employeeInfo?.designation,
    department: d?.employeeInfo?.department,
    salaryRegisterNo: d?.employeeInfo?.salaryRegisterNo,
    appointedAs: d?.employeeInfo?.appointedAs,
    fromDate: toIsoString(d?.employeeInfo?.fromDate),
    toDate: toIsoString(d?.employeeInfo?.toDate),
  },
  totals: d?.totals,
  payFixation: d?.payFixation
    ? { count: Number(d.payFixation.count) || 0, bytes: Number(d.payFixation.bytes) || 0, updatedAt: d.payFixation.updatedAt || "" }
    : undefined,
});

export async function fetchStatementsFor(uid: string, isAdmin: boolean): Promise<StatementLite[]> {
  const fs = need();
  const q = isAdmin ? collection(fs, STATEMENTS) : query(collection(fs, STATEMENTS), where("userId", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toStatementLite(d.id, d.data()));
}

export async function fetchSummariesFor(uid: string, isAdmin: boolean): Promise<ArrearSummary[]> {
  const fs = need();
  const q = isAdmin ? collection(fs, SUMMARIES) : query(collection(fs, SUMMARIES), where("ownerId", "==", uid));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => normalizeSummary(d.data(), d.id))
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export async function saveSummaryDoc(summary: ArrearSummary): Promise<ArrearSummary> {
  const fs = need();
  const id = summary.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  const toSave: ArrearSummary = { ...summary, id, updatedAt: new Date().toISOString() };
  // Firestore rejects undefined values; the summary only holds plain JSON values.
  await setDoc(doc(fs, SUMMARIES, id), JSON.parse(JSON.stringify(toSave)));
  return toSave;
}

export async function deleteSummaryDoc(id: string): Promise<void> {
  await deleteDoc(doc(need(), SUMMARIES, id));
}

export async function fetchUsers(): Promise<{ uid: string; displayName: string; email: string }[]> {
  const snap = await getDocs(collection(need(), "users"));
  return snap.docs.map((d) => {
    const x = d.data() as any;
    return { uid: d.id, displayName: x.displayName || x.name || "", email: x.email || "" };
  });
}

export async function fetchPrintSettings(): Promise<SummaryPrintSettings> {
  try {
    if (!db) return resolvePrintSettings(null);
    const snap = await getDoc(doc(db, ...PRINT_SETTINGS_DOC));
    return resolvePrintSettings(snap.exists() ? snap.data() : null);
  } catch {
    return resolvePrintSettings(null);
  }
}

export async function savePrintSettings(s: SummaryPrintSettings): Promise<void> {
  await setDoc(doc(need(), ...PRINT_SETTINGS_DOC), { ...resolvePrintSettings(s), updatedAt: new Date().toISOString() });
}
