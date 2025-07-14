
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

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
const app = isFirebaseConfigured() && !getApps().length ? initializeApp(firebaseConfig) : (getApps().length ? getApp() : null);
const db = app ? getFirestore(app) : null;

// Enable offline persistence if db is initialized
if (db) {
    enableIndexedDbPersistence(db)
      .catch((err) => {
        if (err.code == 'failed-precondition') {
          // Multiple tabs open, persistence can only be enabled in one.
          // Silently fail, or log if you want.
          console.warn("Firebase persistence failed: multiple tabs open.");
        } else if (err.code == 'unimplemented') {
          // The current browser does not support all of the
          // features required to enable persistence
          console.warn("Firebase persistence not available in this browser.");
        }
      });
}


export { db };
