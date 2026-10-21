"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  doc,
  onSnapshot,
  addDoc,
  collection,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
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

export type PaymentStatus = "pending" | "completed" | "rejected";

export interface PaymentTransaction {
  id: string;
  planId: PlanType;
  planName: string;
  amount: number;
  date: string;
  utr: string;
  status: PaymentStatus;
  userId?: string;
  userEmail?: string;
  userName?: string;
  migrated?: boolean;
  legacyCredits?: number;
  legacyExpiresAt?: string | null;
}

interface SubscriptionContextType {
  currentPlan: PlanType;
  credits: number;
  expiresAt: string | null;
  transactions: PaymentTransaction[];
  pendingTransactions: PaymentTransaction[];
  merchantUpiId: string;
  merchantName: string;
  hasCredits: () => boolean;
  isUnlimited: () => boolean;
  /** Creates a "pending" payment request. Admin approves it from the Users page. */
  submitPaymentRequest: (planId: PlanType, utr: string) => Promise<void>;
}

// Old versions kept the plan only in this browser's localStorage. It is no longer
// trusted for access; it is only read once to send a pending request to the admin.
const LEGACY_STORAGE_KEY = "arrear_ease_subscription_v1";
const LEGACY_MIGRATED_KEY = "arrear_ease_subscription_v1_migrated";
const ADMIN_EMAIL = "amulivealigarh@gmail.com";
const PAID_PLAN_IDS: PlanType[] = ["single", "pro", "unlimited"];

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [currentPlan, setCurrentPlan] = useState<PlanType>("free");
  const [credits, setCredits] = useState<number>(0);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [merchantUpiId, setMerchantUpiId] = useState<string>("arrearease@upi");
  const [merchantName, setMerchantName] = useState<string>("Arrear Ease");

  const { user, authStatus } = useAuth();
  const isAdmin = authStatus === "authenticated" && user?.email === ADMIN_EMAIL;

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

  // 2. Plan & credits come ONLY from the user's Firestore account (set by admin).
  useEffect(() => {
    if (!db || authStatus !== "authenticated" || !user?.uid) {
      setCurrentPlan("free");
      setCredits(0);
      setExpiresAt(null);
      return;
    }

    const unsubUser = onSnapshot(
      doc(db, "users", user.uid),
      (docSnap) => {
        const data = docSnap.exists() ? docSnap.data() : {};
        setCurrentPlan((data.subscriptionPlan as PlanType) || "free");
        setCredits(typeof data.credits === "number" ? data.credits : 0);
        setExpiresAt(data.planExpiresAt || null);
        migrateLegacyPlanOnce(docSnap.exists() ? data : null);
      },
      (err) => console.warn("User subscription sync note:", err)
    );

    return () => unsubUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, authStatus]);

  // 3. The user's own payment requests (to show "pending" status)
  useEffect(() => {
    if (!db || authStatus !== "authenticated" || !user?.uid) {
      setTransactions([]);
      return;
    }
    const q = query(collection(db, "payment_transactions"), where("userId", "==", user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PaymentTransaction[];
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTransactions(list);
      },
      (err) => console.warn("Payment requests sync note:", err)
    );
    return () => unsub();
  }, [user?.uid, authStatus]);

  // One-time: if this browser has a plan from the old version (stored only locally),
  // send it to the admin as a pending request so the paid user doesn't lose it.
  const migrationStarted = React.useRef(false);
  const migrateLegacyPlanOnce = async (userData: any) => {
    if (!db || !user?.uid || migrationStarted.current) return;
    try {
      if (localStorage.getItem(LEGACY_MIGRATED_KEY)) return;
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return;
      migrationStarted.current = true;

      // Admin already assigned a plan in Firestore => nothing to migrate.
      if (userData?.subscriptionPlan && userData.subscriptionPlan !== "free") {
        localStorage.setItem(LEGACY_MIGRATED_KEY, new Date().toISOString());
        return;
      }

      const legacy = JSON.parse(raw);
      const legacyTx: any[] = Array.isArray(legacy.transactions) ? legacy.transactions : [];
      const realTx = legacyTx.filter(
        (t) =>
          t &&
          typeof t.utr === "string" &&
          t.utr.trim() &&
          !/^(DEMO|MOCK)/i.test(t.utr) &&
          PAID_PLAN_IDS.includes(t.planId)
      );
      if (realTx.length === 0) {
        localStorage.setItem(LEGACY_MIGRATED_KEY, new Date().toISOString());
        return;
      }

      const planId: PlanType = PAID_PLAN_IDS.includes(legacy.currentPlan)
        ? legacy.currentPlan
        : realTx[0].planId;
      const plan = PRICING_PLANS.find((p) => p.id === planId)!;

      await addDoc(collection(db, "payment_transactions"), {
        planId,
        planName: `${plan.name} (old version)`,
        amount: realTx.reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
        utr: realTx.map((t) => String(t.utr).trim()).join(", "),
        date: realTx[0].date || new Date().toISOString(),
        status: "pending",
        userId: user.uid,
        userEmail: user.email || null,
        userName: user.displayName || null,
        migrated: true,
        legacyCredits: typeof legacy.credits === "number" ? legacy.credits : 0,
        legacyExpiresAt: legacy.expiresAt || null,
        createdAt: serverTimestamp(),
      });
      localStorage.setItem(LEGACY_MIGRATED_KEY, new Date().toISOString());
    } catch (e) {
      migrationStarted.current = false; // retry on next load
      console.warn("Legacy plan migration note:", e);
    }
  };

  const isUnlimited = () => {
    if (isAdmin) return true;
    if (currentPlan !== "unlimited") return false;
    if (!expiresAt) return true;
    return new Date(expiresAt) > new Date();
  };

  const hasCredits = () => {
    if (isUnlimited()) return true;
    return credits > 0;
  };

  const submitPaymentRequest = async (planId: PlanType, utr: string) => {
    const plan = PRICING_PLANS.find((p) => p.id === planId);
    if (!plan) throw new Error("Invalid plan selected.");
    if (!db) throw new Error("Database is not available. Please try again later.");
    if (authStatus !== "authenticated" || !user?.uid) {
      throw new Error("Please sign in before submitting a payment.");
    }
    const cleanUtr = utr.replace(/\s+/g, "");
    if (transactions.some((t) => t.utr === cleanUtr && t.status !== "rejected")) {
      throw new Error("This UTR has already been submitted.");
    }

    await addDoc(collection(db, "payment_transactions"), {
      planId,
      planName: plan.name,
      amount: plan.price,
      utr: cleanUtr,
      date: new Date().toISOString(),
      status: "pending",
      userId: user.uid,
      userEmail: user.email || null,
      userName: user.displayName || null,
      createdAt: serverTimestamp(),
    });
  };

  const pendingTransactions = transactions.filter((t) => t.status === "pending");

  return (
    <SubscriptionContext.Provider
      value={{
        currentPlan,
        credits,
        expiresAt,
        transactions,
        pendingTransactions,
        merchantUpiId,
        merchantName,
        hasCredits,
        isUnlimited,
        submitPaymentRequest,
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
