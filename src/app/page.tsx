
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { format, addMonths, differenceInCalendarMonths, getDaysInMonth, startOfMonth, endOfMonth, isSameMonth } from "date-fns";
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
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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

const salaryComponentSchema = z.object({
  basicPay: z.coerce.number({ required_error: "Basic Pay is required." }).min(0, "Cannot be negative"),
  payLevel: z.string({ required_error: "Pay Level is required." }),
  daApplicable: z.boolean().default(false),
  hraApplicable: z.boolean().default(false),
  hraFromDate: z.date().optional(),
  hraToDate: z.date().optional(),
  npaApplicable: z.boolean().default(false),
  npaFromDate: z.date().optional(),
  npaToDate: z.date().optional(),
  taApplicable: z.boolean().default(false),
  taFromDate: z.date().optional(),
  taToDate: z.date().optional(),
  otherAllowanceName: z.string().optional(),
  otherAllowance: z.coerce.number().min(0).optional().default(0),
  otherAllowanceFromDate: z.date().optional(),
  otherAllowanceToDate: z.date().optional(),
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
    incrementMonth: z.string({ required_error: "Increment month is required." }),
    paid: salaryComponentSchema,
    toBePaid: salaryComponentSchema,
  }).refine(data => data.toDate >= data.fromDate, {
    message: "To Date cannot be before From Date.",
    path: ["toDate"],
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

type SavedStatement = {
  id: string;
  savedAt: string;
  rows: StatementRow[];
  totals: StatementTotals;
  employeeInfo: Partial<ArrearFormData>;
};

const INCREMENT_MONTHS = [
  { value: "1", label: "January" },
  { value: "7", label: "July" },
];

const LOCAL_STORAGE_KEY = "arrearEaseSavedStatements";

export default function Home() {
  const [statement, setStatement] = React.useState<Omit<SavedStatement, 'id' | 'savedAt'> | null>(null);
  const [savedStatements, setSavedStatements] = React.useState<SavedStatement[]>([]);
  const [isLoadDialogOpen, setLoadDialogOpen] = React.useState(false);
  const { toast } = useToast();
  const { daRates, hraRates, npaRates, taRates } = useRates();

  React.useEffect(() => {
    try {
        const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedData) {
            setSavedStatements(JSON.parse(savedData));
        }
    } catch (error) {
        console.error("Could not load saved statements:", error);
    }
  }, []);
  
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
      incrementMonth: undefined,
      paid: {
        basicPay: '' as any,
        payLevel: undefined,
        daApplicable: false,
        hraApplicable: false,
        npaApplicable: false,
        taApplicable: false,
        otherAllowance: '' as any,
        otherAllowanceName: "",
      },
      toBePaid: {
        basicPay: '' as any,
        payLevel: undefined,
        daApplicable: false,
        hraApplicable: false,
        npaApplicable: false,
        taApplicable: false,
        otherAllowance: '' as any,
        otherAllowanceName: "",
      },
    },
  });

  const cpc = form.watch("cpc");
  const paidWatch = form.watch("paid");
  const toBePaidWatch = form.watch("toBePaid");

  const payLevels = cpc ? cpcData[cpc].payLevels.map(pl => ({ value: pl.level, label: cpc === '6th' ? `GP ${pl.gradePay} (${pl.payBand})` : `Level ${pl.level}`})) : [];

  const getRateForDate = (rates: Rate[], date: Date, basicPay?: number) => {
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
      return isDateMatch && isBasicMatch;
    });
    return applicableRate ? applicableRate.rate : 0;
  }
  
  const handlePrint = () => {
    window.print();
  };
  
  const isDateInRange = (date: Date, fromDate?: Date, toDate?: Date) => {
    if (!fromDate && !toDate) return true; // No range specified, so it's always applicable
    const checkDate = startOfMonth(date);
    const start = fromDate ? startOfMonth(fromDate) : null;
    const end = toDate ? endOfMonth(toDate) : null;
    
    if (start && end) return checkDate >= start && checkDate <= end;
    if (start) return checkDate >= start;
    if (end) return checkDate <= end;
    return true;
  };

  const onSubmit = (data: ArrearFormData) => {
    try {
      const rows: StatementRow[] = [];
      const totals: StatementTotals = { drawn: { total: 0 }, due: { total: 0 }, difference: 0 };
      
      const startDate = data.fromDate;
      const endDate = data.toDate;
      const firstMonth = startOfMonth(startDate);
      const monthCount = differenceInCalendarMonths(endDate, startDate);

      let drawnBasicTracker = data.paid.basicPay;
      let dueBasicTracker = data.toBePaid.basicPay;

      for (let i = 0; i <= monthCount; i++) {
        const currentDate = addMonths(firstMonth, i);
        const currentMonth = currentDate.getMonth() + 1;
        
        const incrementMonthValue = parseInt(data.incrementMonth);
        if (i > 0 && incrementMonthValue === currentMonth) {
            if(cpc === '7th') {
                if (data.paid.payLevel) {
                    const levelData = cpcData['7th'].payLevels.find(l => l.level === data.paid.payLevel);
                    if (levelData) {
                        const currentBasicIndex = levelData.values.indexOf(drawnBasicTracker);
                        if (currentBasicIndex !== -1 && currentBasicIndex + 1 < levelData.values.length) {
                            drawnBasicTracker = levelData.values[currentBasicIndex + 1];
                        }
                    }
                }
                if (data.toBePaid.payLevel) {
                    const levelData = cpcData['7th'].payLevels.find(l => l.level === data.toBePaid.payLevel);
                    if (levelData) {
                        const currentBasicIndex = levelData.values.indexOf(dueBasicTracker);
                        if (currentBasicIndex !== -1 && currentBasicIndex + 1 < levelData.values.length) {
                            dueBasicTracker = levelData.values[currentBasicIndex + 1];
                        }
                    }
                }
            } else if (cpc === '6th') {
                 drawnBasicTracker = Math.round(drawnBasicTracker * 1.03);
                 dueBasicTracker = Math.round(dueBasicTracker * 1.03);
            }
        }

        const daysInMonth = getDaysInMonth(currentDate);
        let daysToCalculate = daysInMonth;

        if (isSameMonth(currentDate, startDate)) {
          daysToCalculate = daysInMonth - startDate.getDate() + 1;
        }
        if (isSameMonth(currentDate, endDate)) {
            daysToCalculate = isSameMonth(startDate, endDate) ? endDate.getDate() - startDate.getDate() + 1 : endDate.getDate();
        }

        const proRataFactor = daysToCalculate / daysInMonth;

        const proratedDrawnBasic = drawnBasicTracker * proRataFactor;
        const proratedDueBasic = dueBasicTracker * proRataFactor;
        
        const drawnHraApplicable = data.paid.hraApplicable && isDateInRange(currentDate, data.paid.hraFromDate, data.paid.hraToDate);
        const drawnNpaApplicable = data.paid.npaApplicable && isDateInRange(currentDate, data.paid.npaFromDate, data.paid.npaToDate);
        const drawnTaApplicable = data.paid.taApplicable && isDateInRange(currentDate, data.paid.taFromDate, data.paid.taToDate);
        const drawnOtherApplicable = (data.paid.otherAllowance || 0) > 0 && isDateInRange(currentDate, data.paid.otherAllowanceFromDate, data.paid.otherAllowanceToDate);

        const dueHraApplicable = data.toBePaid.hraApplicable && isDateInRange(currentDate, data.toBePaid.hraFromDate, data.toBePaid.hraToDate);
        const dueNpaApplicable = data.toBePaid.npaApplicable && isDateInRange(currentDate, data.toBePaid.npaFromDate, data.toBePaid.npaToDate);
        const dueTaApplicable = data.toBePaid.taApplicable && isDateInRange(currentDate, data.toBePaid.taFromDate, data.toBePaid.taToDate);
        const dueOtherApplicable = (data.toBePaid.otherAllowance || 0) > 0 && isDateInRange(currentDate, data.toBePaid.otherAllowanceFromDate, data.toBePaid.otherAllowanceToDate);

        const drawnHraRate = drawnHraApplicable ? getRateForDate(hraRates, currentDate, drawnBasicTracker) : 0;
        const drawnNpaRate = drawnNpaApplicable ? getRateForDate(npaRates, currentDate) : 0;
        const drawnTaAmount = drawnTaApplicable ? getRateForDate(taRates, currentDate, drawnBasicTracker) * proRataFactor : 0;
        const drawnOtherAmount = drawnOtherApplicable ? (data.paid.otherAllowance || 0) * proRataFactor : 0;

        const dueHraRate = dueHraApplicable ? getRateForDate(hraRates, currentDate, dueBasicTracker) : 0;
        const dueNpaRate = dueNpaApplicable ? getRateForDate(npaRates, currentDate) : 0;
        const dueTaAmount = dueTaApplicable ? getRateForDate(taRates, currentDate, dueBasicTracker) * proRataFactor : 0;
        const dueOtherAmount = dueOtherApplicable ? (data.toBePaid.otherAllowance || 0) * proRataFactor : 0;

        const drawnNPA = proratedDrawnBasic * (drawnNpaRate / 100);
        const dueNPA = proratedDueBasic * (dueNpaRate / 100);

        const drawnDaRate = data.paid.daApplicable ? getRateForDate(daRates, currentDate) : 0;
        const drawnDaBase = data.paid.npaApplicable && drawnNpaApplicable ? proratedDrawnBasic + drawnNPA : proratedDrawnBasic;
        const drawnDA = drawnDaBase * (drawnDaRate / 100);

        const dueDaRate = data.toBePaid.daApplicable ? getRateForDate(daRates, currentDate) : 0;
        const dueDaBase = data.toBePaid.npaApplicable && dueNpaApplicable ? proratedDueBasic + dueNPA : proratedDueBasic;
        const dueDA = dueDaBase * (dueDaRate / 100);

        const drawnHRA = proratedDrawnBasic * (drawnHraRate / 100);
        const dueHRA = proratedDueBasic * (dueHraRate / 100);

        const drawnTotal = proratedDrawnBasic + drawnDA + drawnHRA + drawnNPA + drawnTaAmount + drawnOtherAmount;
        const dueTotal = proratedDueBasic + dueDA + dueHRA + dueNPA + dueTaAmount + dueOtherAmount;
        
        const difference = dueTotal - drawnTotal;

        rows.push({
          month: format(currentDate, "MMM yyyy"),
          drawn: { 
            basic: Math.round(proratedDrawnBasic), 
            da: Math.round(drawnDA), 
            hra: Math.round(drawnHRA), 
            npa: Math.round(drawnNPA), 
            ta: Math.round(drawnTaAmount), 
            other: Math.round(drawnOtherAmount), 
            total: Math.round(drawnTotal) 
          },
          due: { 
            basic: Math.round(proratedDueBasic), 
            da: Math.round(dueDA), 
            hra: Math.round(dueHRA), 
            npa: Math.round(dueNPA), 
            ta: Math.round(dueTaAmount), 
            other: Math.round(dueOtherAmount), 
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
        employeeInfo: { 
          employeeName: data.employeeName, 
          designation: data.designation, 
          employeeId: data.employeeId, 
          department: data.department, 
          payFixationRef: data.payFixationRef,
          fromDate: data.fromDate,
          toDate: data.toDate,
        } 
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
  
  const saveStatement = () => {
    if (!statement) return;
    try {
      const newSavedStatement: SavedStatement = {
        ...statement,
        id: crypto.randomUUID(),
        savedAt: new Date().toISOString()
      };
      const updatedStatements = [...savedStatements, newSavedStatement];
      setSavedStatements(updatedStatements);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedStatements));
      toast({
        title: "Arrear Saved",
        description: "The current arrear statement has been saved.",
      });
    } catch(error) {
      console.error("Failed to save statement:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "Could not save the arrear statement.",
      });
    }
  };
  
  const loadStatement = (statementToLoad: SavedStatement) => {
     setStatement(statementToLoad);
     setLoadDialogOpen(false);
     setTimeout(() => {
        document.getElementById("statement-section")?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
  }

  const deleteStatement = (id: string) => {
    try {
        const updatedStatements = savedStatements.filter(s => s.id !== id);
        setSavedStatements(updatedStatements);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedStatements));
        toast({
            title: "Arrear Deleted",
            description: "The saved arrear statement has been removed.",
        });
    } catch (error) {
        console.error("Failed to delete statement:", error);
        toast({
            variant: "destructive",
            title: "Delete Failed",
            description: "Could not delete the arrear statement.",
        });
    }
  }

  const FormDateInput = ({ field, label }: { field: any, label?: string }) => (
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
              <Calendar mode="single" selected={field.value} onSelect={field.onChange} captionLayout="dropdown-buttons" fromYear={1990} toYear={2050} initialFocus />
          </PopoverContent>
      </Popover>
  );

  const AllowanceField = ({ type, name, label, watchValues }: { type: 'paid' | 'toBePaid', name: 'hra' | 'npa' | 'ta' | 'otherAllowance', label: string, watchValues: any }) => (
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
              <AllowanceField type={type} name="ta" label="TA (Transport Allowance)" watchValues={currentWatchValues}/>

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
              <FormControl><Input type="number" placeholder="e.g., 1500" {...field} /></FormControl>
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
          <h1 className="font-headline text-4xl md:text-5xl font-bold text-primary">ArrearEase</h1>
          <p className="text-muted-foreground mt-2 text-lg">A Simple Tool for Complex Salary Arrear Calculations</p>
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
                        {savedStatements.length > 0 ? (
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
                                            <TableCell className="font-medium">{s.employeeInfo.employeeName} <span className="text-muted-foreground">({s.employeeInfo.employeeId})</span></TableCell>
                                            <TableCell className="hidden sm:table-cell">{format(new Date(s.savedAt), "PPP p")}</TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" onClick={() => loadStatement(s)} className="mr-2">Load</Button>
                                                <Button size="sm" variant="destructive" onClick={() => deleteStatement(s.id)}><Trash2 className="h-4 w-4"/></Button>
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
                    <FormField control={form.control} name="employeeId" render={({ field }) => ( <FormItem> <FormLabel>Employee ID</FormLabel> <FormControl><Input placeholder="e.g., E12345" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                    <FormField control={form.control} name="employeeName" render={({ field }) => ( <FormItem> <FormLabel>Employee Name</FormLabel> <FormControl><Input placeholder="e.g., A. K. Sharma" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                    <FormField control={form.control} name="designation" render={({ field }) => ( <FormItem> <FormLabel>Designation</FormLabel> <FormControl><Input placeholder="e.g., Senior Officer" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                    <FormField control={form.control} name="department" render={({ field }) => ( <FormItem> <FormLabel>Department</FormLabel> <FormControl><Input placeholder="e.g., Accounts" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
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
                    <FormField control={form.control} name="incrementMonth" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Increment Month</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select a month" /></SelectTrigger></FormControl>
                          <SelectContent>{INCREMENT_MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
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
                   <Button onClick={saveStatement} variant="outline">
                      <Save className="mr-2 h-4 w-4" /> Save Arrear
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
