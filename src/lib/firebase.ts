
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Function to check if Firebase is configured
export const isFirebaseConfigured = () => {
    return !!firebaseConfig.apiKey && !!firebaseConfig.projectId;
};

// Initialize Firebase only if it's configured
const app: FirebaseApp | null = isFirebaseConfigured() && !getApps().length ? initializeApp(firebaseConfig) : (getApps().length ? getApp() : null);
const db = app ? getFirestore(app) : null;
const auth: Auth | null = app ? getAuth(app) : null;

// Enable offline persistence with multi-tab support if db is initialized
if (db) {
    enableIndexedDbPersistence(db, { synchronizeTabs: true })
      .catch((err) => {
        if (err.code == 'failed-precondition') {
          // This can happen if the user has multiple tabs open with different
          // persistence settings.
          console.warn("Firebase persistence failed: failed-precondition. Please close other tabs and refresh.");
        } else if (err.code == 'unimplemented') {
          // The current browser does not support all of the
          // features required to enable persistence
          console.warn("Firebase persistence not available in this browser.");
        }
      });
}


export { db, auth, app };
