
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { format, addMonths, differenceInCalendarMonths, getDaysInMonth, startOfMonth, endOfMonth, max, min, isWithinInterval, differenceInDays } from "date-fns";
import {
  User,
  Building,
  CalendarDays,
  FileText,
  Download,
  Calculator,
  Info,
  Settings,
  Save,
  FolderOpen,
  Trash2,
  Loader2,
  Wifi,
  WifiOff,
  CloudUpload,
} from "lucide-react";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, addDoc, getDocs, doc, deleteDoc, Timestamp, writeBatch, setDoc } from "firebase/firestore";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter as UiTableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { cpcData } from "@/lib/cpc-data";
import { Rate, useRates } from "@/context/rates-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const salaryComponentSchema = z.object({
  basicPay: z.coerce.number({ required_error: "Basic Pay is required." }).min(0, "Cannot be negative"),
  payLevel: z.string({ required_error: "Pay Level is required." }),
  incrementMonth: z.string({ required_error: "Increment month is required." }),
  incrementDate: z.date().optional(),
  daApplicable: z.boolean().default(false),
  hraApplicable: z.boolean().default(false),
  hraFromDate: z.date().optional(),
  hraToDate: z.date().optional(),
  npaApplicable: z.boolean().default(false),
  npaFromDate: z.date().optional(),
  npaToDate: z.date().optional(),
  taApplicable: z.boolean().default(false),
  doubleTaApplicable: z.boolean().default(false),
  taFromDate: z.date().optional(),
  taToDate: z.date().optional(),
  otherAllowanceName: z.string().optional(),
  otherAllowance: z.coerce.number().min(0).optional().default(0),
  otherAllowanceFromDate: z.date().optional(),
  otherAllowanceToDate: z.date().optional(),
  refixedBasicPay: z.coerce.number().min(0).optional(),
  refixedBasicPayDate: z.date().optional(),
});

const formSchema = z.object({
    employeeId: z.string().min(1, "Employee ID is required"),
    employeeName: z.string().min(1, "Employee name is required"),
    designation: z.string().min(1, "Designation is required"),
    department: z.string().min(1, "Department is required"),
    cpc: z.enum(["6th", "7th"], { required_error: "CPC selection is required." }),
    fromDate: z.date({ required_error: "From date is required." }),
    toDate: z.date({ required_error: "To date is required." }),
    payFixationRef: z.string().optional(),
    paid: salaryComponentSchema,
    toBePaid: salaryComponentSchema,
  }).refine(data => data.toDate >= data.fromDate, {
    message: "To Date cannot be before From Date.",
    path: ["toDate"],
  }).refine(data => {
      if (data.toBePaid.refixedBasicPay && data.toBePaid.refixedBasicPay > 0 && !data.toBePaid.refixedBasicPayDate) {
          return false;
      }
      return true;
  }, {
      message: "Refixation date is required if refixed basic pay is provided.",
      path: ["toBePaid", "refixedBasicPayDate"],
  });

type ArrearFormData = z.infer<typeof formSchema>;

type StatementRow = {
  month: string;
  drawn: { basic: number; da: number; hra: number; npa: number; ta: number; other: number; total: number; };
  due: { basic: number; da: number; hra: number; npa: number; ta: number; other: number; total: number; };
  difference: number;
};

type StatementTotals = {
  drawn: { total: number };
  due: { total: number };
  difference: number;
};

type EmployeeInfo = Partial<ArrearFormData>;

type SavedStatement = {
  id: string; // This will be doc ID from firestore or a UUID for local
  isLocal?: boolean;
  savedAt: string; // Keep as ISO string for simplicity across environments
  rows: StatementRow[];
  totals: StatementTotals;
  employeeInfo: EmployeeInfo;
};

const INCREMENT_MONTHS = [
  { value: "1", label: "January" },
  { value: "7", label: "July" },
];

const FIRESTORE_STATEMENTS_COLLECTION = "savedStatements";
const LOCALSTORAGE_STATEMENTS_KEY = "arrearEase_savedStatements";


export default function Home() {
  const [statement, setStatement] = React.useState<Omit<SavedStatement, 'id' | 'savedAt' | 'isLocal'> | null>(null);
  const [savedStatements, setSavedStatements] = React.useState<SavedStatement[]>([]);
  const [isLoadDialogOpen, setLoadDialogOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(true);
  const [dbConfigured] = React.useState(isFirebaseConfigured());

  const { toast } = useToast();
  const { daRates, hraRates, npaRates, taRates } = useRates();

  React.useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);
  
  const getLocalStatements = (): SavedStatement[] => {
    try {
      const localData = localStorage.getItem(LOCALSTORAGE_STATEMENTS_KEY);
      return localData ? JSON.parse(localData) : [];
    } catch (error) {
      console.error("Failed to read local statements:", error);
      return [];
    }
  }

  const saveLocalStatements = (statements: SavedStatement[]) => {
    try {
      localStorage.setItem(LOCALSTORAGE_STATEMENTS_KEY, JSON.stringify(statements));
    } catch(error) {
       console.error("Failed to save local statements:", error);
    }
  }

  const syncLocalToServer = async () => {
      if (!isOnline || !dbConfigured || !db) return;
      
      const localStatements = getLocalStatements();
      const localOnly = localStatements.filter(s => s.isLocal);

      if (localOnly.length === 0) return;

      setIsLoading(true);
      try {
        const batch = writeBatch(db);
        const syncedIds = new Set();
        localOnly.forEach(stmt => {
          const { isLocal, ...serverStmt } = stmt; // remove isLocal flag
          const docRef = doc(db, FIRESTORE_STATEMENTS_COLLECTION, stmt.id);
          batch.set(docRef, serverStmt);
          syncedIds.add(stmt.id);
        });
        await batch.commit();

        // Update local statements to remove isLocal flag
        const updatedLocalStatements = localStatements.map(s => syncedIds.has(s.id) ? { ...s, isLocal: false } : s);
        saveLocalStatements(updatedLocalStatements);

        toast({
            title: "Sync Complete",
            description: `${localOnly.length} locally saved statement(s) have been synced to the database.`
        });
        await fetchSavedStatements(); // refresh list
      } catch (error) {
          console.error("Failed to sync statements:", error);
          toast({ variant: "destructive", title: "Sync Failed", description: "Could not sync local changes to the database." });
      }
      setIsLoading(false);
  };


  const fetchSavedStatements = async () => {
    setIsLoading(true);
    let allStatements: SavedStatement[] = [];
    
    // Always load local statements first for offline availability
    const localStatements = getLocalStatements();
    allStatements.push(...localStatements);

    if (isOnline && dbConfigured && db) {
        try {
            const querySnapshot = await getDocs(collection(db, FIRESTORE_STATEMENTS_COLLECTION));
            const serverStatements: SavedStatement[] = [];
            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                
                const employeeInfo: EmployeeInfo = { ...data.employeeInfo };
                if (employeeInfo.fromDate && (employeeInfo.fromDate as any).toDate) {
                  employeeInfo.fromDate = (employeeInfo.fromDate as Timestamp).toDate();
                }
                if (employeeInfo.toDate && (employeeInfo.toDate as any).toDate) {
                  employeeInfo.toDate = (employeeInfo.toDate as Timestamp).toDate();
                }

                const processSide = (side: 'paid' | 'toBePaid') => {
                    if (!employeeInfo[side]) return;
                    const sideData = employeeInfo[side]!;

                    const dateFields: (keyof typeof sideData)[] = [
                      'hraFromDate', 'hraToDate', 
                      'npaFromDate', 'npaToDate', 
                      'taFromDate', 'taToDate',
                      'otherAllowanceFromDate', 'otherAllowanceToDate',
                      'incrementDate', 'refixedBasicPayDate'
                    ];

                    dateFields.forEach(field => {
                        const dateVal = sideData[field] as any;
                        if(dateVal && dateVal.toDate) {
                          (sideData as any)[field] = dateVal.toDate();
                        }
                    });
                };
                processSide('paid');
                processSide('toBePaid');

                let savedAtISO = '';
                if (data.savedAt?.toDate) { // It's a Firestore Timestamp
                    savedAtISO = data.savedAt.toDate().toISOString();
                } else if (typeof data.savedAt === 'string') { // It's an ISO string
                    savedAtISO = data.savedAt;
                } else if (data.savedAt?.seconds) { // It's a serialized Timestamp-like object
                     savedAtISO = new Date(data.savedAt.seconds * 1000).toISOString();
                }

                serverStatements.push({
                    id: docSnap.id,
                    savedAt: savedAtISO,
                    rows: data.rows,
                    totals: data.totals,
                    employeeInfo,
                    isLocal: false
                });
            });

            // Merge server and local, giving server precedence
            const serverIds = new Set(serverStatements.map(s => s.id));
            const merged = [...serverStatements, ...localStatements.filter(l => !serverIds.has(l.id))];
            allStatements = merged;

            // Update local storage with the merged truth
            saveLocalStatements(allStatements);

        } catch (error) {
            console.error("Could not load saved statements from Firestore:", error);
            if (error instanceof Error && (error as any).code === 'unavailable') {
                toast({
                    title: "Offline Mode",
                    description: "Displaying locally saved statements. Will sync when online.",
                });
            } else {
                 toast({
                    variant: "destructive",
                    title: "Load Failed",
                    description: "Could not fetch statements from the database. Showing local data.",
                });
            }
        }
    }
    
    setSavedStatements(allStatements.sort((a,b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()));
    setIsLoading(false);
  };

  React.useEffect(() => {
    if(isLoadDialogOpen) {
      fetchSavedStatements();
    }
  }, [isLoadDialogOpen]);

  React.useEffect(() => {
    if (isOnline && dbConfigured) {
        syncLocalToServer();
    }
  }, [isOnline, dbConfigured]);
  
  const form = useForm<ArrearFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: "",
      employeeName: "",
      designation: "",
      department: "",
      cpc: undefined,
      fromDate: undefined,
      toDate: undefined,
      payFixationRef: "",
      paid: {
        basicPay: '' as any,
        payLevel: undefined,
        incrementMonth: undefined,
        daApplicable: false,
        hraApplicable: false,
        npaApplicable: false,
        taApplicable: false,
        doubleTaApplicable: false,
        otherAllowance: '' as any,
        otherAllowanceName: "",
      },
      toBePaid: {
        basicPay: '' as any,
        payLevel: undefined,
        incrementMonth: undefined,
        daApplicable: false,
        hraApplicable: false,
        npaApplicable: false,
        taApplicable: false,
        doubleTaApplicable: false,
        otherAllowance: '' as any,
        otherAllowanceName: "",
        refixedBasicPay: '' as any,
      },
    },
  });

  const cpc = form.watch("cpc");
  const paidWatch = form.watch("paid");
  const toBePaidWatch = form.watch("toBePaid");

  const payLevels = cpc ? cpcData[cpc].payLevels.map(pl => ({ value: pl.level, label: cpc === '6th' ? `GP ${pl.gradePay} (${pl.payBand})` : `Level ${pl.level}`})) : [];

  const getRateForDate = (rates: Rate[], date: Date, basicPay?: number, payLevel?: string): Rate | null => {
    const applicableRate = rates.find(r => {
      const from = new Date(r.fromDate);
      const to = new Date(r.toDate);
      let isDateMatch = date >= from && date <= to;
      
      let isBasicMatch = true;
      if (basicPay !== undefined) {
        if (r.basicFrom !== undefined && r.basicTo !== undefined && r.basicFrom > 0 && r.basicTo > 0) {
          isBasicMatch = basicPay >= r.basicFrom && basicPay <= r.basicTo;
        }
      }

      let isPayLevelMatch = true;
      if (payLevel !== undefined && r.payLevelFrom !== undefined && r.payLevelTo !== undefined && r.payLevelFrom !== '' && r.payLevelTo !== '') {
          const numericPayLevel = parseInt(payLevel, 10);
          const numericFrom = parseInt(r.payLevelFrom as string, 10);
          const numericTo = parseInt(r.payLevelTo as string, 10);
          if(!isNaN(numericPayLevel) && !isNaN(numericFrom) && !isNaN(numericTo)) {
            isPayLevelMatch = numericPayLevel >= numericFrom && numericPayLevel <= numericTo;
          } else {
            isPayLevelMatch = false;
          }
      }

      return isDateMatch && isBasicMatch && isPayLevelMatch;
    });
    return applicableRate || null;
  }
  
  const handlePrint = () => {
    window.print();
  };

  const getProratedFactorForAllowance = (
      calculationMonth: Date, 
      arrearStartDate: Date, 
      arrearEndDate: Date, 
      allowanceFromDate?: Date, 
      allowanceToDate?: Date
    ): number => {
    
    const monthStart = startOfMonth(calculationMonth);
    const monthEnd = endOfMonth(calculationMonth);
    const daysInMonth = getDaysInMonth(calculationMonth);

    const effectiveArrearStart = arrearStartDate;
    const effectiveArrearEnd = arrearEndDate;
    
    const effectiveAllowanceFrom = allowanceFromDate ? max([allowanceFromDate, effectiveArrearStart]) : effectiveArrearStart;
    const effectiveAllowanceTo = allowanceToDate ? min([allowanceToDate, effectiveArrearEnd]) : effectiveArrearEnd;

    const intersectionStart = max([monthStart, effectiveAllowanceFrom]);
    const intersectionEnd = min([monthEnd, effectiveAllowanceTo]);

    if (intersectionStart > intersectionEnd) {
      return 0;
    }

    const daysToCalculate = differenceInDays(intersectionEnd, intersectionStart) + 1;
    
    return daysToCalculate > 0 ? daysToCalculate / daysInMonth : 0;
  };
  
  const onSubmit = (data: ArrearFormData) => {
    try {
        const rows: StatementRow[] = [];
        const totals: StatementTotals = { drawn: { total: 0 }, due: { total: 0 }, difference: 0 };

        const arrearFromDate = data.fromDate;
        const arrearToDate = data.toDate;
        const firstMonth = startOfMonth(arrearFromDate);
        const monthCount = differenceInCalendarMonths(arrearToDate, arrearFromDate);

        let drawnBasicTracker = data.paid.basicPay;
        let dueBasicTracker = data.toBePaid.basicPay;
        
        for (let i = 0; i <= monthCount; i++) {
            const currentDate = addMonths(firstMonth, i);
            const currentMonth = currentDate.getMonth() + 1;
            const currentYear = currentDate.getFullYear();
            const daysInMonth = getDaysInMonth(currentDate);

            const monthStart = startOfMonth(currentDate);
            const monthEnd = endOfMonth(currentDate);
            
            if(currentDate < arrearFromDate && !isWithinInterval(arrearFromDate, { start: monthStart, end: monthEnd })) continue;
            if(currentDate > arrearToDate && !isWithinInterval(arrearToDate, { start: monthStart, end: monthEnd })) continue;

            const handleIncrement = (side: 'paid' | 'toBePaid', currentBasic: number): [number, number] => {
                let newBasicForMonth = currentBasic;
                let newBasicTracker = currentBasic;
            
                const sideData = data[side];
                const incrementMonthValue = parseInt(sideData.incrementMonth, 10);
                const firstIncrementDate = sideData.incrementDate;

                // Determine the trigger date for this year's increment
                let incrementTriggerDate: Date | null = null;
                if (firstIncrementDate) {
                    if (currentYear === firstIncrementDate.getFullYear() && currentMonth === firstIncrementDate.getMonth() + 1) {
                        incrementTriggerDate = firstIncrementDate;
                    } else if (currentYear > firstIncrementDate.getFullYear() && currentMonth === firstIncrementDate.getMonth() + 1) {
                        // For subsequent years, increment happens on the 1st of the same month
                        incrementTriggerDate = new Date(currentYear, firstIncrementDate.getMonth(), 1);
                    }
                } else if (currentMonth === incrementMonthValue) {
                    // Fallback to month if no specific date is provided
                     const potentialDate = new Date(currentYear, incrementMonthValue - 1, 1);
                     if (potentialDate >= startOfMonth(arrearFromDate)) {
                         incrementTriggerDate = potentialDate;
                     }
                }

                if (incrementTriggerDate && isWithinInterval(incrementTriggerDate, { start: monthStart, end: monthEnd })) {
                    let incrementedBasicValue: number;
                    if (cpc === '7th') {
                        const levelData = cpcData['7th'].payLevels.find(l => l.level === sideData.payLevel);
                        if (levelData) {
                            const currentBasicIndex = levelData.values.indexOf(newBasicTracker);
                            if (currentBasicIndex !== -1 && currentBasicIndex + 1 < levelData.values.length) {
                                incrementedBasicValue = levelData.values[currentBasicIndex + 1];
                            } else {
                                incrementedBasicValue = newBasicTracker; // No more increments in this level
                            }
                        } else {
                            incrementedBasicValue = newBasicTracker;
                        }
                    } else { // 6th CPC
                        incrementedBasicValue = Math.round(newBasicTracker * 1.03);
                    }
            
                    const incrementDay = incrementTriggerDate.getDate();
                    if (incrementDay > 1) {
                        const daysBefore = incrementDay - 1;
                        const daysAfter = daysInMonth - daysBefore;
                        newBasicForMonth = ((currentBasic * daysBefore) + (incrementedBasicValue * daysAfter)) / daysInMonth;
                    } else {
                        newBasicForMonth = incrementedBasicValue;
                    }
                    newBasicTracker = incrementedBasicValue;
                }
            
                return [newBasicForMonth, newBasicTracker];
            };

            const [drawnBasicForMonth, updatedDrawnBasicTracker] = handleIncrement('paid', drawnBasicTracker);
            drawnBasicTracker = updatedDrawnBasicTracker;

            const [dueBasicForMonth, updatedDueBasicTracker] = handleIncrement('toBePaid', dueBasicTracker);
            dueBasicTracker = updatedDueBasicTracker;
            
            let finalDueBasicForMonth = dueBasicForMonth;

            if (data.toBePaid.refixedBasicPay && data.toBePaid.refixedBasicPay > 0 && data.toBePaid.refixedBasicPayDate) {
                const refixDate = data.toBePaid.refixedBasicPayDate;
                if (isWithinInterval(refixDate, { start: monthStart, end: monthEnd })) {
                    const refixDay = refixDate.getDate();
                    const basicBeforeRefix = dueBasicForMonth;
                    
                    if (refixDay > 1) {
                        const daysBefore = refixDay - 1;
                        const daysAfter = daysInMonth - daysBefore;
                        finalDueBasicForMonth = ((basicBeforeRefix * daysAfter) + (data.toBePaid.refixedBasicPay * daysBefore)) / daysInMonth;
                    } else {
                        finalDueBasicForMonth = data.toBePaid.refixedBasicPay;
                    }
                    dueBasicTracker = data.toBePaid.refixedBasicPay;
                } else if (currentDate > refixDate) {
                    finalDueBasicForMonth = dueBasicTracker;
                }
            }
           
            const effectiveMonthStart = max([monthStart, arrearFromDate]);
            const effectiveMonthEnd = min([monthEnd, arrearToDate]);
            const daysToCalculateForMonth = differenceInDays(effectiveMonthEnd, effectiveMonthStart) + 1;
            const monthProRataFactor = daysToCalculateForMonth / daysInMonth;

            const proratedDrawnBasic = drawnBasicForMonth * monthProRataFactor;
            const proratedDueBasic = finalDueBasicForMonth * monthProRataFactor;
            
            const getProratedAmount = (allowanceType: 'hra' | 'npa' | 'ta' | 'otherAllowance', side: 'paid' | 'toBePaid') => {
                const sideData = data[side];
                const isApplicable = (sideData as any)[`${allowanceType}Applicable`];
                const fromDate = (sideData as any)[`${allowanceType}FromDate`];
                const toDate = (sideData as any)[`${allowanceType}ToDate`];
                const otherAllowanceAmount = sideData.otherAllowance || 0;

                if (allowanceType !== 'otherAllowance' && !isApplicable) return 0;
                if (allowanceType === 'otherAllowance' && otherAllowanceAmount <= 0) return 0;
                
                const prorationFactor = getProratedFactorForAllowance(currentDate, arrearFromDate, arrearToDate, fromDate, toDate);
                if (prorationFactor === 0) return 0;
                
                const baseBasicForMonth = side === 'paid' ? drawnBasicForMonth : finalDueBasicForMonth;
                const baseTrackerBasic = side === 'paid' ? drawnBasicTracker : dueBasicTracker;
                const basePayLevel = side === 'paid' ? data.paid.payLevel : data.toBePaid.payLevel;
                
                let amount = 0;
                
                switch(allowanceType) {
                    case 'hra': {
                        const rateDetails = getRateForDate(hraRates, currentDate, baseTrackerBasic);
                        if (!rateDetails) return 0;
                        const rate = rateDetails.rate;
                        let hraAmount = baseBasicForMonth * (rate / 100);
                        
                        if (rateDetails.minAmount && rateDetails.minAmount > 0) {
                             const daysInCurrentMonth = getDaysInMonth(currentDate);
                             const proratedMinHRA = (rateDetails.minAmount / daysInCurrentMonth) * (daysInCurrentMonth * prorationFactor);
                             hraAmount = Math.max(hraAmount, proratedMinHRA);
                        }
                        amount = hraAmount;
                        break;
                    }
                    case 'npa': {
                        const rateDetails = getRateForDate(npaRates, currentDate);
                        if (!rateDetails) return 0;
                        const rate = rateDetails.rate;
                        amount = baseBasicForMonth * (rate / 100);
                        break;
                    }
                    case 'ta': {
                         const rateDetails = getRateForDate(taRates, currentDate, baseTrackerBasic, basePayLevel);
                         if (!rateDetails) return 0;
                         const taBaseAmount = rateDetails.rate;
                         const daRateDetails = getRateForDate(daRates, currentDate);
                         const daRateForTa = daRateDetails ? daRateDetails.rate / 100 : 0;
                         amount = taBaseAmount * (1 + daRateForTa);
                         if(sideData.doubleTaApplicable) {
                             amount *= 2;
                         }
                        break;
                    }
                    case 'otherAllowance':
                        amount = otherAllowanceAmount;
                        break;
                }
                return amount * prorationFactor;
            };

            const drawnHRA = getProratedAmount('hra', 'paid');
            const drawnNPA = getProratedAmount('npa', 'paid');
            const drawnTA = getProratedAmount('ta', 'paid');
            const drawnOther = getProratedAmount('otherAllowance', 'paid');
            
            const dueHRA = getProratedAmount('hra', 'toBePaid');
            const dueNPA = getProratedAmount('npa', 'toBePaid');
            const dueTA = getProratedAmount('ta', 'toBePaid');
            const dueOther = getProratedAmount('otherAllowance', 'toBePaid');

            let drawnDA = 0;
            if (data.paid.daApplicable) {
                const daRateDetails = getRateForDate(daRates, currentDate);
                const daRate = daRateDetails ? daRateDetails.rate : 0;
                const drawnBaseForDA = proratedDrawnBasic + drawnNPA;
                drawnDA = drawnBaseForDA * (daRate / 100);
            }
            
            let dueDA = 0;
            if (data.toBePaid.daApplicable) {
                const daRateDetails = getRateForDate(daRates, currentDate);
                const daRate = daRateDetails ? daRateDetails.rate : 0;
                const dueBaseForDA = proratedDueBasic + dueNPA;
                dueDA = dueBaseForDA * (daRate / 100);
            }

            const drawnTotal = proratedDrawnBasic + drawnDA + drawnHRA + drawnNPA + drawnTA + drawnOther;
            const dueTotal = proratedDueBasic + dueDA + dueHRA + dueNPA + dueTA + dueOther;
            const difference = dueTotal - drawnTotal;

            if (daysToCalculateForMonth <= 0) continue;
            
            rows.push({
                month: format(currentDate, "MMM yyyy"),
                drawn: {
                    basic: Math.round(proratedDrawnBasic),
                    da: Math.round(drawnDA),
                    hra: Math.round(drawnHRA),
                    npa: Math.round(drawnNPA),
                    ta: Math.round(drawnTA),
                    other: Math.round(drawnOther),
                    total: Math.round(drawnTotal)
                },
                due: {
                    basic: Math.round(proratedDueBasic),
                    da: Math.round(dueDA),
                    hra: Math.round(dueHRA),
                    npa: Math.round(dueNPA),
                    ta: Math.round(dueTA),
                    other: Math.round(dueOther),
                    total: Math.round(dueTotal)
                },
                difference: Math.round(difference),
            });

            totals.drawn.total += drawnTotal;
            totals.due.total += dueTotal;
            totals.difference += difference;
        }

        totals.drawn.total = Math.round(totals.drawn.total);
        totals.due.total = Math.round(totals.due.total);
        totals.difference = Math.round(totals.difference);

        setStatement({
            rows,
            totals,
            employeeInfo: data
        });
        toast({
            title: "Calculation Complete",
            description: "Arrear statement has been generated below.",
        });
        setTimeout(() => {
            document.getElementById("statement-section")?.scrollIntoView({ behavior: 'smooth' });
        }, 100);

    } catch (error) {
        console.error(error);
        toast({
            variant: "destructive",
            title: "Calculation Failed",
            description: "An unexpected error occurred. Please check your inputs.",
        });
    }
  };
  
  const saveStatement = async () => {
    if (!statement) return;
    setIsLoading(true);

    const docId = crypto.randomUUID();
    const docToSave: SavedStatement = {
        ...statement,
        id: docId,
        savedAt: new Date().toISOString(),
    };
    
    // Always save locally first
    const localStatements = getLocalStatements();
    saveLocalStatements([...localStatements, { ...docToSave, isLocal: true }]);
    setSavedStatements(prev => [...prev, { ...docToSave, isLocal: true }].sort((a,b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()));

    if (isOnline && dbConfigured && db) {
        try {
            await setDoc(doc(db, FIRESTORE_STATEMENTS_COLLECTION, docId), docToSave);
            
            // Update local copy to remove isLocal flag
            const updatedLocalStatements = getLocalStatements().map(s => s.id === docId ? { ...s, isLocal: false } : s);
            saveLocalStatements(updatedLocalStatements);
            setSavedStatements(prev => prev.map(s => s.id === docId ? { ...s, isLocal: false } : s));

            toast({
                title: "Arrear Saved",
                description: "The statement has been saved to your browser and the database.",
            });
        } catch (error) {
            console.error("Failed to save statement to Firestore:", error);
            toast({
                title: "Saved Locally",
                description: "The statement has been saved to your browser. It will sync to the database when online.",
            });
        }
    } else {
        toast({
            title: "Saved Locally",
            description: "The statement has been saved to your browser. It will sync to the database when online.",
        });
    }

    setIsLoading(false);
  };
  
  const loadStatement = (statementToLoad: SavedStatement) => {
      const { employeeInfo, ...restOfStatement } = statementToLoad;

      const sanitizedEmployeeInfo = { ...employeeInfo };

      // Make sure all date objects are actual Date objects
      const dateFields: (keyof EmployeeInfo)[] = ['fromDate', 'toDate'];
      dateFields.forEach(field => {
          if (sanitizedEmployeeInfo[field]) {
              sanitizedEmployeeInfo[field] = new Date(sanitizedEmployeeInfo[field] as any);
          }
      });
      
      const processSideDates = (side: 'paid' | 'toBePaid') => {
        if (!sanitizedEmployeeInfo[side]) return;
        const sideData = sanitizedEmployeeInfo[side] as any;
        const sideDateFields = [
            'hraFromDate', 'hraToDate', 'npaFromDate', 'npaToDate', 
            'taFromDate', 'taToDate', 'otherAllowanceFromDate', 
            'otherAllowanceToDate', 'incrementDate', 'refixedBasicPayDate'
        ];
        sideDateFields.forEach(field => {
            if (sideData[field]) {
                sideData[field] = new Date(sideData[field]);
            }
        });
      };
      
      processSideDates('paid');
      processSideDates('toBePaid');

      // Reset the form with the loaded data
      form.reset(sanitizedEmployeeInfo);

      // Set the statement for rendering the results table
      setStatement({
          ...restOfStatement,
          employeeInfo: sanitizedEmployeeInfo,
      });

      setLoadDialogOpen(false);
      toast({
          title: "Statement Loaded",
          description: `Loaded arrear for ${statementToLoad.employeeInfo.employeeName}.`
      });
      setTimeout(() => {
          document.getElementById("statement-section")?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
  }

  const deleteStatement = async (id: string, isLocal: boolean | undefined) => {
    setIsLoading(true);
    
    // Always remove from local storage first
    const localStatements = getLocalStatements();
    saveLocalStatements(localStatements.filter(s => s.id !== id));

    if (isOnline && dbConfigured && db && !isLocal) {
        try {
            await deleteDoc(doc(db, FIRESTORE_STATEMENTS_COLLECTION, id));
            toast({
                title: "Arrear Deleted",
                description: "The statement has been removed from the database and local storage.",
            });
        } catch (error) {
            console.error("Failed to delete statement from Firestore:", error);
            toast({
                variant: "destructive",
                title: "Delete Failed",
                description: "Could not delete from database, but removed locally.",
            });
        }
    } else {
        toast({
            title: "Arrear Deleted",
            description: "The saved arrear statement has been removed from local storage.",
        });
    }

    await fetchSavedStatements(); // Refresh list
    setIsLoading(false);
  }

  const FormDateInput = ({ field, label, calendarProps }: { field: any, label?: string, calendarProps?: any }) => (
      <Popover>
          <PopoverTrigger asChild>
              <FormControl>
                  <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                      {field.value ? format(field.value, "PPP") : <span>{label || 'Pick a date'}</span>}
                      <CalendarDays className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
              </FormControl>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus={field.value ? new Date(field.value) : new Date()} captionLayout="dropdown-buttons" fromYear={1990} toYear={2050} {...calendarProps} />
          </PopoverContent>
      </Popover>
  );

  const AllowanceField = ({ type, name, label, watchValues }: { type: 'paid' | 'toBePaid', name: 'hra' | 'npa' | 'otherAllowance', label: string, watchValues: any }) => (
    <>
      <FormField
        control={form.control}
        name={`${type}.${name}Applicable`}
        render={({ field }) => (
          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            <FormLabel className="font-normal">{label}</FormLabel>
          </FormItem>
        )}
      />
      {watchValues[`${name}Applicable`] && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-7 pt-2">
            <FormField
              control={form.control}
              name={`${type}.${name}FromDate`}
              render={({ field }) => (
                <FormItem><FormDateInput field={field} label="From Date"/></FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`${type}.${name}ToDate`}
              render={({ field }) => (
                <FormItem><FormDateInput field={field} label="To Date" /></FormItem>
              )}
            />
        </div>
      )}
    </>
  );

  const renderSalaryFields = (type: "paid" | "toBePaid") => {
      const currentWatchValues = type === 'paid' ? paidWatch : toBePaidWatch;
      const selectedIncrementMonth = parseInt(currentWatchValues.incrementMonth, 10);
      const calendarProps = selectedIncrementMonth ? {
          disabled: (date: Date) => date.getMonth() + 1 !== selectedIncrementMonth || date.getFullYear() < 1990
      } : {};

      return (
        <div className="space-y-4">
           <FormField control={form.control} name={`${type}.payLevel`} render={({ field }) => (
            <FormItem>
                <FormLabel>Pay Level</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!cpc}>
                    <FormControl><SelectTrigger><SelectValue placeholder={cpc ? "Select a level" : "Select CPC first"} /></SelectTrigger></FormControl>
                    <SelectContent>
                    {payLevels.map(level => <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>)}
                    </SelectContent>
                </Select>
                <FormMessage />
            </FormItem>
           )} />
          <FormField control={form.control} name={`${type}.basicPay`} render={({ field }) => (
            <FormItem>
              <FormLabel>Basic Pay</FormLabel>
              <FormControl><Input type="number" placeholder="e.g., 50000" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
           <div className="space-y-4 rounded-md border p-4 bg-muted/20">
              <h4 className="font-medium">Annual Increment</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name={`${type}.incrementMonth`} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Increment Month</FormLabel>
                    <Select onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue(`${type}.incrementDate`, undefined);
                    }} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select a month" /></SelectTrigger></FormControl>
                      <SelectContent>{INCREMENT_MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name={`${type}.incrementDate`} render={({ field }) => (
                  <FormItem className="flex flex-col">
                      <FormLabel>Date of next Increment (Optional)</FormLabel>
                      <FormDateInput field={field} label="Prorate Date" calendarProps={calendarProps} />
                      <FormMessage />
                  </FormItem>
                )} />
              </div>
           </div>

          {type === 'toBePaid' && (
              <div className="space-y-4 rounded-md border p-4 bg-muted/20">
                  <h4 className="font-medium">Pay Refixation (Optional)</h4>
                  <FormField control={form.control} name="toBePaid.refixedBasicPay" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Refixed Basic Pay</FormLabel>
                          <FormControl><Input type="number" placeholder="New basic pay" {...field} value={field.value ?? ''} /></FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <FormField control={form.control} name="toBePaid.refixedBasicPayDate" render={({ field }) => (
                      <FormItem className="flex flex-col">
                          <FormLabel>Refixation Date</FormLabel>
                          <FormDateInput field={field} label="Effective Date"/>
                          <FormMessage />
                      </FormItem>
                  )} />
              </div>
          )}
          <div className="space-y-4 rounded-md border p-4">
              <h4 className="font-medium">Applicable Allowances</h4>
              <FormField control={form.control} name={`${type}.daApplicable`} render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel className="font-normal">DA (Dearness Allowance)</FormLabel>
                </FormItem>
              )} />
              <AllowanceField type={type} name="hra" label="HRA (House Rent Allowance)" watchValues={currentWatchValues}/>
              <AllowanceField type={type} name="npa" label="NPA (Non-Practicing Allowance)" watchValues={currentWatchValues}/>
              
              <div>
                <FormField
                    control={form.control}
                    name={`${type}.taApplicable`}
                    render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel className="font-normal">TA (Transport Allowance)</FormLabel>
                    </FormItem>
                    )}
                />
                {currentWatchValues.taApplicable && (
                    <div className="space-y-2 pl-7 pt-2">
                        <FormField
                            control={form.control}
                            name={`${type}.doubleTaApplicable`}
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                <FormLabel className="font-normal">Double Transport Allowance</FormLabel>
                            </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <FormField
                            control={form.control}
                            name={`${type}.taFromDate`}
                            render={({ field }) => (
                                <FormItem><FormDateInput field={field} label="From Date"/></FormItem>
                            )}
                            />
                            <FormField
                            control={form.control}
                            name={`${type}.taToDate`}
                            render={({ field }) => (
                                <FormItem><FormDateInput field={field} label="To Date" /></FormItem>
                            )}
                            />
                        </div>
                    </div>
                )}
              </div>

          </div>
           <FormField control={form.control} name={`${type}.otherAllowanceName`} render={({ field }) => (
            <FormItem>
                <FormLabel>Other Allowance Name</FormLabel>
                <FormControl><Input placeholder="e.g., Special Duty Allowance" {...field} /></FormControl>
                <FormMessage />
            </FormItem>
            )} />
          <FormField control={form.control} name={`${type}.otherAllowance`} render={({ field }) => (
            <FormItem>
              <FormLabel>Other Allowance Amount</FormLabel>
              <FormControl><Input type="number" placeholder="e.g., 1500" {...field} value={field.value ?? ''} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          {currentWatchValues.otherAllowance > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                <FormField
                  control={form.control}
                  name={`${type}.otherAllowanceFromDate`}
                  render={({ field }) => (
                    <FormItem><FormDateInput field={field} label="From Date"/></FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`${type}.otherAllowanceToDate`}
                  render={({ field }) => (
                    <FormItem><FormDateInput field={field} label="To Date" /></FormItem>
                  )}
                />
            </div>
          )}
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 md:py-12">
        <header className="text-center mb-8 no-print">
          <div className="flex justify-end items-center gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  {dbConfigured ? (
                    isOnline ? <Wifi className="text-green-500" /> : <WifiOff className="text-red-500"/>
                  ) : (
                    <WifiOff className="text-yellow-500"/>
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  {dbConfigured ? (
                    isOnline ? <p>Online: Connected to database</p> : <p>Offline: Changes will be saved locally and synced later.</p>
                  ) : (
                    <p>Database not configured. All data is being saved in your browser only.</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <ThemeToggle />
          </div>
          <h1 className="font-headline text-4xl md:text-5xl font-bold text-primary">Arrear Ease</h1>
          <p className="text-muted-foreground mt-2 text-lg">A Simple Tool for Complex Salary Arrear Calculations</p>
          <p className="text-muted-foreground mt-1 text-sm">Dedicated to AMU by Zafar Ali Khan</p>
        </header>

        <div className="flex flex-col sm:flex-row justify-end gap-2 mb-4 no-print">
            <Dialog open={isLoadDialogOpen} onOpenChange={setLoadDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline">
                        <FolderOpen className="mr-2 h-4 w-4" /> Load Saved Arrears
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[800px]">
                    <DialogHeader>
                        <DialogTitle>Load Saved Arrear Statement</DialogTitle>
                        <DialogDescription>Select a previously saved statement to view or print it again.</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto">
                        {isLoading ? (
                           <div className="flex justify-center items-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : savedStatements.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Employee</TableHead>
                                        <TableHead className="hidden sm:table-cell">Saved On</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {savedStatements.map(s => (
                                        <TableRow key={s.id}>
                                            <TableCell className="font-medium">
                                                {s.isLocal && <TooltipProvider><Tooltip><TooltipTrigger asChild><span className="inline-block mr-2"><CloudUpload className="h-4 w-4 text-muted-foreground"/></span></TooltipTrigger><TooltipContent><p>Saved locally. Will sync when online.</p></TooltipContent></Tooltip></TooltipProvider>}
                                                {s.employeeInfo.employeeName} <span className="text-muted-foreground">({s.employeeInfo.employeeId})</span>
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell">{format(new Date(s.savedAt), "PPP p")}</TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" onClick={() => loadStatement(s)} className="mr-2" disabled={isLoading}>Load</Button>
                                                <Button size="sm" variant="destructive" onClick={() => deleteStatement(s.id, s.isLocal)} disabled={isLoading}><Trash2 className="h-4 w-4"/></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <p className="text-center text-muted-foreground py-8">No saved statements found.</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
            <Button variant="outline" asChild>
                <Link href="/rates">
                    <Settings className="mr-2 h-4 w-4" /> Rate Configuration
                </Link>
            </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 no-print">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><User /> Employee Details</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <FormField control={form.control} name="employeeId" render={({ field }) => ( <FormItem> <FormLabel>Employee ID</FormLabel> <FormControl><Input placeholder="Employee ID" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                    <FormField control={form.control} name="employeeName" render={({ field }) => ( <FormItem> <FormLabel>Employee Name</FormLabel> <FormControl><Input placeholder="Full Name" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                    <FormField control={form.control} name="designation" render={({ field }) => ( <FormItem> <FormLabel>Designation</FormLabel> <FormControl><Input placeholder="Designation" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                    <FormField control={form.control} name="department" render={({ field }) => ( <FormItem> <FormLabel>Department</FormLabel> <FormControl><Input placeholder="Department" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                    <FormField control={form.control} name="cpc" render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPC</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select CPC" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="6th">6th CPC</SelectItem>
                            <SelectItem value="7th">7th CPC</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays /> Calculation Period & Pay Details</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="fromDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>From Date</FormLabel><FormDateInput field={field}/><FormMessage /></FormItem> )} />
                       <FormField control={form.control} name="toDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>To Date</FormLabel><FormDateInput field={field}/><FormMessage /></FormItem> )} />
                    </div>
                    <FormField control={form.control} name="payFixationRef" render={({ field }) => (<FormItem><FormLabel>Pay Fixation Reference</FormLabel><FormControl><Input placeholder="Reference No." {...field} /></FormControl></FormItem>)} />
                  </CardContent>
                </Card>
              </div>
              <div className="lg:col-span-3">
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><FileText /> Salary Components</CardTitle><CardDescription>Define salary structures before and after the revision.</CardDescription></CardHeader>
                  <CardContent>
                    <Tabs defaultValue="toBePaid" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="paid">Drawn (Previous)</TabsTrigger>
                        <TabsTrigger value="toBePaid">Due (Revised)</TabsTrigger>
                      </TabsList>
                      <TabsContent value="paid" className="mt-4">{renderSalaryFields("paid")}</TabsContent>
                      <TabsContent value="toBePaid" className="mt-4">{renderSalaryFields("toBePaid")}</TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="flex justify-center">
              <Button type="submit" size="lg" className="font-bold text-lg">
                <Calculator className="mr-2 h-5 w-5" /> Calculate Arrears
              </Button>
            </div>
          </form>
        </Form>
        
        {statement && (
          <div id="statement-section" className="mt-12">
            <Card className="printable-area" id="printable-statement-card">
              <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                   <CardTitle className="font-headline text-3xl">Arrear Statement</CardTitle>
                   <CardDescription>
                     For: {statement.employeeInfo.employeeName} ({statement.employeeInfo.employeeId}) <br />
                     {statement.employeeInfo.designation}, {statement.employeeInfo.department} <br/>
                     {statement.employeeInfo.payFixationRef && `Ref: ${statement.employeeInfo.payFixationRef}`} <br/>
                     {statement.employeeInfo.fromDate && statement.employeeInfo.toDate &&
                      `Period: ${format(new Date(statement.employeeInfo.fromDate), "dd/MM/yyyy")} to ${format(new Date(statement.employeeInfo.toDate), "dd/MM/yyyy")}`
                     }
                   </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2 no-print">
                   <Button onClick={saveStatement} variant="outline" disabled={isLoading}>
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save Arrear
                   </Button>
                   <Button onClick={handlePrint} variant="outline">
                     <Download className="mr-2 h-4 w-4" /> Download PDF
                   </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table className="min-w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead rowSpan={2} className="text-center align-middle border-r">Month</TableHead>
                        <TableHead colSpan={7} className="text-center border-r">Amount Drawn</TableHead>
                        <TableHead colSpan={7} className="text-center border-r">Amount Due</TableHead>
                        <TableHead rowSpan={2} className="text-center align-middle">Difference</TableHead>
                      </TableRow>
                      <TableRow>
                        <TableHead className="text-right">Basic</TableHead>
                        <TableHead className="text-right">DA</TableHead>
                        <TableHead className="text-right">HRA</TableHead>
                        <TableHead className="text-right">NPA</TableHead>
                        <TableHead className="text-right">TA</TableHead>
                        <TableHead className="text-right">Other</TableHead>
                        <TableHead className="text-right font-bold border-r">Total</TableHead>
                        <TableHead className="text-right">Basic</TableHead>
                        <TableHead className="text-right">DA</TableHead>
                        <TableHead className="text-right">HRA</TableHead>
                        <TableHead className="text-right">NPA</TableHead>
                        <TableHead className="text-right">TA</TableHead>
                        <TableHead className="text-right">Other</TableHead>
                        <TableHead className="text-right font-bold border-r">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statement.rows.map(row => (
                        <TableRow key={row.month}>
                          <TableCell className="font-medium border-r">{row.month}</TableCell>
                          <TableCell className="text-right">{row.drawn.basic.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{row.drawn.da.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{row.drawn.hra.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{row.drawn.npa.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{row.drawn.ta.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{row.drawn.other.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-semibold border-r">{row.drawn.total.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{row.due.basic.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{row.due.da.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{row.due.hra.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{row.due.npa.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{row.due.ta.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{row.due.other.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-semibold border-r">{row.due.total.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-bold">{row.difference.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <UiTableFooter>
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell className="border-r">Total</TableCell>
                        <TableCell colSpan={6}></TableCell>
                        <TableCell className="text-right border-r">{statement.totals.drawn.total.toLocaleString()}</TableCell>
                        <TableCell colSpan={6}></TableCell>
                        <TableCell className="text-right border-r">{statement.totals.due.total.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{statement.totals.difference.toLocaleString()}</TableCell>
                      </TableRow>
                    </UiTableFooter>
                  </Table>
                </div>
                 <Alert className="mt-6">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Disclaimer</AlertTitle>
                  <AlertDescription>
                    This is an automatically generated statement. All calculations are based on the data provided. Please verify against official CPC rules and rounding-off norms. The final arrear amount is rounded to the nearest rupee.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
