// Firestore storage for saved pay fixation documents (images).
//  payFixationFiles/{id}  – the full image (Bytes), downloaded only when opened.
//  payFixationThumbs/{id} – same id, a small thumbnail + details; lists use only these.
//  savedStatements/{statementId}.payFixation = { count, bytes, updatedAt } – counters,
//  so lists know which statements have a pay fixation without reading any image.
// ownerId on both docs = the statement's owner (userId). See firestore.rules.
import {
  Bytes,
  collection,
  count,
  doc,
  getAggregateFromServer,
  getDoc,
  getDocs,
  increment,
  query,
  sum,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PreparedPayFixation } from "@/lib/pay-fixation-image";

export const PF_FILES = "payFixationFiles";
export const PF_THUMBS = "payFixationThumbs";
const STATEMENTS = "savedStatements";

export interface PayFixationThumb {
  id: string;
  statementId: string;
  ownerId: string;
  page: number;
  width: number;
  height: number;
  mime: string;
  bytes: number; // full image size
  thumbBytes: number;
  createdAt: string;
  uploadedBy: string;
  thumbUrl: string; // object URL of the thumbnail (revoke when done)
}

const need = () => {
  if (!db) throw new Error("Database is not configured.");
  return db;
};

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const blobToBytes = async (b: Blob) => Bytes.fromUint8Array(new Uint8Array(await b.arrayBuffer()));
const bytesToBlob = (b: any, mime: string) => {
  const arr: Uint8Array = b && typeof b.toUint8Array === "function" ? b.toUint8Array() : new Uint8Array();
  return new Blob([arr as BlobPart], { type: mime || "image/webp" });
};

/** Saves one page. The statement must already exist in Firestore. */
export async function uploadPayFixation(opts: {
  statementId: string;
  ownerId: string;
  uploadedBy: string;
  page: number;
  image: PreparedPayFixation;
}): Promise<string> {
  const fs = need();
  const id = newId();
  const now = new Date().toISOString();
  const { image } = opts;
  const batch = writeBatch(fs);
  batch.set(doc(fs, PF_FILES, id), {
    statementId: opts.statementId,
    ownerId: opts.ownerId,
    image: await blobToBytes(image.full),
    mime: image.full.type,
    createdAt: now,
  });
  batch.set(doc(fs, PF_THUMBS, id), {
    statementId: opts.statementId,
    ownerId: opts.ownerId,
    page: opts.page,
    width: image.width,
    height: image.height,
    mime: image.full.type,
    bytes: image.full.size,
    thumb: await blobToBytes(image.thumb),
    thumbMime: image.thumb.type,
    thumbBytes: image.thumb.size,
    createdAt: now,
    uploadedBy: opts.uploadedBy,
  });
  batch.update(doc(fs, STATEMENTS, opts.statementId), {
    "payFixation.count": increment(1),
    "payFixation.bytes": increment(image.full.size + image.thumb.size),
    "payFixation.updatedAt": now,
  });
  await batch.commit();
  return id;
}

const toThumb = (id: string, d: any): PayFixationThumb => ({
  id,
  statementId: d.statementId,
  ownerId: d.ownerId,
  page: Number(d.page) || 1,
  width: Number(d.width) || 0,
  height: Number(d.height) || 0,
  mime: d.mime || "image/webp",
  bytes: Number(d.bytes) || 0,
  thumbBytes: Number(d.thumbBytes) || 0,
  createdAt: d.createdAt || "",
  uploadedBy: d.uploadedBy || "",
  thumbUrl: URL.createObjectURL(bytesToBlob(d.thumb, d.thumbMime)),
});

/**
 * Thumbnails of the given statements (only thumbnails are downloaded).
 * A normal user's query must be limited to their own documents (security rules).
 */
export async function fetchThumbs(statementIds: string[], uid: string, isAdmin: boolean): Promise<PayFixationThumb[]> {
  const fs = need();
  const ids = [...new Set(statementIds.filter(Boolean))];
  const out: PayFixationThumb[] = [];
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30);
    const q = isAdmin
      ? query(collection(fs, PF_THUMBS), where("statementId", "in", chunk))
      : query(collection(fs, PF_THUMBS), where("ownerId", "==", uid), where("statementId", "in", chunk));
    const snap = await getDocs(q);
    snap.forEach((d) => out.push(toThumb(d.id, d.data())));
  }
  return out.sort((a, b) => a.statementId.localeCompare(b.statementId) || a.createdAt.localeCompare(b.createdAt) || a.page - b.page);
}

const fullCache = new Map<string, Blob>();

/** The full image (cached for this page session). */
export async function fetchFullImage(id: string): Promise<Blob> {
  const hit = fullCache.get(id);
  if (hit) return hit;
  const snap = await getDoc(doc(need(), PF_FILES, id));
  if (!snap.exists()) throw new Error("Image not found.");
  const d = snap.data();
  const blob = bytesToBlob(d.image, d.mime);
  fullCache.set(id, blob);
  return blob;
}

/** Deletes one page and lowers the statement's counters. */
export async function deletePayFixation(t: Pick<PayFixationThumb, "id" | "statementId" | "bytes" | "thumbBytes">) {
  const fs = need();
  const batch = writeBatch(fs);
  batch.delete(doc(fs, PF_FILES, t.id));
  batch.delete(doc(fs, PF_THUMBS, t.id));
  const st = await getDoc(doc(fs, STATEMENTS, t.statementId)).catch(() => null);
  if (st?.exists()) {
    batch.update(doc(fs, STATEMENTS, t.statementId), {
      "payFixation.count": increment(-1),
      "payFixation.bytes": increment(-(t.bytes + t.thumbBytes)),
      "payFixation.updatedAt": new Date().toISOString(),
    });
  }
  await batch.commit();
  fullCache.delete(t.id);
}

/** Removes all pages of a statement (used when the statement is deleted). */
export async function deleteAllPayFixations(statementId: string, uid: string, isAdmin: boolean) {
  const fs = need();
  const q = isAdmin
    ? query(collection(fs, PF_THUMBS), where("statementId", "==", statementId))
    : query(collection(fs, PF_THUMBS), where("ownerId", "==", uid), where("statementId", "==", statementId));
  const snap = await getDocs(q);
  if (snap.empty) return 0;
  const batch = writeBatch(fs);
  snap.forEach((d) => {
    batch.delete(doc(fs, PF_FILES, d.id));
    batch.delete(doc(fs, PF_THUMBS, d.id));
  });
  await batch.commit();
  return snap.size;
}

/** Admin: when a statement is given to another user, its pay fixation goes with it. */
export async function reassignPayFixations(statementId: string, newOwnerId: string) {
  const fs = need();
  const snap = await getDocs(query(collection(fs, PF_THUMBS), where("statementId", "==", statementId)));
  if (snap.empty) return;
  const batch = writeBatch(fs);
  snap.forEach((d) => {
    batch.update(doc(fs, PF_FILES, d.id), { ownerId: newOwnerId });
    batch.update(doc(fs, PF_THUMBS, d.id), { ownerId: newOwnerId });
  });
  await batch.commit();
}

/** Exact count and bytes of saved pay fixation images (all users for the admin). */
export async function fetchPayFixationUsage(uid: string, isAdmin: boolean) {
  const fs = need();
  const q = isAdmin ? collection(fs, PF_THUMBS) : query(collection(fs, PF_THUMBS), where("ownerId", "==", uid));
  const snap = await getAggregateFromServer(q, { images: count(), bytes: sum("bytes"), thumbBytes: sum("thumbBytes") });
  const d = snap.data();
  return { images: d.images || 0, bytes: (d.bytes || 0) + (d.thumbBytes || 0) };
}
