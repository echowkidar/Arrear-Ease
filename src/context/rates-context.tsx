
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import * as z from "zod";
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore"; 
import { useToast } from '@/hooks/use-toast';
import isEqual from 'lodash.isequal';

const rateSchema = z.object({
  id: z.string(),
  fromDate: z.date().optional(),
  toDate: z.date().optional(),
  rate: z.any(), // Allow string for typing
  basicFrom: z.any().optional(),
  basicTo: z.any().optional(),
  daRateFrom: z.any().optional(),
  daRateTo: z.any().optional(),
  payLevelFrom: z.any().optional(),
  payLevelTo: z.any().optional(),
  minAmount: z.any().optional(),
}).refine(data => !data.toDate || !data.fromDate || new Date(data.toDate) >= new Date(data.fromDate), {
    message: "To Date cannot be before From Date.",
    path: ["toDate"],
});

export type Rate = z.infer<typeof rateSchema>;

type AllRates = {
    daRates: Rate[];
    hraRates: Rate[];
    npaRates: Rate[];
    taRates: Rate[];
}

interface RatesContextType extends AllRates {
  setDaRates: React.Dispatch<React.SetStateAction<Rate[]>>;
  setHraRates: React.Dispatch<React.SetStateAction<Rate[]>>;
  setNpaRates: React.Dispatch<React.SetStateAction<Rate[]>>;
  setTaRates: React.Dispatch<React.SetStateAction<Rate[]>>;
}

const RatesContext = createContext<RatesContextType | undefined>(undefined);

const FIRESTORE_RATES_DOC_ID = "allRates";
const FIRESTORE_RATES_COLLECTION_ID = "configurations";
const LOCALSTORAGE_RATES_KEY = "arrearEase_rates";

const parseTimestamps = (rates: any[]): Rate[] => {
    if (!Array.isArray(rates)) return [];
    return rates.map(rate => {
        const newRate = {...rate};
        if (rate.fromDate) {
           newRate.fromDate = rate.fromDate?.toDate ? rate.fromDate.toDate() : new Date(rate.fromDate);
        }
        if (rate.toDate) {
            newRate.toDate = rate.toDate?.toDate ? rate.toDate.toDate() : new Date(rate.toDate);
        }
        return newRate;
    });
}

const parseAllRateTypes = (data: any): AllRates => ({
    daRates: parseTimestamps(data.daRates || []),
    hraRates: parseTimestamps(data.hraRates || []),
    npaRates: parseTimestamps(data.npaRates || []),
    taRates: parseTimestamps(data.taRates || []),
});

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

  const getLocalRates = (): AllRates | null => {
      try {
        const localData = localStorage.getItem(LOCALSTORAGE_RATES_KEY);
        if (localData) {
            return parseAllRateTypes(JSON.parse(localData));
        }
        return null;
      } catch (error) {
          console.error("Could not load rates from localStorage:", error);
          return null;
      }
  };

  const setAllRates = (rates: AllRates) => {
      setDaRates(rates.daRates);
      setHraRates(rates.hraRates);
      setNpaRates(rates.npaRates);
      setTaRates(rates.taRates);
  };
  
  const loadRates = useCallback(async () => {
    const localRatesData = getLocalRates();

    if (dbConfigured && db) {
        try {
            const ratesDocRef = doc(db, FIRESTORE_RATES_COLLECTION_ID, FIRESTORE_RATES_DOC_ID);
            const docSnap = await getDoc(ratesDocRef);
            if (docSnap.exists()) {
                const firestoreData = parseAllRateTypes(docSnap.data());
                setAllRates(firestoreData);
                // Sync to local storage to ensure it's up-to-date
                localStorage.setItem(LOCALSTORAGE_RATES_KEY, JSON.stringify(firestoreData));
            } else if (localRatesData) {
                // Firestore is empty, but we have local data, so sync it up.
                await setDoc(ratesDocRef, localRatesData);
                setAllRates(localRatesData);
                toast({ title: "Rates Synced", description: "Your locally saved rates have been uploaded to the database."});
            }
        } catch(error) {
            console.error("Could not load or sync rates from Firestore, falling back to local:", error);
            if (error instanceof Error && (error as any).code === 'unavailable') {
              toast({ title: "Offline Mode", description: "Using locally saved rate data."})
            }
            if(localRatesData) setAllRates(localRatesData); // Fallback to local on error
        }
    } else { // No DB configured, use local only
        if(localRatesData) setAllRates(localRatesData);
    }
    setIsLoaded(true);
  }, [dbConfigured, toast]);

  useEffect(() => {
    loadRates();
  }, [loadRates]);
  
  const saveRates = useCallback(async () => {
    if (!isLoaded) return;
    
    const dataToSave = { daRates, hraRates, npaRates, taRates };
    
    try {
      localStorage.setItem(LOCALSTORAGE_RATES_KEY, JSON.stringify(dataToSave));
    } catch (error) {
      console.error("Could not save rates to localStorage:", error);
    }
    
    if (dbConfigured && db && isOnline) {
        try {
            const ratesDocRef = doc(db, FIRESTORE_RATES_COLLECTION_ID, FIRESTORE_RATES_DOC_ID);
            await setDoc(ratesDocRef, dataToSave, { merge: true });
        } catch (error) {
            console.error("Could not save rates to Firestore:", error);
            toast({
                variant: 'destructive',
                title: "Database Sync Failed",
                description: "Rate changes have been saved locally but failed to sync to the database."
            });
        }
    }
  }, [isLoaded, daRates, hraRates, npaRates, taRates, dbConfigured, toast, isOnline]);
  
  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    
    const handler = setTimeout(() => {
      const localRates = getLocalRates();
      const currentRates = { daRates, hraRates, npaRates, taRates };
      if (!isEqual(localRates, currentRates)) {
          saveRates();
      }
    }, 1500);

    return () => clearTimeout(handler);
  }, [daRates, hraRates, npaRates, taRates, saveRates, isLoaded]);

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
