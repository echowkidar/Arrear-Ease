
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';
import { 
    onAuthStateChanged, 
    signOut,
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink,
    updateProfile,
    type User, 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
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
    authMessage: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const EMAIL_FOR_SIGN_IN_KEY = 'emailForSignIn';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
    const [loading, setLoading] = useState(true);
    const [isAuthModalOpen, setAuthModalOpen] = useState(false);
    const [authMessage, setAuthMessage] = useState<string | null>(null);

    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        const processSignIn = async () => {
            if (isFirebaseConfigured() && auth && isSignInWithEmailLink(auth, window.location.href)) {
                setLoading(true);
                let email = window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
                if (!email) {
                    // This can happen if the user opens the link on a different device.
                    // We can ask them to provide their email again.
                    email = window.prompt('Please provide your email for confirmation');
                }

                if(email) {
                    try {
                        const result = await signInWithEmailLink(auth, email, window.location.href);
                        window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
                        
                        const firebaseUser = result.user;
                        const userDoc = await getDoc(doc(db!, 'users', firebaseUser.uid));
                        if (!userDoc.exists()) {
                            await setDoc(doc(db!, 'users', firebaseUser.uid), {
                                email: firebaseUser.email,
                                createdAt: new Date(),
                            });
                             if (!firebaseUser.displayName) {
                                const name = firebaseUser.email?.split('@')[0] || 'New User';
                                await updateProfile(firebaseUser, { displayName: name });
                            }
                        }
                        setUser(firebaseUser);
                        setAuthStatus('authenticated');
                        toast({ title: 'Successfully signed in!', description: 'Welcome back.'});

                    } catch(error) {
                        console.error("Sign in with email link error:", error);
                        toast({ variant: 'destructive', title: 'Sign In Failed', description: 'The sign-in link is invalid or has expired.' });
                    }
                }
                // Clean the URL
                router.replace('/');
                setLoading(false);
            }
        }
        processSignIn();
    }, [router, toast]);


    useEffect(() => {
        if (!isFirebaseConfigured() || !auth) {
            setAuthStatus('unauthenticated');
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            setAuthStatus(currentUser ? 'authenticated' : 'unauthenticated');
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleEmailSignIn = async (email: string) => {
        if (!auth) return;
        const actionCodeSettings = {
            url: window.location.origin,
            handleCodeInApp: true,
        };
        try {
            await sendSignInLinkToEmail(auth, email, actionCodeSettings);
            window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, email);
            setAuthMessage(`A sign-in link has been sent to ${email}. Please check your inbox.`);
        } catch(error) {
            console.error("Error sending sign in link:", error);
            toast({ variant: 'destructive', title: 'Failed to Send Link', description: 'Could not send sign-in link. Please try again.'});
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
