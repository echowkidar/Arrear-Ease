
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import * as z from "zod";
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { doc, getDoc, setDoc } from "firebase/firestore"; 
import { useToast } from '@/hooks/use-toast';

const rateSchema = z.object({
  id: z.string(),
  fromDate: z.date(),
  toDate: z.date(),
  rate: z.any(), // Allow string for typing
  basicFrom: z.any().optional(),
  basicTo: z.any().optional(),
  payLevelFrom: z.any().optional(),
  payLevelTo: z.any().optional(),
}).refine(data => !data.toDate || !data.fromDate || new Date(data.toDate) >= new Date(data.fromDate), {
    message: "To Date cannot be before From Date.",
    path: ["toDate"],
});

export type Rate = z.infer<typeof rateSchema>;

interface RatesContextType {
  daRates: Rate[];
  setDaRates: React.Dispatch<React.SetStateAction<Rate[]>>;
  hraRates: Rate[];
  setHraRates: React.Dispatch<React.SetStateAction<Rate[]>>;
  npaRates: Rate[];
  setNpaRates: React.Dispatch<React.SetStateAction<Rate[]>>;
  taRates: Rate[];
  setTaRates: React.Dispatch<React.SetStateAction<Rate[]>>;
}

const RatesContext = createContext<RatesContextType | undefined>(undefined);

const FIRESTORE_RATES_DOC_ID = "allRates";
const FIRESTORE_RATES_COLLECTION_ID = "configurations";
const LOCALSTORAGE_RATES_KEY = "arrearEase_rates";

const parseTimestamps = (rates: any[]): Rate[] => {
    if (!Array.isArray(rates)) return [];
    return rates.map(rate => ({
        ...rate,
        fromDate: rate.fromDate?.toDate ? rate.fromDate.toDate() : new Date(rate.fromDate),
        toDate: rate.toDate?.toDate ? rate.toDate.toDate() : new Date(rate.toDate)
    }));
}

export const RatesProvider = ({ children }: { children: ReactNode }) => {
  const [daRates, setDaRates] = useState<Rate[]>([]);
  const [hraRates, setHraRates] = useState<Rate[]>([]);
  const [npaRates, setNpaRates] = useState<Rate[]>([]);
  const [taRates, setTaRates] = useState<Rate[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [dbConfigured] = useState(isFirebaseConfigured());
  const { toast } = useToast();

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  const loadRatesFromLocal = useCallback(() => {
    try {
      const localData = localStorage.getItem(LOCALSTORAGE_RATES_KEY);
      if (localData) {
          const data = JSON.parse(localData);
          if (data.daRates) setDaRates(parseTimestamps(data.daRates));
          if (data.hraRates) setHraRates(parseTimestamps(data.hraRates));
          if (data.npaRates) setNpaRates(parseTimestamps(data.npaRates));
          if (data.taRates) setTaRates(parseTimestamps(data.taRates));
      }
    } catch (error) {
      console.error("Could not load rates from localStorage:", error);
    }
    setIsLoaded(true);
  }, []);

  const loadRates = useCallback(async () => {
    if (isOnline && dbConfigured && db) {
        try {
            const ratesDocRef = doc(db, FIRESTORE_RATES_COLLECTION_ID, FIRESTORE_RATES_DOC_ID);
            const docSnap = await getDoc(ratesDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.daRates) setDaRates(parseTimestamps(data.daRates));
                if (data.hraRates) setHraRates(parseTimestamps(data.hraRates));
                if (data.npaRates) setNpaRates(parseTimestamps(data.npaRates));
                if (data.taRates) setTaRates(parseTimestamps(data.taRates));
                setIsLoaded(true);
                return;
            }
        } catch(error) {
            console.error("Could not load rates from Firestore, falling back to local:", error);
        }
    }
    loadRatesFromLocal();
  }, [isOnline, dbConfigured, loadRatesFromLocal]);

  useEffect(() => {
    loadRates();
  }, [loadRates]);
  
  const saveRates = useCallback(async () => {
    if (!isLoaded) return;
    
    const dataToSave = { daRates, hraRates, npaRates, taRates };
    
    // Always save to localStorage
    try {
      localStorage.setItem(LOCALSTORAGE_RATES_KEY, JSON.stringify(dataToSave));
    } catch (error) {
      console.error("Could not save rates to localStorage:", error);
    }
    
    // Attempt to save to Firestore if online and configured
    if (isOnline && dbConfigured && db) {
        try {
            const ratesDocRef = doc(db, FIRESTORE_RATES_COLLECTION_ID, FIRESTORE_RATES_DOC_ID);
            await setDoc(ratesDocRef, dataToSave);
        } catch (error) {
            console.error("Could not save rates to Firestore:", error);
            toast({
                variant: 'destructive',
                title: "Database Sync Failed",
                description: "Rate changes have been saved locally but failed to sync to the database."
            });
        }
    }
  }, [isLoaded, daRates, hraRates, npaRates, taRates, isOnline, dbConfigured, toast]);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      saveRates();
    }, 1500); // Debounce saving

    return () => clearTimeout(handler);
  }, [saveRates]);

  return (
    <RatesContext.Provider value={{
      daRates, setDaRates,
      hraRates, setHraRates,
      npaRates, setNpaRates,
      taRates, setTaRates
    }}>
      {children}
    </RatesContext.Provider>
  );
};

export const useRates = (): RatesContextType => {
  const context = useContext(RatesContext);
  if (context === undefined) {
    throw new Error('useRates must be used within a RatesProvider');
  }
  return context;
};

    