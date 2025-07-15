
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, isFirebaseConfigured, sendPasswordResetEmail } from '@/lib/firebase';
import { 
    onAuthStateChanged, 
    signOut,
    updateProfile,
    type User, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    type AuthError
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
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
    signUpWithEmailPassword: (email: string, password: string, phoneNumber: string) => Promise<void>;
    signInWithEmailPassword: (email: string, password: string) => Promise<void>;
    sendPasswordReset: (email: string) => Promise<void>;
    authError: string | null;
    authMessage: string | null;
    clearAuthMessages: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const EMAIL_FOR_SIGN_IN_KEY = 'emailForSignIn';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
    const [loading, setLoading] = useState(true);
    const [isAuthModalOpen, setAuthModalOpen] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [authMessage, setAuthMessage] = useState<string | null>(null);

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
            } else {
                setUser(null);
                setAuthStatus('unauthenticated');
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleAuthError = (error: AuthError) => {
        switch (error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                setAuthError('Invalid email or password. Please try again.');
                break;
            case 'auth/email-already-in-use':
                setAuthError('An account with this email already exists.');
                break;
            case 'auth/weak-password':
                setAuthError('The password is too weak. Please use a stronger password.');
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

    const signUpWithEmailPassword = async (email: string, password: string, phoneNumber: string) => {
        if (!auth || !db) return;
        clearAuthMessages();
        try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            const firebaseUser = result.user;

            await updateProfile(firebaseUser, { displayName: email.split('@')[0] });
            
            await setDoc(doc(db, 'users', firebaseUser.uid), {
                email: email,
                displayName: email.split('@')[0],
                phoneNumber: phoneNumber,
                createdAt: serverTimestamp(),
            });

            const updatedUser: User = { ...firebaseUser, email: email, displayName: email.split('@')[0] };
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
