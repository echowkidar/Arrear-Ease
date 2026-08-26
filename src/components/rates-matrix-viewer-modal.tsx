"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cpcData, default6thCpcDaRates } from "@/lib/cpc-data";
import { useRates } from "@/context/rates-context";
import { useAuth } from "@/context/auth-context";
import {
  TableProperties,
  Printer,
  Search,
  Maximize2,
  Minimize2,
  TrendingUp,
  History,
  Building2,
  Car,
  HeartPulse,
  Layers,
  CheckCircle2,
  Filter,
  Info,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface RatesMatrixViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: string;
}

// 7th CPC Level metadata
const LEVEL_METADATA: Record<string, { payBand: string; gradePay: number | string; minPay: number; maxPay: number; stages: number; description: string }> = {
  "1": { payBand: "PB-1 (5200-20200)", gradePay: 1800, minPay: 18000, maxPay: 56900, stages: 40, description: "Group C - Multi-Tasking Staff, Peon, Attendant" },
  "2": { payBand: "PB-1 (5200-20200)", gradePay: 1900, minPay: 19900, maxPay: 63200, stages: 40, description: "Lower Division Clerk (LDC), Junior Typist" },
  "3": { payBand: "PB-1 (5200-20200)", gradePay: 2000, minPay: 21700, maxPay: 69100, stages: 40, description: "Junior Assistant, Head Constable" },
  "4": { payBand: "PB-1 (5200-20200)", gradePay: 2400, minPay: 25500, maxPay: 81100, stages: 40, description: "Upper Division Clerk (UDC), Senior Clerk" },
  "5": { payBand: "PB-1 (5200-20200)", gradePay: 2800, minPay: 29200, maxPay: 92300, stages: 40, description: "Assistant, Auditor, Accountant" },
  "6": { payBand: "PB-2 (9300-34800)", gradePay: 4200, minPay: 35400, maxPay: 112400, stages: 40, description: "Senior Assistant, Inspector, Sub-Inspector" },
  "7": { payBand: "PB-2 (9300-34800)", gradePay: 4600, minPay: 44900, maxPay: 142400, stages: 40, description: "Section Officer, Assistant Accounts Officer (AAO)" },
  "8": { payBand: "PB-2 (9300-34800)", gradePay: 4800, minPay: 47600, maxPay: 151100, stages: 39, description: "Assistant Audit Officer, Section Officer (Gazetted)" },
  "9": { payBand: "PB-2 (9300-34800)", gradePay: 5400, minPay: 53100, maxPay: 167800, stages: 39, description: "Senior Section Officer, Junior Accounts Officer" },
  "10": { payBand: "PB-3 (15600-39100)", gradePay: 5400, minPay: 56100, maxPay: 177500, stages: 40, description: "Group A Entry / Assistant Commissioner, Assistant Professor" },
  "AL-10": { payBand: "PB-3 (15600-39100)", gradePay: 6000, minPay: 57700, maxPay: 182400, stages: 40, description: "Academic Level 10 - Assistant Professor (Stage 1)" },
  "11": { payBand: "PB-3 (15600-39100)", gradePay: 6600, minPay: 67700, maxPay: 208700, stages: 39, description: "Senior Time Scale / Deputy Commissioner" },
  "AL-11": { payBand: "PB-3 (15600-39100)", gradePay: 7000, minPay: 68900, maxPay: 205500, stages: 38, description: "Academic Level 11 - Assistant Professor (Stage 2)" },
  "12": { payBand: "PB-3 (15600-39100)", gradePay: 7600, minPay: 78800, maxPay: 209200, stages: 34, description: "Junior Administrative Grade (JAG) / Joint Commissioner" },
  "AL-12": { payBand: "PB-3 (15600-39100)", gradePay: 8000, minPay: 79800, maxPay: 211500, stages: 34, description: "Associate Professor (Stage 3)" },
  "13": { payBand: "PB-4 (37400-67000)", gradePay: 8700, minPay: 123100, maxPay: 215900, stages: 20, description: "Selection Grade / Director" },
  "13-A": { payBand: "PB-4 (37400-67000)", gradePay: 8900, minPay: 131100, maxPay: 216600, stages: 18, description: "Senior Administrative Grade (SAG)" },
  "AL-13-A": { payBand: "PB-4 (37400-67000)", gradePay: 9000, minPay: 131400, maxPay: 217100, stages: 18, description: "Academic Level 13-A - Professor" },
  "14/AL-14": { payBand: "PB-4 (37400-67000)", gradePay: 10000, minPay: 144200, maxPay: 218200, stages: 15, description: "Joint Secretary / Senior Professor" },
  "15VC": { payBand: "Apex (75000-80000)", gradePay: "Fixed", minPay: 210000, maxPay: 210000, stages: 1, description: "Vice Chancellor / Apex Scale" },
};

// 6th CPC Structure Data
const SIXTH_CPC_STRUCTURE = [
  { level: "1", gradePay: 1800, payBand: "PB-1 (5200-20200)", entryPay7th: 18000, level7th: "Level 1" },
  { level: "2", gradePay: 1900, payBand: "PB-1 (5200-20200)", entryPay7th: 19900, level7th: "Level 2" },
  { level: "3", gradePay: 2000, payBand: "PB-1 (5200-20200)", entryPay7th: 21700, level7th: "Level 3" },
  { level: "4", gradePay: 2400, payBand: "PB-1 (5200-20200)", entryPay7th: 25500, level7th: "Level 4" },
  { level: "5", gradePay: 2800, payBand: "PB-1 (5200-20200)", entryPay7th: 29200, level7th: "Level 5" },
  { level: "6", gradePay: 4200, payBand: "PB-2 (9300-34800)", entryPay7th: 35400, level7th: "Level 6" },
  { level: "7", gradePay: 4600, payBand: "PB-2 (9300-34800)", entryPay7th: 44900, level7th: "Level 7" },
  { level: "8", gradePay: 4800, payBand: "PB-2 (9300-34800)", entryPay7th: 47600, level7th: "Level 8" },
  { level: "9", gradePay: 5400, payBand: "PB-2 (9300-34800)", entryPay7th: 53100, level7th: "Level 9" },
  { level: "10", gradePay: 5400, payBand: "PB-3 (15600-39100)", entryPay7th: 56100, level7th: "Level 10" },
  { level: "AL-10", gradePay: 6000, payBand: "PB-3 (15600-39100)", entryPay7th: 57700, level7th: "Level AL-10" },
  { level: "11", gradePay: 6600, payBand: "PB-3 (15600-39100)", entryPay7th: 67700, level7th: "Level 11" },
  { level: "AL-11", gradePay: 7000, payBand: "PB-3 (15600-39100)", entryPay7th: 68900, level7th: "Level AL-11" },
  { level: "12", gradePay: 7600, payBand: "PB-3 (15600-39100)", entryPay7th: 78800, level7th: "Level 12" },
  { level: "AL-12", gradePay: 8000, payBand: "PB-3 (15600-39100)", entryPay7th: 79800, level7th: "Level AL-12" },
  { level: "13", gradePay: 8700, payBand: "PB-4 (37400-67000)", entryPay7th: 123100, level7th: "Level 13" },
  { level: "13-A", gradePay: 8900, payBand: "PB-4 (37400-67000)", entryPay7th: 131100, level7th: "Level 13-A" },
  { level: "14/AL-14", gradePay: 10000, payBand: "PB-4 (37400-67000)", entryPay7th: 144200, level7th: "Level 14/AL-14" },
  { level: "15VC", gradePay: 0, payBand: "Apex (75000-80000)", entryPay7th: 210000, level7th: "Level 15VC" },
];

export function RatesMatrixViewerModal({
  isOpen,
  onClose,
  defaultTab = "7th-matrix",
}: RatesMatrixViewerModalProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchPay, setSearchPay] = useState("");
  const [selectedLevelFilter, setSelectedLevelFilter] = useState("all");
  const [matrixViewMode, setMatrixViewMode] = useState<"table" | "cards">("table");

  const { daRates, hraRates, npaRates, taRates, da6thRates, sixthCpcConfig } = useRates();
  const { user } = useAuth();

  const maxStages = 40;
  const payLevels7th = useMemo(() => cpcData["7th"].payLevels, []);

  // Split for 2-Part Official Pay Matrix Printout
  const part1Levels = useMemo(() => payLevels7th.filter((l) => ["1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(l.level)), [payLevels7th]);
  const part2Levels = useMemo(() => payLevels7th.filter((l) => ["10", "AL-10", "11", "AL-11", "12", "AL-12", "13", "13-A", "AL-13-A", "14/AL-14", "15VC"].includes(l.level)), [payLevels7th]);

  // Filtered Pay Levels for Screen View
  const filteredPayLevels = useMemo(() => {
    if (selectedLevelFilter === "all") return payLevels7th;
    if (selectedLevelFilter === "pb1") return payLevels7th.filter((l) => ["1", "2", "3", "4", "5"].includes(l.level));
    if (selectedLevelFilter === "pb2") return payLevels7th.filter((l) => ["6", "7", "8", "9"].includes(l.level));
    if (selectedLevelFilter === "pb3") return payLevels7th.filter((l) => ["10", "AL-10", "11", "AL-11", "12", "AL-12"].includes(l.level));
    if (selectedLevelFilter === "pb4") return payLevels7th.filter((l) => ["13", "13-A", "AL-13-A", "14/AL-14", "15VC"].includes(l.level));
    return payLevels7th.filter((l) => l.level === selectedLevelFilter);
  }, [selectedLevelFilter, payLevels7th]);

  // Search Results for Basic Pay
  const searchResults = useMemo(() => {
    const query = parseInt(searchPay.trim(), 10);
    if (isNaN(query) || query <= 0) return [];

    const matches: { level: string; stageIndex: number; value: number }[] = [];
    payLevels7th.forEach((pl) => {
      pl.values.forEach((val, idx) => {
        if (val === query) {
          matches.push({ level: pl.level, stageIndex: idx + 1, value: val });
        }
      });
    });
    return matches;
  }, [searchPay, payLevels7th]);

  // Sort DA rates in DESCENDING order (Newest / highest rate on top)
  const sorted7thDaRates = useMemo(() => {
    return [...daRates].sort((a, b) => {
      const dateA = a.fromDate ? new Date(a.fromDate).getTime() : 0;
      const dateB = b.fromDate ? new Date(b.fromDate).getTime() : 0;
      return dateB - dateA; // Descending
    });
  }, [daRates]);

  const sorted6thDaRates = useMemo(() => {
    const list = da6thRates && da6thRates.length > 0 ? da6thRates : default6thCpcDaRates;
    return [...list].sort((a, b) => {
      const dateA = a.fromDate ? new Date(a.fromDate).getTime() : 0;
      const dateB = b.fromDate ? new Date(b.fromDate).getTime() : 0;
      return dateB - dateA; // Descending
    });
  }, [da6thRates]);

  // Print Lifecycle Listeners for modal printing
  React.useEffect(() => {
    if (!isOpen) return;

    const handleBeforePrint = () => {
      document.body.classList.add("printing-master-modal");
    };
    const handleAfterPrint = () => {
      document.body.classList.remove("printing-master-modal");
    };

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
      document.body.classList.remove("printing-master-modal");
    };
  }, [isOpen]);

  // Direct Print Handler
  const handlePrint = () => {
    document.body.classList.add("printing-master-modal");
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          document.body.classList.remove("printing-master-modal");
        }, 1500);
      }, 50);
    });
  };

  // Helper to format level headers cleanly across lines
  const formatLevelHeader = (lvl: string) => {
    if (lvl.includes("/")) {
      const parts = lvl.split("/");
      return (
        <span className="inline-block leading-tight">
          Level<br />
          <span className="text-[7.5pt] sm:text-xs">{parts.join("/")}</span>
        </span>
      );
    }
    if (lvl.startsWith("AL-") || lvl === "13-A" || lvl === "15VC") {
      return (
        <span className="inline-block leading-tight">
          Level<br />
          <span className="text-[7.5pt] sm:text-xs">{lvl}</span>
        </span>
      );
    }
    return `Level ${lvl}`;
  };

  // Reusable Matrix Table Generator
  const renderMatrixTable = (levelsToRender: typeof payLevels7th, title?: string) => (
    <div className="mb-4 last:mb-0 print:mb-0">
      {title && (
        <div className="py-1.5 px-3 bg-muted/70 dark:bg-muted/40 font-bold text-xs sm:text-sm border border-b-0 text-foreground flex justify-between items-center print:bg-gray-100 print:text-black print:border-black print:text-[8.5pt] print:py-1 print:px-2.5 print:font-black">
          <span>{title}</span>
          <span className="text-[11px] sm:text-xs text-muted-foreground font-normal print:text-gray-700 print:text-[7.5pt]">Levels {levelsToRender[0]?.level} to {levelsToRender[levelsToRender.length - 1]?.level}</span>
        </div>
      )}
      <table className="w-full text-xs sm:text-[13.5px] text-center border-collapse border border-border print:border-black print:text-[8.5pt] print:leading-normal">
        <thead className="bg-muted text-foreground print:bg-gray-100">
          {/* Row 1: Pay Bands */}
          <tr className="border-b border-border bg-muted/90 print:border-black print:bg-gray-100">
            <th className="border-r border-border p-2 sm:p-2.5 font-bold text-left min-w-[50px] text-[11px] sm:text-xs print:border-black print:text-black print:p-[2px] print:text-[8pt] print:w-8 print:min-w-[30px] print:max-w-[34px] print:text-center">
              <span className="print:hidden">Pay Band</span>
              <span className="hidden print:inline-block leading-tight text-[7.5pt]">Pay<br />Band</span>
            </th>
            {levelsToRender.map((pl) => {
              const meta = LEVEL_METADATA[pl.level];
              return (
                <th key={`pb-${pl.level}`} className="border-r border-border p-1.5 sm:p-2 font-semibold text-muted-foreground min-w-[76px] sm:min-w-[88px] text-[11px] sm:text-xs print:min-w-0 print:border-black print:text-black print:p-[1.5px] print:text-[7.5pt]">
                  {meta?.payBand.split(" ")[0] || "PB"}
                </th>
              );
            })}
          </tr>

          {/* Row 2: Grade Pay */}
          <tr className="border-b border-border bg-muted/80 print:border-black print:bg-gray-100">
            <th className="border-r border-border p-2 sm:p-2.5 font-bold text-left text-[11px] sm:text-xs print:border-black print:text-black print:p-[2px] print:w-8 print:min-w-[30px] print:max-w-[34px] print:text-center">
              <span className="print:hidden">Grade Pay (₹)</span>
              <span className="hidden print:inline-block leading-tight text-[7.5pt]">Grade<br />Pay (₹)</span>
            </th>
            {levelsToRender.map((pl) => {
              const meta = LEVEL_METADATA[pl.level];
              return (
                <th key={`gp-${pl.level}`} className="border-r border-border p-1.5 sm:p-2 font-bold text-foreground text-xs sm:text-[13px] print:border-black print:text-black print:p-[1.5px] print:text-[8.5pt]">
                  {typeof meta?.gradePay === "number" ? meta.gradePay.toLocaleString("en-IN") : meta?.gradePay || "-"}
                </th>
              );
            })}
          </tr>

          {/* Row 3: Levels */}
          <tr className="border-b-2 border-primary/50 bg-primary/10 print:border-black print:bg-gray-200">
            <th className="border-r border-border p-2 sm:p-2.5 font-extrabold text-left text-primary text-xs sm:text-[13px] print:border-black print:text-black print:p-[2px] print:w-8 print:min-w-[30px] print:max-w-[34px] print:text-center">
              <span className="print:hidden">Levels &rarr;</span>
              <span className="hidden print:inline-block leading-tight text-[8pt] font-black">Level<br />&rarr;</span>
            </th>
            {levelsToRender.map((pl) => (
              <th key={`lvl-${pl.level}`} className="border-r border-border p-2 sm:p-2.5 font-extrabold text-primary text-xs sm:text-[14px] bg-primary/5 print:border-black print:text-black print:bg-transparent print:p-[2px] print:text-[8.5pt] print:font-black">
                {formatLevelHeader(pl.level)}
              </th>
            ))}
          </tr>

          {/* Row 4: Entry Pay (Index 1) */}
          <tr className="border-b border-border bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300 print:border-black print:bg-transparent">
            <th className="border-r border-border p-2 sm:p-2.5 font-bold text-left text-[11px] sm:text-xs print:border-black print:text-black print:p-[2px] print:w-8 print:min-w-[30px] print:max-w-[34px] print:text-center">
              <span className="print:hidden">Entry Pay (₹)</span>
              <span className="hidden print:inline-block leading-tight text-[7.5pt]">Entry<br />Pay (₹)</span>
            </th>
            {levelsToRender.map((pl) => (
              <th key={`entry-${pl.level}`} className="border-r border-border p-1.5 sm:p-2 font-bold text-xs sm:text-[13px] font-mono print:border-black print:text-black print:p-[1.5px] print:text-[8.5pt]">
                {(pl.values[0] || 0).toLocaleString("en-IN")}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {Array.from({ length: maxStages }, (_, stageIdx) => {
            const stageNumber = stageIdx + 1;
            const hasAnyValue = levelsToRender.some((pl) => pl.values[stageIdx] !== undefined);
            if (!hasAnyValue) return null;

            return (
              <tr
                key={`stage-${stageNumber}`}
                className={cn(
                  "border-b border-border/50 font-mono print:border-black",
                  stageNumber % 2 === 0 ? "bg-muted/15 print:bg-gray-50" : "bg-card print:bg-white"
                )}
              >
                <td className="border-r border-border px-2 py-1.5 sm:py-2 font-bold text-center text-muted-foreground text-xs sm:text-[12px] print:border-black print:text-black print:px-[1px] print:py-[1.8px] print:text-[8pt] print:w-8 print:min-w-[30px] print:max-w-[34px]">
                  {stageNumber}
                </td>

                {levelsToRender.map((pl) => {
                  const val = pl.values[stageIdx];
                  const isMatch = searchPay && val === parseInt(searchPay.trim(), 10);

                  return (
                    <td
                      key={`val-${pl.level}-${stageIdx}`}
                      className={cn(
                        "border-r border-border px-2 py-1.5 sm:py-2 text-xs sm:text-[13px] transition-all print:border-black print:text-black print:px-[1.5px] print:py-[1.8px] print:text-[8.5pt]",
                        isMatch
                          ? "bg-emerald-500 text-white font-black shadow-md z-10 ring-2 ring-emerald-600 scale-[1.02] print:bg-gray-200 print:text-black print:scale-100"
                          : val
                          ? "text-foreground font-medium"
                          : "text-muted-foreground/20 bg-muted/5 print:text-gray-300"
                      )}
                    >
                      {val ? val.toLocaleString("en-IN") : "—"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          "transition-all duration-300 flex flex-col p-0 gap-0 overflow-hidden bg-background border-border shadow-2xl",
          isFullscreen
            ? "max-w-[100vw] w-screen h-screen rounded-none border-0"
            : "max-w-6xl w-[96vw] max-h-[92vh] h-[92vh] rounded-xl"
        )}
      >
        {/* Top Header / Action Bar (Hidden during Print) */}
        <DialogHeader className="p-4 sm:px-6 sm:py-4 border-b bg-muted/30 flex-row items-center justify-between no-print space-y-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/20">
              <TableProperties className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2 text-foreground">
                Rates & Pay Matrix Master
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs hidden sm:inline-flex">
                  Standard Reference
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Official 7th & 6th CPC Pay Matrix, DA schedule, HRA, TA & Allowance rules.
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="bg-primary text-primary-foreground hover:bg-primary/90 border-0 shadow-sm flex items-center gap-1.5 h-9 font-medium"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print Reference</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-9 w-9 text-muted-foreground hover:text-foreground hidden md:inline-flex"
              title={isFullscreen ? "Restore standard size" : "Expand to fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </DialogHeader>

        {/* ========================================================================= */}
        {/* DEDICATED MASTER PRINT CONTAINER (Starts immediately at Top of Page 1)     */}
        {/* ========================================================================= */}
        <div className="hidden print:block master-print-container">
          {/* Document Header */}
          <div className="text-black p-3 pb-2 border-b-2 border-black mb-3 text-center">
            <h1 className="text-base font-black uppercase tracking-wider text-black m-0 leading-tight">
              ARREAR EASE — GOVT. PAY & ALLOWANCE MASTER REFERENCE
            </h1>
            <p className="text-[8.5pt] font-semibold text-gray-700 mt-1 leading-tight">
              Official Schedule based on Ministry of Finance (DoE) & Pay Commission Notifications
            </p>
            <div className="flex justify-between items-center text-[8pt] text-gray-600 mt-1.5 pt-1 border-t border-gray-400">
              <span>
                <strong>Document Ref:</strong> REF-GOVT-RATES-{new Date().getFullYear()}
              </span>
              <span>
                <strong>Section:</strong>{" "}
                {activeTab === "7th-matrix"
                  ? "7th CPC Pay Matrix (Civilian & Defense)"
                  : activeTab === "6th-structure"
                  ? "6th CPC Pay Scale & Grade Pay Structure"
                  : activeTab === "7th-da"
                  ? "7th CPC Dearness Allowance (DA) Master Schedule (Descending Order)"
                  : activeTab === "6th-da"
                  ? "6th CPC Dearness Allowance (DA) Schedule (Descending Order)"
                  : "Allowance Rates (HRA, TA, NPA)"}
              </span>
              <span>
                <strong>Printed:</strong> {format(new Date(), "dd-MM-yyyy HH:mm")}
              </span>
            </div>
          </div>

          {/* Section 1: 7th CPC Matrix Print Layout */}
          {activeTab === "7th-matrix" && (
            <div>
              {selectedLevelFilter === "all" ? (
                <div>
                  {renderMatrixTable(part1Levels, "7th CPC Pay Matrix — Part I: Levels 1 to 9 (PB-1 & PB-2)")}
                  <div className="page-break" />
                  {renderMatrixTable(part2Levels, "7th CPC Pay Matrix — Part II: Levels 10 to 15VC (PB-3, PB-4 & Apex)")}
                </div>
              ) : (
                <div>
                  {renderMatrixTable(filteredPayLevels, `7th CPC Pay Matrix — Filtered View (${selectedLevelFilter.toUpperCase()})`)}
                </div>
              )}
            </div>
          )}

          {/* Section 2: 6th CPC Structure Print Layout */}
          {activeTab === "6th-structure" && (
            <div className="space-y-4">
              <table className="w-full text-xs text-center border-collapse border border-black">
                <thead className="bg-gray-100">
                  <tr className="border-b border-black">
                    <th className="border-r border-black p-1.5 font-bold text-left">6th CPC Level</th>
                    <th className="border-r border-black p-1.5 font-bold text-left">Pay Band Name</th>
                    <th className="border-r border-black p-1.5 font-bold text-left">Pay Band Scale (₹)</th>
                    <th className="border-r border-black p-1.5 font-bold text-right">Grade Pay (₹)</th>
                    <th className="border-r border-black p-1.5 font-bold text-center">Corresponding 7th CPC</th>
                    <th className="p-1.5 font-bold text-right">7th CPC Entry Pay (₹)</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-xs">
                  {SIXTH_CPC_STRUCTURE.map((row, idx) => (
                    <tr key={idx} className="border-b border-black">
                      <td className="border-r border-black p-1 text-left font-bold">Level {row.level}</td>
                      <td className="border-r border-black p-1 text-left font-sans">{row.payBand.split(" ")[0]}</td>
                      <td className="border-r border-black p-1 text-left">{row.payBand.match(/\((.*?)\)/)?.[1] || row.payBand}</td>
                      <td className="border-r border-black p-1 text-right font-bold">
                        {row.gradePay > 0 ? `₹${row.gradePay.toLocaleString("en-IN")}` : "Apex / Fixed"}
                      </td>
                      <td className="border-r border-black p-1 text-center font-sans font-bold">{row.level7th}</td>
                      <td className="p-1 text-right font-bold">₹{row.entryPay7th.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="p-2.5 border border-black text-xs space-y-1 mt-4">
                <p><strong>Fitment Formula:</strong> Basic in 7th CPC = (6th CPC Basic Pay + Grade Pay) × 2.57 [fitted to next matrix stage]</p>
                <p><strong>Annual Increment:</strong> 3% on (Pay in Pay Band + Grade Pay), rounded off to next multiple of 10.</p>
              </div>
            </div>
          )}

          {/* Section 3: 7th CPC DA Rates (Descending Order) */}
          {activeTab === "7th-da" && (
            <div>
              <table className="w-full text-xs text-center border-collapse border border-black">
                <thead className="bg-gray-100">
                  <tr className="border-b border-black">
                    <th className="border-r border-black p-1.5 font-bold text-left w-12">#</th>
                    <th className="border-r border-black p-1.5 font-bold text-left">Effective From</th>
                    <th className="border-r border-black p-1.5 font-bold text-left">Effective To</th>
                    <th className="border-r border-black p-1.5 font-bold text-center">DA Rate (%)</th>
                    <th className="border-r border-black p-1.5 font-bold text-center">Hike (+%)</th>
                    <th className="p-1.5 font-bold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-xs">
                  {sorted7thDaRates.map((rateItem, idx) => {
                    const fromStr = rateItem.fromDate ? format(new Date(rateItem.fromDate), "dd-MM-yyyy") : "—";
                    const toStr = rateItem.toDate ? format(new Date(rateItem.toDate), "dd-MM-yyyy") : "Continuing";
                    const currentRate = Number(rateItem.rate);
                    const olderRate = idx < sorted7thDaRates.length - 1 ? Number(sorted7thDaRates[idx + 1].rate) : 0;
                    const diff = idx < sorted7thDaRates.length - 1 ? currentRate - olderRate : currentRate;
                    const isLatest = idx === 0;

                    return (
                      <tr key={idx} className="border-b border-black">
                        <td className="border-r border-black p-1 text-left">{idx + 1}</td>
                        <td className="border-r border-black p-1 text-left font-semibold">{fromStr}</td>
                        <td className="border-r border-black p-1 text-left">{toStr}</td>
                        <td className="border-r border-black p-1 text-center font-extrabold text-sm">{currentRate}%</td>
                        <td className="border-r border-black p-1 text-center">{diff > 0 ? `+${diff}%` : "—"}</td>
                        <td className="p-1 text-right">{isLatest ? "Latest / Active" : "Historical"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Section 4: 6th CPC DA Rates (Descending Order) */}
          {activeTab === "6th-da" && (
            <div>
              <table className="w-full text-xs text-center border-collapse border border-black">
                <thead className="bg-gray-100">
                  <tr className="border-b border-black">
                    <th className="border-r border-black p-1.5 font-bold text-left w-12">#</th>
                    <th className="border-r border-black p-1.5 font-bold text-left">Effective Date</th>
                    <th className="border-r border-black p-1.5 font-bold text-center">DA Rate (%)</th>
                    <th className="border-r border-black p-1.5 font-bold text-center">Hike (+%)</th>
                    <th className="p-1.5 font-bold text-right">Pay Commission</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-xs">
                  {sorted6thDaRates.map((rateItem, idx) => {
                    const fromStr = rateItem.fromDate ? format(new Date(rateItem.fromDate), "dd-MM-yyyy") : "—";
                    const currentRate = Number(rateItem.rate);
                    const olderRate = idx < sorted6thDaRates.length - 1 ? Number(sorted6thDaRates[idx + 1].rate) : 0;
                    const diff = idx < sorted6thDaRates.length - 1 ? currentRate - olderRate : currentRate;

                    return (
                      <tr key={idx} className="border-b border-black">
                        <td className="border-r border-black p-1 text-left">{idx + 1}</td>
                        <td className="border-r border-black p-1 text-left font-semibold">{fromStr}</td>
                        <td className="border-r border-black p-1 text-center font-extrabold text-sm">{currentRate}%</td>
                        <td className="border-r border-black p-1 text-center">{diff > 0 ? `+${diff}%` : "—"}</td>
                        <td className="p-1 text-right">6th Pay Commission</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Section 5: Allowances (HRA, TA, NPA) */}
          {activeTab === "allowances" && (
            <div className="space-y-6">
              {/* HRA */}
              <div className="break-inside-avoid">
                <h3 className="font-bold text-sm text-black border-b border-black pb-1 mb-2">1. House Rent Allowance (HRA) Rules</h3>
                <table className="w-full text-xs text-center border-collapse border border-black">
                  <thead className="bg-gray-100">
                    <tr className="border-b border-black">
                      <th className="border-r border-black p-1.5 font-bold text-left">City Category</th>
                      <th className="border-r border-black p-1.5 font-bold text-left">Population Criteria</th>
                      <th className="border-r border-black p-1.5 font-bold text-center">Initial (DA &lt; 25%)</th>
                      <th className="border-r border-black p-1.5 font-bold text-center">When DA &gt; 25%</th>
                      <th className="border-r border-black p-1.5 font-bold text-center">When DA &gt; 50%</th>
                      <th className="p-1.5 font-bold text-right">Minimum HRA (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-xs">
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-1 text-left font-bold">Class X</td>
                      <td className="border-r border-black p-1 text-left font-sans">50 Lakhs & above (Delhi, Mumbai, etc.)</td>
                      <td className="border-r border-black p-1 text-center font-bold">24%</td>
                      <td className="border-r border-black p-1 text-center font-bold">27%</td>
                      <td className="border-r border-black p-1 text-center font-bold">30%</td>
                      <td className="p-1 text-right font-bold">₹5,400 / month</td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-1 text-left font-bold">Class Y</td>
                      <td className="border-r border-black p-1 text-left font-sans">5 to 50 Lakhs (Aligarh, Lucknow, etc.)</td>
                      <td className="border-r border-black p-1 text-center font-bold">16%</td>
                      <td className="border-r border-black p-1 text-center font-bold">18%</td>
                      <td className="border-r border-black p-1 text-center font-bold">20%</td>
                      <td className="p-1 text-right font-bold">₹3,600 / month</td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-1 text-left font-bold">Class Z</td>
                      <td className="border-r border-black p-1 text-left font-sans">Below 5 Lakhs & remaining places</td>
                      <td className="border-r border-black p-1 text-center font-bold">8%</td>
                      <td className="border-r border-black p-1 text-center font-bold">9%</td>
                      <td className="border-r border-black p-1 text-center font-bold">10%</td>
                      <td className="p-1 text-right font-bold">₹1,800 / month</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* TA */}
              <div className="break-inside-avoid">
                <h3 className="font-bold text-sm text-black border-b border-black pb-1 mb-2">2. Transport Allowance (TA) Schedule</h3>
                <table className="w-full text-xs text-center border-collapse border border-black">
                  <thead className="bg-gray-100">
                    <tr className="border-b border-black">
                      <th className="border-r border-black p-1.5 font-bold text-left">Employees Pay Level</th>
                      <th className="border-r border-black p-1.5 font-bold text-right">Higher TPTA Cities (₹ / month)</th>
                      <th className="border-r border-black p-1.5 font-bold text-right">Other Places (₹ / month)</th>
                      <th className="p-1.5 font-bold text-center">DA Payable on TA?</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-xs">
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-1 text-left font-sans font-bold">Pay Level 9 and above</td>
                      <td className="border-r border-black p-1 text-right font-bold">₹7,200 + DA%</td>
                      <td className="border-r border-black p-1 text-right font-bold">₹3,600 + DA%</td>
                      <td className="p-1 text-center font-bold">Yes</td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-1 text-left font-sans font-bold">Pay Level 3 to Level 8</td>
                      <td className="border-r border-black p-1 text-right font-bold">₹3,600 + DA%</td>
                      <td className="border-r border-black p-1 text-right font-bold">₹1,800 + DA%</td>
                      <td className="p-1 text-center font-bold">Yes</td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-1 text-left font-sans font-bold">Pay Level 1 and Level 2</td>
                      <td className="border-r border-black p-1 text-right font-bold">₹1,350 + DA%</td>
                      <td className="border-r border-black p-1 text-right font-bold">₹900 + DA%</td>
                      <td className="p-1 text-center font-bold">Yes</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-[9pt] text-gray-700 mt-1">
                  * PwD / Blind / Orthopedically handicapped employees are entitled to <strong>Double Transport Allowance</strong>.
                </p>
              </div>

              {/* NPA */}
              <div className="break-inside-avoid">
                <h3 className="font-bold text-sm text-black border-b border-black pb-1 mb-2">3. Non-Practicing Allowance (NPA)</h3>
                <div className="p-2 border border-black text-xs space-y-1">
                  <p><strong>7th CPC:</strong> 20% of Basic Pay (Ceiling: Basic Pay + NPA &le; ₹2,37,500/month). NPA counts for DA, but <strong>HRA is calculated on Basic Pay only</strong>.</p>
                  <p><strong>6th CPC:</strong> 25% of Basic Pay (Ceiling: Basic Pay + NPA &le; ₹85,000/month). HRA is on (Basic Pay + NPA).</p>
                </div>
              </div>
            </div>
          )}

          {/* Document Footer */}
          <div className="mt-1.5 pt-1 border-t border-gray-400 text-center text-[7pt] text-gray-600 print:mt-1 print:pt-0.5 break-inside-avoid">
            Generated by Arrear Ease • Standard Pay, DA & Allowance Reference (Based on MoF & Pay Commission Orders)
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SCREEN INTERACTIVE TABS VIEW (Hidden during Print)                       */}
        {/* ========================================================================= */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col overflow-hidden no-print"
        >
          {/* Tabs Navigation */}
          <div className="px-4 sm:px-6 pt-3 pb-2 border-b bg-muted/10">
            <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full h-auto p-1 bg-muted/60">
              <TabsTrigger value="7th-matrix" className="text-xs sm:text-sm py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <TableProperties className="h-3.5 w-3.5 mr-1.5 text-blue-600 dark:text-blue-400" />
                7th CPC Matrix
              </TabsTrigger>
              <TabsTrigger value="6th-structure" className="text-xs sm:text-sm py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Layers className="h-3.5 w-3.5 mr-1.5 text-amber-600 dark:text-amber-400" />
                6th CPC Structure
              </TabsTrigger>
              <TabsTrigger value="7th-da" className="text-xs sm:text-sm py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <TrendingUp className="h-3.5 w-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
                7th CPC DA Rates
              </TabsTrigger>
              <TabsTrigger value="6th-da" className="text-xs sm:text-sm py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <History className="h-3.5 w-3.5 mr-1.5 text-purple-600 dark:text-purple-400" />
                6th CPC DA Rates
              </TabsTrigger>
              <TabsTrigger value="allowances" className="text-xs sm:text-sm py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm col-span-2 sm:col-span-1">
                <Building2 className="h-3.5 w-3.5 mr-1.5 text-rose-600 dark:text-rose-400" />
                HRA, TA & NPA
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab 1: 7th CPC Pay Matrix Screen View */}
          <TabsContent
            value="7th-matrix"
            className="flex-1 flex flex-col overflow-hidden m-0 p-4 sm:p-6 data-[state=inactive]:hidden"
          >
            {/* Interactive Toolbar (Search & Filter) */}
            <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 mb-4 bg-card p-3 rounded-lg border shadow-xs">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="Search any Basic Pay (e.g. 56100)..."
                    value={searchPay}
                    onChange={(e) => setSearchPay(e.target.value)}
                    className="pl-9 h-9"
                  />
                  {searchPay && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchPay("")}
                      className="absolute right-1 top-1 h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <Filter className="h-4 w-4 text-muted-foreground ml-1" />
                  <select
                    value={selectedLevelFilter}
                    onChange={(e) => setSelectedLevelFilter(e.target.value)}
                    className="h-9 text-xs sm:text-sm rounded-md border border-input bg-background px-3 py-1 text-foreground shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
                  >
                    <option value="all">All Pay Levels (1 to 15VC)</option>
                    <option value="pb1">PB-1: Levels 1 to 5 (Entry ₹18,000 - ₹29,200)</option>
                    <option value="pb2">PB-2: Levels 6 to 9 (Entry ₹35,400 - ₹53,100)</option>
                    <option value="pb3">PB-3: Levels 10 to 12 & Academics (Entry ₹56,100 - ₹79,800)</option>
                    <option value="pb4">PB-4 & Apex: Levels 13 to 15VC (Entry ₹1,23,100 - ₹2,10,000)</option>
                    {payLevels7th.map((pl) => (
                      <option key={pl.level} value={pl.level}>
                        Level {pl.level} Only
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 justify-between">
                <div className="flex items-center border rounded-md p-0.5 bg-muted/40 text-xs">
                  <Button
                    variant={matrixViewMode === "table" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setMatrixViewMode("table")}
                    className="h-7 text-xs px-2.5"
                  >
                    Table Grid
                  </Button>
                  <Button
                    variant={matrixViewMode === "cards" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setMatrixViewMode("cards")}
                    className="h-7 text-xs px-2.5"
                  >
                    Level Cards
                  </Button>
                </div>

                <Badge variant="outline" className="font-mono text-xs px-2.5 py-1 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200">
                  {filteredPayLevels.length} Levels Active
                </Badge>
              </div>
            </div>

            {/* Search Result Banner */}
            {searchPay && (
              <div className="mb-3 p-2.5 px-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs sm:text-sm text-emerald-900 dark:text-emerald-200">
                    {searchResults.length > 0 ? (
                      <>
                        Basic Pay <strong>₹{parseInt(searchPay, 10).toLocaleString("en-IN")}</strong> found in:{" "}
                        {searchResults.map((m, idx) => (
                          <span key={idx} className="font-semibold text-emerald-700 dark:text-emerald-300 ml-1">
                            Level {m.level} (Index {m.stageIndex}){idx < searchResults.length - 1 ? "," : ""}
                          </span>
                        ))}
                      </>
                    ) : (
                      <>
                        Basic Pay <strong>₹{parseInt(searchPay, 10).toLocaleString("en-IN")}</strong> does not exist in any 7th CPC Pay Level.
                      </>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Screen Interactive Table / Cards View */}
            <div className="flex-1 overflow-auto rounded-lg border bg-card relative shadow-inner">
              {matrixViewMode === "table" ? (
                <div className="min-w-max">
                  {renderMatrixTable(filteredPayLevels)}
                </div>
              ) : (
                /* Level Cards View for Screen */
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPayLevels.map((pl) => {
                    const meta = LEVEL_METADATA[pl.level];
                    return (
                      <Card key={pl.level} className="border shadow-xs hover:shadow-md transition-shadow">
                        <CardHeader className="p-4 pb-2 bg-muted/30 border-b">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-base font-bold text-primary">
                                Level {pl.level}
                              </CardTitle>
                              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                                {meta?.payBand} • GP: {typeof meta?.gradePay === "number" ? `₹${meta.gradePay}` : meta?.gradePay || "-"}
                              </CardDescription>
                            </div>
                            <Badge variant="secondary" className="text-xs font-mono">
                              {pl.values.length} Stages
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-3 space-y-3">
                          <div className="grid grid-cols-2 gap-2 text-xs bg-muted/20 p-2.5 rounded-md">
                            <div>
                              <span className="text-muted-foreground block text-xs">Entry Basic (Stage 1)</span>
                              <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                                {(pl.values[0] || 0).toLocaleString("en-IN")}
                              </strong>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-xs">Max Basic (Stage {pl.values.length})</span>
                              <strong className="text-indigo-600 dark:text-indigo-400 font-mono text-sm">
                                {(pl.values[pl.values.length - 1] || 0).toLocaleString("en-IN")}
                              </strong>
                            </div>
                          </div>

                          <div className="max-h-56 overflow-y-auto border rounded-md p-2 space-y-1 bg-card">
                            <div className="grid grid-cols-3 text-xs font-mono gap-1.5 text-center">
                              {pl.values.map((v, i) => {
                                const isMatch = searchPay && v === parseInt(searchPay.trim(), 10);
                                return (
                                  <div
                                    key={i}
                                    className={cn(
                                      "p-1.5 rounded-sm border text-xs font-medium",
                                      isMatch
                                        ? "bg-emerald-600 text-white font-bold border-emerald-700 shadow-xs"
                                        : "bg-muted/30 hover:bg-muted"
                                    )}
                                  >
                                    <span className="text-muted-foreground text-[10px] block">#{i + 1}</span>
                                    {v.toLocaleString("en-IN")}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab 2: 6th CPC Structure Screen View */}
          <TabsContent
            value="6th-structure"
            className="flex-1 flex flex-col overflow-auto m-0 p-4 sm:p-6 space-y-6 data-[state=inactive]:hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-l-4 border-l-amber-500 bg-amber-50/20 dark:bg-amber-950/10">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    6th to 7th Fitment Factor
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1 text-xs text-muted-foreground">
                  Multiplying factor of <strong>2.57</strong> was applied to (6th CPC Basic + Grade Pay) to determine the fitment stage in 7th CPC.
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-blue-500 bg-blue-50/20 dark:bg-blue-950/10">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-bold text-blue-900 dark:text-blue-200">
                    Annual Increment in 6th CPC
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1 text-xs text-muted-foreground">
                  Annual Increment was <strong>3%</strong> calculated on (Pay in Pay Band + Grade Pay), rounded off to next multiple of 10.
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500 bg-purple-50/20 dark:bg-purple-950/10">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-bold text-purple-900 dark:text-purple-200">
                    Fixed Allowances (6th CPC)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1 text-xs text-muted-foreground">
                  HRA: <strong>{sixthCpcConfig?.hra6thRate ?? 20}%</strong> on (Basic + NPA). NPA: <strong>{sixthCpcConfig?.npa6thRate ?? 25}%</strong> on Basic Pay.
                </CardContent>
              </Card>
            </div>

            <Card className="border shadow-xs">
              <CardHeader className="p-4 bg-muted/30 border-b">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-amber-600" />
                  6th CPC Pay Bands & Grade Pay Schedule
                </CardTitle>
                <CardDescription className="text-xs">
                  Complete Grade Pay mapping with corresponding 7th CPC Pay Matrix Levels.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 text-xs">
                        <TableHead className="font-bold">6th CPC Level</TableHead>
                        <TableHead className="font-bold">Pay Band Name</TableHead>
                        <TableHead className="font-bold">Pay Band Scale (₹)</TableHead>
                        <TableHead className="font-bold text-right">Grade Pay (₹)</TableHead>
                        <TableHead className="font-bold text-center">Corresponding 7th CPC</TableHead>
                        <TableHead className="font-bold text-right">7th CPC Entry Pay (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs font-mono">
                      {SIXTH_CPC_STRUCTURE.map((row, idx) => (
                        <TableRow key={idx} className="hover:bg-muted/30">
                          <TableCell className="font-bold text-foreground">Level {row.level}</TableCell>
                          <TableCell className="font-sans font-medium">{row.payBand.split(" ")[0]}</TableCell>
                          <TableCell>{row.payBand.match(/\((.*?)\)/)?.[1] || row.payBand}</TableCell>
                          <TableCell className="text-right font-bold text-amber-600 dark:text-amber-400">
                            {row.gradePay > 0 ? `₹${row.gradePay.toLocaleString("en-IN")}` : "Apex / Fixed"}
                          </TableCell>
                          <TableCell className="text-center font-sans">
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                              {row.level7th}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                            ₹{row.entryPay7th.toLocaleString("en-IN")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: 7th CPC DA Rates Screen View (Descending Order) */}
          <TabsContent
            value="7th-da"
            className="flex-1 flex flex-col overflow-auto m-0 p-4 sm:p-6 space-y-6 data-[state=inactive]:hidden"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-muted/20 p-4 rounded-xl border">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  7th CPC Dearness Allowance (DA) Master Schedule
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  DA revisions arranged in <strong>descending order</strong> (latest rates on top).
                </p>
              </div>
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1 text-xs">
                Total Revisions: {sorted7thDaRates.length}
              </Badge>
            </div>

            <Card className="border shadow-xs">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 text-xs">
                        <TableHead className="font-bold">#</TableHead>
                        <TableHead className="font-bold">Effective From</TableHead>
                        <TableHead className="font-bold">Effective To</TableHead>
                        <TableHead className="font-bold text-center">DA Rate (%)</TableHead>
                        <TableHead className="font-bold text-center">Hike (+%)</TableHead>
                        <TableHead className="font-bold text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs font-mono">
                      {sorted7thDaRates.map((rateItem, idx) => {
                        const fromStr = rateItem.fromDate ? format(new Date(rateItem.fromDate), "dd-MM-yyyy") : "—";
                        const toStr = rateItem.toDate ? format(new Date(rateItem.toDate), "dd-MM-yyyy") : "Continuing";
                        const currentRate = Number(rateItem.rate);
                        const olderRate = idx < sorted7thDaRates.length - 1 ? Number(sorted7thDaRates[idx + 1].rate) : 0;
                        const diff = idx < sorted7thDaRates.length - 1 ? currentRate - olderRate : currentRate;
                        const isLatest = idx === 0;

                        return (
                          <TableRow
                            key={idx}
                            className={cn(
                              "hover:bg-muted/30 transition-colors",
                              isLatest ? "bg-emerald-50/40 dark:bg-emerald-950/20 font-bold" : ""
                            )}
                          >
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-semibold text-foreground">{fromStr}</TableCell>
                            <TableCell className="text-muted-foreground">{toStr}</TableCell>
                            <TableCell className="text-center font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                              {currentRate}%
                            </TableCell>
                            <TableCell className="text-center">
                              {diff > 0 ? (
                                <span className="text-emerald-700 dark:text-emerald-300 font-semibold">+{diff}%</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {isLatest ? (
                                <Badge className="bg-emerald-600 text-white text-[10px]">Latest / Active</Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground text-[10px]">
                                  Historical
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: 6th CPC DA Rates Screen View (Descending Order) */}
          <TabsContent
            value="6th-da"
            className="flex-1 flex flex-col overflow-auto m-0 p-4 sm:p-6 space-y-6 data-[state=inactive]:hidden"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-muted/20 p-4 rounded-xl border">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <History className="h-5 w-5 text-purple-600" />
                  6th CPC Dearness Allowance (DA) Master Schedule
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Historical DA progression in <strong>descending order</strong> from 139% down to 0%.
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                {sorted6thDaRates.length} Historical Stages
              </Badge>
            </div>

            <Card className="border shadow-xs">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 text-xs">
                        <TableHead className="font-bold">#</TableHead>
                        <TableHead className="font-bold">Effective Date</TableHead>
                        <TableHead className="font-bold text-center">DA Rate (%)</TableHead>
                        <TableHead className="font-bold text-center">Hike (+%)</TableHead>
                        <TableHead className="font-bold text-right">Pay Commission</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs font-mono">
                      {sorted6thDaRates.map((rateItem, idx) => {
                        const fromStr = rateItem.fromDate ? format(new Date(rateItem.fromDate), "dd-MM-yyyy") : "—";
                        const currentRate = Number(rateItem.rate);
                        const olderRate = idx < sorted6thDaRates.length - 1 ? Number(sorted6thDaRates[idx + 1].rate) : 0;
                        const diff = idx < sorted6thDaRates.length - 1 ? currentRate - olderRate : currentRate;

                        return (
                          <TableRow key={idx} className="hover:bg-muted/30">
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-semibold text-foreground">{fromStr}</TableCell>
                            <TableCell className="text-center font-extrabold text-sm text-purple-600 dark:text-purple-400">
                              {currentRate}%
                            </TableCell>
                            <TableCell className="text-center">
                              {diff > 0 ? (
                                <span className="text-purple-700 dark:text-purple-300 font-semibold">+{diff}%</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                6th Pay Commission
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 5: Other Allowances Screen View */}
          <TabsContent
            value="allowances"
            className="flex-1 flex flex-col overflow-auto m-0 p-4 sm:p-6 space-y-6 data-[state=inactive]:hidden"
          >
            {/* 1. HRA Classification */}
            <Card className="border shadow-xs">
              <CardHeader className="p-4 bg-muted/30 border-b">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-rose-600" />
                  House Rent Allowance (HRA) Rules (7th CPC & 6th CPC)
                </CardTitle>
                <CardDescription className="text-xs">
                  Classification of cities and automatic revision thresholds when DA crosses 25% and 50%.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="overflow-x-auto">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-bold">City Category</TableHead>
                        <TableHead className="font-bold">Population Criteria</TableHead>
                        <TableHead className="font-bold text-center">Initial Rate (DA &lt; 25%)</TableHead>
                        <TableHead className="font-bold text-center bg-amber-50/50 dark:bg-amber-950/20">When DA &gt; 25%</TableHead>
                        <TableHead className="font-bold text-center bg-emerald-50/50 dark:bg-emerald-950/20">When DA &gt; 50%</TableHead>
                        <TableHead className="font-bold text-right">Minimum HRA (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="font-mono">
                      <TableRow>
                        <TableCell className="font-bold text-foreground">Class X</TableCell>
                        <TableCell className="font-sans text-muted-foreground">50 Lakhs and above (Delhi, Mumbai, etc.)</TableCell>
                        <TableCell className="text-center font-bold">24%</TableCell>
                        <TableCell className="text-center font-bold text-amber-600 dark:text-amber-400 bg-amber-50/30">27%</TableCell>
                        <TableCell className="text-center font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/30">30%</TableCell>
                        <TableCell className="text-right font-bold">₹5,400 / month</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-bold text-foreground">Class Y</TableCell>
                        <TableCell className="font-sans text-muted-foreground">5 to 50 Lakhs (Aligarh, Lucknow, Jaipur, etc.)</TableCell>
                        <TableCell className="text-center font-bold">16%</TableCell>
                        <TableCell className="text-center font-bold text-amber-600 dark:text-amber-400 bg-amber-50/30">18%</TableCell>
                        <TableCell className="text-center font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/30">20%</TableCell>
                        <TableCell className="text-right font-bold">₹3,600 / month</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-bold text-foreground">Class Z</TableCell>
                        <TableCell className="font-sans text-muted-foreground">Below 5 Lakhs & all remaining locations</TableCell>
                        <TableCell className="text-center font-bold">8%</TableCell>
                        <TableCell className="text-center font-bold text-amber-600 dark:text-amber-400 bg-amber-50/30">9%</TableCell>
                        <TableCell className="text-center font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/30">10%</TableCell>
                        <TableCell className="text-right font-bold">₹1,800 / month</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* 2. Transport Allowance (TA / TPTA) */}
            <Card className="border shadow-xs">
              <CardHeader className="p-4 bg-muted/30 border-b">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Car className="h-4 w-4 text-blue-600" />
                  Transport Allowance (TA) Structure (7th CPC)
                </CardTitle>
                <CardDescription className="text-xs">
                  Fixed allowance amounts. Dearness Allowance (DA %) is additionally payable on Transport Allowance.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="overflow-x-auto">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-bold">Employees Pay Level</TableHead>
                        <TableHead className="font-bold text-right">Higher TPTA Cities (₹ / month)</TableHead>
                        <TableHead className="font-bold text-right">Other Places (₹ / month)</TableHead>
                        <TableHead className="font-bold text-center">DA Applicable?</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="font-mono">
                      <TableRow>
                        <TableCell className="font-bold text-foreground font-sans">
                          Pay Level 9 and above
                        </TableCell>
                        <TableCell className="text-right font-bold text-blue-600 dark:text-blue-400">
                          ₹7,200 + DA%
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          ₹3,600 + DA%
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-emerald-600 border-emerald-200">Yes</Badge>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-bold text-foreground font-sans">
                          Pay Level 3 to Level 8
                        </TableCell>
                        <TableCell className="text-right font-bold text-blue-600 dark:text-blue-400">
                          ₹3,600 + DA%
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          ₹1,800 + DA%
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-emerald-600 border-emerald-200">Yes</Badge>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-bold text-foreground font-sans">
                          Pay Level 1 and Level 2
                        </TableCell>
                        <TableCell className="text-right font-bold text-blue-600 dark:text-blue-400">
                          ₹1,350 + DA%
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          ₹900 + DA%
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-emerald-600 border-emerald-200">Yes</Badge>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <div className="p-3 bg-muted/20 rounded-md text-xs text-muted-foreground space-y-1">
                  <p>
                    <strong>Note 1 (Divyangjan / PwD Employees):</strong> Visually impaired, orthopedically handicapped employees are entitled to <strong>Double Transport Allowance (Normal TA × 2)</strong>, subject to minimum ₹2,250 + DA.
                  </p>
                  <p>
                    <strong>Note 2 (Higher TPTA Cities):</strong> 19 specified urban agglomerations including Delhi, Mumbai, Kolkata, Chennai, Bengaluru, Hyderabad, Ahmedabad, Pune, etc.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 3. Non-Practicing Allowance (NPA) */}
            <Card className="border shadow-xs">
              <CardHeader className="p-4 bg-muted/30 border-b">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <HeartPulse className="h-4 w-4 text-rose-600" />
                  Non-Practicing Allowance (NPA) Rules
                </CardTitle>
                <CardDescription className="text-xs">
                  Payable to eligible medical and dental doctors/officers in Central & State Services.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-2 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg border bg-card">
                    <h4 className="font-bold text-sm text-foreground mb-1">7th Central Pay Commission</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Rate: <strong>20% of Basic Pay</strong></li>
                      <li>Basic Pay + NPA shall not exceed <strong>₹2,37,500 per month</strong></li>
                      <li>NPA counts as Pay for <strong>Dearness Allowance (DA)</strong> calculations.</li>
                      <li><strong>HRA in 7th CPC is calculated ONLY on Basic Pay</strong> (NPA is not added).</li>
                    </ul>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <h4 className="font-bold text-sm text-foreground mb-1">6th Central Pay Commission</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Rate: <strong>25% of Basic Pay (Pay in Pay Band + Grade Pay)</strong></li>
                      <li>Basic Pay + NPA shall not exceed <strong>₹85,000 per month</strong></li>
                      <li>HRA is calculated on (Basic Pay + NPA).</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal Footer (Hidden during Print) */}
        <div className="p-3 sm:px-6 border-t bg-muted/20 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-muted-foreground no-print">
          <div className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-primary" />
            <span>Click <strong>Print Reference</strong> to generate a high-quality standard printable document.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="h-8">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
