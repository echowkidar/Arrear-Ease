
"use client";

import React from "react";
import { useForm, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { format, addMonths, differenceInCalendarMonths, getDaysInMonth, startOfMonth, endOfMonth, max, min, isWithinInterval, differenceInDays, addDays } from "date-fns";
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
  Copy,
  Edit,
  LogOut,
  Users,
  X,
  History,
} from "lucide-react";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, addDoc, getDocs, doc, deleteDoc, Timestamp, writeBatch, setDoc, updateDoc, query, where, serverTimestamp } from "firebase/firestore";

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
  useFormField,
} from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { cpcData } from "@/lib/cpc-data";
import { Rate, useRates } from "@/context/rates-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/auth-context";
import { AuthModal } from "@/components/auth-modals";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const salaryComponentSchema = z.object({
  cpc: z.enum(["6th", "7th"], { required_error: "CPC selection is required." }),
  basicPay: z.coerce.number({ required_error: "Basic Pay is required." }).min(0, "Cannot be negative"),
  payLevel: z.string({ required_error: "Pay Level is required." }),
  incrementMonth: z.string({ required_error: "Increment month is required." }),
  incrementDate: z.date().optional(),
  
  fixedBasicPayApplicable: z.boolean().default(false),
  fixedBasicPayValue: z.coerce.number().min(0).optional(),
  fixedBasicPayFromDate: z.date().optional(),
  fixedBasicPayToDate: z.date().optional(),
  
  daApplicable: z.boolean().default(false),
  daFixedRateApplicable: z.boolean().default(false),
  daFixedRate: z.coerce.number().min(0).optional(),
  daFixedRateFromDate: z.date().optional(),
  daFixedRateToDate: z.date().optional(),

  hraApplicable: z.boolean().default(false),
  hraFromDate: z.date().optional(),
  hraToDate: z.date().optional(),
  hraFixedRateApplicable: z.boolean().default(false),
  hraFixedRate: z.coerce.number().min(0).optional(),
  hraFixedRateFromDate: z.date().optional(),
  hraFixedRateToDate: z.date().optional(),

  npaApplicable: z.boolean().default(false),
  npaFromDate: z.date().optional(),
  npaToDate: z.date().optional(),
  
  taApplicable: z.boolean().default(false),
  doubleTaApplicable: z.boolean().default(false),
  taFromDate: z.date().optional(),
  taToDate: z.date().optional(),
  taFixedRateApplicable: z.boolean().default(false),
  taFixedRate: z.coerce.number().min(0).optional(),
  taFixedRateFromDate: z.date().optional(),
  taFixedRateToDate: z.date().optional(),

  otherAllowanceName: z.string().optional(),
  otherAllowance: z.coerce.number().min(0).optional().default(0),
  otherAllowanceFromDate: z.date().optional(),
  otherAllowanceToDate: z.date().optional(),
  otherAllowanceFixedRateApplicable: z.boolean().default(false),
  otherAllowanceFixedRate: z.coerce.number().min(0).optional(),
  otherAllowanceFixedRateFromDate: z.date().optional(),
  otherAllowanceFixedRateToDate: z.date().optional(),
  
  refixedBasicPay: z.coerce.number().min(0).optional(),
  refixedBasicPayDate: z.date().optional(),
});

const formSchema = z.object({
    employeeId: z.string().min(1, "Employee ID is required"),
    employeeName: z.string().min(1, "Employee name is required"),
    designation: z.string().min(1, "Designation is required"),
    department: z.string().min(1, "Department is required"),
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
  id: string; 
  isLocal?: boolean;
  savedAt: string; 
  lastAccessedAt?: string;
  rows: StatementRow[];
  totals: StatementTotals;
  employeeInfo: EmployeeInfo;
  userId?: string;
  userName?: string;
  userEmail?: string;
};

const INCREMENT_MONTHS = [
  { value: "1", label: "January" },
  { value: "7", label: "July" },
];

const FIRESTORE_STATEMENTS_COLLECTION = "savedStatements";
const LOCALSTORAGE_STATEMENTS_KEY = "arrearEase_savedStatements";

const sanitizeForFirebase = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeForFirebase(item));
    }
    
    if (obj instanceof Date) {
        return Timestamp.fromDate(obj);
    }

    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
            newObj[key] = sanitizeForFirebase(obj[key]);
        }
    }
    return newObj;
};

const FormDateInput = ({ field, label }: { field: any, label?: string }) => {
    const { name } = useFormField();
    const form = useFormContext();
    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      form.setValue(name, undefined, { shouldDirty: true, shouldValidate: true });
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                 <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {field.value ? format(field.value, "PPP") : <span>{label || 'Pick a date'}</span>}
                    {field.value && (
                       <span
                        className="ml-auto p-1 rounded-full hover:bg-muted"
                        onClick={handleClear}
                        >
                           <X className="h-4 w-4" />
                       </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={(date) => field.onChange(date)}
                    initialFocus={field.value ? new Date(field.value) : undefined}
                    defaultMonth={field.value ? new Date(field.value) : undefined}
                    captionLayout="dropdown-buttons"
                    fromYear={1990}
                    toYear={2050}
                />
            </PopoverContent>
        </Popover>
    );
};


const FixedRateFields = ({ type, name, isAmount }: { type: 'paid' | 'toBePaid', name: 'da' | 'hra' | 'ta' | 'otherAllowance' | 'npa', isAmount?: boolean }) => {
    const form = useFormContext();
    const isFixedRateApplicable = form.watch(`${type}.${name}FixedRateApplicable`);
    
    React.useEffect(() => {
        if (!isFixedRateApplicable) {
            form.setValue(`${type}.${name}FixedRate`, undefined, { shouldDirty: true });
            form.setValue(`${type}.${name}FixedRateFromDate`, undefined, { shouldDirty: true });
            form.setValue(`${type}.${name}FixedRateToDate`, undefined, { shouldDirty: true });
        }
    }, [isFixedRateApplicable, form, type, name]);

    return (
        <div className="space-y-4 rounded-md border p-4 bg-muted/20 mt-4">
            <FormField
                control={form.control}
                name={`${type}.${name}FixedRateApplicable`}
                render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between">
                    <FormLabel>Override with Fixed Rate</FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
                )}
            />
            {isFixedRateApplicable && (
                <div className="space-y-4 pt-2">
                    <FormField
                        control={form.control}
                        name={`${type}.${name}FixedRate`}
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Fixed {isAmount ? 'Amount' : 'Rate (%)'}</FormLabel>
                            <FormControl><Input type="number" placeholder={isAmount ? "e.g., 3600" : "e.g., 10"} {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                         <FormField
                            control={form.control}
                            name={`${type}.${name}FixedRateFromDate`}
                            render={({ field }) => (
                                <FormItem>
                                  <FormDateInput field={field} label="From Date" />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={form.control}
                            name={`${type}.${name}FixedRateToDate`}
                            render={({ field }) => (
                                <FormItem>
                                  <FormDateInput field={field} label="To Date" />
                                </FormItem>
                            )}
                            />
                    </div>
                </div>
            )}
        </div>
    );
};


const AllowanceField = ({ type, name, label }: { type: 'paid' | 'toBePaid', name: 'hra' | 'npa', label: string }) => {
  const form = useFormContext();
  const isApplicable = form.watch(`${type}.${name}Applicable`);
  
  return (
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
      {isApplicable && (
        <div className="space-y-2 pl-7 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name={`${type}.${name}FromDate`}
                  render={({ field }) => (
                    <FormItem>
                      <FormDateInput field={field} label="From Date" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`${type}.${name}ToDate`}
                  render={({ field }) => (
                    <FormItem>
                      <FormDateInput field={field} label="To Date" />
                    </FormItem>
                  )}
                />
            </div>
             <FixedRateFields type={type} name={name}/>
        </div>
      )}
    </>
  );
};

const payLevelIndexMap = new Map<string, number>();
cpcData["6th"].payLevels.forEach((level, index) => payLevelIndexMap.set(level.level, index));
cpcData["7th"].payLevels.forEach((level, index) => payLevelIndexMap.set(level.level, index + cpcData["6th"].payLevels.length));


export default function Home() {
  const [statement, setStatement] = React.useState<Omit<SavedStatement, 'id' | 'savedAt' | 'isLocal'> | null>(null);
  const [savedStatements, setSavedStatements] = React.useState<SavedStatement[]>([]);
  const [isLoadDialogOpen, setLoadDialogOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(true);
  const [dbConfigured] = React.useState(isFirebaseConfigured());
  const [loadedStatementId, setLoadedStatementId] = React.useState<string | null>(null);
  
  const { user, authStatus, loading, logout, openAuthModal } = useAuth();
  const { toast } = useToast();
  const { daRates, hraRates, npaRates, taRates } = useRates();

  const isAdmin = user?.email === "amulivealigarh@gmail.com";

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
      if (typeof window === 'undefined') return [];
      const localData = localStorage.getItem(LOCALSTORAGE_STATEMENTS_KEY);
      return localData ? JSON.parse(localData) : [];
    } catch (error) {
      console.error("Failed to read local statements:", error);
      return [];
    }
  }

  const saveLocalStatements = (statements: SavedStatement[]) => {
    try {
       if (typeof window === 'undefined') return;
      localStorage.setItem(LOCALSTORAGE_STATEMENTS_KEY, JSON.stringify(statements));
    } catch(error) {
       console.error("Failed to save local statements:", error);
    }
  }

  const syncLocalToServer = async () => {
      if (!isOnline || !dbConfigured || !db || authStatus !== 'authenticated' || !user?.uid) return;
      
      const localStatements = getLocalStatements();
      const localOnly = localStatements.filter(s => s.isLocal && !s.userId); 

      if (localOnly.length === 0) return;

      setIsLoading(true);
      try {
        const batch = writeBatch(db);
        const syncedIds = new Set();
        localOnly.forEach(stmt => {
          const { isLocal, ...serverStmt } = stmt; 
          const docRef = doc(db, FIRESTORE_STATEMENTS_COLLECTION, stmt.id);
          batch.set(docRef, sanitizeForFirebase({ ...serverStmt, userId: user.uid, userName: user.displayName, userEmail: user.email }));
          syncedIds.add(stmt.id);
        });
        await batch.commit();
        
        const updatedLocalStatements = localStatements.map(s => syncedIds.has(s.id) ? { ...s, isLocal: false, userId: user.uid, userName: user.displayName, userEmail: user.email } : s);
        saveLocalStatements(updatedLocalStatements);

        toast({
            title: "Sync Complete",
            description: `${localOnly.length} locally saved statement(s) have been synced to your account.`
        });
        await fetchSavedStatements(); 
      } catch (error) {
          console.error("Failed to sync statements:", error);
          toast({ variant: "destructive", title: "Sync Failed", description: "Could not sync local changes to the database." });
      }
      setIsLoading(false);
  };

  const processFirestoreDataRecursive = (data: any): any => {
    if (!data) return data;
  
    if (Array.isArray(data)) {
      return data.map(item => processFirestoreDataRecursive(item));
    }
  
    if (typeof data === 'object' && data !== null && !Array.isArray(data) && !(data instanceof Date)) {
        
        if (typeof data.seconds === 'number' && typeof data.nanoseconds === 'number') {
            try {
                return new Timestamp(data.seconds, data.nanoseconds).toDate();
            } catch (e) {
                return data; 
            }
        }
  
        
        const newObj: { [key: string]: any } = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                newObj[key] = processFirestoreDataRecursive(data[key]);
            }
        }
        return newObj;
    }
  
    
    if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(data)) {
        const d = new Date(data);
        if (!isNaN(d.getTime())) return d;
    }
  
    return data;
  };

  const fetchSavedStatements = async () => {
    if (authStatus !== 'authenticated') return;
    setIsLoading(true);
    let allStatements: SavedStatement[] = [];
    
    
    if (!isOnline) {
      const localStatements = getLocalStatements();
      const filterFn = isAdmin ? () => true : (s: SavedStatement) => s.userId === user?.uid;
      allStatements.push(...localStatements.filter(filterFn));
    }

    if (isOnline && dbConfigured && db && user?.uid) {
        try {
            const statementsQuery = isAdmin
                ? collection(db, FIRESTORE_STATEMENTS_COLLECTION)
                : query(collection(db, FIRESTORE_STATEMENTS_COLLECTION), where("userId", "==", user.uid));

            const querySnapshot = await getDocs(statementsQuery);
            const serverStatements: SavedStatement[] = [];
            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                
                const processedData = processFirestoreDataRecursive(data);
                const { employeeInfo, ...restOfData } = processedData;

                const toISOStringSafe = (dateValue: any) => {
                  if (dateValue instanceof Date) return dateValue.toISOString();
                  if (typeof dateValue === 'string') return dateValue;
                  if (dateValue && typeof dateValue.seconds === 'number') {
                    return new Timestamp(dateValue.seconds, dateValue.nanoseconds).toDate().toISOString();
                  }
                  return '';
                }

                serverStatements.push({
                    id: docSnap.id,
                    savedAt: toISOStringSafe(processedData.savedAt),
                    lastAccessedAt: toISOStringSafe(processedData.lastAccessedAt),
                    rows: restOfData.rows,
                    totals: restOfData.totals,
                    employeeInfo: employeeInfo,
                    isLocal: false,
                    userId: data.userId,
                    userName: data.userName,
                    userEmail: data.userEmail
                });
            });
            allStatements = serverStatements;
            saveLocalStatements(allStatements); 

        } catch (error) {
            console.error("Could not load saved statements from Firestore:", error);
            if (error instanceof Error && (error as any).code === 'unavailable') {
                toast({
                    title: "Offline Mode",
                    description: "Displaying locally saved statements. Will sync when online.",
                });
                 const localStatements = getLocalStatements();
                 const filterFn = isAdmin ? () => true : (s: SavedStatement) => s.userId === user?.uid;
                 allStatements.push(...localStatements.filter(filterFn));

            } else {
                 toast({
                    variant: "destructive",
                    title: "Load Failed",
                    description: "Could not fetch statements from the database. Showing local data.",
                });
                 const localStatements = getLocalStatements();
                 const filterFn = isAdmin ? () => true : (s: SavedStatement) => s.userId === user?.uid;
                 allStatements.push(...localStatements.filter(filterFn));
            }
        }
    }
    
    allStatements.sort((a, b) => {
      const aAccessed = a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : 0;
      const bAccessed = b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : 0;
      const aSaved = a.savedAt ? new Date(a.savedAt).getTime() : 0;
      const bSaved = b.savedAt ? new Date(b.savedAt).getTime() : 0;
  
      if (bAccessed !== aAccessed) {
        return bAccessed - aAccessed;
      }
      return bSaved - aSaved;
    });

    setSavedStatements(allStatements);
    setIsLoading(false);
  };

  React.useEffect(() => {
    if(isLoadDialogOpen && authStatus === 'authenticated') {
      fetchSavedStatements();
    }
  }, [isLoadDialogOpen, authStatus, isAdmin]);
  
  React.useEffect(() => {
    if (isOnline && dbConfigured && authStatus === 'authenticated') {
        syncLocalToServer();
    }
  }, [isOnline, dbConfigured, authStatus]);
  
  const form = useForm<ArrearFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: "",
      employeeName: "",
      designation: "",
      department: "",
      fromDate: undefined,
      toDate: undefined,
      payFixationRef: "",
      paid: {
        cpc: undefined,
        basicPay: '' as any,
        payLevel: undefined,
        incrementMonth: undefined,
        fixedBasicPayApplicable: false,
        daApplicable: false,
        daFixedRateApplicable: false,
        hraApplicable: false,
        hraFixedRateApplicable: false,
        npaApplicable: false,
        npaFixedRateApplicable: false,
        taApplicable: false,
        doubleTaApplicable: false,
        taFixedRateApplicable: false,
        otherAllowance: '' as any,
        otherAllowanceName: "",
        otherAllowanceFixedRateApplicable: false,
      },
      toBePaid: {
        cpc: undefined,
        basicPay: '' as any,
        payLevel: undefined,
        incrementMonth: undefined,
        fixedBasicPayApplicable: false,
        daApplicable: false,
        daFixedRateApplicable: false,
        hraApplicable: false,
        hraFixedRateApplicable: false,
        npaApplicable: false,
        npaFixedRateApplicable: false,
        taApplicable: false,
        doubleTaApplicable: false,
        taFixedRateApplicable: false,
        otherAllowance: '' as any,
        otherAllowanceName: "",
        otherAllowanceFixedRateApplicable: false,
        refixedBasicPay: '' as any,
      },
    },
  });

  const getPayLevels = (cpc: '6th' | '7th' | undefined) => {
     if (!cpc) return [];
     return cpcData[cpc].payLevels.map(pl => ({ value: pl.level, label: cpc === '6th' ? `GP ${pl.gradePay} (${pl.payBand})` : `Level ${pl.level}`}));
  };
  
  const getRateForDate = (
    rates: Rate[], 
    date: Date,
    options: { basicPay?: number, payLevel?: string, daRate?: number } = {}
  ): Rate | null => {
    const { basicPay, payLevel, daRate } = options;

    const applicableRates = rates.filter(r => {
        let isMatch = true;

        if (r.fromDate && date < new Date(r.fromDate)) {
            isMatch = false;
        }

        if (r.toDate && date > new Date(r.toDate)) {
            isMatch = false;
        }

        if (daRate !== undefined && r.daRateFrom !== undefined && r.daRateTo !== undefined) {
            if (!(daRate >= r.daRateFrom && daRate <= r.daRateTo)) {
                isMatch = false;
            }
        }

        if (!isMatch) return false;

        if (basicPay !== undefined) {
            if (r.basicFrom !== undefined && r.basicTo !== undefined && r.basicFrom > 0 && r.basicTo > 0) {
                if (!(basicPay >= r.basicFrom && basicPay <= r.basicTo)) {
                    isMatch = false;
                }
            }
        }

        if (!isMatch) return false;

        if (payLevel !== undefined && r.payLevelFrom !== undefined && r.payLevelTo !== undefined && r.payLevelFrom !== '' && r.payLevelTo !== '') {
            const fromIndex = payLevelIndexMap.get(String(r.payLevelFrom));
            const toIndex = payLevelIndexMap.get(String(r.payLevelTo));
            const currentIndex = payLevelIndexMap.get(String(payLevel));

            if (fromIndex !== undefined && toIndex !== undefined && currentIndex !== undefined) {
                if (!(currentIndex >= fromIndex && currentIndex <= toIndex)) {
                    isMatch = false;
                }
            } else {
                isMatch = false; // Could not find one of the levels in the map
            }
        }

        return isMatch;
    });

    if (applicableRates.length === 0) return null;
    applicableRates.sort((a, b) => (new Date(b.fromDate!) as any) - (new Date(a.fromDate!) as any));
    
    // Additional sort for HRA rates based on DA rate range to pick the most specific one
    if (daRate !== undefined) {
        applicableRates.sort((a, b) => {
            const aDaFrom = a.daRateFrom ?? -Infinity;
            const bDaFrom = b.daRateFrom ?? -Infinity;
            return bDaFrom - aDaFrom;
        });
    }

    return applicableRates[0];
}
  
  const handlePrint = () => {
    if (authStatus !== 'authenticated') {
      openAuthModal();
      return;
    }
    window.print();
  };
  
  const calculateMonthlyRow = (
      currentDate: Date,
      arrearFromDate: Date,
      arrearToDate: Date,
      data: ArrearFormData,
      trackers: { drawnBasic: number; dueBasic: number }
    ): { row: StatementRow; newTrackers: { drawnBasic: number; dueBasic: number } } => {

    const { drawnBasic: drawnBasicTracker, dueBasic: dueBasicTracker } = trackers;
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    const daysInMonth = getDaysInMonth(currentDate);

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    let drawnBasicForMonth = drawnBasicTracker;
    let dueBasicForMonth = dueBasicTracker;
    let newDrawnTracker = drawnBasicTracker;
    let newDueTracker = dueBasicTracker;
    
    const handleIncrement = (side: 'paid' | 'toBePaid', trackerBasic: number): { newTrackerValue: number; basicForMonth: number } => {
        const sideData = data[side];
        let newTracker = trackerBasic;
        let basicForMonth = trackerBasic;
        
        if (sideData.fixedBasicPayApplicable && sideData.fixedBasicPayValue && sideData.fixedBasicPayFromDate && sideData.fixedBasicPayToDate) {
          const fixedStart = startOfMonth(sideData.fixedBasicPayFromDate);
          const fixedEnd = endOfMonth(sideData.fixedBasicPayToDate);
          if (isWithinInterval(currentDate, { start: fixedStart, end: fixedEnd })) {
              return { newTrackerValue: sideData.fixedBasicPayValue, basicForMonth: sideData.fixedBasicPayValue };
          }
        }
        
        if (sideData.incrementMonth) {
            const incrementMonthValue = parseInt(sideData.incrementMonth, 10);
            let incrementTriggerDate: Date | null = null;
    
            if (!sideData.incrementDate && currentMonth === incrementMonthValue && currentDate >= new Date(currentYear, incrementMonthValue - 1, 1)) {
               incrementTriggerDate = new Date(currentYear, incrementMonthValue - 1, 1);
            } 
            else if (sideData.incrementDate && currentMonth === sideData.incrementDate.getMonth() + 1 && currentYear === sideData.incrementDate.getFullYear()) {
                incrementTriggerDate = sideData.incrementDate;
            }
            
            if (incrementTriggerDate && isWithinInterval(incrementTriggerDate, { start: monthStart, end: monthEnd })) {
                let newBasic: number | null = null;
                if (sideData.cpc === '7th' && sideData.payLevel) {
                   let levelData = cpcData['7th'].payLevels.find(l => l.level === sideData.payLevel);
                    
                    if (!levelData) {
                        levelData = cpcData['7th'].payLevels.find(l => l.level.includes('/') && l.level.split('/').includes(sideData.payLevel));
                    }

                    if (levelData) {
                        const currentBasicIndex = levelData.values.indexOf(trackerBasic);
                        if (currentBasicIndex !== -1 && currentBasicIndex + 1 < levelData.values.length) {
                            newBasic = levelData.values[currentBasicIndex + 1];
                        }
                    }
                } else {
                    newBasic = Math.round(trackerBasic * 1.03);
                }

                if (newBasic !== null) {
                    if (sideData.incrementDate) { 
                        const incrementDay = sideData.incrementDate.getDate();
                        if (incrementDay > 1) {
                            const daysBefore = incrementDay - 1;
                            const daysAfter = daysInMonth - daysBefore;
                            basicForMonth = ((trackerBasic * daysBefore) + (newBasic * daysAfter)) / daysInMonth;
                        } else {
                            basicForMonth = newBasic;
                        }
                    } else { 
                        basicForMonth = newBasic;
                    }
                    newTracker = newBasic;
                }
            }
        }
        return { newTrackerValue: newTracker, basicForMonth };
    };
    
    ({ newTrackerValue: newDrawnTracker, basicForMonth: drawnBasicForMonth } = handleIncrement('paid', drawnBasicTracker));
    ({ newTrackerValue: newDueTracker, basicForMonth: dueBasicForMonth } = handleIncrement('toBePaid', dueBasicTracker));
    
    if (data.toBePaid.refixedBasicPay && data.toBePaid.refixedBasicPay > 0 && data.toBePaid.refixedBasicPayDate) {
        const refixDate = data.toBePaid.refixedBasicPayDate;
        if (currentDate >= startOfMonth(refixDate)) {
             if (isWithinInterval(refixDate, { start: monthStart, end: monthEnd })) {
                const refixDay = refixDate.getDate();
                const basicBeforeRefix = dueBasicForMonth;
                
                if (refixDay > 1) {
                    const daysBefore = refixDay - 1;
                    const daysAfter = daysInMonth - daysBefore;
                    dueBasicForMonth = ((basicBeforeRefix * daysBefore) + (data.toBePaid.refixedBasicPay * daysAfter)) / daysInMonth;
                } else {
                   dueBasicForMonth = data.toBePaid.refixedBasicPay;
                }
                newDueTracker = data.toBePaid.refixedBasicPay;
            } else if (currentDate > refixDate) {
                dueBasicForMonth = newDueTracker;
            }
        }
    }

    const effectiveMonthStart = max([monthStart, arrearFromDate]);
    const effectiveMonthEnd = min([monthEnd, arrearToDate]);
    const daysToCalculateForMonth = differenceInDays(effectiveMonthEnd, effectiveMonthStart) + 1;
    const monthProRataFactor = daysToCalculateForMonth > 0 ? daysToCalculateForMonth / daysInMonth : 0;

    const calculateAllowancesForSide = (side: 'paid' | 'toBePaid') => {
        const sideData = data[side];
        const payLevel = sideData.payLevel;
        const fullMonthBasic = side === 'paid' ? drawnBasicForMonth : dueBasicForMonth;
        const proratedBasic = fullMonthBasic * monthProRataFactor;

        const getProratedFactorForAllowance = (allowanceFrom?: Date, allowanceTo?: Date): number => {
            const mStart = startOfMonth(currentDate);
            const mEnd = endOfMonth(currentDate);
            const daysInCalcMonth = getDaysInMonth(currentDate);

            const effectiveAllowanceFrom = allowanceFrom ? max([allowanceFrom, arrearFromDate]) : arrearFromDate;
            const effectiveAllowanceTo = allowanceTo ? min([allowanceTo, arrearToDate]) : arrearToDate;

            const intersectionStart = max([mStart, effectiveAllowanceFrom]);
            const intersectionEnd = min([mEnd, effectiveAllowanceTo]);

            if (intersectionStart > intersectionEnd) return 0;

            const daysToCalc = differenceInDays(intersectionEnd, intersectionStart) + 1;
            return daysToCalc > 0 ? daysToCalc / daysInCalcMonth : 0;
        };

        const getEffectiveDaRate = (): number => {
            if (sideData.daFixedRateApplicable && sideData.daFixedRate && sideData.daFixedRateFromDate && sideData.daFixedRateToDate) {
                if (isWithinInterval(currentDate, { start: sideData.daFixedRateFromDate, end: sideData.daFixedRateToDate })) {
                    return sideData.daFixedRate;
                }
            }
            const daRateDetails = getRateForDate(daRates, currentDate);
            return daRateDetails ? daRateDetails.rate : 0;
        };
        
        const effectiveDaRate = getEffectiveDaRate();

        // Calculate NPA
        let npa = 0;
        if (sideData.npaApplicable) {
            const prorationFactor = getProratedFactorForAllowance(sideData.npaFromDate, sideData.npaToDate);
            if (prorationFactor > 0) {
                const npaRateDetails = getRateForDate(npaRates, currentDate);
                if (npaRateDetails) {
                    const fullMonthNpa = fullMonthBasic * (npaRateDetails.rate / 100);
                    npa = fullMonthNpa * monthProRataFactor;
                }
            }
        }

        // Calculate DA
        let da = 0;
        if (sideData.daApplicable) {
             const baseForDA = proratedBasic + npa;
             da = baseForDA * (effectiveDaRate / 100);
        }

        // Calculate HRA
        let hra = 0;
        if (sideData.hraApplicable) {
            const prorationFactor = getProratedFactorForAllowance(sideData.hraFromDate, sideData.hraToDate);
            if (prorationFactor > 0) {
                const hraRateDetails = getRateForDate(hraRates, currentDate, { daRate: effectiveDaRate });
                if (hraRateDetails) {
                    let fullMonthHra = fullMonthBasic * (hraRateDetails.rate / 100);
                    if (hraRateDetails.minAmount && hraRateDetails.minAmount > 0) {
                        fullMonthHra = Math.max(fullMonthHra, hraRateDetails.minAmount);
                    }
                    hra = fullMonthHra * monthProRataFactor;
                }
            }
        }

        // Calculate TA
        let ta = 0;
        if (sideData.taApplicable) {
            const prorationFactor = getProratedFactorForAllowance(sideData.taFromDate, sideData.taToDate);
            if(prorationFactor > 0) {
                const taRateDetails = getRateForDate(taRates, currentDate, { basicPay: (side === 'paid' ? newDrawnTracker : newDueTracker), payLevel });
                if (taRateDetails) {
                    const taBaseAmount = taRateDetails.rate;
                    let fullMonthTa = taBaseAmount + (taBaseAmount * (effectiveDaRate / 100));
                    if (sideData.doubleTaApplicable) fullMonthTa *= 2;
                    ta = fullMonthTa * monthProRataFactor;
                }
            }
        }

        // Calculate Other Allowance
        let other = 0;
        if (sideData.otherAllowance && sideData.otherAllowance > 0) {
             const prorationFactor = getProratedFactorForAllowance(sideData.otherAllowanceFromDate, sideData.otherAllowanceToDate);
             if(prorationFactor > 0) {
                other = sideData.otherAllowance * monthProRataFactor;
             }
        }

        return { basic: proratedBasic, da, hra, npa, ta, other };
    };

    const drawnComponents = calculateAllowancesForSide('paid');
    const dueComponents = calculateAllowancesForSide('toBePaid');

    const drawnTotal = Object.values(drawnComponents).reduce((sum, val) => sum + val, 0);
    const dueTotal = Object.values(dueComponents).reduce((sum, val) => sum + val, 0);
    const difference = dueTotal - drawnTotal;

    const row: StatementRow = {
        month: format(currentDate, "MMM yyyy"),
        drawn: {
            basic: Math.round(drawnComponents.basic),
            da: Math.round(drawnComponents.da),
            hra: Math.round(drawnComponents.hra),
            npa: Math.round(drawnComponents.npa),
            ta: Math.round(drawnComponents.ta),
            other: Math.round(drawnComponents.other),
            total: Math.round(drawnTotal)
        },
        due: {
            basic: Math.round(dueComponents.basic),
            da: Math.round(dueComponents.da),
            hra: Math.round(dueComponents.hra),
            npa: Math.round(dueComponents.npa),
            ta: Math.round(dueComponents.ta),
            other: Math.round(dueComponents.other),
            total: Math.round(dueTotal)
        },
        difference: Math.round(difference),
    };
    
    return { row, newTrackers: { drawnBasic: newDrawnTracker, dueBasic: newDueTracker } };
  };


  const onSubmit = (data: ArrearFormData) => {
    if (authStatus !== 'authenticated') {
      openAuthModal();
      return;
    }
    
    try {
        const rows: StatementRow[] = [];
        const totals: StatementTotals = { drawn: { total: 0 }, due: { total: 0 }, difference: 0 };

        const arrearFromDate = data.fromDate;
        const arrearToDate = data.toDate;
        const firstMonth = startOfMonth(arrearFromDate);
        const monthCount = differenceInCalendarMonths(arrearToDate, arrearFromDate);

        let trackers = {
            drawnBasic: data.paid.basicPay,
            dueBasic: data.toBePaid.basicPay
        };
        
        for (let i = 0; i <= monthCount; i++) {
            const currentDate = addMonths(firstMonth, i);
            const monthStart = startOfMonth(currentDate);
            const monthEnd = endOfMonth(currentDate);
            
            if(currentDate < arrearFromDate && !isWithinInterval(arrearFromDate, { start: monthStart, end: monthEnd })) continue;
            if(currentDate > arrearToDate && !isWithinInterval(arrearToDate, { start: monthStart, end: monthEnd })) continue;
            
            const effectiveMonthStart = max([monthStart, arrearFromDate]);
            const effectiveMonthEnd = min([monthEnd, arrearToDate]);
            const daysToCalculateForMonth = differenceInDays(effectiveMonthEnd, effectiveMonthStart) + 1;
            
            if (daysToCalculateForMonth <= 0) continue;

            const { row, newTrackers } = calculateMonthlyRow(currentDate, arrearFromDate, arrearToDate, data, trackers);
            rows.push(row);
            trackers = newTrackers;
        }

        totals.drawn.total = rows.reduce((acc, row) => acc + row.drawn.total, 0);
        totals.due.total = rows.reduce((acc, row) => acc + row.due.total, 0);
        totals.difference = rows.reduce((acc, row) => acc + row.difference, 0);

        const newStatement = { rows, totals, employeeInfo: data };
        setStatement(newStatement);
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
  
  const handleSaveOrUpdate = async () => {
    if (!statement || authStatus !== 'authenticated') {
      openAuthModal();
      return;
    }

    if (loadedStatementId) {
      await updateStatement();
    } else {
      await saveStatement();
    }
  }

  const saveStatement = async () => {
    if (!statement || !user) return;
    setIsLoading(true);

    const docId = crypto.randomUUID();
    const now = new Date().toISOString();
    const docToSave: SavedStatement = {
        ...statement,
        id: docId,
        savedAt: now,
        lastAccessedAt: now,
        userId: user.uid,
        userName: user.displayName || undefined,
        userEmail: user.email || undefined,
    };
    
    const localStatements = getLocalStatements();
    saveLocalStatements([...localStatements, { ...docToSave, isLocal: true }]);
    setSavedStatements(prev => [...prev, { ...docToSave, isLocal: true }].sort((a,b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()));

    if (isOnline && dbConfigured && db) {
        try {
            await setDoc(doc(db, FIRESTORE_STATEMENTS_COLLECTION, docId), sanitizeForFirebase(docToSave));
            
            const updatedLocalStatements = getLocalStatements().map(s => s.id === docId ? { ...s, isLocal: false } : s);
            saveLocalStatements(updatedLocalStatements);
            setSavedStatements(prev => prev.map(s => s.id === docId ? { ...s, isLocal: false } : s));

            setLoadedStatementId(docId); 
            toast({
                title: "Arrear Saved",
                description: "The statement has been saved to your account.",
            });
        } catch (error) {
            console.error("Failed to save statement to Firestore:", error);
            toast({
                title: "Saved Locally",
                description: "The statement has been saved to your browser. It will sync to your account when online.",
            });
        }
    } else {
        setLoadedStatementId(docId); 
        toast({
            title: "Saved Locally",
            description: "The statement has been saved to your browser. It will sync to your account when online.",
        });
    }

    setIsLoading(false);
  };
  
  const updateStatement = async () => {
    if (!loadedStatementId || !user) return;
    setIsLoading(true);

    const currentFormData = form.getValues();
    
    // Recalculate statement before saving
    const rows: StatementRow[] = [];
    const totals: StatementTotals = { drawn: { total: 0 }, due: { total: 0 }, difference: 0 };
    const arrearFromDate = currentFormData.fromDate;
    const arrearToDate = currentFormData.toDate;
    const firstMonth = startOfMonth(arrearFromDate);
    const monthCount = differenceInCalendarMonths(arrearToDate, arrearFromDate);

    let trackers = { drawnBasic: currentFormData.paid.basicPay, dueBasic: currentFormData.toBePaid.basicPay };
    for (let i = 0; i <= monthCount; i++) {
        const currentDate = addMonths(firstMonth, i);
        if (currentDate < arrearFromDate && !isWithinInterval(arrearFromDate, { start: startOfMonth(currentDate), end: endOfMonth(currentDate) })) continue;
        if (currentDate > arrearToDate && !isWithinInterval(arrearToDate, { start: startOfMonth(currentDate), end: endOfMonth(currentDate) })) continue;
        
        const { row, newTrackers } = calculateMonthlyRow(currentDate, arrearFromDate, arrearToDate, currentFormData, trackers);
        rows.push(row);
        trackers = newTrackers;
    }
    totals.drawn.total = rows.reduce((acc, row) => acc + row.drawn.total, 0);
    totals.due.total = rows.reduce((acc, row) => acc + row.due.total, 0);
    totals.difference = rows.reduce((acc, row) => acc + row.difference, 0);

    const updatedStatement = { rows, totals, employeeInfo: currentFormData };
    setStatement(updatedStatement);

    const docToUpdate: Omit<SavedStatement, 'isLocal'> = {
        id: loadedStatementId,
        savedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        rows: updatedStatement.rows,
        totals: updatedStatement.totals,
        employeeInfo: currentFormData,
        userId: user.uid,
        userName: user.displayName || undefined,
        userEmail: user.email || undefined,
    };

    const localStatements = getLocalStatements();
    const updatedLocalStatements = localStatements.map(s => 
        s.id === loadedStatementId ? { ...docToUpdate, isLocal: s.isLocal ?? true } : s
    );
    saveLocalStatements(updatedLocalStatements);
    setSavedStatements(updatedLocalStatements.sort((a,b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()));

    if (isOnline && dbConfigured && db) {
        try {
            const docRef = doc(db, FIRESTORE_STATEMENTS_COLLECTION, loadedStatementId);
            await updateDoc(docRef, sanitizeForFirebase(docToUpdate));
            
            const finalLocalStatements = getLocalStatements().map(s => 
                s.id === loadedStatementId ? { ...s, isLocal: false } : s
            );
            saveLocalStatements(finalLocalStatements);
            setSavedStatements(finalLocalStatements.sort((a,b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()));

            toast({
                title: "Arrear Updated",
                description: "The statement has been updated successfully.",
            });
        } catch (error) {
            console.error("Failed to update statement in Firestore:", error);
            toast({
                variant: "destructive",
                title: "Update Failed",
                description: "Could not update in database, but saved locally.",
            });
        }
    } else {
        toast({
            title: "Updated Locally",
            description: "Your changes have been saved to your browser and will sync when online.",
        });
    }

    setIsLoading(false);
  }

  const handleCopy = () => {
    if (!statement) return;

    if (authStatus !== 'authenticated') {
      openAuthModal();
      return;
    }

    
    form.setValue("employeeId", "");
    form.setValue("employeeName", "");
    
    
    setLoadedStatementId(null);

    
    setStatement(prev => prev ? {
      ...prev,
      employeeInfo: {
        ...prev.employeeInfo,
        employeeId: "",
        employeeName: "",
      }
    } : null);
    
    toast({
        title: "Arrear Copied",
        description: "Statement data copied. Enter new employee details and save as a new arrear.",
    });

    document.getElementById("employee-details-card")?.scrollIntoView({ behavior: 'smooth' });
  }

  const loadStatement = async (statementToLoad: SavedStatement) => {
    const { employeeInfo, ...restOfStatement } = statementToLoad;
    
    const fullyProcessedInfo = processFirestoreDataRecursive(employeeInfo);

    const { paid, toBePaid, ...restInfo } = fullyProcessedInfo;
    const { payLevel: paidPayLevel, ...restPaid } = paid || {};
    const { payLevel: toBePaidPayLevel, ...restToBePaid } = toBePaid || {};
    
    const formDataToReset = {
      ...restInfo,
      paid: restPaid,
      toBePaid: restToBePaid,
    }

    form.reset(formDataToReset as ArrearFormData);
    
    setTimeout(() => {
        if(paidPayLevel) form.setValue('paid.payLevel', paidPayLevel);
        if(toBePaidPayLevel) form.setValue('toBePaid.payLevel', toBePaidPayLevel);
    }, 0);


    setStatement({
        ...restOfStatement,
        employeeInfo: fullyProcessedInfo,
    });
    setLoadedStatementId(statementToLoad.id);

    if (isOnline && dbConfigured && db) {
      try {
        const docRef = doc(db, FIRESTORE_STATEMENTS_COLLECTION, statementToLoad.id);
        await updateDoc(docRef, { lastAccessedAt: serverTimestamp() });
        const localStmts = getLocalStatements().map(s => s.id === statementToLoad.id ? {...s, lastAccessedAt: new Date().toISOString() } : s);
        saveLocalStatements(localStmts);
      } catch (error) {
        console.error("Failed to update last accessed time:", error);
      }
    }

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

    if (loadedStatementId === id) {
        setLoadedStatementId(null);
        setStatement(null);
        form.reset();
    }

    await fetchSavedStatements(); 
    setIsLoading(false);
  }

  const handleClearForm = () => {
    form.reset({
      employeeId: "",
      employeeName: "",
      designation: "",
      department: "",
      fromDate: undefined,
      toDate: undefined,
      payFixationRef: "",
      paid: { cpc: undefined, basicPay: '' as any, payLevel: undefined, incrementMonth: undefined, daApplicable: false, hraApplicable: false, npaApplicable: false, taApplicable: false, doubleTaApplicable: false, otherAllowance: '' as any, otherAllowanceName: "" },
      toBePaid: { cpc: undefined, basicPay: '' as any, payLevel: undefined, incrementMonth: undefined, daApplicable: false, hraApplicable: false, npaApplicable: false, taApplicable: false, doubleTaApplicable: false, otherAllowance: '' as any, otherAllowanceName: "", refixedBasicPay: '' as any },
    });
    setStatement(null);
    setLoadedStatementId(null);
    toast({ title: "Form Cleared", description: "All fields have been reset." });
  };


  const renderSalaryFields = (type: "paid" | "toBePaid") => {
      const cpc = form.watch(`${type}.cpc`);
      const incrementMonth = form.watch(`${type}.incrementMonth`);
      const isFixedBasicApplicable = form.watch(`${type}.fixedBasicPayApplicable`);
      const isDAApplicable = form.watch(`${type}.daApplicable`);
      const isTAApplicable = form.watch(`${type}.taApplicable`);
      const otherAllowanceAmount = form.watch(`${type}.otherAllowance`);

      const selectedIncrementMonth = incrementMonth ? parseInt(incrementMonth, 10) : undefined;
      const calendarProps = selectedIncrementMonth ? {
          disabled: (date: Date) => date.getMonth() + 1 !== selectedIncrementMonth || date.getFullYear() < 1990
      } : {};

      const payLevels = getPayLevels(cpc);
      
      return (
        <div className="space-y-4">
            <FormField control={form.control} name={`${type}.cpc`} render={({ field }) => (
              <FormItem>
                <FormLabel>CPC</FormLabel>
                <Select onValueChange={(value) => {
                    field.onChange(value);
                    form.setValue(`${type}.payLevel`, undefined as any);
                }} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select CPC" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="6th">6th CPC</SelectItem>
                    <SelectItem value="7th">7th CPC</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

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
                      <FormDateInput field={field} label="Prorate Date" />
                      <FormMessage />
                  </FormItem>
                )} />
              </div>
           </div>

          <div className="space-y-4 rounded-md border p-4 bg-muted/20">
              <FormField
                control={form.control}
                name={`${type}.fixedBasicPayApplicable`}
                render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between">
                    <FormLabel>Fixed Basic Pay (Overrides Increment)</FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
                )}
            />
             {isFixedBasicApplicable && (
                <div className="space-y-4 pt-2">
                    <FormField
                        control={form.control}
                        name={`${type}.fixedBasicPayValue`}
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Fixed Basic Pay Amount</FormLabel>
                            <FormControl><Input type="number" placeholder="e.g., 52000" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                         <FormField
                            control={form.control}
                            name={`${type}.fixedBasicPayFromDate`}
                            render={({ field }) => (
                                <FormItem><FormDateInput field={field} label="From Date" /></FormItem>
                            )}
                            />
                            <FormField
                            control={form.control}
                            name={`${type}.fixedBasicPayToDate`}
                            render={({ field }) => (
                                <FormItem><FormDateInput field={field} label="To Date" /></FormItem>
                            )}
                            />
                    </div>
                </div>
            )}
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
                          <FormDateInput field={field} label="Effective Date" />
                          <FormMessage />
                      </FormItem>
                  )} />
              </div>
          )}
          <div className="space-y-4 rounded-md border p-4">
              <h4 className="font-medium">Applicable Allowances</h4>
              <div className="space-y-2">
                <FormField control={form.control} name={`${type}.daApplicable`} render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      <FormLabel className="font-normal">DA (Dearness Allowance)</FormLabel>
                  </FormItem>
                )} />
                {isDAApplicable && <FixedRateFields type={type} name="da"/>}
              </div>
             
              <div className="space-y-2">
                <AllowanceField type={type} name="hra" label="HRA (House Rent Allowance)"/>
              </div>

              <div className="space-y-2">
                 <AllowanceField type={type} name="npa" label="NPA (Non-Practicing Allowance)"/>
              </div>
              
              <div className="space-y-2">
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
                {isTAApplicable && (
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
                                <FormItem><FormDateInput field={field} label="From Date" /></FormItem>
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
                        <FixedRateFields type={type} name="ta" isAmount />
                    </div>
                )}
              </div>
          </div>
          <div className="space-y-2 rounded-md border p-4">
              <h4 className="font-medium">Other Allowance</h4>
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
              {otherAllowanceAmount > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    <FormField
                      control={form.control}
                      name={`${type}.otherAllowanceFromDate`}
                      render={({ field }) => (
                        <FormItem><FormDateInput field={field} label="From Date" /></FormItem>
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
               <FixedRateFields type={type} name="otherAllowance" isAmount />
          </div>
        </div>
      );
    }

  const formatDisplayDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), "PPP p");
    } catch {
      return 'Invalid Date';
    }
  }

  const handleLoadClick = () => {
    if (authStatus !== 'authenticated') {
      openAuthModal();
    } else {
      setLoadDialogOpen(true);
    }
  };

  const numberToWords = (num: number): string => {
    if (num === 0) return "Zero";
  
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const thousands = ['', 'Thousand', 'Lakh', 'Crore'];
  
    const toWords = (n: number): string => {
      let word = '';
      if (n >= 100) {
        word += ones[Math.floor(n / 100)] + ' Hundred ';
        n %= 100;
      }
      if (n >= 10 && n < 20) {
        word += teens[n - 10] + ' ';
      } else {
        if (n >= 20) {
          word += tens[Math.floor(n / 10)] + ' ';
          n %= 10;
        }
        if (n > 0) {
          word += ones[n] + ' ';
        }
      }
      return word;
    };
  
    let n = Math.floor(num);
    let words = '';
    let i = 0;
  
    if (n === 0) return 'Zero';
  
    while (n > 0) {
      let base = (i === 1) ? 1000 : 100; // For thousand
      if (i > 1) base = 100; // For lakh, crore
  
      let chunk;
      if (i === 0) { // Ones and tens
          chunk = n % 1000;
      } else { // Thousands, Lakhs, Crores
          chunk = n % 100;
      }
      
      if (chunk !== 0) {
        if (i===0) { // For the first chunk (up to 999)
          words = toWords(chunk) + thousands[i] + ' ' + words;
        } else if (i === 1) { // For thousands
           words = toWords(n % 1000) + thousands[i] + ' ' + words;
           n = Math.floor(n / 1000);
           i++;
           continue;
        } else { // for Lakhs and crores
            words = toWords(n % 100) + thousands[i] + ' ' + words;
        }
      }
      
      if (i === 0) {
          n = Math.floor(n / 1000);
      } else {
          n = Math.floor(n / 100);
      }
      i++;
    }
    
    return words.trim() + " Only";
  };


  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 md:py-12">
        <AuthModal />
        
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

            {loading ? (
                <Loader2 className="h-6 w-6 animate-spin"/>
            ) : authStatus === 'authenticated' && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>{user.displayName || user.email}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="outline" onClick={() => openAuthModal()}>
                <User className="mr-2 h-4 w-4" /> Login / Signup
              </Button>
            )}

            <ThemeToggle />
          </div>
          <h1 className="font-headline text-4xl md:text-5xl font-bold text-primary">Arrear Ease</h1>
          <p className="text-muted-foreground mt-2 text-lg">A Simple Tool for Complex Salary Arrear Calculations</p>
          <p className="text-muted-foreground mt-1">For Central Govt and State Govt employees (6th, 7th & 8th Central Pay Commission)</p>
          <p className="text-muted-foreground mt-1 text-sm">Dedicated to AMU by Zafar Ali Khan</p>
        </header>

        <div className="flex flex-col sm:flex-row justify-end gap-2 mb-4 no-print">
            <Button variant="outline" onClick={handleClearForm}>
              <Trash2 className="mr-2 h-4 w-4" /> Clear Form
            </Button>
            <Button variant="outline" onClick={handleLoadClick}>
              <FolderOpen className="mr-2 h-4 w-4" /> Load Saved Arrears
            </Button>
            <Dialog open={isLoadDialogOpen} onOpenChange={setLoadDialogOpen}>
                <DialogContent className="sm:max-w-4xl">
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
                                        {isAdmin && <TableHead className="hidden md:table-cell">User</TableHead>}
                                        <TableHead className="hidden sm:table-cell">Saved On</TableHead>
                                        <TableHead className="hidden lg:table-cell">Last Accessed</TableHead>
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
                                            {isAdmin && <TableCell className="hidden md:table-cell text-xs">{s.userName || 'N/A'}<br/><span className="text-muted-foreground">{s.userEmail}</span></TableCell>}
                                            <TableCell className="hidden sm:table-cell">{formatDisplayDate(s.savedAt)}</TableCell>
                                            <TableCell className="hidden lg:table-cell">{formatDisplayDate(s.lastAccessedAt)}</TableCell>
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
            {authStatus === 'authenticated' && isAdmin && (
              <>
                <Button variant="outline" asChild>
                    <Link href="/users">
                        <Users className="mr-2 h-4 w-4" /> User Management
                    </Link>
                </Button>
                <Button variant="outline" asChild>
                    <Link href="/rates">
                        <Settings className="mr-2 h-4 w-4" /> Rate Configuration
                    </Link>
                </Button>
              </>
            )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 no-print">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <Card id="employee-details-card">
                  <CardHeader><CardTitle className="flex items-center gap-2"><User /> Employee Details</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <FormField control={form.control} name="employeeId" render={({ field }) => ( <FormItem> <FormLabel>Employee ID</FormLabel> <FormControl><Input placeholder="Employee ID" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                    <FormField control={form.control} name="employeeName" render={({ field }) => ( <FormItem> <FormLabel>Employee Name</FormLabel> <FormControl><Input placeholder="Full Name" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                    <FormField control={form.control} name="designation" render={({ field }) => ( <FormItem> <FormLabel>Designation</FormLabel> <FormControl><Input placeholder="Designation" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                    <FormField control={form.control} name="department" render={({ field }) => ( <FormItem> <FormLabel>Department</FormLabel> <FormControl><Input placeholder="Department" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays /> Calculation Period & Pay Details</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="fromDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>From Date</FormLabel><FormDateInput field={field} /><FormMessage /></FormItem> )} />
                       <FormField control={form.control} name="toDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>To Date</FormLabel><FormDateInput field={field} /><FormMessage /></FormItem> )} />
                    </div>
                    <FormField control={form.control} name="payFixationRef" render={({ field }) => (<FormItem><FormLabel>Pay Fixation Reference</FormLabel><FormControl><Input placeholder="Reference No." {...field} /></FormControl></FormItem>)} />
                  </CardContent>
                </Card>
              </div>
              <div className="lg:col-span-3">
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><FileText /> Salary Components</CardTitle><CardDescription>Define salary structures before and after the revision.</CardDescription></CardHeader>
                  <CardContent>
                    <Tabs defaultValue="paid" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="paid">Already Paid</TabsTrigger>
                        <TabsTrigger value="toBePaid">To be Paid</TabsTrigger>
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
            <div className="printable-area page">
              <Card id="printable-statement-card">
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
                     <Button onClick={handleSaveOrUpdate} variant="outline" disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (loadedStatementId ? <Edit className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />)}
                        {loadedStatementId ? "Update Arrear" : "Save Arrear"}
                     </Button>
                     {loadedStatementId && (
                       <Button onClick={handleCopy} variant="outline" disabled={isLoading || authStatus !== 'authenticated'}>
                          <Copy className="mr-2 h-4 w-4" /> Copy Arrear
                       </Button>
                     )}
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
                          <TableHead rowSpan={2} className="text-center align-middle border-r month-col">Month</TableHead>
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
                            <TableCell className="font-medium border-r month-col">{row.month}</TableCell>
                            <TableCell className="text-right">{row.drawn.basic}</TableCell>
                            <TableCell className="text-right">{row.drawn.da}</TableCell>
                            <TableCell className="text-right">{row.drawn.hra}</TableCell>
                            <TableCell className="text-right">{row.drawn.npa}</TableCell>
                            <TableCell className="text-right">{row.drawn.ta}</TableCell>
                            <TableCell className="text-right">{row.drawn.other}</TableCell>
                            <TableCell className="text-right font-semibold border-r">{row.drawn.total}</TableCell>
                            <TableCell className="text-right">{row.due.basic}</TableCell>
                            <TableCell className="text-right">{row.due.da}</TableCell>
                            <TableCell className="text-right">{row.due.hra}</TableCell>
                            <TableCell className="text-right">{row.due.npa}</TableCell>
                            <TableCell className="text-right">{row.due.ta}</TableCell>
                            <TableCell className="text-right">{row.due.other}</TableCell>
                            <TableCell className="text-right font-semibold border-r">{row.due.total}</TableCell>
                            <TableCell className="text-right font-bold">{row.difference}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <UiTableFooter>
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell className="border-r">Total</TableCell>
                          <TableCell colSpan={6}></TableCell>
                          <TableCell className="text-right border-r">{statement.totals.drawn.total}</TableCell>
                          <TableCell colSpan={6}></TableCell>
                          <TableCell className="text-right border-r">{statement.totals.due.total}</TableCell>
                          <TableCell className="text-right">{statement.totals.difference}</TableCell>
                        </TableRow>
                      </UiTableFooter>
                    </Table>
                  </div>
                  <Alert className="mt-6 print-disclaimer">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Disclaimer</AlertTitle>
                    <AlertDescription>
                      This is an automatically generated statement. All calculations are based on the data provided. Please verify against official CPC rules and rounding-off norms. The final arrear amount is rounded to the nearest rupee.
                    </AlertDescription>
                  </Alert>
                  <div className="pt-12 text-sm">
                    {statement.totals.difference > 0 &&
                      <div className="mb-8">
                          Passed for pay of rupees {numberToWords(statement.totals.difference)}.
                          <div className="mt-2 border-t border-dotted border-foreground"></div>
                      </div>
                    }
                    <div className="flex justify-between items-end">
                      <span>Date: {format(new Date(), "dd/MM/yyyy")}</span>
                      <div className="grid grid-cols-3 gap-12 text-center w-full max-w-2xl mx-auto">
                          <div className="pt-8">Dealing Assistant</div>
                          <div className="pt-8">Section Officer</div>
                          <div className="pt-8">Assistant Finance Officer (Salary)</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <div className="page-footer"></div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
