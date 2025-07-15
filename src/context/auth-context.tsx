
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';
import { 
    onAuthStateChanged, 
    RecaptchaVerifier, 
    signInWithPhoneNumber,
    signOut,
    type User, 
    type ConfirmationResult 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

type AuthStatus = 'authenticated' | 'guest' | 'unauthenticated' | 'loading';

interface AuthContextType {
    user: User | null;
    authStatus: AuthStatus;
    loading: boolean;
    logout: () => void;
    openAuthModal: (callback?: () => void) => void;
    closeAuthModal: () => void;
    openGuestModal: (callback?: () => void) => void;
    closeGuestModal: () => void;
    isAuthModalOpen: boolean;
    isGuestModalOpen: boolean;
    isOtpModalOpen: boolean;
    handleFullSignup: (name: string, email: string, phone: string) => Promise<void>;
    handleGuestSignin: (name: string, phone: string) => Promise<void>;
    handleOtpSubmit: (otp: string) => Promise<void>;
    resendOtp: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
    const [loading, setLoading] = useState(true);
    const [isAuthModalOpen, setAuthModalOpen] = useState(false);
    const [isGuestModalOpen, setGuestModalOpen] = useState(false);
    const [isOtpModalOpen, setOtpModalOpen] = useState(false);
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const [pendingAuthData, setPendingAuthData] = useState<{name: string; email?: string; phone: string} | null>(null);
    const [onSuccessCallback, setOnSuccessCallback] = useState<(() => void) | null>(() => null);

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
                const userDoc = await getDoc(doc(db!, "users", currentUser.uid));
                if (userDoc.exists()) {
                    // This is a fully signed-up user
                    setUser(currentUser);
                    setAuthStatus('authenticated');
                } else {
                    // This is a temporary/guest user
                    setUser(currentUser);
                    setAuthStatus('guest');
                }
            } else {
                setUser(null);
                setAuthStatus('unauthenticated');
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const setupRecaptcha = () => {
        if (!auth) return;
        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'invisible',
                'callback': (response: any) => {
                    // reCAPTCHA solved, allow signInWithPhoneNumber.
                }
            });
        }
    };
    
    const sendOtp = async (phone: string) => {
        if (!auth) throw new Error("Firebase Auth not configured.");
        setupRecaptcha();
        const appVerifier = window.recaptchaVerifier;
        try {
            const result = await signInWithPhoneNumber(auth, `+${phone}`, appVerifier);
            setConfirmationResult(result);
            return result;
        } catch (error) {
            console.error("Error sending OTP:", error);
            toast({ variant: "destructive", title: "OTP Error", description: "Failed to send OTP. Please check the phone number and try again." });
            window.recaptchaVerifier.render().then((widgetId: any) => {
                grecaptcha.reset(widgetId);
            });
            throw error;
        }
    };

    const handleFullSignup = async (name: string, email: string, phone: string) => {
        try {
            setPendingAuthData({ name, email, phone });
            await sendOtp(phone);
            setAuthModalOpen(false);
            setOtpModalOpen(true);
        } catch (error) {
            // Error is handled in sendOtp
        }
    };

    const handleGuestSignin = async (name: string, phone: string) => {
        try {
            setPendingAuthData({ name, phone });
            await sendOtp(phone);
            setGuestModalOpen(false);
            setOtpModalOpen(true);
        } catch (error) {
             // Error is handled in sendOtp
        }
    };

    const handleOtpSubmit = async (otp: string) => {
        if (!confirmationResult || !pendingAuthData) return;
        try {
            const result = await confirmationResult.confirm(otp);
            const firebaseUser = result.user;

            if (pendingAuthData.email) { // Full signup
                await setDoc(doc(db!, "users", firebaseUser.uid), {
                    name: pendingAuthData.name,
                    email: pendingAuthData.email,
                    phone: pendingAuthData.phone,
                });
                toast({ title: "Signup Successful", description: "Welcome to ArrearEase!" });
            } else { // Guest signin
                 toast({ title: "Verification Successful", description: "You can now calculate arrears." });
            }
            
            setOtpModalOpen(false);
            if (onSuccessCallback) {
                onSuccessCallback();
                setOnSuccessCallback(null);
            }

        } catch (error) {
            console.error("OTP verification failed:", error);
            toast({ variant: "destructive", title: "Invalid OTP", description: "The OTP you entered is incorrect. Please try again." });
        }
    };
    
    const resendOtp = async () => {
      if (!pendingAuthData) return;
      toast({ title: "Resending OTP..." });
      try {
        await sendOtp(pendingAuthData.phone);
        toast({ title: "OTP Resent", description: "A new OTP has been sent to your phone." });
      } catch (error) {
        // Error handled in sendOtp
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

    const openAuthModal = (callback?: () => void) => {
        if (callback) setOnSuccessCallback(() => callback);
        setAuthModalOpen(true);
    }
    const closeAuthModal = () => setAuthModalOpen(false);

    const openGuestModal = (callback?: () => void) => {
        if (callback) setOnSuccessCallback(() => callback);
        setGuestModalOpen(true);
    };
    const closeGuestModal = () => setGuestModalOpen(false);

    return (
        <AuthContext.Provider value={{ 
            user, 
            authStatus, 
            loading, 
            logout,
            openAuthModal,
            closeAuthModal,
            openGuestModal,
            closeGuestModal,
            isAuthModalOpen,
            isGuestModalOpen,
            isOtpModalOpen,
            handleFullSignup,
            handleGuestSignin,
            handleOtpSubmit,
            resendOtp,
        }}>
            {children}
            <div id="recaptcha-container"></div>
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
