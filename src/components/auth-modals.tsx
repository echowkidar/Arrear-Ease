
"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/context/auth-context';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Input } from './ui/input';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(1, "Password is required."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const signupSchema = z.object({
  name: z.string().min(1, "Name is required."),
  email: z.string().email({ message: "Please enter a valid email address." }),
  phoneNumber: z.string().min(1, "Phone number is required."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

type AuthMode = 'login' | 'signup' | 'forgot_password';

export function AuthModal() {
  const { 
    isAuthModalOpen, 
    closeAuthModal, 
    signUpWithEmailPassword,
    signInWithEmailPassword,
    signInWithGoogle,
    sendPasswordReset,
    authError,
    authMessage,
    clearAuthMessages,
  } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');

  const form = useForm<LoginFormValues | SignupFormValues | ForgotPasswordFormValues>({
    resolver: zodResolver(
      mode === 'login' ? loginSchema :
      mode === 'signup' ? signupSchema :
      forgotPasswordSchema
    ),
    defaultValues: {
      email: "",
      password: "",
      name: "",
      confirmPassword: "",
      phoneNumber: "",
    },
  });
  
  const onSubmit = async (values: any) => {
    setIsLoading(true);
    if (mode === 'signup') {
      const fullPhoneNumber = `+91${values.phoneNumber}`;
      await signUpWithEmailPassword(values.email, values.password, values.name, fullPhoneNumber);
    } else if (mode === 'login') {
      await signInWithEmailPassword(values.email, values.password);
    } else if (mode === 'forgot_password') {
        await sendPasswordReset(values.email);
    }
    setIsLoading(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      form.reset();
      clearAuthMessages();
      closeAuthModal();
      setMode('login');
    }
  };

  const toggleMode = (newMode: AuthMode) => {
      setMode(newMode);
      form.reset({
        email: "",
        password: "",
        name: "",
        confirmPassword: "",
        phoneNumber: "",
      });
      clearAuthMessages();
  }
  
  const getTitle = () => {
      if (mode === 'signup') return "Create an Account";
      if (mode === 'forgot_password') return "Reset Password";
      return "Login";
  }

  const getDescription = () => {
    if (mode === 'signup') return "Enter your details to create a new account.";
    if (mode === 'forgot_password') return "Enter your email to receive a password reset link.";
    return "Enter your email and password to sign in.";
  }
  
  const renderFormFields = () => {
    if (mode === 'forgot_password') {
        return (
             <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" placeholder="your.email@example.com" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
        )
    }

    return (
        <>
            {mode === 'signup' && (
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl><Input placeholder="Your Name" {...field} value={field.value ?? ''} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            )}
            <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" placeholder="your.email@example.com" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            {mode === 'signup' && (
                <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <div className="flex items-center">
                          <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-background text-muted-foreground text-sm h-10">
                            +91
                          </span>
                          <FormControl>
                            <Input 
                              type="tel" 
                              placeholder="9876543210" 
                              className="rounded-l-none"
                              {...field} 
                              value={field.value ?? ''} 
                            />
                          </FormControl>
                        </div>
                        <FormMessage />
                    </FormItem>
                )} />
            )}
             <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl><Input type="password" placeholder="••••••••" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            {mode === 'signup' && (
                <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl><Input type="password" placeholder="••••••••" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                </FormItem>
                )} />
            )}
        </>
    )
  }

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
           <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                {authError && <Alert variant="destructive"><AlertDescription>{authError}</AlertDescription></Alert>}
                {authMessage && <Alert variant="default" className="border-green-500 text-green-700"><AlertDescription>{authMessage}</AlertDescription></Alert>}
                
                {renderFormFields()}

                {mode === 'login' && (
                     <div className="text-sm">
                        <Button type="button" variant="link" onClick={() => toggleMode('forgot_password')} className="p-0 h-auto">
                           Forgot Password?
                        </Button>
                     </div>
                )}
                
                {(mode === 'login' || mode === 'signup') && (
                    <div className="flex flex-col space-y-4 pt-2">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                            </div>
                        </div>
                        <Button 
                            type="button" 
                            variant="outline" 
                            className="w-full bg-white text-gray-700 hover:bg-gray-50 border-gray-300 shadow-sm"
                            onClick={async () => {
                                setIsLoading(true);
                                await signInWithGoogle();
                                setIsLoading(false);
                            }} 
                            disabled={isLoading}
                        >
                            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="mr-2 h-5 w-5">
                                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z"></path>
                                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                                <path fill="none" d="M0 0h48v48H0z"></path>
                            </svg>
                            Continue with Google
                        </Button>
                    </div>
                )}
                
                <DialogFooter className="flex-col !space-y-2 sm:!space-y-0 sm:flex-row sm:!justify-between pt-4">
                    <Button type="button" variant="link" onClick={() => toggleMode(mode === 'login' ? 'signup' : 'login')} className="p-0 h-auto">
                        {mode === 'login' && "Don't have an account? Sign Up"}
                        {mode === 'signup' && "Already have an account? Login"}
                        {mode === 'forgot_password' && "Back to Login"}
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {mode === 'signup' && "Sign Up"}
                        {mode === 'login' && "Login"}
                        {mode === 'forgot_password' && "Send Reset Link"}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
