
"use client";
import { useEffect } from 'react'
import React from "react";
import { useForm, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { format, addMonths, differenceInCalendarMonths, getDaysInMonth, startOfMonth, endOfMonth, startOfDay, endOfDay, max, min, isWithinInterval, differenceInDays, addDays } from "date-fns";
import { AIValidationModal } from "@/components/ai-validation-modal";
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
  TrendingUp,
  Camera,
  Sparkles,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ArrowLeft,
  ArrowRight,
  Plus,
} from "lucide-react";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, addDoc, getDocs, getDoc, doc, deleteDoc, Timestamp, writeBatch, setDoc, updateDoc, query, where, serverTimestamp } from "firebase/firestore";

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

  daApplicable: z.boolean().default(true),
  daFixedRateApplicable: z.boolean().default(false),
  daFixedRate: z.coerce.number().min(0).optional(),
  daFixedRateFromDate: z.date().optional(),
  daFixedRateToDate: z.date().optional(),

  hraApplicable: z.boolean().default(true),
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
  remark: z.string().optional(),
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

type FixationPeriod = {
  id: string;
  formData: ArrearFormData;
  rows: StatementRow[];
  totals: StatementTotals;
};

type SavedStatement = {
  id: string;
  isLocal?: boolean;
  savedAt: string;
  lastAccessedAt?: string;
  rows: StatementRow[];
  totals: StatementTotals;
  employeeInfo: EmployeeInfo;
  periods?: FixationPeriod[];
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
  const [open, setOpen] = React.useState(false);
  const { name } = useFormField();
  const form = useFormContext();
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    form.setValue(name, undefined, { shouldDirty: true, shouldValidate: true });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          onSelect={(date) => {
            field.onChange(date);
            if (date) setOpen(false);
          }}
          defaultMonth={field.value ? new Date(field.value) : undefined}
          captionLayout="dropdown-buttons"
          fromYear={1990}
          toYear={2050}
        />
        <div className="p-2 border-t border-border">
          <Button 
            variant="ghost" 
            className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={(e) => {
              e.preventDefault();
              form.setValue(name, undefined, { shouldDirty: true, shouldValidate: true });
              setOpen(false);
            }}
          >
            Clear Date
          </Button>
        </div>
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
          <FixedRateFields type={type} name={name} />
        </div>
      )}
    </>
  );
};

const payLevelIndexMap = new Map<string, number>();
cpcData["6th"].payLevels.forEach((level, index) => payLevelIndexMap.set(level.level, index));
cpcData["7th"].payLevels.forEach((level, index) => payLevelIndexMap.set(level.level, index + cpcData["6th"].payLevels.length));

// Note: Debug useEffect removed — was incorrectly placed outside a React component.

const compressImage = (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const newFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(newFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.7
        );
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};
export default function Home() {
  const [aiScannedData, setAiScannedData] = React.useState<any>(null);
  const [isAiModalOpen, setIsAiModalOpen] = React.useState(false);
  const [showDiffToast, setShowDiffToast] = React.useState<{ show: boolean, diff: number }>({ show: false, diff: 0 });
  const [statement, setStatement] = React.useState<Omit<SavedStatement, 'id' | 'savedAt' | 'isLocal'> | null>(null);
  const [savedStatements, setSavedStatements] = React.useState<SavedStatement[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc' | null>(null);
  const [isLoadDialogOpen, setLoadDialogOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(true);
  const [dbConfigured] = React.useState(isFirebaseConfigured());
  const [loadedStatementId, setLoadedStatementId] = React.useState<string | null>(null);
  const [allowBasicPayAutoFill, setAllowBasicPayAutoFill] = React.useState(false);
  const [isScanning, setIsScanning] = React.useState(false);
  const [currentPeriodIndex, setCurrentPeriodIndex] = React.useState(0);
  const [basicPayWarning, setBasicPayWarning] = React.useState<{ show: boolean, basicPay: number, payLevel: string, fieldName?: any } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { user, authStatus, loading, logout, openAuthModal } = useAuth();
  const { toast } = useToast();
  const { daRates, hraRates, npaRates, taRates, da6thRates, sixthCpcConfig } = useRates();

  const isAdmin = user?.email === "amulivealigarh@gmail.com";

  const activeCols = React.useMemo(() => {
    if (!statement || !statement.rows || statement.rows.length === 0) {
      return { hra: true, npa: true, ta: true, other: true };
    }
    return {
      hra: statement.rows.some(r => (r.drawn?.hra || 0) !== 0 || (r.due?.hra || 0) !== 0),
      npa: statement.rows.some(r => (r.drawn?.npa || 0) !== 0 || (r.due?.npa || 0) !== 0),
      ta: statement.rows.some(r => (r.drawn?.ta || 0) !== 0 || (r.due?.ta || 0) !== 0),
      other: statement.rows.some(r => (r.drawn?.other || 0) !== 0 || (r.due?.other || 0) !== 0),
    };
  }, [statement]);

  const subColsCount = React.useMemo(() => {
    return 3 + (activeCols.hra ? 1 : 0) + (activeCols.npa ? 1 : 0) + (activeCols.ta ? 1 : 0) + (activeCols.other ? 1 : 0);
  }, [activeCols]);

  const colWidths = React.useMemo(() => {
    const weights = {
      month: 6.8,
      basic: 6.7,
      da: 6.2,
      hra: activeCols.hra ? 6.2 : 0,
      npa: activeCols.npa ? 4.8 : 0,
      ta: activeCols.ta ? 4.8 : 0,
      other: activeCols.other ? 4.8 : 0,
      total: 9.3,
      diff: 7.6,
    };

    const sideSum = weights.basic + weights.da + weights.hra + weights.npa + weights.ta + weights.other + weights.total;
    const totalWeight = weights.month + sideSum * 2 + weights.diff;

    const pct = (w: number) => `${((w / totalWeight) * 100).toFixed(1)}%`;

    return {
      month: pct(weights.month),
      basic: pct(weights.basic),
      da: pct(weights.da),
      hra: pct(weights.hra),
      npa: pct(weights.npa),
      ta: pct(weights.ta),
      other: pct(weights.other),
      total: pct(weights.total),
      diff: pct(weights.diff),
    };
  }, [activeCols]);

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

  React.useEffect(() => {
    if (user?.uid && dbConfigured && db) {
      getDoc(doc(db, "users", user.uid)).then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          setAllowBasicPayAutoFill(data.allowBasicPayAutoFill === true || user.email === "amulivealigarh@gmail.com");
        }
      }).catch(err => console.error("Error fetching user doc:", err));
    } else {
      setAllowBasicPayAutoFill(false);
    }
  }, [user, dbConfigured]);

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
    } catch (error) {
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
      const batch = writeBatch(db!);
      const syncedIds = new Set();
      localOnly.forEach(stmt => {
        const { isLocal, ...serverStmt } = stmt;
        const docRef = doc(db!, FIRESTORE_STATEMENTS_COLLECTION, stmt.id);
        batch.set(docRef, sanitizeForFirebase({ ...serverStmt, userId: user.uid, userName: user.displayName || undefined, userEmail: user.email || undefined }));
        syncedIds.add(stmt.id);
      });
      await batch.commit();

      const updatedLocalStatements = localStatements.map(s => syncedIds.has(s.id) ? { ...s, isLocal: false, userId: user.uid, userName: user.displayName || undefined, userEmail: user.email || undefined } : s);
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
            periods: restOfData.periods,
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
    if (isLoadDialogOpen && authStatus === 'authenticated') {
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
      remark: "",
      paid: {
        cpc: "7th" as any,
        basicPay: '' as any,
        payLevel: undefined,
        incrementMonth: undefined,
        fixedBasicPayApplicable: false,
        daApplicable: true,
        daFixedRateApplicable: false,
        hraApplicable: true,
        hraFixedRateApplicable: false,
        npaApplicable: false,
        taApplicable: false,
        doubleTaApplicable: false,
        taFixedRateApplicable: false,
        otherAllowance: '' as any,
        otherAllowanceName: "",
        otherAllowanceFixedRateApplicable: false,
      },
      toBePaid: {
        cpc: "7th" as any,
        basicPay: '' as any,
        payLevel: undefined,
        incrementMonth: undefined,
        fixedBasicPayApplicable: false,
        daApplicable: true,
        daFixedRateApplicable: false,
        hraApplicable: true,
        hraFixedRateApplicable: false,
        npaApplicable: false,
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

  const { dirtyFields } = form.formState;
  const isCalcFieldDirty = React.useMemo(() => {
    const dirtyKeys = Object.keys(dirtyFields);
    return dirtyKeys.some(key => !['employeeId', 'employeeName', 'designation', 'department', 'payFixationRef', 'remark'].includes(key));
  }, [dirtyFields]);

  const watchedEmployeeId = form.watch("employeeId");
  React.useEffect(() => {
    const fetchEmployeeData = async () => {
      if (watchedEmployeeId && watchedEmployeeId.length === 5) {
        try {
          const response = await fetch(`/api/employee/${watchedEmployeeId}`);
          if (response.ok) {
            const data = await response.json();
            form.setValue("employeeName", data.name || "");
            form.setValue("designation", data.designation || "");
            form.setValue("department", data.department || "");
            toast({
              title: "Employee Found",
              description: "Details auto-filled successfully.",
            });
          } else if (response.status === 404) {
            toast({
              variant: "destructive",
              title: "Not Found",
              description: "No employee found with this ID.",
            });
          }
        } catch (error) {
          console.error("Error fetching employee:", error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to fetch employee details.",
          });
        }
      }
    };
    fetchEmployeeData();
  }, [watchedEmployeeId, form, toast]);

  const watchedFromDate = form.watch("fromDate");
  React.useEffect(() => {
    const fetchBasicPayHistory = async () => {
      if (!allowBasicPayAutoFill) return;
      if (watchedEmployeeId && watchedEmployeeId.length === 5 && watchedFromDate) {
        const dateObj = new Date(watchedFromDate);
        const month = dateObj.getMonth() + 1;
        const year = dateObj.getFullYear();
        try {
          const response = await fetch(`/api/employee/${watchedEmployeeId}/history?month=${month}&year=${year}`);
          if (response.ok) {
            const data = await response.json();
            if (data.basic_sal) {
              form.setValue("paid.basicPay", data.basic_sal);

              if (data.grade_pay) {
                const currentCpc = form.getValues("paid.cpc");
                if (currentCpc === "7th") {
                  const gpLevelMatch = cpcData["6th"].payLevels.find((pl: any) => pl.gradePay === Number(data.grade_pay));
                  if (gpLevelMatch) {
                    form.setValue("paid.payLevel", gpLevelMatch.level as any);
                  }
                }
              }

              toast({
                title: "Data Found",
                description: `Auto-filled Basic Pay and Level for ${month}/${year}.`,
              });
            }
          }
        } catch (error) {
          console.error("Error fetching basic pay:", error);
        }
      }
    };
    fetchBasicPayHistory();
  }, [watchedEmployeeId, watchedFromDate, form, toast, allowBasicPayAutoFill]);

  const getPayLevels = (cpc: '6th' | '7th' | undefined) => {
    if (!cpc) return [];
    return cpcData[cpc].payLevels.map((pl: any) => ({ value: pl.level, label: cpc === '6th' ? `GP ${pl.gradePay} (${pl.payBand})` : `Level ${pl.level}` }));
  };

  const getPayLevelDisplay = (cpc?: string, level?: string) => {
    if (!level) return '';
    if (cpc === '6th') {
      const pl = cpcData['6th']?.payLevels?.find((p: any) => String(p.level) === String(level));
      if (pl) return `GP ${pl.gradePay} (${pl.payBand})`;
      return `Level ${level}`;
    }
    return String(level).startsWith('Level') || String(level).startsWith('AL-') || String(level).startsWith('GP') ? String(level) : `Level ${level}`;
  };
  const getRateForDate = (
    rates: Rate[],
    date: Date,
    options: { basicPay?: number, payLevel?: string, daRate?: number } = {}
  ): Rate | null => {
    const { basicPay, payLevel, daRate } = options;
    const calcDate = startOfDay(date);

    // First attempt: exact match within fromDate and toDate interval
    let applicableRates = rates.filter(r => {
      let isMatch = true;

      if (r.fromDate) {
        const rFrom = startOfDay(new Date(r.fromDate));
        if (calcDate < rFrom) {
          isMatch = false;
        }
      }

      if (r.toDate) {
        const rTo = endOfDay(new Date(r.toDate));
        if (calcDate > rTo) {
          isMatch = false;
        }
      }

      if (daRate !== undefined && r.daRateFrom !== undefined && r.daRateTo !== undefined && r.daRateFrom !== '' && r.daRateTo !== '') {
        if (!(daRate >= Number(r.daRateFrom) && daRate <= Number(r.daRateTo))) {
          isMatch = false;
        }
      }

      if (!isMatch) return false;

      if (basicPay !== undefined) {
        if (r.basicFrom !== undefined && r.basicTo !== undefined && Number(r.basicFrom) > 0 && Number(r.basicTo) > 0) {
          if (!(basicPay >= Number(r.basicFrom) && basicPay <= Number(r.basicTo))) {
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
          isMatch = false;
        }
      }

      return isMatch;
    });

    // Fallback: If no exact match (e.g. calculation date is past the latest configured toDate),
    // pick the latest rate that started on or before the calculation date (r.fromDate <= date)
    if (applicableRates.length === 0) {
      applicableRates = rates.filter(r => {
        let isMatch = true;

        if (r.fromDate) {
          const rFrom = startOfDay(new Date(r.fromDate));
          if (calcDate < rFrom) {
            isMatch = false;
          }
        }

        if (daRate !== undefined && r.daRateFrom !== undefined && r.daRateTo !== undefined && r.daRateFrom !== '' && r.daRateTo !== '') {
          if (!(daRate >= Number(r.daRateFrom) && daRate <= Number(r.daRateTo))) {
            isMatch = false;
          }
        }

        if (!isMatch) return false;

        if (basicPay !== undefined) {
          if (r.basicFrom !== undefined && r.basicTo !== undefined && Number(r.basicFrom) > 0 && Number(r.basicTo) > 0) {
            if (!(basicPay >= Number(r.basicFrom) && basicPay <= Number(r.basicTo))) {
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
            isMatch = false;
          }
        }

        return isMatch;
      });
    }

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

    const matchedRate = applicableRates[0];
    return {
      ...matchedRate,
      rate: Number(matchedRate.rate),
    };
  };

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
        else if (sideData.incrementDate && currentMonth === sideData.incrementDate.getMonth() + 1 && currentYear >= sideData.incrementDate.getFullYear()) {
          incrementTriggerDate = new Date(currentYear, sideData.incrementDate.getMonth(), sideData.incrementDate.getDate());
        }

        if (incrementTriggerDate && isWithinInterval(incrementTriggerDate, { start: monthStart, end: monthEnd }) && startOfDay(incrementTriggerDate) >= startOfDay(arrearFromDate)) {
          let newBasic: number | null = null;

          if (sideData.cpc === '7th' && trackerBasic >= 218200) {
            newBasic = trackerBasic; // Freeze at 218200 or above
          } else if (sideData.cpc === '7th' && sideData.payLevel) {
            let levelData = cpcData['7th'].payLevels.find(l => l.level === sideData.payLevel);

            if (!levelData) {
              levelData = cpcData['7th'].payLevels.find(l => l.level.includes('/') && l.level.split('/').includes(sideData.payLevel));
            }

            if (levelData) {
              const currentBasicIndex = levelData.values.indexOf(trackerBasic);
              if (currentBasicIndex !== -1 && currentBasicIndex + 1 < levelData.values.length) {
                newBasic = levelData.values[currentBasicIndex + 1];
              } else {
                // If refixed to a different level, try to find the basic in any level to get the next cell
                for (const l of cpcData['7th'].payLevels) {
                  const idx = l.values.indexOf(trackerBasic);
                  if (idx !== -1 && idx + 1 < l.values.length) {
                    newBasic = l.values[idx + 1];
                    break;
                  }
                }
              }
            }
          }

          if (newBasic === null) {
            // 6th CPC (and fallback): Annual increment @ 3% of Basic Pay, rounded off UP to the next multiple of 10
            newBasic = Math.ceil((trackerBasic * 1.03) / 10) * 10;
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
    const daysToCalculateForMonth = differenceInDays(startOfDay(effectiveMonthEnd), startOfDay(effectiveMonthStart)) + 1;
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

        const daysToCalc = differenceInDays(startOfDay(intersectionEnd), startOfDay(intersectionStart)) + 1;
        return daysToCalc > 0 ? daysToCalc / daysInCalcMonth : 0;
      };

      const is6thCpc = sideData.cpc === '6th';

      const getEffectiveDaRate = (): number => {
        // Fixed rate override (applies to both 6th and 7th CPC)
        if (sideData.daFixedRateApplicable && sideData.daFixedRate && sideData.daFixedRateFromDate && sideData.daFixedRateToDate) {
          if (isWithinInterval(currentDate, { start: sideData.daFixedRateFromDate, end: sideData.daFixedRateToDate })) {
            return sideData.daFixedRate;
          }
        }
        // 6th CPC: use da6thRates table; 7th CPC: use daRates table
        if (is6thCpc) {
          const daRateDetails = getRateForDate(da6thRates, currentDate);
          return daRateDetails ? daRateDetails.rate : 0;
        }
        const daRateDetails = getRateForDate(daRates, currentDate);
        return daRateDetails ? daRateDetails.rate : 0;
      };

      const effectiveDaRate = getEffectiveDaRate();

      // Calculate NPA
      let npa = 0;
      let fullMonthNpaCalculated = 0;
      if (sideData.npaApplicable) {
        if (is6thCpc) {
          fullMonthNpaCalculated = fullMonthBasic * (sixthCpcConfig.npa6thRate / 100);
        } else {
          const npaRateDetails = getRateForDate(npaRates, currentDate);
          if (npaRateDetails) {
            fullMonthNpaCalculated = fullMonthBasic * (npaRateDetails.rate / 100);
          }
        }
        const prorationFactor = getProratedFactorForAllowance(sideData.npaFromDate, sideData.npaToDate);
        if (prorationFactor > 0) {
          npa = fullMonthNpaCalculated * monthProRataFactor;
        }
      }

      // Calculate DA
      let da = 0;
      if (sideData.daApplicable) {
        // DA base = Basic Pay + NPA (same for both 6th and 7th CPC)
        const baseForDA = proratedBasic + npa;
        da = baseForDA * (effectiveDaRate / 100);
      }

      // Calculate HRA
      let hra = 0;
      if (sideData.hraApplicable) {
        const prorationFactor = getProratedFactorForAllowance(sideData.hraFromDate, sideData.hraToDate);
        if (prorationFactor > 0) {
          // 6th CPC: HRA is on (Basic Pay + NPA). 7th CPC: HRA is on Basic Pay only.
          const hraBase = is6thCpc
            ? fullMonthBasic + (sideData.npaApplicable ? fullMonthNpaCalculated : 0)
            : fullMonthBasic;

          if (is6thCpc) {
            // 6th CPC: HRA = hra6thRate% of (Basic Pay + NPA) — fixed rate, not DA-slab based
            let fullMonthHra = hraBase * (sixthCpcConfig.hra6thRate / 100);
            // Override with fixed rate if applicable
            if (sideData.hraFixedRateApplicable && sideData.hraFixedRate && sideData.hraFixedRateFromDate && sideData.hraFixedRateToDate) {
              if (isWithinInterval(currentDate, { start: sideData.hraFixedRateFromDate, end: sideData.hraFixedRateToDate })) {
                fullMonthHra = hraBase * (sideData.hraFixedRate / 100);
              }
            }
            hra = fullMonthHra * monthProRataFactor;
          } else {
            // 7th CPC: HRA is DA-slab based from hraRates table
            const hraRateDetails = getRateForDate(hraRates, currentDate, { daRate: effectiveDaRate });
            if (hraRateDetails) {
              let fullMonthHra = hraBase * (hraRateDetails.rate / 100);
              if (hraRateDetails.minAmount && hraRateDetails.minAmount > 0) {
                fullMonthHra = Math.max(fullMonthHra, hraRateDetails.minAmount);
              }
              hra = fullMonthHra * monthProRataFactor;
            }
          }
        }
      }

      // Calculate TA
      let ta = 0;
      if (sideData.taApplicable) {
        const prorationFactor = getProratedFactorForAllowance(sideData.taFromDate, sideData.taToDate);
        if (prorationFactor > 0) {
          const taRateDetails = getRateForDate(taRates, currentDate, { basicPay: (side === 'paid' ? newDrawnTracker : newDueTracker), payLevel });
          if (taRateDetails) {
            let taBaseAmount = taRateDetails.rate;
            if (sideData.doubleTaApplicable) {
              taBaseAmount *= 2;
              if (sideData.cpc === '7th' && taBaseAmount < 2250) {
                taBaseAmount = 2250;
              }
            }
            let fullMonthTa = taBaseAmount + (taBaseAmount * (effectiveDaRate / 100));
            ta = fullMonthTa * monthProRataFactor;
          }
        }
      }

      // Calculate Other Allowance
      let other = 0;
      if (sideData.otherAllowance && sideData.otherAllowance > 0) {
        const prorationFactor = getProratedFactorForAllowance(sideData.otherAllowanceFromDate, sideData.otherAllowanceToDate);
        if (prorationFactor > 0) {
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
      month: format(currentDate, "MMM yy"),
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
      let currentPeriods = statement ? (statement.periods || [{ 
        id: crypto.randomUUID(), 
        formData: statement.employeeInfo as ArrearFormData, 
        rows: statement.rows, 
        totals: statement.totals 
      }]) : [];

      if (statement) {
        // Overlap checks
        if (currentPeriodIndex > 0) {
          const prevPeriod = currentPeriods[currentPeriodIndex - 1];
          if (data.fromDate <= new Date(prevPeriod.formData.toDate)) {
            toast({
              variant: "destructive",
              title: "Overlapping Dates",
              description: `Start date must be after Period ${currentPeriodIndex}'s end date.`,
            });
            return;
          }
        }
        if (currentPeriodIndex < currentPeriods.length - 1) {
          const nextPeriod = currentPeriods[currentPeriodIndex + 1];
          if (data.toDate >= new Date(nextPeriod.formData.fromDate)) {
            toast({
              variant: "destructive",
              title: "Overlapping Dates",
              description: `End date must be before Period ${currentPeriodIndex + 2}'s start date.`,
            });
            return;
          }
        }
      }

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

        if (currentDate < arrearFromDate && !isWithinInterval(arrearFromDate, { start: monthStart, end: monthEnd })) continue;
        if (currentDate > arrearToDate && !isWithinInterval(arrearToDate, { start: monthStart, end: monthEnd })) continue;

        const effectiveMonthStart = max([monthStart, arrearFromDate]);
        const effectiveMonthEnd = min([monthEnd, arrearToDate]);
        const daysToCalculateForMonth = differenceInDays(startOfDay(effectiveMonthEnd), startOfDay(effectiveMonthStart)) + 1;

        if (daysToCalculateForMonth <= 0) continue;

        const { row, newTrackers } = calculateMonthlyRow(currentDate, arrearFromDate, arrearToDate, data, trackers);
        rows.push(row);
        trackers = newTrackers;
      }

      totals.drawn.total = rows.reduce((acc, row) => acc + row.drawn.total, 0);
      totals.due.total = rows.reduce((acc, row) => acc + row.due.total, 0);
      totals.difference = rows.reduce((acc, row) => acc + row.difference, 0);

      const newPeriod: FixationPeriod = {
        id: crypto.randomUUID(),
        formData: data,
        rows,
        totals
      };

      if (statement) {
        if (currentPeriodIndex < currentPeriods.length) {
          currentPeriods[currentPeriodIndex] = newPeriod;
        } else {
          currentPeriods.push(newPeriod);
        }

        const combinedRows = currentPeriods.flatMap(p => p.rows);
        const combinedTotals = {
          drawn: { total: currentPeriods.reduce((acc, p) => acc + p.totals.drawn.total, 0) },
          due: { total: currentPeriods.reduce((acc, p) => acc + p.totals.due.total, 0) },
          difference: currentPeriods.reduce((acc, p) => acc + p.totals.difference, 0)
        };
        const updatedEmployeeInfo = {
          ...statement.employeeInfo,
          employeeId: data.employeeId,
          employeeName: data.employeeName,
          designation: data.designation,
          department: data.department,
          payFixationRef: data.payFixationRef,
          remark: data.remark,
          toDate: currentPeriods[currentPeriods.length - 1].formData.toDate
        };

        setStatement({ rows: combinedRows, totals: combinedTotals, employeeInfo: updatedEmployeeInfo, periods: currentPeriods });
      } else {
        const newStatement = { rows, totals, employeeInfo: data, periods: [newPeriod] };
        setStatement(newStatement);
      }
      
      setShowDiffToast({ show: true, diff: totals.difference });
      
      // Auto-hide popup after 7 seconds
      setTimeout(() => {
        setShowDiffToast(prev => ({ ...prev, show: false }));
      }, 7000);

      setTimeout(() => {
        document.getElementById("statement-section")?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      // Reset form dirty state so the calculate button becomes inactive again
      form.reset(data);
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

    if (statement.periods && currentPeriodIndex >= statement.periods.length) {
      toast({
        variant: "destructive",
        title: "Calculation Required",
        description: "Please click 'Calculate & Append' to process the new period before saving."
      });
      return;
    }

    if (isCalcFieldDirty) {
      toast({
        variant: "destructive",
        title: "Uncalculated Changes",
        description: "You have changed calculation fields. Please click 'Recalculate Arrears' before saving."
      });
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
    setSavedStatements(prev => [...prev, { ...docToSave, isLocal: true }].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()));

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

  const handlePrepareNextPeriod = () => {
    if (!statement || !statement.employeeInfo.toDate) return;
    
    let currentPeriods = statement.periods || [{ 
      id: crypto.randomUUID(), 
      formData: statement.employeeInfo as ArrearFormData, 
      rows: statement.rows, 
      totals: statement.totals 
    }];

    const nextIndex = currentPeriods.length;
    setCurrentPeriodIndex(nextIndex);

    // Set new fromDate to the day after the last period's toDate
    const lastPeriodToDate = currentPeriods[currentPeriods.length - 1].formData.toDate;
    const nextStartDate = addDays(new Date(lastPeriodToDate), 1);
    
    // Clear the form but retain top level non-period specific data if possible, or just reset and set specific fields
    // We can use form.reset with a partial payload to keep employee details
    const currentData = form.getValues();
    form.reset({
      ...currentData,
      fromDate: nextStartDate,
      toDate: undefined as any,
      remark: "",
      paid: {
        ...currentData.paid,
        basicPay: '' as any,
        payLevel: undefined,
        incrementMonth: undefined,
      },
      toBePaid: {
        ...currentData.toBePaid,
        basicPay: '' as any,
        payLevel: undefined,
        incrementMonth: undefined,
      }
    });
    
    toast({
      title: "Ready for Next Period",
      description: `Please enter the details for Period ${nextIndex + 1} and click Calculate.`,
    });
    
    // Scroll to form top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadPeriodIntoForm = (index: number) => {
    if (!statement || !statement.periods || index < 0 || index >= statement.periods.length) return;
    
    if (isCalcFieldDirty) {
      toast({
        variant: "destructive",
        title: "Uncalculated Changes",
        description: "You have changed calculation fields. Please click 'Recalculate Arrears' before navigating to another period."
      });
      return;
    }

    const currentData = form.getValues();
    let updatedPeriods = [...statement.periods];
    if (updatedPeriods[currentPeriodIndex]) {
      updatedPeriods[currentPeriodIndex] = {
        ...updatedPeriods[currentPeriodIndex],
        formData: {
          ...updatedPeriods[currentPeriodIndex].formData,
          remark: currentData.remark,
          payFixationRef: currentData.payFixationRef,
        }
      };
      setStatement({ ...statement, periods: updatedPeriods });
    }

    setCurrentPeriodIndex(index);
    form.reset({
      ...updatedPeriods[index].formData,
      remark: updatedPeriods[index].formData.remark || "",
      payFixationRef: updatedPeriods[index].formData.payFixationRef || ""
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast({
      title: `Loaded Period ${index + 1}`,
      description: "You can now view or edit this period's configuration.",
    });
  };

  const updateStatement = async () => {
    if (!loadedStatementId || !user || !statement) return;
    setIsLoading(true);

    const formData = form.getValues();

    const updatedEmployeeInfo = {
      ...statement.employeeInfo,
      employeeId: formData.employeeId,
      employeeName: formData.employeeName,
      designation: formData.designation,
      department: formData.department,
      payFixationRef: formData.payFixationRef,
      remark: formData.remark,
    };

    let updatedPeriods = statement.periods ? [...statement.periods] : [];
    if (updatedPeriods[currentPeriodIndex]) {
      updatedPeriods[currentPeriodIndex] = {
        ...updatedPeriods[currentPeriodIndex],
        formData: {
          ...updatedPeriods[currentPeriodIndex].formData,
          employeeId: formData.employeeId,
          employeeName: formData.employeeName,
          designation: formData.designation,
          department: formData.department,
          payFixationRef: formData.payFixationRef,
          remark: formData.remark,
        }
      };
    }

    const statementToSave = {
      ...statement,
      employeeInfo: updatedEmployeeInfo,
      periods: updatedPeriods
    };

    setStatement(statementToSave);

    const docToUpdate: Omit<SavedStatement, 'isLocal'> = {
      ...statementToSave,
      id: loadedStatementId,
      savedAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
      userId: user.uid,
      userName: user.displayName || undefined,
      userEmail: user.email || undefined,
    };

    const localStatements = getLocalStatements();
    const updatedLocalStatements = localStatements.map(s =>
      s.id === loadedStatementId ? { ...docToUpdate, isLocal: s.isLocal ?? true } : s
    );
    saveLocalStatements(updatedLocalStatements);
    setSavedStatements(updatedLocalStatements.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()));

    if (isOnline && dbConfigured && db) {
      try {
        const docRef = doc(db, FIRESTORE_STATEMENTS_COLLECTION, loadedStatementId);
        await updateDoc(docRef, sanitizeForFirebase(docToUpdate));

        const finalLocalStatements = getLocalStatements().map(s =>
          s.id === loadedStatementId ? { ...s, isLocal: false } : s
        );
        saveLocalStatements(finalLocalStatements);
        setSavedStatements(finalLocalStatements.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()));

        toast({
          title: "Arrear Updated",
          description: "Your changes have been saved to your account.",
        });
      } catch (error) {
        console.error("Failed to update statement in Firestore:", error);
        toast({
          title: "Updated Locally",
          description: "Changes saved to your browser. Will sync when online.",
        });
      }
    } else {
      toast({
        title: "Updated Locally",
        description: "Changes saved to your browser. Will sync when online.",
      });
    }

    setIsLoading(false);
  };

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
    const fullyProcessedRest = processFirestoreDataRecursive(restOfStatement);

    let periodsToLoad = fullyProcessedRest.periods;
    if (!periodsToLoad || periodsToLoad.length === 0) {
      periodsToLoad = [{
        id: fullyProcessedRest.id || crypto.randomUUID(),
        formData: fullyProcessedInfo as ArrearFormData,
        rows: fullyProcessedRest.rows,
        totals: fullyProcessedRest.totals
      }];
    }

    const firstPeriodData = periodsToLoad[0].formData;
    
    const formDataToReset = {
      ...firstPeriodData,
      employeeId: fullyProcessedInfo.employeeId || "",
      employeeName: fullyProcessedInfo.employeeName || "",
      designation: fullyProcessedInfo.designation || "",
      department: fullyProcessedInfo.department || "",
    }

    form.reset(formDataToReset as ArrearFormData);

    setTimeout(() => {
      if (formDataToReset.paid?.payLevel) form.setValue('paid.payLevel', formDataToReset.paid.payLevel);
      if (formDataToReset.toBePaid?.payLevel) form.setValue('toBePaid.payLevel', formDataToReset.toBePaid.payLevel);
    }, 0);

    setStatement({
      ...fullyProcessedRest,
      employeeInfo: fullyProcessedInfo,
      periods: periodsToLoad
    });
    
    setCurrentPeriodIndex(0);
    setLoadedStatementId(statementToLoad.id);

    if (isOnline && dbConfigured && db) {
      try {
        const docRef = doc(db, FIRESTORE_STATEMENTS_COLLECTION, statementToLoad.id);
        await updateDoc(docRef, { lastAccessedAt: serverTimestamp() });
        const localStmts = getLocalStatements().map(s => s.id === statementToLoad.id ? { ...s, lastAccessedAt: new Date().toISOString() } : s);
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
      remark: "",
      paid: { cpc: "7th" as any, basicPay: '' as any, payLevel: undefined, incrementMonth: undefined, daApplicable: true, hraApplicable: true, npaApplicable: false, taApplicable: false, doubleTaApplicable: false, otherAllowance: '' as any, otherAllowanceName: "" },
      toBePaid: { cpc: "7th" as any, basicPay: '' as any, payLevel: undefined, incrementMonth: undefined, daApplicable: true, hraApplicable: true, npaApplicable: false, taApplicable: false, doubleTaApplicable: false, otherAllowance: '' as any, otherAllowanceName: "", refixedBasicPay: '' as any },
    });
    setStatement(null);
    setLoadedStatementId(null);
    toast({ title: "Form Cleared", description: "All fields have been reset." });
  };

  const handleScanClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    toast({
      title: "Scanning Document",
      description: "Extracting data using AI, please wait...",
    });

    try {
      const compressedFile = await compressImage(file);
      
      const formData = new FormData();
      formData.append("file", compressedFile);

      const response = await fetch("/api/extract-proforma", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to process document");
      }

      const data = await response.json();
      
      // Calculate toDate based on fromDate just like the AI extraction logic
      const today = new Date();
      const lastDayOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      
      const preparedData = {
        employeeName: data.employeeName || '',
        employeeId: data.employeeId || '',
        designation: data.designation || '',
        department: data.department || '',
        fromDate: data.fromDate || '',
        toDate: lastDayOfPrevMonth,
        payFixationRef: data.payFixationRef || '',
        paid: data.paid ? { ...data.paid } : {},
        toBePaid: data.toBePaid ? { ...data.toBePaid } : {},
      };

      setAiScannedData(preparedData);
      setIsAiModalOpen(true);
      
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Scan Failed",
        description: "Could not extract data from the image.",
      });
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAiModalConfirm = (confirmedData: any) => {
    // Fill the form with confirmed data
    if (confirmedData.employeeName) form.setValue("employeeName", confirmedData.employeeName);
    if (confirmedData.employeeId) form.setValue("employeeId", confirmedData.employeeId);
    if (confirmedData.designation) form.setValue("designation", confirmedData.designation);
    if (confirmedData.department) form.setValue("department", confirmedData.department);
    
    if (confirmedData.fromDate) form.setValue("fromDate", new Date(confirmedData.fromDate));
    if (confirmedData.toDate) form.setValue("toDate", new Date(confirmedData.toDate));
    if (confirmedData.payFixationRef) form.setValue("payFixationRef", confirmedData.payFixationRef);
    
    if (confirmedData.paid) {
      if (confirmedData.paid.cpc) form.setValue("paid.cpc", confirmedData.paid.cpc);
      if (confirmedData.paid.basicPay) form.setValue("paid.basicPay", confirmedData.paid.basicPay);
      if (confirmedData.paid.payLevel) form.setValue("paid.payLevel", confirmedData.paid.payLevel);
      if (confirmedData.paid.incrementMonth) form.setValue("paid.incrementMonth", confirmedData.paid.incrementMonth);
    }
    
    if (confirmedData.toBePaid) {
      if (confirmedData.toBePaid.cpc) form.setValue("toBePaid.cpc", confirmedData.toBePaid.cpc);
      if (confirmedData.toBePaid.basicPay) form.setValue("toBePaid.basicPay", confirmedData.toBePaid.basicPay);
      if (confirmedData.toBePaid.payLevel) form.setValue("toBePaid.payLevel", confirmedData.toBePaid.payLevel);
      if (confirmedData.toBePaid.refixedBasicPay) form.setValue("toBePaid.refixedBasicPay", confirmedData.toBePaid.refixedBasicPay);
      if (confirmedData.toBePaid.refixedBasicPayDate) form.setValue("toBePaid.refixedBasicPayDate", new Date(confirmedData.toBePaid.refixedBasicPayDate));
      if (confirmedData.toBePaid.incrementMonth) form.setValue("toBePaid.incrementMonth", confirmedData.toBePaid.incrementMonth);
    }

    setIsAiModalOpen(false);
    
    toast({
      title: "Data Applied",
      description: "Form has been auto-filled with verified data. Calculating arrears...",
    });

    // Automatically trigger form submission (calculation)
    setTimeout(() => {
      form.handleSubmit(onSubmit)();
    }, 100);
  };

  const handleRowEdit = (
    rowIndex: number,
    type: 'drawn' | 'due',
    field: 'basic' | 'da' | 'hra' | 'ta' | 'npa' | 'other',
    value: number
  ) => {
    if (!statement) return;

    const updatedRows = [...statement.rows];
    const row = { ...updatedRows[rowIndex] };
    row[type] = { ...row[type], [field]: value };

    // Recalculate row totals
    row[type].total = row[type].basic + row[type].da + row[type].hra + row[type].ta + row[type].npa + row[type].other;
    row.difference = row.due.total - row.drawn.total;

    updatedRows[rowIndex] = row;

    // Recalculate statement totals
    const newTotals = {
      drawn: { basic: 0, da: 0, hra: 0, ta: 0, npa: 0, other: 0, total: 0 },
      due: { basic: 0, da: 0, hra: 0, ta: 0, npa: 0, other: 0, total: 0 },
      difference: 0
    };

    updatedRows.forEach(r => {
      ['drawn', 'due'].forEach(t => {
        const cat = t as 'drawn' | 'due';
        newTotals[cat].basic += r[cat].basic;
        newTotals[cat].da += r[cat].da;
        newTotals[cat].hra += r[cat].hra;
        newTotals[cat].ta += r[cat].ta;
        newTotals[cat].npa += r[cat].npa;
        newTotals[cat].other += r[cat].other;
        newTotals[cat].total += r[cat].total;
      });
      newTotals.difference += r.difference;
    });

    setStatement({ ...statement, rows: updatedRows, totals: newTotals });
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
        {type === "paid" ? (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-amber-500/10 border border-amber-300/80 dark:border-amber-700/50 text-amber-900 dark:text-amber-200 text-xs font-semibold">
            <History className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Configuring: <strong>Already Paid (Existing / Pre-revised)</strong> Salary Structure</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-300/80 dark:border-emerald-700/50 text-emerald-900 dark:text-emerald-200 text-xs font-semibold">
            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Configuring: <strong>To be Paid (Upgraded / Revised Due)</strong> Salary Structure</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <FormField control={form.control} name={`${type}.payLevel`} render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Pay Level</FormLabel>
                  <Select onValueChange={(val) => {
                    field.onChange(val);
                    form.clearErrors(`${type}.payLevel`);
                    form.clearErrors(`${type}.basicPay`);
                  }} value={field.value} disabled={!cpc}>
                    <FormControl><SelectTrigger className={fieldState.error ? "border-red-500 focus-visible:ring-red-500" : ""}><SelectValue placeholder={cpc ? "Select a level" : "Select CPC first"} /></SelectTrigger></FormControl>
                    <SelectContent>
                      {payLevels.map(level => <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name={`${type}.basicPay`} render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Basic Pay</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="e.g., 50000" 
                    {...field} 
                    className={fieldState.error ? "border-red-500 focus-visible:ring-red-500" : ""}
                    onBlur={(e) => {
                      field.onBlur();
                      const basicPay = Number(e.target.value);
                      if (!basicPay || isNaN(basicPay)) {
                        form.clearErrors(`${type}.basicPay`);
                        form.clearErrors(`${type}.payLevel`);
                        return;
                      }
                      const cpc = form.getValues(`${type}.cpc`);
                      const payLevel = form.getValues(`${type}.payLevel`);
                      if (cpc === "7th" && payLevel) {
                        let levelData = cpcData['7th'].payLevels.find(l => l.level === payLevel);
                        if (!levelData) {
                           levelData = cpcData['7th'].payLevels.find(l => l.level.includes('/') && l.level.split('/').includes(payLevel));
                        }
                        if (levelData) {
                          if (!levelData.values.includes(basicPay)) {
                            setBasicPayWarning({ show: true, basicPay, payLevel, fieldName: `${type}.basicPay` });
                          } else {
                            form.clearErrors(`${type}.basicPay`);
                            form.clearErrors(`${type}.payLevel`);
                          }
                        }
                      }
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="space-y-4 rounded-md border p-4 bg-muted/20">
              <h4 className="font-medium">Annual Increment</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField control={form.control} name="toBePaid.refixedBasicPay" render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Refixed Basic Pay</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="New basic pay" 
                          {...field} 
                          value={field.value ?? ''} 
                          className={fieldState.error ? "border-red-500 focus-visible:ring-red-500" : ""}
                          onBlur={(e) => {
                            field.onBlur();
                            const basicPay = Number(e.target.value);
                            if (!basicPay || isNaN(basicPay)) {
                              form.clearErrors(`toBePaid.refixedBasicPay`);
                              return;
                            }
                            const cpc = form.getValues(`toBePaid.cpc`);
                            const payLevel = form.getValues(`toBePaid.payLevel`);
                            if (cpc === "7th" && payLevel) {
                              let levelData = cpcData['7th'].payLevels.find(l => l.level === payLevel);
                              if (!levelData) {
                                 levelData = cpcData['7th'].payLevels.find(l => l.level.includes('/') && l.level.split('/').includes(payLevel));
                              }
                              if (levelData) {
                                if (!levelData.values.includes(basicPay)) {
                                  setBasicPayWarning({ show: true, basicPay, payLevel, fieldName: `toBePaid.refixedBasicPay` });
                                } else {
                                  form.clearErrors(`toBePaid.refixedBasicPay`);
                                }
                              }
                            }
                          }}
                        />
                      </FormControl>
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
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="space-y-4 rounded-md border p-4">
              <h4 className="font-medium">Applicable Allowances</h4>
              <div className="space-y-2">
                <FormField control={form.control} name={`${type}.daApplicable`} render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel className="font-normal">DA (Dearness Allowance)</FormLabel>
                  </FormItem>
                )} />
                {isDAApplicable && <FixedRateFields type={type} name="da" />}
              </div>
              <div className="space-y-2">
                <AllowanceField type={type} name="hra" label="HRA (House Rent Allowance)" />
              </div>
              <div className="space-y-2">
                <AllowanceField type={type} name="npa" label="NPA (Non-Practicing Allowance)" />
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
        </div>
      </div>
    );
  };

  const formatDisplayDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), "dd-MM-yy hh:mm a");
    } catch {
      return 'Invalid Date';
    }
  };

  const handleLoadClick = () => {
    if (authStatus !== 'authenticated') {
      openAuthModal();
    } else {
      setLoadDialogOpen(true);
    }
  };

  const numberToWords = (num: number): string => {
    if (!num || isNaN(num) || num === 0) return "Zero Only";

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const convertLessThanThousand = (n: number): string => {
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

    let n = Math.floor(Math.abs(num));
    if (n === 0) return "Zero Only";

    const remainder = n % 1000;
    let words = convertLessThanThousand(remainder);
    n = Math.floor(n / 1000);

    const units = ['Thousand', 'Lakh', 'Crore'];
    let unitIndex = 0;

    while (n > 0) {
      const chunk = n % 100;
      if (chunk > 0) {
        const unitName = units[Math.min(unitIndex, units.length - 1)];
        words = convertLessThanThousand(chunk) + unitName + ' ' + words;
      }
      n = Math.floor(n / 100);
      unitIndex++;
    }

    return words.replace(/\s+/g, ' ').trim() + " Only";
  };


  return (
    <>
      <AIValidationModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        data={aiScannedData}
        onConfirm={handleAiModalConfirm}
      />
      <Dialog open={showDiffToast.show} onOpenChange={(open) => { if (!open) setShowDiffToast(prev => ({ ...prev, show: false })) }}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Total Arrear Difference</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center py-6">
            <span className={cn("text-4xl font-extrabold tracking-tight", showDiffToast.diff > 0 ? "text-emerald-600 dark:text-emerald-500" : showDiffToast.diff < 0 ? "text-red-600 dark:text-red-500" : "text-gray-600")}>
              Rs. {showDiffToast.diff.toLocaleString('en-IN')}
            </span>
          </div>
          <p className="text-muted-foreground mt-4">Arrear statement calculated successfully!</p>
        </DialogContent>
      </Dialog>

      <Dialog open={basicPayWarning?.show || false} onOpenChange={(open) => { if (!open) setBasicPayWarning(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-600 flex items-center gap-2">
              <Info className="h-6 w-6" /> Basic Pay Warning
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center space-y-4">
            <p className="text-muted-foreground text-[15px]">
              The basic pay <strong>Rs. {basicPayWarning?.basicPay}</strong> does not exist in <strong>Level {basicPayWarning?.payLevel}</strong> of the 7th CPC Pay Matrix.
            </p>
            <p className="text-sm font-semibold text-amber-600">
              Please check your selected Pay Level and Basic Pay.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => {
              if (basicPayWarning?.fieldName) {
                form.setError(basicPayWarning.fieldName, { type: "manual", message: "Invalid basic pay for selected level." });
                if (basicPayWarning.fieldName !== 'toBePaid.refixedBasicPay') {
                  const payLevelFieldName = basicPayWarning.fieldName.replace('basicPay', 'payLevel') as any;
                  form.setError(payLevelFieldName, { type: "manual", message: "Invalid level for basic pay." });
                }
              }
              setBasicPayWarning(null);
            }} variant="default">
              Understood
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isScanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="flex flex-col items-center p-8 bg-card rounded-2xl shadow-2xl border border-border animate-in zoom-in-95 duration-300">
             <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
             <h2 className="text-2xl font-bold mb-2 text-foreground text-center">Analyzing Document</h2>
             <p className="text-muted-foreground text-center max-w-xs md:max-w-sm">
               Our AI is scanning your pay fixation proforma. This usually takes a few seconds...
             </p>
          </div>
        </div>
      )}


    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 md:py-12">
        <AuthModal />

        <header className="text-center mb-8 no-print">
          <div className="flex justify-end items-center gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  {dbConfigured ? (
                    isOnline ? <Wifi className="text-green-500" /> : <WifiOff className="text-red-500" />
                  ) : (
                    <WifiOff className="text-yellow-500" />
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
              <Loader2 className="h-6 w-6 animate-spin" />
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
          <h1 className="font-headline text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-900 dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400 bg-clip-text text-transparent tracking-tight">Arrear Ease</h1>
          <p className="text-muted-foreground mt-2 text-lg font-medium">A Simple Tool for Complex Salary Arrear Calculations</p>
          <p className="text-muted-foreground/80 mt-1 text-sm">For Central Govt and State Govt employees (6th, 7th & 8th Central Pay Commission)</p>
          <div className="mt-2">
            <span className="inline-block px-3 py-0.5 text-xs font-semibold bg-primary/10 text-primary rounded-full border border-primary/20">Dedicated to AMU by Zafar Ali Khan</span>
          </div>
        </header>

        <div className="flex flex-col sm:flex-row justify-end gap-2 mb-4 no-print">
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileChange} 
          />
          <Button 
            onClick={handleScanClick} 
            disabled={isScanning} 
            className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 text-white font-medium shadow-sm hover:shadow-md transition-all duration-200 border-0 active:scale-95"
          >
            {isScanning ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <>
                <Camera className="mr-1.5 h-4 w-4" />
                <Sparkles className="mr-1.5 h-3.5 w-3.5 text-amber-300 animate-pulse" />
              </>
            )}
            {isScanning ? "Scanning..." : "Scan Pay Fixation"}
          </Button>
          <Button 
            variant="outline" 
            onClick={handleClearForm}
            className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Clear Form
          </Button>
          <Button 
            variant="outline" 
            onClick={handleLoadClick}
            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 dark:border-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-950/40 transition-colors"
          >
            <FolderOpen className="mr-2 h-4 w-4" /> Load Saved Arrears
          </Button>
          <Dialog open={isLoadDialogOpen} onOpenChange={setLoadDialogOpen}>
            <DialogContent className="max-w-5xl lg:max-w-6xl w-[95vw]">
              <DialogHeader>
                <DialogTitle>Load Saved Arrear Statement</DialogTitle>
                <DialogDescription>Select a previously saved statement to view or print it again.</DialogDescription>
              </DialogHeader>
              <div className="py-2 px-1">
                <Input
                  placeholder="Search by Employee ID or Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              <div className="max-h-[60vh] overflow-y-auto overflow-x-auto">
                {isLoading ? (
                  <div className="flex justify-center items-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : (() => {
                  let result = [...savedStatements];
                  if (searchQuery.trim() !== '') {
                    const q = searchQuery.toLowerCase();
                    result = result.filter(s => 
                      (s.employeeInfo?.employeeName || '').toLowerCase().includes(q) ||
                      (s.employeeInfo?.employeeId || '').toLowerCase().includes(q)
                    );
                  }
                  if (sortDirection) {
                    result.sort((a, b) => {
                      const nameA = (a.employeeInfo?.employeeName || '').toLowerCase();
                      const nameB = (b.employeeInfo?.employeeName || '').toLowerCase();
                      if (nameA < nameB) return sortDirection === 'asc' ? -1 : 1;
                      if (nameA > nameB) return sortDirection === 'asc' ? 1 : -1;
                      return 0;
                    });
                  }
                  return result.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer hover:bg-muted/50 select-none" onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc')}>
                          <div className="flex items-center">
                            Employee
                            {sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : sortDirection === 'desc' ? <ArrowDown className="ml-2 h-4 w-4" /> : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />}
                          </div>
                        </TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Difference</TableHead>
                        {isAdmin && <TableHead className="hidden lg:table-cell">User</TableHead>}
                        <TableHead className="hidden sm:table-cell">Saved On</TableHead>
                        <TableHead className="hidden 2xl:table-cell">Last Accessed</TableHead>
                        <TableHead className="text-right sticky right-0 bg-background shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)] z-10">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.map(s => (
                        <TableRow key={s.id} className="group">
                          <TableCell className="font-medium whitespace-nowrap">
                            {s.isLocal && <TooltipProvider><Tooltip><TooltipTrigger asChild><span className="inline-block mr-2"><CloudUpload className="h-4 w-4 text-muted-foreground" /></span></TooltipTrigger><TooltipContent><p>Saved locally. Will sync when online.</p></TooltipContent></Tooltip></TooltipProvider>}
                            {s.employeeInfo.employeeId} {s.employeeInfo.employeeName}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                            {s.employeeInfo.fromDate ? format(new Date(s.employeeInfo.fromDate), "dd-MM-yy") : "-"} - {s.employeeInfo.toDate ? format(new Date(s.employeeInfo.toDate), "dd-MM-yy") : "-"}
                          </TableCell>
                          <TableCell className="font-semibold text-right">
                            {s.totals?.difference?.toLocaleString('en-IN') || 0}
                          </TableCell>
                          {isAdmin && <TableCell className="hidden lg:table-cell text-xs">{s.userName || 'N/A'}<br /><span className="text-muted-foreground">{s.userEmail}</span></TableCell>}
                          <TableCell className="hidden sm:table-cell whitespace-nowrap text-xs text-muted-foreground">{formatDisplayDate(s.savedAt)}</TableCell>
                          <TableCell className="hidden 2xl:table-cell whitespace-nowrap text-xs text-muted-foreground">{formatDisplayDate(s.lastAccessedAt)}</TableCell>
                          <TableCell className="text-right sticky right-0 bg-background group-hover:bg-muted/50 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)] z-10">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" onClick={() => loadStatement(s)} disabled={isLoading}>Load</Button>
                              <Button size="sm" variant="destructive" onClick={() => deleteStatement(s.id, s.isLocal)} disabled={isLoading}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No saved statements found.</p>
                  );
                })()}
              </div>
            </DialogContent>
          </Dialog>
          {authStatus === 'authenticated' && isAdmin && (
            <>
              <Button 
                variant="outline" 
                asChild
                className="border-sky-200 text-sky-700 hover:bg-sky-50 hover:text-sky-800 hover:border-sky-300 dark:border-sky-900/40 dark:text-sky-400 dark:hover:bg-sky-950/40 transition-colors"
              >
                <Link href="/users">
                  <Users className="mr-2 h-4 w-4" /> User Management
                </Link>
              </Button>
              <Button 
                variant="outline" 
                asChild
                className="border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 hover:border-purple-300 dark:border-purple-900/40 dark:text-purple-400 dark:hover:bg-purple-950/40 transition-colors"
              >
                <Link href="/rates">
                  <Settings className="mr-2 h-4 w-4" /> Rate Configuration
                </Link>
              </Button>
            </>
          )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 no-print">
            {/* Top row: Employee Details & Calculation Period side-by-side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card id="employee-details-card" className="border-t-4 border-t-blue-500 border-border/80 shadow-sm hover:shadow-md transition-shadow bg-card flex flex-col justify-between">
                <div>
                  <CardHeader className="pb-3 border-b bg-blue-50/40 dark:bg-blue-950/20">
                    <CardTitle className="flex items-center gap-2.5 text-base font-semibold text-blue-950 dark:text-blue-100">
                      <span className="p-1.5 rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-500/20">
                        <User className="h-4 w-4" />
                      </span> 
                      Employee Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={form.control} name="employeeId" render={({ field }) => (<FormItem> <FormLabel>Employee ID</FormLabel> <FormControl><Input placeholder="Employee ID" {...field} maxLength={5} onChange={(e) => { const val = e.target.value.replace(/\D/g, '').slice(0, 5); field.onChange(val); }} /></FormControl> <FormMessage /> </FormItem>)} />
                      <FormField control={form.control} name="employeeName" render={({ field }) => (<FormItem> <FormLabel>Employee Name</FormLabel> <FormControl><Input placeholder="Full Name" {...field} /></FormControl> <FormMessage /> </FormItem>)} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={form.control} name="designation" render={({ field }) => (<FormItem> <FormLabel>Designation</FormLabel> <FormControl><Input placeholder="Designation" {...field} /></FormControl> <FormMessage /> </FormItem>)} />
                      <FormField control={form.control} name="department" render={({ field }) => (<FormItem> <FormLabel>Department</FormLabel> <FormControl><Input placeholder="Department" {...field} /></FormControl> <FormMessage /> </FormItem>)} />
                    </div>
                  </CardContent>
                </div>
              </Card>

              <Card className="border-t-4 border-t-amber-500 border-border/80 shadow-sm hover:shadow-md transition-shadow bg-card flex flex-col justify-between">
                <div>
                  <CardHeader className="pb-3 border-b bg-amber-50/40 dark:bg-amber-950/20">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2.5 text-base font-semibold text-amber-950 dark:text-amber-100">
                        <span className="p-1.5 rounded-lg bg-amber-500 text-white shadow-sm shadow-amber-500/20">
                          <CalendarDays className="h-4 w-4" />
                        </span> 
                        Calculation Period & Pay Details
                      </CardTitle>
                      {statement && statement.periods && (
                        <div className="flex items-center gap-2 lg:gap-4 no-print">
                          <Button 
                            type="button"
                            variant="outline" 
                            size="sm"
                            disabled={currentPeriodIndex === 0} 
                            onClick={() => loadPeriodIntoForm(currentPeriodIndex - 1)}
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                            Period {currentPeriodIndex + 1} of {Math.max(currentPeriodIndex + 1, statement.periods.length)}
                          </span>
                          <Button 
                            type="button"
                            variant="outline" 
                            size="sm"
                            disabled={currentPeriodIndex >= statement.periods.length - 1} 
                            onClick={() => loadPeriodIntoForm(currentPeriodIndex + 1)}
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={form.control} name="fromDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>From Date</FormLabel><FormDateInput field={field} /><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="toDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>To Date</FormLabel><FormDateInput field={field} /><FormMessage /></FormItem>)} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={form.control} name="payFixationRef" render={({ field }) => (<FormItem><FormLabel>Pay Fixation Reference</FormLabel><FormControl><Input placeholder="Reference No." {...field} /></FormControl></FormItem>)} />
                      <FormField control={form.control} name="remark" render={({ field }) => (<FormItem><FormLabel>Remark (Optional)</FormLabel><FormControl><Input placeholder="Any remark for pay fixation..." {...field} /></FormControl><p className="text-xs text-muted-foreground mt-1">This will be printed below the statement table.</p></FormItem>)} />
                    </div>
                  </CardContent>
                </div>
              </Card>
            </div>

            {/* Bottom: Salary Components Card full width */}
            <div>
              <Card className="border-t-4 border-t-indigo-600 border-border/80 shadow-sm hover:shadow-md transition-shadow bg-card">
                <CardHeader className="pb-3 border-b bg-indigo-50/40 dark:bg-indigo-950/20">
                  <CardTitle className="flex items-center gap-2.5 text-base font-semibold text-indigo-950 dark:text-indigo-100">
                    <span className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-500/20">
                      <FileText className="h-4 w-4" />
                    </span> 
                    Salary Components
                  </CardTitle>
                  <CardDescription>Define salary structures before and after the revision.</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <Tabs defaultValue="paid" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 p-1.5 bg-slate-100 dark:bg-slate-800/90 rounded-xl gap-2 h-auto">
                      <TabsTrigger 
                        value="paid" 
                        className="data-[state=active]:bg-amber-500 data-[state=active]:text-white dark:data-[state=active]:bg-amber-600 dark:data-[state=active]:text-white font-semibold transition-all shadow-sm rounded-lg py-2.5 flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-300"
                      >
                        <History className="h-4 w-4" /> Already Paid (Pre-revised)
                      </TabsTrigger>
                      <TabsTrigger 
                        value="toBePaid" 
                        className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white dark:data-[state=active]:bg-emerald-600 dark:data-[state=active]:text-white font-semibold transition-all shadow-sm rounded-lg py-2.5 flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300"
                      >
                        <TrendingUp className="h-4 w-4" /> To be Paid (Revised Due)
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="paid" className="mt-4 focus-visible:outline-none">{renderSalaryFields("paid")}</TabsContent>
                    <TabsContent value="toBePaid" className="mt-4 focus-visible:outline-none">{renderSalaryFields("toBePaid")}</TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-center pt-2 gap-4">
              <Button type="submit" disabled={isLoading || (!!(statement && statement.periods) && currentPeriodIndex < statement.periods.length && !isCalcFieldDirty)} size="lg" className="w-full sm:w-auto font-bold text-lg px-10 py-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all rounded-xl border-0 disabled:opacity-50 disabled:scale-100">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Calculator className="mr-2 h-5 w-5" />
                    {(!statement || !statement.periods) ? "Calculate Arrears" : (currentPeriodIndex < statement.periods.length ? "Recalculate Arrears" : "Calculate & Append")}
                  </>
                )}
              </Button>
              {statement && statement.periods && currentPeriodIndex === statement.periods.length && (
                <Button type="button" onClick={() => loadPeriodIntoForm(statement.periods!.length - 1)} size="lg" variant="outline" className="font-bold text-lg px-8 py-6 text-slate-600 border-slate-300 hover:bg-slate-100 rounded-xl">
                  Cancel Append
                </Button>
              )}
            </div>
          </form>
        </Form>

        {statement && (
          <div id="statement-section" className="mt-12">
            <div className="printable-area page">
              <Card id="printable-statement-card" className="border-border/80 shadow-md print:p-0 print:border-none print:shadow-none overflow-hidden">
                <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-muted/20 border-b print:bg-transparent print:p-0 print:pb-4 print:text-center print:items-center print:w-full">
                  <div className="w-full text-left print:text-center print:mx-auto">
                    <CardTitle className="font-headline text-3xl print:text-center print:text-2xl print:font-bold text-primary print:text-black">Arrear Statement</CardTitle>
                    <CardDescription className="print:text-center print:text-black print:text-sm mt-1">
                      <span className="text-lg md:text-xl font-bold text-foreground print:text-black print:!text-[13pt] tracking-tight inline-block mb-0.5">
                        {statement.employeeInfo.employeeName} ({statement.employeeInfo.employeeId})
                      </span>
                      <br />
                      {statement.employeeInfo.designation}, {statement.employeeInfo.department} <br />
                      {statement.periods && statement.periods.length > 0 ? (
                        statement.periods.map((p, idx) => (
                          <div key={p.id} className="mt-1.5 leading-snug">
                            {statement.periods!.length > 1 && <span className="inline-block bg-primary/10 text-primary print:bg-transparent print:border print:border-black print:text-black font-semibold text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded mr-2 mb-1">Period {idx + 1}</span>}
                            {(p.formData.paid?.basicPay != null || p.formData.toBePaid?.basicPay != null) && (
                              <span className="inline-block">
                                {p.formData.paid?.basicPay != null && (
                                  <span>
                                    <strong>Pre-revised Pay:</strong> {p.formData.paid.payLevel ? `${getPayLevelDisplay(p.formData.paid.cpc, p.formData.paid.payLevel)} ` : ''}(Basic: Rs. {p.formData.paid.basicPay.toLocaleString('en-IN')})
                                  </span>
                                )}
                                {p.formData.paid?.basicPay != null && p.formData.toBePaid?.basicPay != null && (
                                  <span className="mx-2 font-normal text-muted-foreground print:text-black">|</span>
                                )}
                                {p.formData.toBePaid?.basicPay != null && (
                                  <span>
                                    <strong>Revised Pay:</strong> {p.formData.toBePaid.payLevel ? `${getPayLevelDisplay(p.formData.toBePaid.cpc, p.formData.toBePaid.payLevel)} ` : ''}(Basic: Rs. {p.formData.toBePaid.basicPay.toLocaleString('en-IN')})
                                  </span>
                                )}
                              </span>
                            )}
                            <div className="text-muted-foreground print:text-black text-xs sm:text-sm mt-0.5">
                              {p.formData.payFixationRef && (
                                <span className="mr-3"><strong>Ref:</strong> {p.formData.payFixationRef}</span>
                              )}
                              {p.formData.fromDate && p.formData.toDate && (
                                <span><strong>Period:</strong> {format(new Date(p.formData.fromDate), "dd/MM/yyyy")} to {format(new Date(p.formData.toDate), "dd/MM/yyyy")}</span>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <>
                          {(statement.employeeInfo.paid?.basicPay != null || statement.employeeInfo.toBePaid?.basicPay != null) && (
                            <>
                              <span>
                                {statement.employeeInfo.paid?.basicPay != null && (
                                  <span>
                                    <strong>Pre-revised Pay:</strong> {statement.employeeInfo.paid.payLevel ? `${getPayLevelDisplay(statement.employeeInfo.paid.cpc, statement.employeeInfo.paid.payLevel)} ` : ''}(Basic: Rs. {statement.employeeInfo.paid.basicPay.toLocaleString('en-IN')})
                                  </span>
                                )}
                                {statement.employeeInfo.paid?.basicPay != null && statement.employeeInfo.toBePaid?.basicPay != null && (
                                  <span className="mx-2 font-normal">|</span>
                                )}
                                {statement.employeeInfo.toBePaid?.basicPay != null && (
                                  <span>
                                    <strong>Revised Pay:</strong> {statement.employeeInfo.toBePaid.payLevel ? `${getPayLevelDisplay(statement.employeeInfo.toBePaid.cpc, statement.employeeInfo.toBePaid.payLevel)} ` : ''}(Basic: Rs. {statement.employeeInfo.toBePaid.basicPay.toLocaleString('en-IN')})
                                  </span>
                                )}
                              </span>
                              <br />
                            </>
                          )}
                          {statement.employeeInfo.payFixationRef && (
                            <>Ref: {statement.employeeInfo.payFixationRef} <br /></>
                          )}
                          {statement.employeeInfo.fromDate && statement.employeeInfo.toDate &&
                            `Period: ${format(new Date(statement.employeeInfo.fromDate), "dd/MM/yyyy")} to ${format(new Date(statement.employeeInfo.toDate), "dd/MM/yyyy")}`
                          }
                        </>
                      )}
                    </CardDescription>
                  </div>
                    <div className="flex flex-wrap gap-2 no-print">
                    <Button onClick={handlePrepareNextPeriod} disabled={isLoading} variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 shadow-sm font-medium dark:border-purple-900/40 dark:text-purple-400 dark:hover:bg-purple-950/40">
                      <Plus className="mr-2 h-4 w-4" /> Add Next Period
                    </Button>
                    <Button onClick={handleSaveOrUpdate} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-medium">
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (loadedStatementId ? <Edit className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />)}
                      {loadedStatementId ? "Update Arrear" : "Save Arrear"}
                    </Button>
                    {loadedStatementId && (
                      <Button onClick={handleCopy} variant="outline" disabled={isLoading || authStatus !== 'authenticated'} className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:border-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-950/40">
                        <Copy className="mr-2 h-4 w-4" /> Copy Arrear
                      </Button>
                    )}
                    <Button onClick={handlePrint} variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 shadow-sm font-medium">
                      <Download className="mr-2 h-4 w-4" /> Print / Download PDF
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="print:p-0 pt-4">
                  <div className="overflow-x-auto">
                    <Table className="min-w-full">
                      <colgroup>
                        <col style={{ width: colWidths.month }} />
                        {/* Drawn group */}
                        <col style={{ width: colWidths.basic }} />
                        <col style={{ width: colWidths.da }} />
                        {activeCols.hra && <col style={{ width: colWidths.hra }} />}
                        {activeCols.npa && <col style={{ width: colWidths.npa }} />}
                        {activeCols.ta && <col style={{ width: colWidths.ta }} />}
                        {activeCols.other && <col style={{ width: colWidths.other }} />}
                        <col style={{ width: colWidths.total }} />
                        {/* Due group */}
                        <col style={{ width: colWidths.basic }} />
                        <col style={{ width: colWidths.da }} />
                        {activeCols.hra && <col style={{ width: colWidths.hra }} />}
                        {activeCols.npa && <col style={{ width: colWidths.npa }} />}
                        {activeCols.ta && <col style={{ width: colWidths.ta }} />}
                        {activeCols.other && <col style={{ width: colWidths.other }} />}
                        <col style={{ width: colWidths.total }} />
                        {/* Difference */}
                        <col style={{ width: colWidths.diff }} />
                      </colgroup>
                      <TableHeader>
                        <TableRow>
                          <TableHead rowSpan={2} className="text-center align-middle border-r month-col bg-muted/50 print:bg-transparent">Month</TableHead>
                          <TableHead colSpan={subColsCount} className="text-center border-r bg-blue-50/70 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 font-semibold print:bg-transparent print:text-black">Amount Drawn</TableHead>
                          <TableHead colSpan={subColsCount} className="text-center border-r bg-indigo-50/70 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 font-semibold print:bg-transparent print:text-black">Amount Due</TableHead>
                          <TableHead rowSpan={2} className="text-center align-middle diff-col bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-bold print:bg-transparent print:text-black">Difference</TableHead>
                        </TableRow>
                        <TableRow>
                          {/* Drawn Subheaders */}
                          <TableHead className="text-right bg-blue-50/40 dark:bg-blue-950/20 text-xs font-semibold print:bg-transparent">Basic</TableHead>
                          <TableHead className="text-right bg-blue-50/40 dark:bg-blue-950/20 text-xs font-semibold print:bg-transparent">DA</TableHead>
                          {activeCols.hra && <TableHead className="text-right bg-blue-50/40 dark:bg-blue-950/20 text-xs font-semibold print:bg-transparent">HRA</TableHead>}
                          {activeCols.npa && <TableHead className="text-right bg-blue-50/40 dark:bg-blue-950/20 text-xs font-semibold print:bg-transparent">NPA</TableHead>}
                          {activeCols.ta && <TableHead className="text-right bg-blue-50/40 dark:bg-blue-950/20 text-xs font-semibold print:bg-transparent">TA</TableHead>}
                          {activeCols.other && <TableHead className="text-right bg-blue-50/40 dark:bg-blue-950/20 text-xs font-semibold print:bg-transparent">Other</TableHead>}
                          <TableHead className="text-right font-bold border-r total-col bg-blue-100/50 dark:bg-blue-900/30 text-blue-950 dark:text-blue-100 print:bg-transparent print:text-black">Total</TableHead>

                          {/* Due Subheaders */}
                          <TableHead className="text-right bg-indigo-50/40 dark:bg-indigo-950/20 text-xs font-semibold print:bg-transparent">Basic</TableHead>
                          <TableHead className="text-right bg-indigo-50/40 dark:bg-indigo-950/20 text-xs font-semibold print:bg-transparent">DA</TableHead>
                          {activeCols.hra && <TableHead className="text-right bg-indigo-50/40 dark:bg-indigo-950/20 text-xs font-semibold print:bg-transparent">HRA</TableHead>}
                          {activeCols.npa && <TableHead className="text-right bg-indigo-50/40 dark:bg-indigo-950/20 text-xs font-semibold print:bg-transparent">NPA</TableHead>}
                          {activeCols.ta && <TableHead className="text-right bg-indigo-50/40 dark:bg-indigo-950/20 text-xs font-semibold print:bg-transparent">TA</TableHead>}
                          {activeCols.other && <TableHead className="text-right bg-indigo-50/40 dark:bg-indigo-950/20 text-xs font-semibold print:bg-transparent">Other</TableHead>}
                          <TableHead className="text-right font-bold border-r total-col bg-indigo-100/50 dark:bg-indigo-900/30 text-indigo-950 dark:text-indigo-100 print:bg-transparent print:text-black">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statement.rows.map((row, idx) => (
                          <TableRow key={`${row.month}-${idx}`} className="hover:bg-muted/40 transition-colors">
                            <TableCell className="font-medium border-r month-col">{row.month.replace(/(\s\d{2})\d{2}$/, '$1')}</TableCell>
                            
                            {/* Drawn Cells */}
                            <TableCell className="p-0 text-right"><input type="number" value={row.drawn.basic} onChange={(e) => handleRowEdit(statement.rows.indexOf(row), 'drawn', 'basic', parseInt(e.target.value) || 0)} className="w-full text-right bg-transparent outline-none focus:bg-white dark:focus:bg-slate-900 h-full py-2 px-4 print:px-0 print:py-0 print:bg-transparent hide-arrows tabular-nums" style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }} /></TableCell>
                            <TableCell className="p-0 text-right"><input type="number" value={row.drawn.da} onChange={(e) => handleRowEdit(statement.rows.indexOf(row), 'drawn', 'da', parseInt(e.target.value) || 0)} className="w-full text-right bg-transparent outline-none focus:bg-white dark:focus:bg-slate-900 h-full py-2 px-4 print:px-0 print:py-0 print:bg-transparent hide-arrows tabular-nums" style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }} /></TableCell>
                            {activeCols.hra && <TableCell className="p-0 text-right"><input type="number" value={row.drawn.hra} onChange={(e) => handleRowEdit(statement.rows.indexOf(row), 'drawn', 'hra', parseInt(e.target.value) || 0)} className="w-full text-right bg-transparent outline-none focus:bg-white dark:focus:bg-slate-900 h-full py-2 px-4 print:px-0 print:py-0 print:bg-transparent hide-arrows tabular-nums" style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }} /></TableCell>}
                            {activeCols.npa && <TableCell className="p-0 text-right"><input type="number" value={row.drawn.npa} onChange={(e) => handleRowEdit(statement.rows.indexOf(row), 'drawn', 'npa', parseInt(e.target.value) || 0)} className="w-full text-right bg-transparent outline-none focus:bg-white dark:focus:bg-slate-900 h-full py-2 px-4 print:px-0 print:py-0 print:bg-transparent hide-arrows tabular-nums" style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }} /></TableCell>}
                            {activeCols.ta && <TableCell className="p-0 text-right"><input type="number" value={row.drawn.ta} onChange={(e) => handleRowEdit(statement.rows.indexOf(row), 'drawn', 'ta', parseInt(e.target.value) || 0)} className="w-full text-right bg-transparent outline-none focus:bg-white dark:focus:bg-slate-900 h-full py-2 px-4 print:px-0 print:py-0 print:bg-transparent hide-arrows tabular-nums" style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }} /></TableCell>}
                            {activeCols.other && <TableCell className="p-0 text-right"><input type="number" value={row.drawn.other} onChange={(e) => handleRowEdit(statement.rows.indexOf(row), 'drawn', 'other', parseInt(e.target.value) || 0)} className="w-full text-right bg-transparent outline-none focus:bg-white dark:focus:bg-slate-900 h-full py-2 px-4 print:px-0 print:py-0 print:bg-transparent hide-arrows tabular-nums" style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }} /></TableCell>}
                            <TableCell className="text-right font-semibold border-r total-col bg-blue-50/30 dark:bg-blue-950/10 print:bg-transparent">{row.drawn.total}</TableCell>

                            {/* Due Cells */}
                            <TableCell className="p-0 text-right"><input type="number" value={row.due.basic} onChange={(e) => handleRowEdit(statement.rows.indexOf(row), 'due', 'basic', parseInt(e.target.value) || 0)} className="w-full text-right bg-transparent outline-none focus:bg-white dark:focus:bg-slate-900 h-full py-2 px-4 print:px-0 print:py-0 print:bg-transparent hide-arrows tabular-nums" style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }} /></TableCell>
                            <TableCell className="p-0 text-right"><input type="number" value={row.due.da} onChange={(e) => handleRowEdit(statement.rows.indexOf(row), 'due', 'da', parseInt(e.target.value) || 0)} className="w-full text-right bg-transparent outline-none focus:bg-white dark:focus:bg-slate-900 h-full py-2 px-4 print:px-0 print:py-0 print:bg-transparent hide-arrows tabular-nums" style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }} /></TableCell>
                            {activeCols.hra && <TableCell className="p-0 text-right"><input type="number" value={row.due.hra} onChange={(e) => handleRowEdit(statement.rows.indexOf(row), 'due', 'hra', parseInt(e.target.value) || 0)} className="w-full text-right bg-transparent outline-none focus:bg-white dark:focus:bg-slate-900 h-full py-2 px-4 print:px-0 print:py-0 print:bg-transparent hide-arrows tabular-nums" style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }} /></TableCell>}
                            {activeCols.npa && <TableCell className="p-0 text-right"><input type="number" value={row.due.npa} onChange={(e) => handleRowEdit(statement.rows.indexOf(row), 'due', 'npa', parseInt(e.target.value) || 0)} className="w-full text-right bg-transparent outline-none focus:bg-white dark:focus:bg-slate-900 h-full py-2 px-4 print:px-0 print:py-0 print:bg-transparent hide-arrows tabular-nums" style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }} /></TableCell>}
                            {activeCols.ta && <TableCell className="p-0 text-right"><input type="number" value={row.due.ta} onChange={(e) => handleRowEdit(statement.rows.indexOf(row), 'due', 'ta', parseInt(e.target.value) || 0)} className="w-full text-right bg-transparent outline-none focus:bg-white dark:focus:bg-slate-900 h-full py-2 px-4 print:px-0 print:py-0 print:bg-transparent hide-arrows tabular-nums" style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }} /></TableCell>}
                            {activeCols.other && <TableCell className="p-0 text-right"><input type="number" value={row.due.other} onChange={(e) => handleRowEdit(statement.rows.indexOf(row), 'due', 'other', parseInt(e.target.value) || 0)} className="w-full text-right bg-transparent outline-none focus:bg-white dark:focus:bg-slate-900 h-full py-2 px-4 print:px-0 print:py-0 print:bg-transparent hide-arrows tabular-nums" style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }} /></TableCell>}
                            <TableCell className="text-right font-semibold border-r total-col bg-indigo-50/30 dark:bg-indigo-950/10 print:bg-transparent">{row.due.total}</TableCell>

                            <TableCell className="text-right font-bold diff-col text-emerald-700 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10 print:text-black print:bg-transparent">{row.difference}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <UiTableFooter>
                        <TableRow className="bg-slate-100/90 dark:bg-slate-800/90 font-bold border-t-2 border-slate-300 dark:border-slate-600 print:bg-transparent">
                          <TableCell className="border-r month-col font-bold">Total</TableCell>
                          <TableCell colSpan={subColsCount - 1}></TableCell>
                          <TableCell className="text-right border-r total-col font-bold text-blue-900 dark:text-blue-200 print:text-black">{statement.totals.drawn.total}</TableCell>
                          <TableCell colSpan={subColsCount - 1}></TableCell>
                          <TableCell className="text-right border-r total-col font-bold text-indigo-900 dark:text-indigo-200 print:text-black">{statement.totals.due.total}</TableCell>
                          <TableCell className="text-right diff-col font-bold text-emerald-700 dark:text-emerald-300 print:text-black">{statement.totals.difference}</TableCell>
                        </TableRow>
                      </UiTableFooter>
                    </Table>
                  </div>
                  {statement.periods && statement.periods.some(p => p.formData.remark) ? (
                    <div className="mt-2 print:mt-1 mb-2 text-sm font-medium w-full text-left print:text-black break-words">
                      <span className="font-bold">Remark:</span> {statement.periods.filter(p => p.formData.remark).map(p => p.formData.remark).join(" & ")}
                    </div>
                  ) : statement.employeeInfo.remark ? (
                    <div className="mt-2 print:mt-1 mb-2 text-sm font-medium w-full text-left print:text-black break-words">
                      <span className="font-bold">Remark:</span> {statement.employeeInfo.remark}
                    </div>
                  ) : null}
                  <div className="pt-6 print:pt-3 text-sm signature-section">
                    {/* Financial Year Breakup */}
                    {statement.rows.length > 0 && (
                      <div className="mb-6 w-full print:w-full text-xs">
                        <div className="font-bold pb-2 mb-2 w-max pr-4">Financial Year Breakup (Difference)</div>
                        {(() => {
                          const breakdown: Record<string, number> = {};
                          statement.rows.forEach(row => {
                            const [month, yearStr] = row.month.split(' ');
                            const year = parseInt(yearStr, 10);
                            const isBeforeApril = ['Jan', 'Feb', 'Mar'].includes(month);
                            const fy = isBeforeApril 
                              ? `${year - 1}-${year.toString().slice(-2)}` 
                              : `${year}-${(year + 1).toString().slice(-2)}`;
                            breakdown[fy] = (breakdown[fy] || 0) + row.difference;
                          });
                          const entries = Object.entries(breakdown);
                          const chunkedRows = [];
                          for (let i = 0; i < entries.length; i += 3) {
                            chunkedRows.push(entries.slice(i, i + 3));
                          }
                          return (
                            <Table className="border border-black text-xs min-w-full">
                              <TableHeader>
                                <TableRow className="bg-muted/50 border-b border-black">
                                  <TableHead className="font-bold border-r border-black text-center py-1 h-8 text-black print:text-black">Financial Year</TableHead>
                                  <TableHead className="font-bold border-r border-black text-center py-1 h-8 text-black print:text-black">Difference</TableHead>
                                  <TableHead className="font-bold border-r border-black text-center py-1 h-8 text-black print:text-black">Financial Year</TableHead>
                                  <TableHead className="font-bold border-r border-black text-center py-1 h-8 text-black print:text-black">Difference</TableHead>
                                  <TableHead className="font-bold border-r border-black text-center py-1 h-8 text-black print:text-black">Financial Year</TableHead>
                                  <TableHead className="font-bold text-center py-1 h-8 text-black print:text-black">Difference</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {chunkedRows.map((row, idx) => (
                                  <TableRow key={idx} className="border-b border-black hover:bg-transparent">
                                    <TableCell className="border-r border-black text-center py-1 h-8">{row[0] ? `FY ${row[0][0]}` : ''}</TableCell>
                                    <TableCell className="border-r border-black text-right py-1 h-8 pr-4 font-semibold">{row[0] ? row[0][1] : ''}</TableCell>
                                    <TableCell className="border-r border-black text-center py-1 h-8">{row[1] ? `FY ${row[1][0]}` : ''}</TableCell>
                                    <TableCell className="border-r border-black text-right py-1 h-8 pr-4 font-semibold">{row[1] ? row[1][1] : ''}</TableCell>
                                    <TableCell className="border-r border-black text-center py-1 h-8">{row[2] ? `FY ${row[2][0]}` : ''}</TableCell>
                                    <TableCell className="text-right py-1 h-8 pr-4 font-semibold">{row[2] ? row[2][1] : ''}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          );
                        })()}
                      </div>
                    )}

                    {statement.totals.difference > 0 &&
                      <div className="mb-4 print:mb-2 font-medium">
                        Passed for pay of rupees {numberToWords(statement.totals.difference)}.
                      </div>
                    }
                    <div className="flex justify-between items-start mt-4">
                      <div className="pt-6 print:pt-4 flex flex-col">
                        <span>Date:</span>
                        <span>{format(new Date(), "dd/MM/yyyy")}</span>
                      </div>
                      <div className="flex flex-col w-full max-w-2xl mx-auto gap-12 print:gap-16">
                        <div className="grid grid-cols-3 gap-8 text-center">
                          <div className="pt-6 print:pt-4">Dealing Assistant</div>
                          <div className="pt-6 print:pt-4">Section Officer</div>
                          <div className="pt-6 print:pt-4">Assistant Finance Officer (Salary)</div>
                        </div>
                        {statement.totals.difference > 50000 && (
                          <div className="text-center">
                            Joint Finance Officer (Salary)
                          </div>
                        )}
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
    </>
  );
}
