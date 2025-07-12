
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import * as z from "zod";

const rateSchema = z.object({
  id: z.string(),
  fromDate: z.date(),
  toDate: z.date(),
  rate: z.any(), // Allow string for typing
  basicFrom: z.any().optional(),
  basicTo: z.any().optional(),
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

const LOCAL_STORAGE_RATES_KEY = "arrearEaseRates";

// Helper to deserialize dates from strings
const parseDates = (rates: any[]): Rate[] => {
    return rates.map(rate => ({
        ...rate,
        fromDate: new Date(rate.fromDate),
        toDate: new Date(rate.toDate)
    }));
}

export const RatesProvider = ({ children }: { children: ReactNode }) => {
  const [daRates, setDaRates] = useState<Rate[]>([]);
  const [hraRates, setHraRates] = useState<Rate[]>([]);
  const [npaRates, setNpaRates] = useState<Rate[]>([]);
  const [taRates, setTaRates] = useState<Rate[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on initial mount
  useEffect(() => {
    try {
        const savedData = localStorage.getItem(LOCAL_STORAGE_RATES_KEY);
        if (savedData) {
            const { daRates, hraRates, npaRates, taRates } = JSON.parse(savedData);
            if (daRates) setDaRates(parseDates(daRates));
            if (hraRates) setHraRates(parseDates(hraRates));
            if (npaRates) setNpaRates(parseDates(npaRates));
            if (taRates) setTaRates(parseDates(taRates));
        }
    } catch(error) {
        console.error("Could not load rates from local storage:", error);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever rates change
  useEffect(() => {
    if (!isLoaded) return; // Don't save until we've loaded initial state
    try {
        const dataToSave = JSON.stringify({ daRates, hraRates, npaRates, taRates });
        localStorage.setItem(LOCAL_STORAGE_RATES_KEY, dataToSave);
    } catch (error) {
        console.error("Could not save rates to local storage:", error);
    }
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
