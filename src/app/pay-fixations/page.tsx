"use client";

// Pay Fixation Gallery: every saved pay fixation as a thumbnail card, searchable by
// employee details (and user for the admin), with space used on Firebase.
// Only the thumbnails of the cards on the current page are downloaded; a full
// page is downloaded when it is opened, printed or downloaded.

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Eye, FileText, HardDrive, Loader2, Printer, RefreshCw, Search, Images } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { usePayFixationOpener } from "@/components/pay-fixation-opener";
import { printImages } from "@/components/pay-fixation-viewer";
import { fetchStatementsFor, fetchUsers } from "@/lib/summary-data";
import { fetchFullImage, fetchPayFixationUsage, fetchThumbs, type PayFixationThumb } from "@/lib/pay-fixation-data";
import { formatBytes } from "@/lib/pay-fixation-image";
import { toLocalYmd, ymdToDisplay, type StatementLite } from "@/lib/summary-engine";

const ADMIN_EMAIL = "amulivealigarh@gmail.com";
const FREE_QUOTA = 1024 * 1024 * 1024; // Firestore free plan: 1 GiB stored data
const PAGE_SIZE = 24;

type SortKey = "newest" | "oldest" | "name";

export default function PayFixationGalleryPage() {
  const { user, authStatus } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;
  const { toast } = useToast();

  const [statements, setStatements] = React.useState<StatementLite[]>([]);
  const [users, setUsers] = React.useState<{ uid: string; displayName: string; email: string }[]>([]);
  const [usage, setUsage] = React.useState<{ images: number; bytes: number; exact: boolean } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [userFilter, setUserFilter] = React.useState("all");
  const [sort, setSort] = React.useState<SortKey>("newest");
  const [page, setPage] = React.useState(0);
  const [thumbs, setThumbs] = React.useState<Record<string, PayFixationThumb[]>>({});
  const [thumbsLoading, setThumbsLoading] = React.useState(false);
  const [printingId, setPrintingId] = React.useState<string | null>(null);
  const thumbsRef = React.useRef<Record<string, PayFixationThumb[]>>({});

  const onError = React.useCallback((msg: string) => toast({ variant: "destructive", title: msg }), [toast]);
  const opener = usePayFixationOpener(user?.uid || "", isAdmin, onError);

  const load = React.useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError("");
    try {
      const [st, us] = await Promise.all([fetchStatementsFor(user.uid, isAdmin), isAdmin ? fetchUsers().catch(() => []) : Promise.resolve([])]);
      setStatements(st);
      setUsers(us);
      try {
        const u = await fetchPayFixationUsage(user.uid, isAdmin);
        setUsage({ ...u, exact: true });
      } catch (e) {
        console.warn("Usage aggregation failed, using statement counters:", e);
        const withPf = st.filter((s) => (s.payFixation?.count || 0) > 0);
        setUsage({
          images: withPf.reduce((a, s) => a + (s.payFixation?.count || 0), 0),
          bytes: withPf.reduce((a, s) => a + (s.payFixation?.bytes || 0), 0),
          exact: false,
        });
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Could not load data.");
    }
    // drop cached thumbnails so changes show
    Object.values(thumbsRef.current).flat().forEach((t) => URL.revokeObjectURL(t.thumbUrl));
    thumbsRef.current = {};
    setThumbs({});
    setLoading(false);
  }, [user?.uid, isAdmin]);

  React.useEffect(() => {
    if (authStatus === "authenticated") load();
    else if (authStatus !== "loading") setLoading(false);
  }, [authStatus, load]);

  React.useEffect(() => () => Object.values(thumbsRef.current).flat().forEach((t) => URL.revokeObjectURL(t.thumbUrl)), []);

  const userName = React.useCallback(
    (s: StatementLite) => users.find((u) => u.uid === s.userId)?.displayName || s.userName || s.userEmail || "Unknown",
    [users]
  );

  const withPf = React.useMemo(() => statements.filter((s) => (s.payFixation?.count || 0) > 0), [statements]);

  const userOptions = React.useMemo(() => {
    const m = new Map<string, string>();
    withPf.forEach((s) => s.userId && m.set(s.userId, userName(s)));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [withPf, userName]);

  const perUser = React.useMemo(() => {
    const m = new Map<string, { name: string; statements: number; images: number; bytes: number }>();
    withPf.forEach((s) => {
      const k = s.userId || "?";
      const e = m.get(k) || { name: userName(s), statements: 0, images: 0, bytes: 0 };
      e.statements++;
      e.images += s.payFixation?.count || 0;
      e.bytes += s.payFixation?.bytes || 0;
      m.set(k, e);
    });
    return [...m.values()].sort((a, b) => b.bytes - a.bytes);
  }, [withPf, userName]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = withPf
      .filter((s) => userFilter === "all" || s.userId === userFilter)
      .filter((s) => {
        if (!q) return true;
        const e = s.employeeInfo || {};
        return [e.employeeName, e.employeeId, e.designation, e.department, s.userName, s.userEmail].some((v) =>
          String(v ?? "").toLowerCase().includes(q)
        );
      });
    const when = (s: StatementLite) => s.payFixation?.updatedAt || s.savedAt || "";
    return list.sort((a, b) =>
      sort === "name"
        ? String(a.employeeInfo?.employeeName || "").localeCompare(String(b.employeeInfo?.employeeName || ""))
        : sort === "oldest"
          ? when(a).localeCompare(when(b))
          : when(b).localeCompare(when(a))
    );
  }, [withPf, search, userFilter, sort]);

  React.useEffect(() => setPage(0), [search, userFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  // fetch thumbnails only for the cards on this page
  React.useEffect(() => {
    if (!user?.uid) return;
    const missing = visible.map((s) => s.id).filter((id) => !thumbsRef.current[id]);
    if (!missing.length) return;
    let cancelled = false;
    setThumbsLoading(true);
    fetchThumbs(missing, user.uid, isAdmin)
      .then((list) => {
        const next = { ...thumbsRef.current };
        missing.forEach((id) => (next[id] = []));
        list.forEach((t) => next[t.statementId].push(t));
        thumbsRef.current = next;
        if (!cancelled) setThumbs(next);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setError(/permission/i.test(String(e?.code || e?.message)) ? "Database rules for pay fixation are not published yet (firestore.rules)." : e?.message || "Could not load images.");
      })
      .finally(() => !cancelled && setThumbsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [visible.map((s) => s.id).join(","), user?.uid, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const labelOf = (s: StatementLite) => {
    const e = s.employeeInfo || {};
    return `${e.employeeName || "Employee"}${e.employeeId ? ` (${e.employeeId})` : ""}`;
  };
  const fileBaseOf = (s: StatementLite) => `${s.employeeInfo?.employeeId || ""}_${s.employeeInfo?.employeeName || ""}`;

  const printStatementPf = async (s: StatementLite) => {
    setPrintingId(s.id);
    try {
      const list = thumbs[s.id]?.length ? thumbs[s.id] : await fetchThumbs([s.id], user!.uid, isAdmin);
      const blobs: Blob[] = [];
      for (const t of list) blobs.push(await fetchFullImage(t.id));
      await printImages(blobs, labelOf(s));
    } catch (e: any) {
      onError(e?.message || "Could not print.");
    }
    setPrintingId(null);
  };

  if (authStatus === "loading" || (loading && !statements.length && !error && authStatus === "authenticated")) {
    return (
      <main className="container mx-auto px-4 py-16 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  if (authStatus !== "authenticated" || !user) {
    return (
      <main className="container mx-auto px-4 py-16 max-w-lg text-center space-y-4">
        <h1 className="text-2xl font-bold">Pay Fixation Gallery</h1>
        <p className="text-muted-foreground">Please sign in on the calculator page to see saved pay fixations.</p>
        <Button asChild><Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Calculator</Link></Button>
      </main>
    );
  }

  const usedPct = usage ? Math.min(100, (usage.bytes / FREE_QUOTA) * 100) : 0;

  return (
    <main className="container mx-auto px-3 sm:px-4 py-6 md:py-10 space-y-6">
      <header className="space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Calculator</Link></Button>
            <Button asChild variant="outline"><Link href="/summaries">Arrear Summaries</Link></Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <ThemeToggle />
          </div>
        </div>
        <div className="text-center">
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">Pay Fixation Gallery</h1>
          <p className="text-muted-foreground mt-1">{isAdmin ? "Saved pay fixations of all users." : "Your saved pay fixations."} Click a card to view, download or print.</p>
        </div>
      </header>

      {error && <div className="rounded-md border border-rose-300 bg-rose-50 dark:bg-rose-950/30 p-3 text-sm text-rose-800 dark:text-rose-200">{error}</div>}

      <Card data-testid="pf-usage">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><HardDrive className="h-4 w-4" /> Space used by pay fixation images {isAdmin ? "(all users)" : "(yours)"}</CardTitle>
          <CardDescription className="text-xs">
            Firebase free plan gives 1 GB for the whole database (statements included). Exact total: Firebase Console → Firestore → Usage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div><span className="text-muted-foreground">Images</span> <b data-testid="pf-usage-images">{usage?.images ?? "—"}</b></div>
            <div><span className="text-muted-foreground">Statements with pay fixation</span> <b>{withPf.length}</b></div>
            <div><span className="text-muted-foreground">Space used</span> <b data-testid="pf-usage-bytes">{usage ? formatBytes(usage.bytes) : "—"}</b> <span className="text-muted-foreground">of 1 GB ({usedPct < 0.1 && usedPct > 0 ? "<0.1" : usedPct.toFixed(1)}%)</span></div>
            {usage && usage.images > 0 && <div><span className="text-muted-foreground">Average per image</span> <b>{formatBytes(usage.bytes / usage.images)}</b></div>}
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={usedPct} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full ${usedPct > 80 ? "bg-rose-500" : usedPct > 50 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.max(usedPct, usage?.bytes ? 0.5 : 0)}%` }} />
          </div>
          {usage && !usage.exact && <p className="text-[11px] text-muted-foreground">Counted from statement records.</p>}
          {isAdmin && perUser.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">User-wise space</summary>
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-muted-foreground border-b"><th className="py-1 pr-3">User</th><th className="py-1 pr-3 text-right">Statements</th><th className="py-1 pr-3 text-right">Images</th><th className="py-1 text-right">Space</th></tr></thead>
                  <tbody>
                    {perUser.map((u) => (
                      <tr key={u.name} className="border-b last:border-0"><td className="py-1 pr-3">{u.name}</td><td className="py-1 pr-3 text-right">{u.statements}</td><td className="py-1 pr-3 text-right">{u.images}</td><td className="py-1 text-right">{formatBytes(u.bytes)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input className="pl-8 w-[260px]" placeholder="Search name, ID, designation, department…" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="pf-search" />
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
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="name">By name</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} found{thumbsLoading ? " · loading thumbnails…" : ""}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-16 border rounded-lg">
          <Images className="h-10 w-10 mx-auto mb-2 opacity-40" />
          {withPf.length === 0 ? "No pay fixation saved yet. Attach one from the Pay Fixation box below an arrear statement." : "Nothing matches your search."}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3" data-testid="pf-grid">
          {visible.map((s) => {
            const list = thumbs[s.id];
            const first = list?.[0];
            const e = s.employeeInfo || {};
            return (
              <div key={s.id} className="rounded-lg border bg-card overflow-hidden flex flex-col" data-testid="pf-card">
                <button
                  type="button"
                  className="relative aspect-[3/4] bg-white flex items-center justify-center hover:opacity-90"
                  onClick={() => opener.openFor(s.id, labelOf(s), fileBaseOf(s), list)}
                  aria-label={`View pay fixation of ${e.employeeName || "employee"}`}
                >
                  {first ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={first.thumbUrl} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                  ) : (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  )}
                  {(s.payFixation?.count || 0) > 1 && (
                    <Badge className="absolute top-1.5 right-1.5 text-[10px] py-0">{s.payFixation?.count} pages</Badge>
                  )}
                  {opener.loadingId === s.id && <Loader2 className="absolute h-5 w-5 animate-spin text-primary" />}
                </button>
                <div className="p-2 text-xs space-y-0.5 flex-1">
                  <div className="font-semibold text-sm leading-tight truncate" title={String(e.employeeName || "")}>{e.employeeName || "—"}</div>
                  <div className="text-muted-foreground truncate">{[e.employeeId, e.designation].filter(Boolean).join(" · ")}</div>
                  <div className="text-muted-foreground truncate" title={String(e.department || "")}>{e.department || ""}</div>
                  {isAdmin && <div className="truncate">{userName(s)}</div>}
                  <div className="text-muted-foreground">{ymdToDisplay(toLocalYmd(s.payFixation?.updatedAt || s.savedAt)) || ""} · {formatBytes(s.payFixation?.bytes || 0)}</div>
                </div>
                <div className="flex border-t">
                  <button className="flex-1 py-1.5 text-xs hover:bg-muted flex items-center justify-center gap-1" onClick={() => opener.openFor(s.id, labelOf(s), fileBaseOf(s), list)}>
                    <Eye className="h-3.5 w-3.5" /> View
                  </button>
                  <button className="flex-1 py-1.5 text-xs hover:bg-muted flex items-center justify-center gap-1 border-l" disabled={printingId === s.id} onClick={() => printStatementPf(s)}>
                    {printingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />} Print
                  </button>
                  <Link href={`/?statement=${encodeURIComponent(s.id)}`} className="flex-1 py-1.5 text-xs hover:bg-muted flex items-center justify-center gap-1 border-l" title="Open arrear statement">
                    <FileText className="h-3.5 w-3.5" /> Arrear
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm">Page {page + 1} of {pageCount}</span>
          <Button variant="outline" size="sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}

      {opener.element}
    </main>
  );
}
