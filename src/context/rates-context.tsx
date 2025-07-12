"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import * as z from "zod";

const rateSchema = z.object({
  id: z.string(),
  fromDate: z.date(),
  toDate: z.date(),
  rate: z.coerce.number().min(0),
  basicFrom: z.coerce.number().optional(),
  basicTo: z.coerce.number().optional(),
}).refine(data => !data.toDate || !data.fromDate || data.toDate >= data.fromDate, {
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

export const RatesProvider = ({ children }: { children: ReactNode }) => {
  const [daRates, setDaRates] = useState<Rate[]>([]);
  const [hraRates, setHraRates] = useState<Rate[]>([]);
  const [npaRates, setNpaRates] = useState<Rate[]>([]);
  const [taRates, setTaRates] = useState<Rate[]>([]);

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
