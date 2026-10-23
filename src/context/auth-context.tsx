
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, isFirebaseConfigured, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } from '@/lib/firebase';
import { 
    onAuthStateChanged, 
    signOut,
    updateProfile,
    type User, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    type AuthError
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

type AuthStatus = 'authenticated' | 'unauthenticated' | 'loading';

interface AuthContextType {
    user: User | null;
    authStatus: AuthStatus;
    loading: boolean;
    logout: () => void;
    openAuthModal: () => void;
    closeAuthModal: () => void;
    isAuthModalOpen: boolean;
    signUpWithEmailPassword: (email: string, password: string, name: string, phoneNumber: string) => Promise<void>;
    signInWithEmailPassword: (email: string, password: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    sendPasswordReset: (email: string) => Promise<void>;
    authError: string | null;
    authMessage: string | null;
    clearAuthMessages: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Use a session-level flag to prevent repeated updates
let sessionLoginUpdated = false;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
    const [loading, setLoading] = useState(true);
    const [isAuthModalOpen, setAuthModalOpen] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [authMessage, setAuthMessage] = useState<string | null>(null);
    // re-render consumers after the profile name is synced from the users document
    const [, setProfileVersion] = useState(0);

    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        if (!isFirebaseConfigured() || !auth) {
            setAuthStatus('unauthenticated');
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setAuthStatus('authenticated');
                // The name saved in the users document (edited by the user/admin) is the
                // one to show — not the Google account name.
                if (db) {
                    try {
                        const snap = await getDoc(doc(db, 'users', currentUser.uid));
                        const savedName = snap.exists() ? String(snap.data()?.displayName || '').trim() : '';
                        if (savedName && savedName !== currentUser.displayName) {
                            await updateProfile(currentUser, { displayName: savedName });
                            setProfileVersion((v) => v + 1);
                        }
                    } catch (error) {
                        console.warn("Could not sync profile name:", error);
                    }
                }
                // Update last login timestamp, but only once per session
                if (!sessionLoginUpdated && db) {
                    const userDocRef = doc(db, 'users', currentUser.uid);
                    try {
                        // Use setDoc with merge: true instead of updateDoc
                        // This prevents errors if onAuthStateChanged fires before the user doc is fully created during signup
                        await setDoc(userDocRef, {
                            lastLogin: serverTimestamp()
                        }, { merge: true });
                        sessionLoginUpdated = true;
                    } catch (error) {
                        console.error("Failed to update last login time:", error);
                    }
                }
            } else {
                setUser(null);
                setAuthStatus('unauthenticated');
                sessionLoginUpdated = false; // Reset flag on logout
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleAuthError = (error: AuthError) => {
        switch (error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':  // New Firebase SDK v9+ error code
            case 'auth/invalid-email':
                setAuthError('Invalid email or password. Please try again.');
                break;
            case 'auth/email-already-in-use':
                setAuthError('An account with this email already exists.');
                break;
            case 'auth/weak-password':
                setAuthError('The password is too weak. Please use a stronger password.');
                break;
            case 'auth/too-many-requests':
                setAuthError('Too many failed attempts. Please wait a moment and try again.');
                break;
            default:
                setAuthError('An unexpected error occurred. Please try again.');
                console.error(error);
        }
    }
    
    const clearAuthMessages = () => {
      setAuthError(null);
      setAuthMessage(null);
    };

    const signUpWithEmailPassword = async (email: string, password: string, name: string, phoneNumber: string) => {
        if (!auth || !db) return;
        clearAuthMessages();
        try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            const firebaseUser = result.user;

            await updateProfile(firebaseUser, { displayName: name });
            
            await setDoc(doc(db, 'users', firebaseUser.uid), {
                email: email,
                displayName: name,
                phoneNumber: phoneNumber,
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp(),
            });

            const updatedUser: User = { ...firebaseUser, email: email, displayName: name };
            setUser(updatedUser);

            toast({ title: "Account Created!", description: 'Welcome! You are now signed in.' });
            closeAuthModal();
            setAuthStatus('authenticated');
        } catch (error) {
            handleAuthError(error as AuthError);
        }
    };

    const signInWithEmailPassword = async (email: string, password: string) => {
        if (!auth) return;
        clearAuthMessages();
        try {
            await signInWithEmailAndPassword(auth, email, password);
            toast({ title: "Successfully signed in!", description: 'Welcome back!' });
            closeAuthModal();
        } catch (error) {
            handleAuthError(error as AuthError);
        }
    };
    
    const signInWithGoogle = async () => {
        if (!auth || !db) return;
        clearAuthMessages();
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const firebaseUser = result.user;
            
            // Keep a name the user/admin has already set; the Google account name is
            // used only for a new account (or one that has no name yet).
            const userRef = doc(db, 'users', firebaseUser.uid);
            const existing = await getDoc(userRef).catch(() => null);
            const savedName = existing?.exists() ? String(existing.data()?.displayName || '').trim() : '';
            await setDoc(userRef, {
                email: firebaseUser.email,
                ...(savedName ? {} : { displayName: firebaseUser.displayName || 'Google User' }),
                ...(existing?.exists() ? {} : { createdAt: serverTimestamp() }),
                lastLogin: serverTimestamp(),
            }, { merge: true });
            if (savedName && savedName !== firebaseUser.displayName) {
                await updateProfile(firebaseUser, { displayName: savedName }).catch(() => {});
                setProfileVersion((v) => v + 1);
            }

            setUser(firebaseUser);
            toast({ title: "Successfully signed in!", description: 'Welcome via Google!' });
            closeAuthModal();
            setAuthStatus('authenticated');
        } catch (error) {
            handleAuthError(error as AuthError);
        }
    };

    const sendPasswordReset = async (email: string) => {
        if (!auth) return;
        clearAuthMessages();
        try {
            await sendPasswordResetEmail(auth, email);
            setAuthMessage("Password reset email sent. Please check your inbox.");
        } catch (error) {
            handleAuthError(error as AuthError);
        }
    };

    const logout = async () => {
        if (!auth) return;
        await signOut(auth);
        setUser(null);
        setAuthStatus('unauthenticated');
        router.push('/');
        toast({ title: "Logged Out", description: "You have been successfully logged out." });
    };

    const openAuthModal = () => setAuthModalOpen(true);

    const closeAuthModal = () => {
        setAuthModalOpen(false);
        clearAuthMessages();
    }

    return (
        <AuthContext.Provider value={{ 
            user, 
            authStatus, 
            loading, 
            logout,
            openAuthModal,
            closeAuthModal,
            isAuthModalOpen,
            signUpWithEmailPassword,
            signInWithEmailPassword,
            signInWithGoogle,
            sendPasswordReset,
            authError,
            authMessage,
            clearAuthMessages
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
