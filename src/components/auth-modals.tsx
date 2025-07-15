
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

const emailSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
});

const otpSchema = z.object({
    otp: z.string().min(6, "OTP must be 6 digits.").max(6, "OTP must be 6 digits."),
});


export function AuthModal() {
  const { 
    isAuthModalOpen, 
    closeAuthModal, 
    handleEmailSignIn, 
    authMessage, 
    isAwaitingOtp,
    verifyOtp
  } = useAuth();

  const [isLoading, setIsLoading] = useState(false);

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  const onEmailSubmit = async (values: z.infer<typeof emailSchema>) => {
    setIsLoading(true);
    await handleEmailSignIn(values.email);
    setIsLoading(false);
  };
  
  const onOtpSubmit = (values: z.infer<typeof otpSchema>) => {
    setIsLoading(true);
    verifyOtp(values.otp);
    setIsLoading(false);
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      emailForm.reset();
      otpForm.reset();
      closeAuthModal();
    }
  };

  const renderContent = () => {
      if (authMessage) {
        return (
             <DialogDescription>
                {authMessage}
            </DialogDescription>
        )
      }

      if (isAwaitingOtp) {
        return (
            <>
            <DialogDescription>
                An OTP has been sent to your email. Please enter it below to sign in.
            </DialogDescription>
            <Form {...otpForm}>
                <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4 pt-4">
                    <FormField control={otpForm.control} name="otp" render={({ field }) => (
                        <FormItem>
                            <FormLabel>One-Time Password (OTP)</FormLabel>
                            <FormControl><Input type="text" placeholder="123456" {...field} maxLength={6} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <DialogFooter>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Verify & Sign In
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
            </>
        )
      }

      return (
        <>
        <DialogDescription>
            Enter your email to sign in or create an account. An OTP will be sent to your inbox.
        </DialogDescription>
        <Form {...emailForm}>
            <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4 pt-4">
                <FormField control={emailForm.control} name="email" render={({ field }) => (
                <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" placeholder="your.email@example.com" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
                )} />
                <DialogFooter>
                <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send OTP
                </Button>
                </DialogFooter>
            </form>
        </Form>
        </>
      )
  }

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Login or Signup</DialogTitle>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
