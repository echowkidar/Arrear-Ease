// Server-only helpers: verify Firebase ID tokens and read/update the caller's
// Firestore user document via the Firestore REST API using the caller's own
// token (so Firestore security rules still apply). No service account needed.
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const ADMIN_EMAIL = "amulivealigarh@gmail.com";

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
const CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let certCache: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getGoogleCerts(): Promise<Record<string, string>> {
  if (certCache && certCache.expiresAt > Date.now()) return certCache.certs;
  const res = await fetch(CERTS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch Google certs: ${res.status}`);
  const certs = (await res.json()) as Record<string, string>;
  const cacheControl = res.headers.get("cache-control") || "";
  const maxAge = Number(/max-age=(\d+)/.exec(cacheControl)?.[1] || 3600);
  certCache = { certs, expiresAt: Date.now() + maxAge * 1000 };
  return certs;
}

function decodePart(part: string): any {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

export interface VerifiedUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  isAdmin: boolean;
  token: string;
}

export async function verifyIdToken(token: string): Promise<VerifiedUser | null> {
  if (!PROJECT_ID || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = decodePart(parts[0]);
    const payload = decodePart(parts[1]);
    if (header.alg !== "RS256" || !header.kid) return null;

    const now = Math.floor(Date.now() / 1000);
    if (payload.aud !== PROJECT_ID) return null;
    if (payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) return null;
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    if (typeof payload.exp !== "number" || payload.exp < now - 30) return null;
    if (typeof payload.iat !== "number" || payload.iat > now + 300) return null;

    let certs = await getGoogleCerts();
    if (!certs[header.kid]) {
      certCache = null; // keys rotated, refetch once
      certs = await getGoogleCerts();
    }
    const cert = certs[header.kid];
    if (!cert) return null;

    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(`${parts[0]}.${parts[1]}`);
    verifier.end();
    if (!verifier.verify(cert, Buffer.from(parts[2], "base64url"))) return null;

    const email: string | null = payload.email || null;
    return {
      uid: payload.sub,
      email,
      emailVerified: payload.email_verified === true,
      isAdmin: email === ADMIN_EMAIL,
      token,
    };
  } catch (err) {
    console.error("ID token verification failed:", err);
    return null;
  }
}

/** Returns the verified user, or a 401 response to return directly. */
export async function requireUser(
  req: NextRequest
): Promise<{ user: VerifiedUser; error?: undefined } | { user?: undefined; error: NextResponse }> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const user = token ? await verifyIdToken(token) : null;
  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Please sign in to use this feature.", code: "auth-required" },
        { status: 401 }
      ),
    };
  }
  return { user };
}

// ---------- Firestore REST (runs with the caller's token => rules apply) ----------

const docUrl = (path: string) =>
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;

function fromFirestoreValue(v: any): any {
  if (!v || typeof v !== "object") return undefined;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  return undefined;
}

export interface UserDocInfo {
  exists: boolean;
  updateTime?: string;
  subscriptionPlan?: string;
  credits?: number;
  planExpiresAt?: string;
  allowBasicPayAutoFill?: boolean;
}

export async function getOwnUserDoc(user: VerifiedUser): Promise<UserDocInfo> {
  const res = await fetch(docUrl(`users/${user.uid}`), {
    headers: { Authorization: `Bearer ${user.token}` },
    cache: "no-store",
  });
  if (res.status === 404) return { exists: false };
  if (!res.ok) throw new Error(`Firestore read failed: ${res.status}`);
  const json = await res.json();
  const f = json.fields || {};
  return {
    exists: true,
    updateTime: json.updateTime,
    subscriptionPlan: fromFirestoreValue(f.subscriptionPlan),
    credits: fromFirestoreValue(f.credits),
    planExpiresAt: fromFirestoreValue(f.planExpiresAt),
    allowBasicPayAutoFill: fromFirestoreValue(f.allowBasicPayAutoFill),
  };
}

export function hasUnlimitedAccess(info: UserDocInfo): boolean {
  if (info.subscriptionPlan !== "unlimited") return false;
  if (!info.planExpiresAt) return true;
  const exp = new Date(info.planExpiresAt);
  return isNaN(exp.getTime()) ? true : exp > new Date();
}

export function availableCredits(info: UserDocInfo): number {
  return typeof info.credits === "number" && info.credits > 0 ? Math.floor(info.credits) : 0;
}

/**
 * Deducts exactly one credit from the caller's own user doc.
 * Firestore rules only allow a user to lower their credits by 1.
 */
export async function deductOneCredit(user: VerifiedUser): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const info = await getOwnUserDoc(user);
    const current = availableCredits(info);
    if (!info.exists || current <= 0 || !info.updateTime) return false;

    const params = new URLSearchParams();
    params.append("updateMask.fieldPaths", "credits");
    params.append("currentDocument.updateTime", info.updateTime);
    const res = await fetch(`${docUrl(`users/${user.uid}`)}?${params.toString()}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${user.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields: { credits: { integerValue: String(current - 1) } } }),
    });
    if (res.ok) return true;
    // 400/409 FAILED_PRECONDITION => doc changed meanwhile, retry
    if (res.status !== 400 && res.status !== 409) {
      console.error("Credit deduction failed:", res.status, await res.text());
      return false;
    }
  }
  return false;
}
