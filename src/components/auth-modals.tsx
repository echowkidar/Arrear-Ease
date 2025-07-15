
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
      confirmPassword: "",
      phoneNumber: "",
    },
  });
  
  const onSubmit = async (values: any) => {
    setIsLoading(true);
    if (mode === 'signup') {
      await signUpWithEmailPassword(values.email, values.password, values.phoneNumber);
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
                        <FormControl><Input type="tel" placeholder="+1 123 456 7890" {...field} value={field.value ?? ''} /></FormControl>
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
                
                <DialogFooter className="flex-col !space-y-2 sm:!space-y-0 sm:flex-row sm:!justify-between">
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
