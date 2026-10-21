"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  PRICING_PLANS,
  PlanDetails,
  PlanType,
  useSubscription,
} from "@/context/subscription-context";
import { QRCode } from "@/components/ui/qr-code";
import {
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  ArrowLeft,
  Copy,
  Check,
  Zap,
  Smartphone,
  ExternalLink,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import { useAuth } from "@/context/auth-context";

interface AIPricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess?: () => void;
  initialPromptText?: string;
  isAdmin?: boolean;
}

export function AIPricingModal({
  isOpen,
  onClose,
  onPaymentSuccess,
  initialPromptText,
  isAdmin = false,
}: AIPricingModalProps) {
  const { submitPaymentRequest, pendingTransactions, merchantUpiId, merchantName } = useSubscription();
  const { authStatus, openAuthModal } = useAuth();
  const { toast } = useToast();

  const [selectedPlan, setSelectedPlan] = useState<PlanDetails | null>(
    PRICING_PLANS.find((p) => p.id === "pro") || PRICING_PLANS[0]
  );
  const [step, setStep] = useState<"plans" | "checkout" | "success">("plans");
  const [utrNumber, setUtrNumber] = useState<string>("");
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentPrice = selectedPlan ? selectedPlan.price : 0;
  const upiIntentString = `upi://pay?pa=${merchantUpiId}&pn=${encodeURIComponent(
    merchantName
  )}&am=${currentPrice}&cu=INR&tn=${encodeURIComponent(
    selectedPlan?.name || "AI Arrear Verification"
  )}`;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(merchantUpiId);
    setCopiedUpi(true);
    toast({
      title: "UPI ID Copied",
      description: `${merchantUpiId} copied to clipboard!`,
    });
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const handleSelectPlan = (plan: PlanDetails) => {
    setSelectedPlan(plan);
    setStep("checkout");
  };

  const handleVerifyAndComplete = async () => {
    if (!selectedPlan) return;

    if (authStatus !== "authenticated") {
      toast({
        variant: "destructive",
        title: "Please Sign In",
        description: "Sign in first so your payment can be linked to your account.",
      });
      onClose();
      openAuthModal();
      return;
    }

    const utr = utrNumber.replace(/\s+/g, "");
    if (!/^[A-Za-z0-9]{6,30}$/.test(utr)) {
      toast({
        variant: "destructive",
        title: "UTR / Transaction ID Required",
        description: "Please enter the 12-digit UPI reference (UTR) number from your payment receipt.",
      });
      return;
    }

    setIsVerifying(true);
    try {
      await submitPaymentRequest(selectedPlan.id, utr);
      setStep("success");
      toast({
        title: "Payment Request Submitted",
        description: "Your plan will be activated after the admin verifies your payment.",
      });
    } catch (err: any) {
      console.error("Payment request failed:", err);
      toast({
        variant: "destructive",
        title: "Could Not Submit",
        description: err?.message || "Please try again.",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCloseModal = () => {
    if (step === "success") {
      setStep("plans");
      setUtrNumber("");
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleCloseModal(); }}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto p-0 gap-0 border-border bg-background shadow-2xl rounded-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>AI Verification Plans & Payment</DialogTitle>
          <DialogDescription>Select an AI audit plan and complete payment with UPI.</DialogDescription>
        </DialogHeader>
        {/* ========================================================================= */}
        {/* STEP 1: PLANS SELECTION                                                   */}
        {/* ========================================================================= */}
        {step === "plans" && (
          <div className="p-5 sm:p-7 space-y-6">
            <DialogHeader className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-semibold mx-auto">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>AI Statement Audit & Verification</span>
              </div>
              <DialogTitle className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Verify Your Arrear Sheet with AI
              </DialogTitle>
              <DialogDescription className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
                {initialPromptText ||
                  "Ensure 100% compliance with 7th/6th CPC rules, DA/HRA schedules, and increment stages with our instant AI audit engine."}
              </DialogDescription>
            </DialogHeader>

            {pendingTransactions.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  You have {pendingTransactions.length} payment request(s) pending verification
                  (UTR: {pendingTransactions.map((t) => t.utr).join(", ")}). Your plan will be
                  activated once the admin approves it.
                </span>
              </div>
            )}

            {/* Pricing Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 pt-2">
              {PRICING_PLANS.map((plan) => {
                const isSelected = selectedPlan?.id === plan.id;
                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "relative rounded-xl border p-5 sm:p-6 flex flex-col justify-between transition-all duration-200 bg-card hover:shadow-lg",
                      plan.popular
                        ? "border-primary shadow-md ring-2 ring-primary/20 bg-gradient-to-b from-primary/5 to-transparent"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    {plan.badge && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground font-semibold px-3 py-0.5 text-xs shadow-sm">
                          {plan.badge}
                        </Badge>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div>
                        <h3 className="font-bold text-lg text-foreground">{plan.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {plan.credits === -1
                            ? "Unlimited sheet audits for 1 full year"
                            : `${plan.credits} Comprehensive AI Sheet Verification`}
                        </p>
                      </div>

                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-extrabold text-foreground font-sans">
                          Rs. {plan.price}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {plan.credits === -1 ? "/ year" : "one-time"}
                        </span>
                      </div>

                      <div className="space-y-2.5 pt-3 border-t border-border/60 text-xs sm:text-sm">
                        {plan.features.map((feat, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-foreground/90">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      onClick={() => handleSelectPlan(plan)}
                      className={cn(
                        "w-full mt-6 font-semibold shadow-sm",
                        plan.popular
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      )}
                    >
                      <Zap className="h-4 w-4 mr-1.5" />
                      Select & Pay with UPI
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Guarantee Note */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-muted/40 rounded-xl border border-border/80 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Instant activation via any UPI app (GPay, PhonePe, Paytm, BHIM, Cred).</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-xs text-muted-foreground hover:text-foreground h-8"
              >
                Skip for now
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: UPI PAYMENT CHECKOUT                                              */}
        {/* ========================================================================= */}
        {step === "checkout" && selectedPlan && (
          <div className="p-5 sm:p-7 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep("plans")}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Change Plan</span>
              </Button>
              <div className="text-right">
                <span className="text-xs text-muted-foreground font-medium">Selected Plan:</span>
                <p className="text-sm font-bold text-foreground">
                  {selectedPlan.name} (Rs. {selectedPlan.price})
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Left Column: Dynamic QR Code */}
              <div className="flex flex-col items-center justify-center p-5 bg-muted/30 rounded-xl border border-border text-center space-y-3">
                <div className="relative group">
                  <QRCode value={upiIntentString} size={190} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-foreground flex items-center justify-center gap-1.5">
                    <Smartphone className="h-3.5 w-3.5 text-primary" />
                    Scan with any UPI App
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Google Pay • PhonePe • Paytm • BHIM • Cred
                  </p>
                </div>
                <div className="text-lg font-black text-primary bg-primary/10 px-4 py-1 rounded-full border border-primary/20">
                  Amount: Rs. {selectedPlan.price}
                </div>
              </div>

              {/* Right Column: UPI ID Copy & Confirmation */}
              <div className="space-y-4">
                {/* Copy UPI ID */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Pay to Merchant UPI ID
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={merchantUpiId}
                      className="font-mono text-xs bg-muted/50 font-bold text-foreground"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopyUpi}
                      className="shrink-0 h-9 font-medium"
                    >
                      {copiedUpi ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600 mr-1" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 mr-1" /> Copy ID
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Direct UPI App Trigger (for mobile) */}
                <div>
                  <Label className="text-xs text-muted-foreground block mb-1.5">
                    Direct Mobile Intent:
                  </Label>
                  <a
                    href={upiIntentString}
                    className="inline-flex items-center justify-center w-full h-9 rounded-md bg-secondary text-secondary-foreground font-semibold text-xs hover:bg-secondary/80 border transition-all"
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Open UPI App Directly
                  </a>
                </div>

                {/* UTR Reference Input */}
                <div className="space-y-1.5 pt-2 border-t border-border">
                  <Label htmlFor="utr" className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Enter 12-Digit UTR / Transaction Ref No.</span>
                    <span className="text-[10px] text-muted-foreground font-normal">(From payment receipt)</span>
                  </Label>
                  <Input
                    id="utr"
                    placeholder="e.g. 423819284729"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>

                {/* Complete & Verify Button */}
                <div className="space-y-2 pt-2">
                  <Button
                    onClick={handleVerifyAndComplete}
                    disabled={isVerifying}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 shadow-md"
                  >
                    {isVerifying ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
                        Submitting...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Submit Payment for Verification
                      </span>
                    )}
                  </Button>

                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: SUCCESS ANIMATION                                                 */}
        {/* ========================================================================= */}
        {step === "success" && (
          <div className="p-8 text-center space-y-4">
            <div className="h-16 w-16 bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-foreground">Payment Request Submitted</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Your payment is <strong>pending verification</strong>. Your plan will be activated
                as soon as the admin verifies the UTR — usually within a few hours.
              </p>
            </div>
            <Button onClick={handleCloseModal} className="mt-2">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
