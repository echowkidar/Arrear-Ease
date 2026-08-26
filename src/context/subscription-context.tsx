"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/context/auth-context";

export type PlanType = "free" | "single" | "pro" | "unlimited";

export interface PlanDetails {
  id: PlanType;
  name: string;
  price: number;
  credits: number; // -1 for unlimited
  validityDays: number;
  features: string[];
  badge?: string;
  popular?: boolean;
}

export const PRICING_PLANS: PlanDetails[] = [
  {
    id: "single",
    name: "Single Sheet Audit",
    price: 49,
    credits: 1,
    validityDays: 30,
    features: [
      "1 Comprehensive AI Sheet Audit",
      "7th & 6th CPC Rule Verification",
      "DA, HRA & TA Rate Consistency",
      "Instant Accuracy Score & Report",
      "Digital AI Verified Badge",
    ],
  },
  {
    id: "pro",
    name: "Professional Pack",
    price: 199,
    credits: 10,
    validityDays: 365,
    features: [
      "10 Full AI Arrear Verifications",
      "Downloadable AI Audit Certificate",
      "Multi-Period Fixation Audit",
      "Priority AI Analysis Queue",
      "Dedicated Calculation Review",
    ],
    popular: true,
    badge: "Most Popular",
  },
  {
    id: "unlimited",
    name: "Annual Unlimited",
    price: 999,
    credits: -1,
    validityDays: 365,
    features: [
      "Unlimited AI Statement Audits (1 Year)",
      "Official Printable Audit Certificates",
      "Batch Department Statement Auditing",
      "Immediate Priority Processing",
      "Email & WhatsApp Support",
    ],
    badge: "Best Value",
  },
];

export interface PaymentTransaction {
  id: string;
  planId: PlanType;
  planName: string;
  amount: number;
  date: string;
  utr: string;
  status: "completed" | "pending";
}

interface SubscriptionContextType {
  currentPlan: PlanType;
  credits: number;
  expiresAt: string | null;
  transactions: PaymentTransaction[];
  merchantUpiId: string;
  merchantName: string;
  hasCredits: () => boolean;
  isUnlimited: () => boolean;
  consumeCredit: () => boolean;
  activatePlan: (planId: PlanType, utr: string) => void;
  resetToFree: () => void;
}

const STORAGE_KEY = "arrear_ease_subscription_v1";

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [currentPlan, setCurrentPlan] = useState<PlanType>("free");
  const [credits, setCredits] = useState<number>(0);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [merchantUpiId, setMerchantUpiId] = useState<string>("arrearease@upi");
  const [merchantName, setMerchantName] = useState<string>("Arrear Ease");
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const { user, authStatus } = useAuth();

  // 1. Load dynamic merchant UPI configuration from localStorage & Firestore
  useEffect(() => {
    try {
      const local = localStorage.getItem("arrearEase_payment_config");
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed.merchantUpiId) setMerchantUpiId(parsed.merchantUpiId);
        if (parsed.merchantName) setMerchantName(parsed.merchantName);
      }
    } catch (e) {
      console.warn("Local payment config read note:", e);
    }

    if (!db) return;
    try {
      const unsub = onSnapshot(
        doc(db, "configurations", "payment_settings"),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.merchantUpiId) setMerchantUpiId(data.merchantUpiId);
            if (data.merchantName) setMerchantName(data.merchantName);
          }
        },
        (err) => console.warn("Payment settings realtime sync note:", err)
      );
      return () => unsub();
    } catch (err) {
      console.warn("Firestore snapshot attach note:", err);
    }
  }, []);

  // 2. Load from localStorage on initial mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setCurrentPlan(parsed.currentPlan || "free");
        setCredits(parsed.credits ?? 0);
        setExpiresAt(parsed.expiresAt || null);
        setTransactions(parsed.transactions || []);
      }
    } catch (e) {
      console.error("Failed to load subscription state:", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // 3. Sync with Firestore User Account if authenticated
  useEffect(() => {
    if (!db || authStatus !== "authenticated" || !user?.uid) return;

    const unsubUser = onSnapshot(
      doc(db, "users", user.uid),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.subscriptionPlan) {
            setCurrentPlan(data.subscriptionPlan);
          }
          if (data.credits !== undefined) {
            setCredits(data.credits);
          }
          if (data.planExpiresAt) {
            setExpiresAt(data.planExpiresAt);
          }
        }
      },
      (err) => console.warn("User subscription sync note:", err)
    );

    return () => unsubUser();
  }, [user?.uid, authStatus]);

  // 4. Save to localStorage whenever state changes
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          currentPlan,
          credits,
          expiresAt,
          transactions,
        })
      );
    } catch (e) {
      console.error("Failed to save subscription state:", e);
    }
  }, [currentPlan, credits, expiresAt, transactions, isLoaded]);

  const hasCredits = () => {
    if (currentPlan === "unlimited") {
      if (!expiresAt) return true;
      return new Date(expiresAt) > new Date();
    }
    return credits > 0;
  };

  const isUnlimited = () => {
    if (currentPlan !== "unlimited") return false;
    if (!expiresAt) return true;
    return new Date(expiresAt) > new Date();
  };

  const consumeCredit = () => {
    if (isUnlimited()) return true;
    if (credits > 0) {
      setCredits((prev) => Math.max(0, prev - 1));
      return true;
    }
    return false;
  };

  const activatePlan = (planId: PlanType, utr: string) => {
    const plan = PRICING_PLANS.find((p) => p.id === planId);
    if (!plan) return;

    const txn: PaymentTransaction = {
      id: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      planId,
      planName: plan.name,
      amount: plan.price,
      date: new Date().toISOString(),
      utr: utr || `MOCK-UTR-${Date.now()}`,
      status: "completed",
    };

    if (planId === "unlimited") {
      setCurrentPlan("unlimited");
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + plan.validityDays);
      setExpiresAt(expiry.toISOString());
    } else {
      if (currentPlan !== "unlimited") {
        setCurrentPlan(planId);
      }
      setCredits((prev) => prev + plan.credits);
    }

    setTransactions((prev) => [txn, ...prev]);
  };

  const resetToFree = () => {
    setCurrentPlan("free");
    setCredits(0);
    setExpiresAt(null);
  };

  return (
    <SubscriptionContext.Provider
      value={{
        currentPlan,
        credits,
        expiresAt,
        transactions,
        merchantUpiId,
        merchantName,
        hasCredits,
        isUnlimited,
        consumeCredit,
        activatePlan,
        resetToFree,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
}
