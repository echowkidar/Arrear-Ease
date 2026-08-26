"use client";

import React, { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Sparkles,
  Award,
  Calendar,
  User,
  FileCheck,
  Building,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export interface AIAuditResult {
  certificateId: string;
  verifiedDate: string;
  employeeName: string;
  employeeId?: string;
  designation?: string;
  cpc: string;
  totalDifference: number;
  totalMonths: number;
  score: number;
  status: "VERIFIED_ACCURATE" | "WARNINGS_DETECTED" | "DISCREPANCIES_FOUND";
  ruleChecklist: {
    rule: string;
    status: "pass" | "warning" | "fail";
    description: string;
  }[];
  auditorComments: string;
}

interface AIAuditReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditResult: AIAuditResult | null;
  isLoading?: boolean;
}

export function AIAuditReportModal({
  isOpen,
  onClose,
  auditResult,
  isLoading = false,
}: AIAuditReportModalProps) {
  const certificateRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrintCertificate = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto p-0 border-border bg-background shadow-2xl rounded-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>AI Statement Audit Report</DialogTitle>
          <DialogDescription>Official verification certificate and rule compliance audit report.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="p-12 text-center space-y-4">
            <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto animate-pulse">
              <Sparkles className="h-8 w-8 animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-foreground">
                AI Statement Audit in Progress...
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Auditing basic pay stages, DA slabs, HRA base rules, and mathematical balances...
              </p>
            </div>
          </div>
        ) : auditResult ? (
          <div className="p-6 sm:p-8 space-y-6">
            {/* Modal Header & Actions */}
            <div className="flex items-center justify-between border-b pb-4 no-print">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-extrabold text-foreground flex items-center gap-2">
                    AI Statement Audit Report
                    <Badge className="bg-emerald-600 text-white text-xs">
                      Score: {auditResult.score}%
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Certificate ID: <span className="font-mono font-bold text-foreground">{auditResult.certificateId}</span>
                  </DialogDescription>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintCertificate}
                className="flex items-center gap-1.5 text-xs font-semibold h-8"
              >
                <Printer className="h-4 w-4" />
                <span>Print Certificate</span>
              </Button>
            </div>

            {/* Certificate Canvas Area */}
            <div
              ref={certificateRef}
              className="p-6 sm:p-8 rounded-xl border-2 border-emerald-600/30 bg-gradient-to-b from-emerald-500/5 via-card to-card shadow-sm space-y-6 relative overflow-hidden"
            >
              {/* Official Watermark / Stamp */}
              <div className="absolute right-4 top-4 opacity-10 pointer-events-none">
                <Award className="h-36 w-36 text-emerald-600" />
              </div>

              {/* Certificate Top Header */}
              <div className="text-center space-y-1 border-b border-border pb-4">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">
                  <FileCheck className="h-3.5 w-3.5" />
                  Official Arrear Ease Audit Certificate
                </div>
                <h2 className="text-2xl font-black text-foreground tracking-tight">
                  CERTIFICATE OF AI VERIFICATION
                </h2>
                <p className="text-xs text-muted-foreground">
                  Verified as per Government Pay Commission Schedules & Finance Ministry Guidelines
                </p>
              </div>

              {/* Verified Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-muted/40 p-3.5 rounded-lg border border-border">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Employee Name</span>
                  <strong className="text-foreground text-[13px]">{auditResult.employeeName}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Pay Structure</span>
                  <strong className="text-foreground text-[13px]">{auditResult.cpc} CPC Scale</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Total Arrear Due</span>
                  <strong className="text-emerald-600 dark:text-emerald-400 text-[13px]">
                    Rs. {auditResult.totalDifference.toLocaleString("en-IN")}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Audited Period</span>
                  <strong className="text-foreground text-[13px]">{auditResult.totalMonths} Months</strong>
                </div>
              </div>

              {/* Rule-by-Rule Audit Checklist */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Itemized Verification Checklist
                </h4>
                <div className="space-y-2">
                  {auditResult.ruleChecklist.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-2.5 rounded-lg bg-card border border-border/80 text-xs"
                    >
                      {item.status === "pass" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <strong className="text-foreground block">{item.rule}</strong>
                        <p className="text-muted-foreground text-[11px] mt-0.5">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Auditor Summary Comments */}
              <div className="p-3.5 bg-primary/5 rounded-lg border border-primary/20 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-primary text-[11px] uppercase">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Auditor Assessment
                </div>
                <p className="text-foreground/90 italic leading-relaxed text-[12px]">
                  "{auditResult.auditorComments}"
                </p>
              </div>

              {/* Certificate Footer Signature & QR Stamp */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-4 border-t border-border text-[11px] text-muted-foreground">
                <div>
                  <span>Verified On: </span>
                  <strong className="text-foreground">
                    {format(new Date(auditResult.verifiedDate), "dd MMMM yyyy, HH:mm")}
                  </strong>
                </div>
                <div className="text-right">
                  <span className="font-mono text-[10px] bg-muted px-2 py-0.5 rounded border">
                    {auditResult.certificateId}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Close CTA */}
            <div className="flex justify-end gap-2 no-print">
              <Button onClick={onClose} className="font-semibold text-xs px-6">
                Done / Back to Statement
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
