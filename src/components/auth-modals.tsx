
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ScrollArea } from './ui/scroll-area';
import { countries } from '@/lib/countries';

const phoneSchemaFields = {
  countryCode: z.string().default("+91"),
  phone: z.string().min(10, { message: "Phone number must be at least 10 digits." }).regex(/^\d+$/, "Phone number must contain only digits."),
};

// Signup form schema
const signupSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  ...phoneSchemaFields,
});

// Guest form schema
const guestSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  ...phoneSchemaFields,
});

// OTP form schema
const otpSchema = z.object({
  otp: z.string().min(6, { message: "OTP must be 6 digits." }).max(6),
});

const CountryCodeSelect = ({ field }: { field: any }) => (
    <Select onValueChange={field.onChange} defaultValue={field.value}>
        <FormControl>
            <SelectTrigger className="w-[80px]">
                <SelectValue placeholder="Code" />
            </SelectTrigger>
        </FormControl>
        <SelectContent>
            <ScrollArea className="h-72">
                {countries.map(country => (
                    <SelectItem key={country.code} value={country.dial_code}>
                        {country.dial_code}
                    </SelectItem>
                ))}
            </ScrollArea>
        </SelectContent>
    </Select>
);

export function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, handleFullSignup } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", countryCode: "+91", phone: "" },
  });

  const onSubmit = async (values: z.infer<typeof signupSchema>) => {
    setIsLoading(true);
    const fullPhoneNumber = `${values.countryCode}${values.phone}`;
    await handleFullSignup(values.name, values.email, fullPhoneNumber.replace('+', ''));
    setIsLoading(false);
  };

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={closeAuthModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Login or Signup</DialogTitle>
          <DialogDescription>
            Create an account to save and load your arrear statements.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl><Input placeholder="Your Name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input placeholder="your.email@example.com" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
             <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <div className="flex gap-2">
                    <FormField
                        control={form.control}
                        name="countryCode"
                        render={({ field }) => <CountryCodeSelect field={field} />}
                    />
                    <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                            <FormControl>
                                <Input type="tel" placeholder="9876543210" {...field} />
                            </FormControl>
                        )}
                    />
                </div>
                 <FormMessage>
                    {form.formState.errors.phone?.message}
                </FormMessage>
            </FormItem>
            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Get OTP
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


export function GuestInfoModal() {
  const { isGuestModalOpen, closeGuestModal, handleGuestSignin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<z.infer<typeof guestSchema>>({
    resolver: zodResolver(guestSchema),
    defaultValues: { name: "", countryCode: "+91", phone: "" },
  });

  const onSubmit = async (values: z.infer<typeof guestSchema>) => {
    setIsLoading(true);
    const fullPhoneNumber = `${values.countryCode}${values.phone}`;
    await handleGuestSignin(values.name, fullPhoneNumber.replace('+', ''));
    setIsLoading(false);
  };

  return (
    <Dialog open={isGuestModalOpen} onOpenChange={closeGuestModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verify to Calculate</DialogTitle>
          <DialogDescription>
            Please provide your name and verify your phone number to proceed with the calculation.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl><Input placeholder="Your Name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <div className="flex gap-2">
                    <FormField
                        control={form.control}
                        name="countryCode"
                        render={({ field }) => <CountryCodeSelect field={field} />}
                    />
                    <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                            <FormControl>
                                <Input type="tel" placeholder="9876543210" {...field} />
                            </FormControl>
                        )}
                    />
                </div>
                <FormMessage>
                    {form.formState.errors.phone?.message}
                </FormMessage>
            </FormItem>
            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Get OTP
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


export function OtpModal() {
  const { isOtpModalOpen, handleOtpSubmit, resendOtp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  const onSubmit = async (values: z.infer<typeof otpSchema>) => {
    setIsLoading(true);
    await handleOtpSubmit(values.otp);
    setIsLoading(false);
  };
  
  const onResend = async () => {
      setIsLoading(true);
      await resendOtp();
      setIsLoading(false);
  }

  return (
    <Dialog open={isOtpModalOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enter OTP</DialogTitle>
          <DialogDescription>
            Please enter the 6-digit OTP sent to your phone.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="otp" render={({ field }) => (
              <FormItem>
                <FormLabel>OTP</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="123456" 
                    {...field} 
                    maxLength={6}
                    className="text-center tracking-[0.5em]"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter className='sm:justify-between'>
                <Button type="button" variant="link" onClick={onResend} disabled={isLoading}>
                    Resend OTP
                </Button>
                <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Verify
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    