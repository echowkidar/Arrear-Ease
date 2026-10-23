"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarRange,
  CheckSquare,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Settings,
  Square,
  Trash2,
  Unlock,
  X,
  AlertTriangle,
  Paperclip,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { SummaryPrint } from "@/components/summary-print";
import { usePayFixationOpener } from "@/components/pay-fixation-opener";
import {
  SUMMARY_REASONS,
  DEFAULT_PRINT_SETTINGS,
  buildSnapshot,
  computeSummaryRows,
  emptySummary,
  formatINR,
  rangeMatchIds,
  reasonText,
  resolveIncluded,
  statementCreatedYmd,
  statementUsage,
  summaryToCsv,
  toRowValue,
  toggleStatement,
  totalsOf,
  ymdToDisplay,
  type ArrearSummary,
  type StatementLite,
  type SummaryPrintSettings,
} from "@/lib/summary-engine";
import {
  deleteSummaryDoc,
  fetchPrintSettings,
  fetchStatementsFor,
  fetchSummariesFor,
  fetchUsers,
  savePrintSettings,
  saveSummaryDoc,
} from "@/lib/summary-data";

const ADMIN_EMAIL = "amulivealigarh@gmail.com";

type AppUser = { uid: string; displayName: string; email: string };
type ShowFilter = "all" | "included" | "notIncluded";

const isoToDisplay = (iso: string) => {
  const d = new Date(iso);
  if (!iso || isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};

const Money = ({ v, className = "" }: { v: number; className?: string }) => (
  <span className={`tabular-nums ${className}`}>Rs. {formatINR(v)}</span>
);

export default function SummariesPage() {
  const { user, authStatus } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;
  const { toast } = useToast();
  const pfError = React.useCallback((msg: string) => toast({ variant: "destructive", title: msg }), [toast]);
  const pfOpener = usePayFixationOpener(user?.uid || "", isAdmin, pfError);
  const openPf = (id: string, name: string, empId: string) =>
    pfOpener.openFor(id, `${name || "Employee"}${empId ? ` (${empId})` : ""}`, `${empId}_${name}`);
  const pfCount = (id: string) => statements.find((s) => s.id === id)?.payFixation?.count || 0;

  const [statements, setStatements] = React.useState<StatementLite[]>([]);
  const [summaries, setSummaries] = React.useState<ArrearSummary[]>([]);
  const [users, setUsers] = React.useState<AppUser[]>([]);
  const [printSettings, setPrintSettings] = React.useState<SummaryPrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const [draft, setDraft] = React.useState<ArrearSummary | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [printTarget, setPrintTarget] = React.useState<ArrearSummary | null>(null);

  // builder controls (not saved)
  const [search, setSearch] = React.useState("");
  const [userFilter, setUserFilter] = React.useState("all");
  const [showFilter, setShowFilter] = React.useState<ShowFilter>("all");
  const [rangeFrom, setRangeFrom] = React.useState("");
  const [rangeTo, setRangeTo] = React.useState("");
  const [rangeUser, setRangeUser] = React.useState("all");
  const [customReason, setCustomReason] = React.useState("");

  // dialogs
  const [toDelete, setToDelete] = React.useState<ArrearSummary | null>(null);
  const [confirmUnlock, setConfirmUnlock] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [settingsDraft, setSettingsDraft] = React.useState({ headingLine1: "", headingLine2: "", signatories: "" });

  const load = React.useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setLoadError("");
    // Each part loads on its own, so one failure (e.g. summaries rules not yet
    // published) does not hide the statements.
    const [st, sm, ps, us] = await Promise.allSettled([
      fetchStatementsFor(user.uid, isAdmin),
      fetchSummariesFor(user.uid, isAdmin),
      fetchPrintSettings(),
      isAdmin ? fetchUsers() : Promise.resolve([] as AppUser[]),
    ]);
    const problems: string[] = [];
    const isPerm = (r: PromiseRejectedResult) => /permission/i.test(String(r.reason?.code || r.reason?.message || ""));
    if (st.status === "fulfilled") setStatements(st.value);
    else {
      console.error("Statements load failed:", st.reason);
      problems.push(`Saved statements could not be loaded (${st.reason?.message || "error"}).`);
    }
    if (sm.status === "fulfilled") setSummaries(sm.value);
    else {
      console.error("Summaries load failed:", sm.reason);
      problems.push(
        isPerm(sm)
          ? "Saved summaries could not be loaded: the database rules for Arrear Summaries are not published yet. Publish the latest firestore.rules in Firebase Console → Firestore → Rules."
          : `Saved summaries could not be loaded (${sm.reason?.message || "error"}).`
      );
    }
    if (ps.status === "fulfilled") setPrintSettings(ps.value);
    if (us.status === "fulfilled") setUsers(us.value);
    setLoadError(problems.join(" "));
    setLoading(false);
  }, [user?.uid, isAdmin]);

  React.useEffect(() => {
    if (authStatus === "authenticated") load();
    else if (authStatus !== "loading") setLoading(false);
  }, [authStatus, load]);

  // ---------- derived ----------
  const userLabel = React.useCallback(
    (uid: string, fallbackName?: string, fallbackEmail?: string) => {
      const u = users.find((x) => x.uid === uid);
      return u?.displayName || fallbackName || u?.email || fallbackEmail || "Unknown";
    },
    [users]
  );

  const userOptions = React.useMemo(() => {
    const m = new Map<string, string>();
    statements.forEach((s) => s.userId && m.set(s.userId, userLabel(s.userId, s.userName, s.userEmail)));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [statements, userLabel]);

  const computed = React.useMemo(() => (draft ? computeSummaryRows(draft, statements) : null), [draft, statements]);
  const draftTotals = React.useMemo(() => totalsOf(computed?.rows || []), [computed]);
  const resolved = React.useMemo(() => (draft ? resolveIncluded(draft, statements) : null), [draft, statements]);
  const includedSet = React.useMemo(() => new Set(resolved?.included || []), [resolved]);
  const usage = React.useMemo(() => statementUsage(summaries, statements, draft?.id || undefined), [summaries, statements, draft?.id]);

  const visibleStatements = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return statements
      .filter((s) => (userFilter === "all" ? true : s.userId === userFilter))
      .filter((s) => {
        if (showFilter === "included") return includedSet.has(s.id);
        if (showFilter === "notIncluded") return !includedSet.has(s.id);
        return true;
      })
      .filter((s) => {
        if (!q) return true;
        const e = s.employeeInfo || {};
        return [e.employeeName, e.employeeId, e.designation, e.department, s.userName, s.userEmail]
          .some((v) => String(v ?? "").toLowerCase().includes(q));
      })
      .sort((a, b) => (b.createdAt || b.savedAt || "").localeCompare(a.createdAt || a.savedAt || ""));
  }, [statements, userFilter, showFilter, search, includedSet]);

  const printData = React.useMemo(() => {
    const target = printTarget || draft;
    return target ? { summary: target, rows: computeSummaryRows(target, statements).rows } : null;
  }, [printTarget, draft, statements]);

  // ---------- draft editing ----------
  const update = (patch: Partial<ArrearSummary>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
  };

  const openDraft = (s: ArrearSummary) => {
    setDraft(s);
    setDirty(false);
    setSearch("");
    setUserFilter("all");
    setShowFilter(s.id ? "included" : "all");
    setRangeFrom(s.range?.from || "");
    setRangeTo(s.range?.to || "");
    setRangeUser(s.range?.userId || "all");
    setCustomReason("");
    window.scrollTo({ top: 0 });
  };

  const newSummary = () =>
    openDraft(emptySummary({ uid: user!.uid, name: user?.displayName || "", email: user?.email || "" }));

  const duplicate = (s: ArrearSummary) => {
    const copy = {
      ...emptySummary({ uid: user!.uid, name: user?.displayName || "", email: user?.email || "" }),
      title: `${s.title || "Summary"} (copy)`,
      reasons: [...s.reasons],
      orderNo: s.orderNo,
      remark: s.remark,
      groupByUser: s.groupByUser,
      layout: s.layout,
      range: s.locked ? null : s.range,
      // a copy of a locked summary starts with the same statements, as live values
      addedIds: s.locked ? s.snapshot.map((r) => r.statementId) : [...s.addedIds],
      excludedIds: s.locked ? [] : [...s.excludedIds],
      rowReasons: { ...s.rowReasons },
    };
    openDraft(copy);
    setDirty(true);
  };

  const toggleReason = (r: string) => {
    if (!draft) return;
    update({ reasons: draft.reasons.includes(r) ? draft.reasons.filter((x) => x !== r) : [...draft.reasons, r] });
  };

  const addCustomReason = () => {
    const r = customReason.trim();
    if (!draft || !r) return;
    if (!draft.reasons.includes(r)) update({ reasons: [...draft.reasons, r] });
    setCustomReason("");
  };

  const setIncluded = (ids: string[], include: boolean) => {
    if (!draft) return;
    let cur = { range: draft.range, addedIds: draft.addedIds, excludedIds: draft.excludedIds };
    for (const id of ids) cur = { ...cur, ...toggleStatement(cur, statements, id, include) };
    update({ addedIds: cur.addedIds, excludedIds: cur.excludedIds });
  };

  const applyRange = () => {
    if (!draft) return;
    if (!rangeFrom && !rangeTo) {
      toast({ variant: "destructive", title: "Select dates", description: "Enter a From date and/or a To date." });
      return;
    }
    if (rangeFrom && rangeTo && rangeFrom > rangeTo) {
      toast({ variant: "destructive", title: "Wrong range", description: "From date is after To date." });
      return;
    }
    const range = { from: rangeFrom, to: rangeTo, userId: isAdmin ? rangeUser : user!.uid };
    const matched = rangeMatchIds(statements, range);
    // manual additions now covered by the range are no longer "extra"
    update({ range, addedIds: draft.addedIds.filter((id) => !matched.has(id)) });
    setShowFilter("all");
    toast({ title: "Date range applied", description: `${matched.size} statement(s) found in this range.` });
  };

  const removeRange = () => {
    if (!draft) return;
    update({ range: null, excludedIds: [] });
    setRangeFrom("");
    setRangeTo("");
  };

  const setRowReason = (id: string, reason: string) => {
    if (!draft) return;
    const rr = { ...draft.rowReasons };
    if (reason) rr[id] = reason;
    else delete rr[id];
    update({ rowReasons: rr });
  };

  // ---------- save / lock ----------
  const persist = async (s: ArrearSummary, message: string) => {
    setSaving(true);
    try {
      const saved = await saveSummaryDoc(s);
      setSummaries((list) => [saved, ...list.filter((x) => x.id !== saved.id)]);
      setDraft(saved);
      setDirty(false);
      toast({ title: message });
      return saved;
    } catch (e: any) {
      console.error("Summary save failed:", e);
      toast({
        variant: "destructive",
        title: "Could not save",
        description: /permission/i.test(String(e?.code || e?.message || ""))
          ? "Database rules for Arrear Summaries are not published yet (firestore.rules)."
          : e?.message || "Please try again.",
      });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const validate = (s: ArrearSummary) => {
    if (!s.title.trim()) {
      toast({ variant: "destructive", title: "Title required", description: "Give the summary a title (e.g. MACP-II arrear, Oct 2026)." });
      return false;
    }
    return true;
  };

  const handleSave = () => {
    if (!draft || !validate(draft)) return;
    persist({ ...draft, title: draft.title.trim() }, "Summary saved");
  };

  const handleLock = () => {
    if (!draft || !validate(draft)) return;
    if (!computed?.rows.length) {
      toast({ variant: "destructive", title: "Nothing to lock", description: "Include at least one statement." });
      return;
    }
    persist(
      {
        ...draft,
        title: draft.title.trim(),
        locked: true,
        lockedAt: new Date().toISOString(),
        lockedBy: user?.email || "",
        snapshot: buildSnapshot(draft, statements),
      },
      "Summary locked — figures are now frozen"
    );
  };

  const handleUnlock = () => {
    if (!draft) return;
    setConfirmUnlock(false);
    persist(
      {
        ...draft,
        locked: false,
        lockedAt: "",
        lockedBy: "",
        snapshot: [],
        // keep exactly the locked statements; a range would bring new ones in
        range: null,
        addedIds: draft.snapshot.map((r) => r.statementId),
        excludedIds: [],
      },
      "Summary unlocked — figures are live again"
    );
  };

  const handleDelete = async () => {
    const s = toDelete;
    setToDelete(null);
    if (!s) return;
    try {
      await deleteSummaryDoc(s.id);
      setSummaries((list) => list.filter((x) => x.id !== s.id));
      if (draft?.id === s.id) setDraft(null);
      toast({ title: "Summary deleted" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not delete", description: e?.message || "" });
    }
  };

  const closeEditor = (force = false) => {
    if (dirty && !force) {
      setConfirmClose(true);
      return;
    }
    setConfirmClose(false);
    setDraft(null);
    setDirty(false);
  };

  // ---------- print / export ----------
  const printSummary = (s: ArrearSummary) => {
    setPrintTarget(s);
    setTimeout(() => {
      window.print();
      setPrintTarget(null);
    }, 80);
  };

  const exportCsv = (s: ArrearSummary) => {
    const rows = computeSummaryRows(s, statements).rows;
    const csv = summaryToCsv(s, rows, isAdmin);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(s.title || "arrear-summary").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "arrear-summary"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // ---------- heading settings ----------
  const openSettings = () => {
    setSettingsDraft({
      headingLine1: printSettings.headingLine1,
      headingLine2: printSettings.headingLine2,
      signatories: printSettings.signatories.join("\n"),
    });
    setSettingsOpen(true);
  };

  const saveSettings = async () => {
    const next = {
      headingLine1: settingsDraft.headingLine1,
      headingLine2: settingsDraft.headingLine2,
      signatories: settingsDraft.signatories.split("\n"),
    };
    try {
      await savePrintSettings(next as SummaryPrintSettings);
      setPrintSettings(await fetchPrintSettings());
      setSettingsOpen(false);
      toast({ title: "Print heading saved" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not save", description: e?.message || "" });
    }
  };

  // ---------- render ----------
  if (authStatus === "loading" || (loading && authStatus === "authenticated" && !statements.length && !loadError)) {
    return (
      <main className="container mx-auto px-4 py-16 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  if (authStatus !== "authenticated" || !user) {
    return (
      <main className="container mx-auto px-4 py-16 max-w-lg text-center space-y-4">
        <h1 className="text-2xl font-bold">Arrear Summaries</h1>
        <p className="text-muted-foreground">Please sign in on the calculator page to make summaries of your saved arrear statements.</p>
        <Button asChild><Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Calculator</Link></Button>
      </main>
    );
  }

  const locked = !!draft?.locked;

  return (
    <>
      <main className="container mx-auto px-3 sm:px-4 py-6 md:py-10 space-y-6 no-print pb-52 sm:pb-32">
        <header className="space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Calculator</Link>
            </Button>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={openSettings}>
                  <Settings className="h-4 w-4 mr-1.5" /> Print Heading
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
              <ThemeToggle />
            </div>
          </div>
          <div className="text-center">
            <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">Arrear Summaries</h1>
            <p className="text-muted-foreground mt-1">
              Select saved arrear statements, give the reason (MACP, CAS, Promotion…) and get the total payable.
            </p>
          </div>
        </header>

        {loadError && (
          <div className="rounded-md border border-rose-300 bg-rose-50 dark:bg-rose-950/30 p-3 text-sm text-rose-800 dark:text-rose-200">
            {loadError}
          </div>
        )}

        {!draft ? (
          // ======================= LIST =======================
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <div>
                <CardTitle>My Summaries</CardTitle>
                <CardDescription>
                  {isAdmin ? "All summaries of all users." : "Summaries you have made."} {statements.length} saved statement(s) available.
                </CardDescription>
              </div>
              <Button onClick={newSummary} data-testid="new-summary">
                <Plus className="h-4 w-4 mr-1.5" /> New Summary
              </Button>
            </CardHeader>
            <CardContent>
              {summaries.length === 0 ? (
                <div className="text-center text-muted-foreground py-10">
                  No summary yet. Click <b>New Summary</b> to make one.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="summary-list">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-3">Title</th>
                        <th className="py-2 pr-3">Reason</th>
                        <th className="py-2 pr-3 text-center">Statements</th>
                        <th className="py-2 pr-3 text-right">Net Payable</th>
                        <th className="py-2 pr-3">Status</th>
                        {isAdmin && <th className="py-2 pr-3">Made by</th>}
                        <th className="py-2 pr-3">Updated</th>
                        <th className="py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaries.map((s) => {
                        const { rows } = computeSummaryRows(s, statements);
                        const t = totalsOf(rows);
                        return (
                          <tr key={s.id} className="border-b last:border-0 hover:bg-muted/40">
                            <td className="py-2 pr-3 font-medium">
                              <button className="text-left hover:underline" onClick={() => openDraft(s)}>{s.title || "Untitled"}</button>
                              {s.orderNo && <div className="text-xs text-muted-foreground">{s.orderNo}</div>}
                            </td>
                            <td className="py-2 pr-3">{reasonText(s) || "—"}</td>
                            <td className="py-2 pr-3 text-center">{t.count}</td>
                            <td className={`py-2 pr-3 text-right font-semibold ${t.net < 0 ? "text-rose-600" : ""}`}>
                              <Money v={t.net} />
                            </td>
                            <td className="py-2 pr-3">
                              {s.locked ? (
                                <Badge className="bg-slate-700 hover:bg-slate-700"><Lock className="h-3 w-3 mr-1" />Locked</Badge>
                              ) : (
                                <Badge variant="outline" className="border-emerald-400 text-emerald-700 dark:text-emerald-400">Live</Badge>
                              )}
                            </td>
                            {isAdmin && <td className="py-2 pr-3 text-xs">{s.ownerName || s.ownerEmail}</td>}
                            <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">{isoToDisplay(s.updatedAt)}</td>
                            <td className="py-2 text-right whitespace-nowrap">
                              <Button size="icon" variant="ghost" title="Open" onClick={() => openDraft(s)}><Pencil className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" title="Print" onClick={() => printSummary(s)}><Printer className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" title="Download CSV (Excel)" onClick={() => exportCsv(s)}><FileSpreadsheet className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" title="Duplicate" onClick={() => duplicate(s)}><Copy className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" title="Delete" className="text-rose-600" onClick={() => setToDelete(s)}><Trash2 className="h-4 w-4" /></Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          // ======================= BUILDER =======================
          <div className="space-y-5" data-testid="summary-builder">
            {locked && (
              <div className="rounded-md border border-slate-400 bg-slate-100 dark:bg-slate-900 p-3 text-sm flex flex-wrap items-center gap-2">
                <Lock className="h-4 w-4" />
                <span>
                  <b>Locked</b> on {isoToDisplay(draft.lockedAt)}{draft.lockedBy ? ` by ${draft.lockedBy}` : ""}. Figures are frozen and will not
                  change even if a statement is edited. Unlock to make changes.
                </span>
              </div>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Summary details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="sum-title">Title *</Label>
                    <Input id="sum-title" value={draft.title} disabled={locked} placeholder="e.g. MACP-II arrear — October 2026"
                      onChange={(e) => update({ title: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sum-order">Order No. / Reference</Label>
                    <Input id="sum-order" value={draft.orderNo} disabled={locked} placeholder="Office order no. and date (optional)"
                      onChange={(e) => update({ orderNo: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Reason for arrear</Label>
                  <div className="flex flex-wrap gap-2" data-testid="reason-chips">
                    {[...SUMMARY_REASONS, ...draft.reasons.filter((r) => !(SUMMARY_REASONS as readonly string[]).includes(r))].map((r) => {
                      const on = draft.reasons.includes(r);
                      return (
                        <button key={r} type="button" disabled={locked} onClick={() => toggleReason(r)}
                          className={`px-3 py-1 rounded-full border text-sm transition-colors disabled:opacity-60 ${on ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}>
                          {r}
                        </button>
                      );
                    })}
                  </div>
                  {!locked && (
                    <div className="flex gap-2 max-w-sm pt-1">
                      <Input value={customReason} placeholder="Other reason…" onChange={(e) => setCustomReason(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomReason(); } }} />
                      <Button type="button" variant="outline" onClick={addCustomReason}>Add</Button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">This reason prints on every row; a different reason can be set for any row below.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sum-remark">Remark</Label>
                  <Textarea id="sum-remark" rows={2} value={draft.remark} disabled={locked} placeholder="Optional note to print at the end"
                    onChange={(e) => update({ remark: e.target.value })} />
                </div>

                <div className="flex flex-wrap gap-6 pt-1">
                  {isAdmin && (
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={draft.groupByUser} disabled={locked} onCheckedChange={(v) => update({ groupByUser: v })} />
                      Group user-wise (sub-total for each user)
                    </label>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <span>Print as</span>
                    <Select value={draft.layout} disabled={locked} onValueChange={(v) => update({ layout: v as ArrearSummary["layout"] })}>
                      <SelectTrigger className="w-[230px] h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="detailed">Detailed (every statement)</SelectItem>
                        <SelectItem value="totals">Totals only{isAdmin ? " (user-wise if grouped)" : ""}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {!locked && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2"><CalendarRange className="h-5 w-5" /> Include by date (optional)</CardTitle>
                  <CardDescription>
                    Bring in all statements {isAdmin ? "of all users or one user " : ""}that were made between two dates. You can still add other
                    statements or remove any of them below. While the summary is not locked, new statements made in this range are added automatically.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="range-from" className="text-xs">From date</Label>
                      <Input id="range-from" type="date" className="w-[165px]" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="range-to" className="text-xs">To date</Label>
                      <Input id="range-to" type="date" className="w-[165px]" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
                    </div>
                    {isAdmin && (
                      <div className="space-y-1">
                        <Label className="text-xs">Statements of</Label>
                        <Select value={rangeUser} onValueChange={setRangeUser}>
                          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All users</SelectItem>
                            {userOptions.map(([uid, name]) => <SelectItem key={uid} value={uid}>{name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <Button type="button" onClick={applyRange} data-testid="apply-range">Apply range</Button>
                    {draft.range && <Button type="button" variant="outline" onClick={removeRange}><X className="h-4 w-4 mr-1" />Remove range</Button>}
                  </div>
                  {draft.range && (
                    <div className="text-sm rounded-md bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 p-2" data-testid="range-info">
                      Range: <b>{ymdToDisplay(draft.range.from) || "beginning"}</b> to <b>{ymdToDisplay(draft.range.to) || "today"}</b>
                      {isAdmin && <> · {draft.range.userId === "all" ? "all users" : userLabel(draft.range.userId)}</>}
                      {" · "}{resolved?.fromRange.size || 0} found, {draft.excludedIds.filter((id) => resolved?.fromRange.has(id)).length} removed,{" "}
                      {draft.addedIds.length} added from outside
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{locked ? "Statements in this summary (frozen)" : "Select statements"}</CardTitle>
                {!locked && (
                  <CardDescription>Tick the statements to include. Figures shown are the current saved figures of each statement.</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {locked ? (
                  <LockedRows rows={computed?.rows || []} isAdmin={isAdmin} pfCount={pfCount} onOpenPf={openPf} />
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative">
                        <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                        <Input className="pl-8 w-[240px]" placeholder="Search name, ID, department…" value={search} onChange={(e) => setSearch(e.target.value)} />
                      </div>
                      {isAdmin && (
                        <Select value={userFilter} onValueChange={setUserFilter}>
                          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All users</SelectItem>
                            {userOptions.map(([uid, name]) => <SelectItem key={uid} value={uid}>{name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                      <Select value={showFilter} onValueChange={(v) => setShowFilter(v as ShowFilter)}>
                        <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Show all</SelectItem>
                          <SelectItem value="included">Included only</SelectItem>
                          <SelectItem value="notIncluded">Not included</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="sm" onClick={() => setIncluded(visibleStatements.map((s) => s.id), true)}>
                        <CheckSquare className="h-4 w-4 mr-1" /> Include all shown
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setIncluded(visibleStatements.map((s) => s.id), false)}>
                        <Square className="h-4 w-4 mr-1" /> Remove all shown
                      </Button>
                    </div>

                    {computed && computed.missing.length > 0 && (
                      <div className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> {computed.missing.length} statement(s) in this summary no longer exist and are left out.
                      </div>
                    )}

                    <div className="overflow-x-auto border rounded-md">
                      <table className="w-full text-sm" data-testid="statement-table">
                        <thead className="bg-muted/50">
                          <tr className="text-left">
                            <th className="p-2 w-8"></th>
                            <th className="p-2">Employee</th>
                            <th className="p-2 hidden md:table-cell">Department</th>
                            <th className="p-2 whitespace-nowrap">Arrear period</th>
                            <th className="p-2 whitespace-nowrap hidden lg:table-cell">Made on</th>
                            {isAdmin && <th className="p-2 hidden lg:table-cell">User</th>}
                            <th className="p-2 text-right">Amount</th>
                            <th className="p-2">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleStatements.length === 0 && (
                            <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No statements to show.</td></tr>
                          )}
                          {visibleStatements.map((s) => {
                            const v = toRowValue(s);
                            const on = includedSet.has(s.id);
                            const src = resolved?.source.get(s.id);
                            const other = usage.get(s.id);
                            const rowReason = draft.rowReasons[s.id] || "";
                            const reasonChoices = [...new Set([...draft.reasons, ...SUMMARY_REASONS, ...(rowReason ? [rowReason] : [])])];
                            return (
                              <tr key={s.id} className={`border-t ${on ? "bg-emerald-50/60 dark:bg-emerald-950/20" : ""}`} data-testid="statement-row">
                                <td className="p-2 align-top">
                                  <Checkbox checked={on} onCheckedChange={(c) => setIncluded([s.id], c === true)} aria-label={`Include ${v.employeeName}`} />
                                </td>
                                <td className="p-2 align-top">
                                  <div className="font-medium flex items-center gap-1.5 flex-wrap">
                                    {v.employeeName || "—"}
                                    <Link href={`/?statement=${encodeURIComponent(s.id)}`} target="_blank" title="Open statement" className="text-muted-foreground hover:text-primary">
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </Link>
                                    {(s.payFixation?.count || 0) > 0 && (
                                      <button type="button" title="View pay fixation" className="text-muted-foreground hover:text-primary" onClick={() => openPf(s.id, v.employeeName, v.employeeId)}>
                                        <Paperclip className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">{[v.employeeId, v.designation].filter(Boolean).join(" · ")}</div>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {src === "range" && <Badge variant="outline" className="text-[10px] py-0">{on ? "from date range" : "removed from range"}</Badge>}
                                    {src === "added" && on && draft.range && <Badge variant="outline" className="text-[10px] py-0">added</Badge>}
                                    {other && (
                                      <Badge variant="outline" className="text-[10px] py-0 border-amber-400 text-amber-700 dark:text-amber-400" title={other.join(", ")}>
                                        also in: {other.length > 1 ? `${other.length} summaries` : other[0]}
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="p-2 align-top hidden md:table-cell">{v.department || "—"}</td>
                                <td className="p-2 align-top whitespace-nowrap text-xs">
                                  {ymdToDisplay(v.fromDate) || "—"}<br />{ymdToDisplay(v.toDate) || "—"}
                                </td>
                                <td className="p-2 align-top whitespace-nowrap text-xs hidden lg:table-cell">{ymdToDisplay(statementCreatedYmd(s)) || "—"}</td>
                                {isAdmin && <td className="p-2 align-top text-xs hidden lg:table-cell">{userLabel(s.userId || "", s.userName, s.userEmail)}</td>}
                                <td className={`p-2 align-top text-right whitespace-nowrap font-semibold ${v.difference < 0 ? "text-rose-600" : ""}`}>
                                  <Money v={Math.abs(v.difference)} />
                                  {v.difference < 0 && <div className="text-[10px] font-normal">recovery</div>}
                                </td>
                                <td className="p-2 align-top">
                                  <select
                                    className="h-8 rounded-md border bg-background px-1.5 text-xs max-w-[150px] disabled:opacity-50"
                                    disabled={!on}
                                    value={rowReason}
                                    onChange={(e) => setRowReason(s.id, e.target.value)}
                                    aria-label="Reason for this statement"
                                  >
                                    <option value="">{reasonText(draft) ? `Same (${reasonText(draft)})` : "Same as summary"}</option>
                                    {reasonChoices.map((r) => <option key={r} value={r}>{r}</option>)}
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* sticky totals + actions for the builder */}
      {draft && (
        <div className="no-print fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <div className="container mx-auto px-3 sm:px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2" data-testid="totals-bar">
            <div className="text-sm"><span className="text-muted-foreground">Statements</span> <b data-testid="t-count">{draftTotals.count}</b></div>
            <div className="text-sm"><span className="text-muted-foreground">Total Arrear</span> <b data-testid="t-arrear"><Money v={draftTotals.arrear} /></b></div>
            <div className="text-sm"><span className="text-muted-foreground">Total Recovery</span> <b className="text-rose-600" data-testid="t-recovery"><Money v={draftTotals.recovery} /></b></div>
            <div className="text-base">
              <span className="text-muted-foreground">{draftTotals.net >= 0 ? "Net Payable" : "Net Recoverable"}</span>{" "}
              <b className="text-emerald-700 dark:text-emerald-400" data-testid="t-net"><Money v={Math.abs(draftTotals.net)} /></b>
            </div>
            <div className="flex flex-wrap gap-2 ml-auto">
              {!locked && (
                <Button onClick={handleSave} disabled={saving} data-testid="save-summary">
                  {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />} Save{dirty ? " *" : ""}
                </Button>
              )}
              {!locked ? (
                <Button variant="outline" onClick={handleLock} disabled={saving} data-testid="lock-summary">
                  <Lock className="h-4 w-4 mr-1.5" /> Save &amp; Lock
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setConfirmUnlock(true)} disabled={saving} data-testid="unlock-summary">
                  <Unlock className="h-4 w-4 mr-1.5" /> Unlock
                </Button>
              )}
              <Button variant="outline" onClick={() => printSummary(draft)} data-testid="print-summary"><Printer className="h-4 w-4 mr-1.5" /> Print</Button>
              <Button variant="outline" onClick={() => exportCsv(draft)}><Download className="h-4 w-4 mr-1.5" /> CSV</Button>
              <Button variant="ghost" onClick={() => closeEditor()} data-testid="close-summary"><X className="h-4 w-4 mr-1.5" /> Close</Button>
            </div>
          </div>
        </div>
      )}

      {printData && <SummaryPrint summary={printData.summary} rows={printData.rows} settings={printSettings} />}
      {pfOpener.element}

      {/* delete */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this summary?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{toDelete?.title || "Untitled"}&quot;{toDelete?.locked ? " is locked. " : " "}will be deleted. The arrear statements themselves are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700 text-white" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* unlock */}
      <AlertDialog open={confirmUnlock} onOpenChange={setConfirmUnlock}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlock this summary?</AlertDialogTitle>
            <AlertDialogDescription>
              After unlocking, the figures will again be taken from the current statements, so any statement edited after locking will show its new
              amount. The same statements stay selected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlock}>Unlock</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* close with unsaved changes */}
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close without saving?</AlertDialogTitle>
            <AlertDialogDescription>Your changes to this summary are not saved yet.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700 text-white" onClick={() => closeEditor(true)}>Discard changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* print heading settings (admin) */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Summary print heading</DialogTitle>
            <DialogDescription>Printed at the top of every Arrear Summary, for all users.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ps-1">Heading line 1</Label>
              <Input id="ps-1" value={settingsDraft.headingLine1} onChange={(e) => setSettingsDraft((s) => ({ ...s, headingLine1: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-2">Heading line 2</Label>
              <Input id="ps-2" value={settingsDraft.headingLine2} onChange={(e) => setSettingsDraft((s) => ({ ...s, headingLine2: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-3">Signatures (one per line, up to 6)</Label>
              <Textarea id="ps-3" rows={4} value={settingsDraft.signatories} onChange={(e) => setSettingsDraft((s) => ({ ...s, signatories: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSettingsDraft({
              headingLine1: DEFAULT_PRINT_SETTINGS.headingLine1,
              headingLine2: DEFAULT_PRINT_SETTINGS.headingLine2,
              signatories: DEFAULT_PRINT_SETTINGS.signatories.join("\n"),
            })}>Reset to default</Button>
            <Button onClick={saveSettings}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LockedRows({
  rows,
  isAdmin,
  pfCount,
  onOpenPf,
}: {
  rows: ReturnType<typeof computeSummaryRows>["rows"];
  isAdmin: boolean;
  pfCount: (id: string) => number;
  onOpenPf: (id: string, name: string, empId: string) => void;
}) {
  if (!rows.length) return <div className="text-muted-foreground text-sm">No statements.</div>;
  return (
    <div className="overflow-x-auto border rounded-md">
      <table className="w-full text-sm" data-testid="locked-table">
        <thead className="bg-muted/50">
          <tr className="text-left">
            <th className="p-2">#</th>
            <th className="p-2">Employee</th>
            <th className="p-2">Arrear period</th>
            {isAdmin && <th className="p-2 hidden lg:table-cell">User</th>}
            <th className="p-2">Reason</th>
            <th className="p-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.statementId} className="border-t">
              <td className="p-2 align-top">{i + 1}</td>
              <td className="p-2 align-top">
                <div className="font-medium flex items-center gap-1.5">
                  {r.employeeName}
                  {pfCount(r.statementId) > 0 && (
                    <button type="button" title="View pay fixation" className="text-muted-foreground hover:text-primary no-print" onClick={() => onOpenPf(r.statementId, r.employeeName, r.employeeId)}>
                      <Paperclip className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{[r.employeeId, r.designation].filter(Boolean).join(" · ")}</div>
                {r.changedSinceLock && (
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                    <AlertTriangle className="h-3 w-3" /> Statement changed after locking (now Rs. {formatINR(Math.abs(r.liveDifference || 0))}
                    {(r.liveDifference || 0) < 0 ? " recovery" : ""}). Locked figure is kept.
                  </div>
                )}
                {r.deletedSinceLock && (
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                    <AlertTriangle className="h-3 w-3" /> Statement deleted after locking. Locked figure is kept.
                  </div>
                )}
              </td>
              <td className="p-2 align-top text-xs whitespace-nowrap">{ymdToDisplay(r.fromDate) || "—"} to {ymdToDisplay(r.toDate) || "—"}</td>
              {isAdmin && <td className="p-2 align-top text-xs hidden lg:table-cell">{r.userName || r.userEmail}</td>}
              <td className="p-2 align-top text-xs">{r.reason || "—"}</td>
              <td className={`p-2 align-top text-right font-semibold whitespace-nowrap ${r.difference < 0 ? "text-rose-600" : ""}`}>
                Rs. {formatINR(Math.abs(r.difference))}
                {r.difference < 0 && <div className="text-[10px] font-normal">recovery</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
