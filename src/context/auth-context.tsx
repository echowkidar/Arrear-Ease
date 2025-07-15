
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';
import { 
    onAuthStateChanged, 
    signOut,
    updateProfile,
    type User, 
    signInAnonymously,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
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
    handleEmailSignIn: (email: string) => Promise<void>;
    verifyOtp: (otp: string) => void;
    isAwaitingOtp: boolean;
    authMessage: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
    const [loading, setLoading] = useState(true);
    const [isAuthModalOpen, setAuthModalOpen] = useState(false);
    const [authMessage, setAuthMessage] = useState<string | null>(null);
    const [isAwaitingOtp, setIsAwaitingOtp] = useState(false);
    const [sessionOtp, setSessionOtp] = useState<string | null>(null);
    const [sessionEmail, setSessionEmail] = useState<string | null>(null);


    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        if (!isFirebaseConfigured() || !auth) {
            setAuthStatus('unauthenticated');
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser && !currentUser.isAnonymous) {
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

    const handleEmailSignIn = async (email: string) => {
        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        setSessionOtp(generatedOtp);
        setSessionEmail(email);

        console.log(`OTP for ${email}: ${generatedOtp}`);
        toast({
            title: "OTP Sent (Simulated)",
            description: `Your OTP is: ${generatedOtp}`,
            duration: 10000 // Keep it on screen longer
        });
        
        setIsAwaitingOtp(true);
    };

    const verifyOtp = async (otp: string) => {
        if (otp === sessionOtp && sessionEmail) {
            try {
                if (!auth) throw new Error("Auth not initialized");

                const result = await signInAnonymously(auth);
                const firebaseUser = result.user;

                await updateProfile(firebaseUser, { displayName: sessionEmail.split('@')[0] });
                
                await setDoc(doc(db!, 'users', firebaseUser.uid), {
                    email: sessionEmail,
                    createdAt: serverTimestamp(),
                }, { merge: true });

                const updatedUser: User = { ...firebaseUser, email: sessionEmail, displayName: sessionEmail.split('@')[0] };
                setUser(updatedUser);

                toast({ title: "Successfully signed in!", description: 'Welcome!' });
                closeAuthModal();
                setAuthStatus('authenticated');
            } catch (error) {
                console.error("Error creating user session:", error);
                toast({ variant: 'destructive', title: 'Sign In Failed', description: 'Could not create a user session.' });
            }

        } else {
            toast({ variant: 'destructive', title: 'Invalid OTP', description: 'The OTP you entered is incorrect. Please try again.' });
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
        setAuthMessage(null);
        setIsAwaitingOtp(false);
        setSessionEmail(null);
        setSessionOtp(null);
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
            handleEmailSignIn,
            verifyOtp,
            isAwaitingOtp,
            authMessage
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
