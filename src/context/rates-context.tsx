
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import * as z from "zod";
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from "firebase/firestore"; 

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

// Helper to deserialize dates from Firestore Timestamps
const parseTimestamps = (rates: any[]): Rate[] => {
    return rates.map(rate => ({
        ...rate,
        fromDate: rate.fromDate.toDate(),
        toDate: rate.toDate.toDate()
    }));
}

export const RatesProvider = ({ children }: { children: ReactNode }) => {
  const [daRates, setDaRates] = useState<Rate[]>([]);
  const [hraRates, setHraRates] = useState<Rate[]>([]);
  const [npaRates, setNpaRates] = useState<Rate[]>([]);
  const [taRates, setTaRates] = useState<Rate[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from Firestore on initial mount
  useEffect(() => {
    const loadRates = async () => {
        try {
            const ratesDocRef = doc(db, FIRESTORE_RATES_COLLECTION_ID, FIRESTORE_RATES_DOC_ID);
            const docSnap = await getDoc(ratesDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.daRates) setDaRates(parseTimestamps(data.daRates));
                if (data.hraRates) setHraRates(parseTimestamps(data.hraRates));
                if (data.npaRates) setNpaRates(parseTimestamps(data.npaRates));
                if (data.taRates) setTaRates(parseTimestamps(data.taRates));
            }
        } catch(error) {
            console.error("Could not load rates from Firestore:", error);
        }
        setIsLoaded(true);
    };
    loadRates();
  }, []);

  // Save to Firestore whenever rates change
  useEffect(() => {
    if (!isLoaded) return; // Don't save until we've loaded initial state
    
    const saveRates = async () => {
        try {
            const ratesDocRef = doc(db, FIRESTORE_RATES_COLLECTION_ID, FIRESTORE_RATES_DOC_ID);
            const dataToSave = { daRates, hraRates, npaRates, taRates };
            await setDoc(ratesDocRef, dataToSave);
        } catch (error) {
            console.error("Could not save rates to Firestore:", error);
        }
    };

    // Debounce saving to avoid excessive writes
    const handler = setTimeout(() => {
      saveRates();
    }, 1000);

    return () => {
      clearTimeout(handler);
    };

  }, [daRates, hraRates, npaRates, taRates, isLoaded]);

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
