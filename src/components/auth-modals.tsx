
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
  password: z.string().min(6, "Password must be at least 6 characters long."),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;


export function AuthModal() {
  const { 
    isAuthModalOpen, 
    closeAuthModal, 
    signUpWithEmailPassword,
    signInWithEmailPassword,
    authError,
    clearAuthError,
  } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);

  const form = useForm<LoginFormValues | SignupFormValues>({
    resolver: zodResolver(isSignup ? signupSchema : loginSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "", // Ensure this is always defined
    },
  });
  
  const onSubmit = async (values: LoginFormValues | SignupFormValues) => {
    setIsLoading(true);
    if (isSignup) {
      // We know this is signup schema because of the isSignup flag
      const signupValues = values as SignupFormValues;
      await signUpWithEmailPassword(signupValues.email, signupValues.password);
    } else {
      const loginValues = values as LoginFormValues;
      await signInWithEmailPassword(loginValues.email, loginValues.password);
    }
    setIsLoading(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      form.reset();
      clearAuthError();
      closeAuthModal();
      setIsSignup(false);
    }
  };

  const toggleMode = () => {
      setIsSignup(!isSignup);
      form.reset({
        email: "",
        password: "",
        confirmPassword: "" // Ensure this is always defined
      });
      clearAuthError();
  }

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isSignup ? "Create an Account" : "Login"}</DialogTitle>
           <DialogDescription>
            {isSignup ? "Enter your details to create a new account." : "Enter your email and password to sign in."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                {authError && <Alert variant="destructive"><AlertDescription>{authError}</AlertDescription></Alert>}
                <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" placeholder="your.email@example.com" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
                )} />
                 <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
                )} />
                {isSignup && (
                    <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )} />
                )}
                <DialogFooter className="flex-col !space-y-2 sm:!space-y-0 sm:flex-row sm:!justify-between">
                    <Button type="button" variant="link" onClick={toggleMode} className="p-0 h-auto">
                        {isSignup ? "Already have an account? Login" : "Don't have an account? Sign Up"}
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isSignup ? "Sign Up" : "Login"}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
