"use client";

import * as React from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, addMonths, differenceInCalendarMonths, parse } from "date-fns";
import {
  User,
  Building,
  Briefcase,
  CalendarDays,
  FileText,
  Percent,
  Download,
  Calculator,
  Info,
  Trash2,
  PlusCircle,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

const rateSchema = z.object({
  fromDate: z.date(),
  toDate: z.date(),
  rate: z.coerce.number().min(0),
  basicFrom: z.coerce.number().optional(),
  basicTo: z.coerce.number().optional(),
}).refine(data => !data.toDate || !data.fromDate || data.toDate >= data.fromDate, {
    message: "To Date cannot be before From Date.",
    path: ["toDate"],
});

const salaryComponentSchema = z.object({
  basicPay: z.coerce.number({ required_error: "Basic Pay is required." }).min(0, "Cannot be negative"),
  payLevel: z.string({ required_error: "Pay Level is required." }),
  daRate: z.coerce.number({ required_error: "DA Rate is required." }).min(0).max(200, "DA rate seems high"),
  hraRate: z.coerce.number({ required_error: "HRA Rate is required." }).min(0).max(100),
  npaRate: z.coerce.number({ required_error: "NPA Rate is required." }).min(0).max(100),
  taRate: z.coerce.number({ required_error: "TA Rate is required." }).min(0),
  otherAllowanceName: z.string().optional(),
  otherAllowance: z.coerce.number().min(0).optional().default(0),
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

    daRates: z.array(rateSchema),
    hraRates: z.array(rateSchema),
    npaRates: z.array(rateSchema),
    taRates: z.array(rateSchema),
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

const MONTHS = [
  { value: "1", label: "January" }, { value: "2", label: "February" }, { value: "3", label: "March" },
  { value: "4", label: "April" }, { value: "5", label: "May" }, { value: "6", label: "June" },
  { value: "7", label: "July" }, { value: "8", label: "August" }, { value: "9", label: "September" },
  { value: "10", label: "October" }, { value: "11", label: "November" }, { value: "12", label: "December" },
];

export default function Home() {
  const [statement, setStatement] = React.useState<{ rows: StatementRow[]; totals: StatementTotals; employeeInfo: Partial<ArrearFormData> } | null>(null);
  const { toast } = useToast();
  
  const form = useForm<ArrearFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: "",
      employeeName: "",
      designation: "",
      department: "",
      payFixationRef: "",
      paid: {
        basicPay: undefined,
        daRate: undefined,
        hraRate: undefined,
        npaRate: undefined,
        taRate: undefined,
        otherAllowance: 0,
        payLevel: undefined,
        otherAllowanceName: "",
      },
      toBePaid: {
        basicPay: undefined,
        daRate: undefined,
        hraRate: undefined,
        npaRate: undefined,
        taRate: undefined,
        otherAllowance: 0,
        payLevel: undefined,
        otherAllowanceName: "",
      },
      daRates: [],
      hraRates: [],
      npaRates: [],
      taRates: [],
    },
  });

  const cpc = form.watch("cpc");
  const payLevels = cpc ? cpcData[cpc].payLevels.map(pl => ({ value: pl.level, label: `Level ${pl.level}`})) : [];

  const getRateForDate = (rates: z.infer<typeof rateSchema>[], date: Date, basicPay?: number) => {
    const applicableRate = rates.find(r => {
      const from = r.fromDate;
      const to = r.toDate;
      let isDateMatch = date >= from && date <= to;
      let isBasicMatch = true;
      if (basicPay !== undefined) {
        if (r.basicFrom !== undefined && r.basicTo !== undefined) {
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
  
  const onSubmit = (data: ArrearFormData) => {
    try {
      const rows: StatementRow[] = [];
      const totals: StatementTotals = { drawn: { total: 0 }, due: { total: 0 }, difference: 0 };
      
      const startDate = data.fromDate;
      const endDate = data.toDate;
      const monthCount = differenceInCalendarMonths(endDate, startDate);

      for (let i = 0; i <= monthCount; i++) {
        const currentDate = addMonths(startDate, i);
        const currentMonth = currentDate.getMonth() + 1;
        
        let currentDrawnBasic = data.paid.basicPay;
        let currentDueBasic = data.toBePaid.basicPay;
        
        const incrementMonthValue = parseInt(data.incrementMonth);
        if (incrementMonthValue === currentMonth) {
            // This is a simplified increment logic. Real logic can be much more complex.
            // For 7th CPC, increment is 3% of basic pay, rounded to next 100.
            if(cpc === '7th' && data.paid.payLevel) {
              const levelData = cpcData['7th'].payLevels.find(l => l.level === data.paid.payLevel);
              if (levelData) {
                  const currentBasicIndex = levelData.values.indexOf(currentDrawnBasic);
                  if (currentBasicIndex !== -1 && currentBasicIndex + 1 < levelData.values.length) {
                      currentDrawnBasic = levelData.values[currentBasicIndex + 1];
                  }
              }
            }
            if(cpc === '7th' && data.toBePaid.payLevel) {
              const levelData = cpcData['7th'].payLevels.find(l => l.level === data.toBePaid.payLevel);
              if (levelData) {
                  const currentBasicIndex = levelData.values.indexOf(currentDueBasic);
                  if (currentBasicIndex !== -1 && currentBasicIndex + 1 < levelData.values.length) {
                      currentDueBasic = levelData.values[currentBasicIndex + 1];
                  }
              }
            }
        }

        const drawnDaRate = getRateForDate(data.daRates, currentDate);
        const drawnHraRate = getRateForDate(data.hraRates, currentDate, currentDrawnBasic);
        const drawnNpaRate = getRateForDate(data.npaRates, currentDate);
        const drawnTaRate = getRateForDate(data.taRates, currentDate, currentDrawnBasic);
        
        const dueDaRate = getRateForDate(data.daRates, currentDate);
        const dueHraRate = getRateForDate(data.hraRates, currentDate, currentDueBasic);
        const dueNpaRate = getRateForDate(data.npaRates, currentDate);
        const dueTaRate = getRateForDate(data.taRates, currentDate, currentDueBasic);

        const drawnDA = currentDrawnBasic * (drawnDaRate / 100);
        const drawnHRA = currentDrawnBasic * (drawnHraRate / 100);
        const drawnNPA = currentDrawnBasic * (drawnNpaRate / 100);
        const drawnTotal = currentDrawnBasic + drawnDA + drawnHRA + drawnNPA + drawnTaRate + (data.paid.otherAllowance || 0);

        const dueDA = currentDueBasic * (dueDaRate / 100);
        const dueHRA = currentDueBasic * (dueHraRate / 100);
        const dueNPA = currentDueBasic * (dueNpaRate / 100);
        const dueTotal = currentDueBasic + dueDA + dueHRA + dueNPA + dueTaRate + (data.toBePaid.otherAllowance || 0);
        
        const difference = dueTotal - drawnTotal;

        rows.push({
          month: format(currentDate, "MMM yyyy"),
          drawn: { basic: currentDrawnBasic, da: drawnDA, hra: drawnHRA, npa: drawnNPA, ta: drawnTaRate, other: data.paid.otherAllowance || 0, total: drawnTotal },
          due: { basic: currentDueBasic, da: dueDA, hra: dueHRA, npa: dueNPA, ta: dueTaRate, other: data.toBePaid.otherAllowance || 0, total: dueTotal },
          difference,
        });

        totals.drawn.total += drawnTotal;
        totals.due.total += dueTotal;
        totals.difference += difference;
      }

      setStatement({ rows, totals, employeeInfo: { employeeName: data.employeeName, designation: data.designation } });
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

  const renderSalaryFields = (type: "paid" | "toBePaid") => (
    <div className="space-y-4">
       <FormField control={form.control} name={`${type}.payLevel`} render={({ field }) => (
        <FormItem>
            <FormLabel>Pay Level</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!cpc}>
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
          <FormLabel>Basic Pay (₹)</FormLabel>
          <FormControl><Input type="number" placeholder="e.g., 50000" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={form.control} name={`${type}.daRate`} render={({ field }) => ( <FormItem> <FormLabel>DA Rate (%)</FormLabel> <FormControl><Input type="number" placeholder="e.g., 50" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
        <FormField control={form.control} name={`${type}.hraRate`} render={({ field }) => ( <FormItem> <FormLabel>HRA Rate (%)</FormLabel> <FormControl><Input type="number" placeholder="e.g., 18" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
        <FormField control={form.control} name={`${type}.npaRate`} render={({ field }) => ( <FormItem> <FormLabel>NPA Rate (%)</FormLabel> <FormControl><Input type="number" placeholder="e.g., 20" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
        <FormField control={form.control} name={`${type}.taRate`} render={({ field }) => ( <FormItem> <FormLabel>TA Rate (₹)</FormLabel> <FormControl><Input type="number" placeholder="e.g., 3600" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
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
          <FormLabel>Other Allowance Amount (₹)</FormLabel>
          <FormControl><Input type="number" placeholder="e.g., 1500" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </div>
  );

  const RateTable = ({ name, title, withBasicRange }: { name: "daRates" | "hraRates" | "npaRates" | "taRates", title: string, withBasicRange?: boolean }) => {
      const { fields, append, remove } = useFieldArray({
          control: form.control,
          name,
      });

      return (
          <Card>
              <CardHeader>
                  <CardTitle className="flex justify-between items-center">{title}
                      <Button type="button" size="sm" onClick={() => append({ fromDate: new Date(), toDate: new Date(), rate: 0, basicFrom: 0, basicTo: 0 })}>
                          <PlusCircle className="mr-2"/> Add Row
                      </Button>
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>From Date</TableHead>
                              <TableHead>To Date</TableHead>
                              {withBasicRange && <><TableHead>Basic From (₹)</TableHead><TableHead>Basic To (₹)</TableHead></>}
                              <TableHead>Rate (%)</TableHead>
                              <TableHead>Action</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {fields.map((field, index) => (
                              <TableRow key={field.id}>
                                  <TableCell>
                                      <FormField control={form.control} name={`${name}.${index}.fromDate`} render={({ field }) => (<DateInput field={field} />)} />
                                  </TableCell>
                                  <TableCell>
                                      <FormField control={form.control} name={`${name}.${index}.toDate`} render={({ field }) => (<DateInput field={field} />)} />
                                  </TableCell>
                                  {withBasicRange && <>
                                      <TableCell><FormField control={form.control} name={`${name}.${index}.basicFrom`} render={({ field }) => <Input type="number" {...field} />} /></TableCell>
                                      <TableCell><FormField control={form.control} name={`${name}.${index}.basicTo`} render={({ field }) => <Input type="number" {...field} />} /></TableCell>
                                  </>}
                                  <TableCell>
                                      <FormField control={form.control} name={`${name}.${index}.rate`} render={({ field }) => <Input type="number" {...field} />} />
                                  </TableCell>
                                  <TableCell>
                                      <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                                          <Trash2 />
                                      </Button>
                                  </TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
              </CardContent>
          </Card>
      )
  }

  const DateInput = ({ field }: { field: any }) => (
      <Popover>
          <PopoverTrigger asChild>
              <FormControl>
                  <Button variant={"outline"} className={cn("w-[240px] pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      <CalendarDays className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
              </FormControl>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
          </PopoverContent>
      </Popover>
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 md:py-12">
        <header className="text-center mb-12 no-print">
          <h1 className="font-headline text-4xl md:text-5xl font-bold text-primary">ArrearEase</h1>
          <p className="text-muted-foreground mt-2 text-lg">A Simple Tool for Complex Salary Arrear Calculations</p>
        </header>

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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                      <FormField control={form.control} name="fromDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>From Date</FormLabel><DateInput field={field}/><FormMessage /></FormItem> )} />
                       <FormField control={form.control} name="toDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>To Date</FormLabel><DateInput field={field}/><FormMessage /></FormItem> )} />
                    </div>
                    <FormField control={form.control} name="payFixationRef" render={({ field }) => (<FormItem><FormLabel>Pay Fixation Reference</FormLabel><FormControl><Input placeholder="Reference No." {...field} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="incrementMonth" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Increment Month</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select a month" /></SelectTrigger></FormControl>
                          <SelectContent>{MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
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

            <div className="space-y-8">
              <RateTable name="daRates" title="DA Rates" />
              <RateTable name="hraRates" title="HRA Rates" withBasicRange />
              <RateTable name="npaRates" title="NPA Rates" />
              <RateTable name="taRates" title="TA Rates" withBasicRange />
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
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-headline text-3xl">Arrear Statement</CardTitle>
                  <CardDescription>
                    For: {statement.employeeInfo.employeeName}, {statement.employeeInfo.designation}
                  </CardDescription>
                </div>
                <Button onClick={handlePrint} variant="outline" className="no-print">
                  <Download className="mr-2 h-4 w-4" /> Download PDF
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table className="min-w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead rowSpan={2} className="text-center align-middle border-r">Month</TableHead>
                        <TableHead colSpan={7} className="text-center border-r">Amount Drawn (₹)</TableHead>
                        <TableHead colSpan={7} className="text-center border-r">Amount Due (₹)</TableHead>
                        <TableHead rowSpan={2} className="text-center align-middle">Difference (₹)</TableHead>
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
                          <TableCell className="text-right">{row.drawn.basic.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{row.drawn.da.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{row.drawn.hra.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{row.drawn.npa.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{row.drawn.ta.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{row.drawn.other.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold border-r">{row.drawn.total.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{row.due.basic.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{row.due.da.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{row.due.hra.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{row.due.npa.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{row.due.ta.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{row.due.other.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold border-r">{row.due.total.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold">{row.difference.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <UiTableFooter>
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell className="border-r">Total</TableCell>
                        <TableCell colSpan={6}></TableCell>
                        <TableCell className="text-right border-r">{statement.totals.drawn.total.toFixed(2)}</TableCell>
                        <TableCell colSpan={6}></TableCell>
                        <TableCell className="text-right border-r">{statement.totals.due.total.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{Math.round(statement.totals.difference).toFixed(2)}</TableCell>
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
