
"use client";

import * as React from "react";
import Link from "next/link";
import {
  Trash2,
  PlusCircle,
  CalendarDays,
  ArrowLeft,
  Save,
} from "lucide-react";
import { format } from "date-fns";
import isEqual from "lodash.isequal";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRates, Rate } from "@/context/rates-context";
import { useToast } from "@/hooks/use-toast";
import { cpcData } from "@/lib/cpc-data";


const allPayLevels = [
    ...cpcData['6th'].payLevels.map(pl => ({ key: `6th-${pl.level}`, value: pl.level, label: `6th CPC: GP ${pl.gradePay} (${pl.payBand})`})),
    ...cpcData['7th'].payLevels.map(pl => ({ key: `7th-${pl.level}`, value: pl.level, label: `7th CPC: Level ${pl.level}`}))
];


const DateInput = ({ value, onChange }: { value: Date | undefined; onChange: (date?: Date) => void }) => {
    const [dateValue, setDateValue] = React.useState(value);

    React.useEffect(() => {
        setDateValue(value);
    }, [value]);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-full md:w-[240px] pl-3 text-left font-normal", !dateValue && "text-muted-foreground")}>
                    {dateValue ? format(new Date(dateValue), "PPP") : <span>Pick a date</span>}
                    <CalendarDays className="ml-auto h-4 w-4 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateValue ? new Date(dateValue) : undefined} onSelect={onChange} captionLayout="dropdown-buttons" fromYear={1990} toYear={2050} initialFocus={dateValue ? new Date(dateValue) : undefined} />
            </PopoverContent>
        </Popover>
    );
};

const RateTable = ({ title, description, withBasicRange, isAmount, withPayLevelRange, initialRates, setGlobalRates }: { title: string, description?: string, withBasicRange?: boolean, isAmount?: boolean, withPayLevelRange?: boolean, initialRates: Rate[], setGlobalRates: React.Dispatch<React.SetStateAction<Rate[]>> }) => {
    const { toast } = useToast();
    const [localRates, setLocalRates] = React.useState<Rate[]>(initialRates);

    React.useEffect(() => {
        setLocalRates(initialRates);
    }, [initialRates]);

    const isModified = !isEqual(initialRates, localRates);

    const handleSaveChanges = () => {
        const validRates = localRates.filter(r => r.rate !== '' && !isNaN(parseFloat(r.rate as any)))
            .map(r => ({
                ...r,
                rate: parseFloat(r.rate as any),
                basicFrom: r.basicFrom ? parseFloat(r.basicFrom as any) : '',
                basicTo: r.basicTo ? parseFloat(r.basicTo as any) : '',
                payLevelFrom: r.payLevelFrom ?? '',
                payLevelTo: r.payLevelTo ?? '',
            }));
        
        if (validRates.length < localRates.length) {
            toast({
                variant: 'destructive',
                title: "Invalid Rows",
                description: "Some rows were not saved because they had an empty or invalid rate. Please complete all rows before saving.",
            });
        }

        setGlobalRates(validRates);
        toast({
            title: "Rates Saved",
            description: `${title} have been updated successfully.`,
        });
    };
    
    const append = () => {
        const newRate: Rate = { id: crypto.randomUUID(), fromDate: new Date(), toDate: new Date(), rate: '', basicFrom: '', basicTo: '', payLevelFrom: '', payLevelTo: '' };
        setLocalRates(prev => [...prev, newRate]);
    }

    const remove = (id: string) => {
        setLocalRates(prev => prev.filter(r => r.id !== id));
    }

    const updateRate = (id: string, field: keyof Rate, value: any) => {
        setLocalRates(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    }

    const handleDateChange = (id: string, field: 'fromDate' | 'toDate', date?: Date) => {
        if (date) {
            updateRate(id, field, date);
        }
    };

    const handleInputChange = (id: string, field: keyof Rate, e: React.ChangeEvent<HTMLInputElement>) => {
        updateRate(id, field, e.target.value);
    };

    const handleBlur = (id: string, field: 'rate' | 'basicFrom' | 'basicTo') => {
        const rate = localRates.find(r => r.id === id);
        if (rate && typeof rate[field] === 'string') {
            const numericValue = parseFloat(rate[field] as string);
            const finalValue = isNaN(numericValue) ? '' : numericValue;
            updateRate(id, field, finalValue);
        }
    };

    const handleSelectChange = (id: string, field: 'payLevelFrom' | 'payLevelTo', value: string) => {
        updateRate(id, field, value);
    };

    const PayLevelSelect = ({ field, value, onChange }: { field: 'payLevelFrom' | 'payLevelTo', value: string | number | undefined, onChange: (value: string) => void }) => (
        <Select onValueChange={onChange} value={value as string ?? ''}>
            <SelectTrigger>
                <SelectValue placeholder="Select Level" />
            </SelectTrigger>
            <SelectContent>
                {allPayLevels.map(level => (
                    <SelectItem key={level.key} value={level.value}>{level.label}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    );

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                  <div>
                    <CardTitle>{title}</CardTitle>
                    {description && <CardDescription className="mt-1">{description}</CardDescription>}
                  </div>
                  <Button type="button" size="sm" onClick={append}>
                      <PlusCircle className="mr-2"/> Add Row
                  </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>From Date</TableHead>
                                <TableHead>To Date</TableHead>
                                {withBasicRange && <><TableHead>Basic From</TableHead><TableHead>Basic To</TableHead></>}
                                {withPayLevelRange && <><TableHead>From Pay Level</TableHead><TableHead>To Pay Level</TableHead></>}
                                <TableHead>{isAmount ? 'Amount' : 'Rate (%)'}</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {localRates.map((field) => (
                                <TableRow key={field.id}>
                                    <TableCell className="min-w-[160px]">
                                        <DateInput 
                                          value={field.fromDate} 
                                          onChange={(date) => handleDateChange(field.id, 'fromDate', date)}
                                        />
                                    </TableCell>
                                    <TableCell className="min-w-[160px]">
                                       <DateInput 
                                          value={field.toDate} 
                                          onChange={(date) => handleDateChange(field.id, 'toDate', date)}
                                        />
                                    </TableCell>
                                    {withBasicRange && <>
                                        <TableCell className="min-w-[120px]"><Input type="number" value={field.basicFrom ?? ''} onChange={e => handleInputChange(field.id, 'basicFrom', e)} onBlur={() => handleBlur(field.id, 'basicFrom')}/></TableCell>
                                        <TableCell className="min-w-[120px]"><Input type="number" value={field.basicTo ?? ''} onChange={e => handleInputChange(field.id, 'basicTo', e)} onBlur={() => handleBlur(field.id, 'basicTo')}/></TableCell>
                                    </>}
                                    {withPayLevelRange && <>
                                        <TableCell className="min-w-[200px]">
                                            <PayLevelSelect field="payLevelFrom" value={field.payLevelFrom} onChange={(value) => handleSelectChange(field.id, 'payLevelFrom', value)} />
                                        </TableCell>
                                        <TableCell className="min-w-[200px]">
                                            <PayLevelSelect field="payLevelTo" value={field.payLevelTo} onChange={(value) => handleSelectChange(field.id, 'payLevelTo', value)} />
                                        </TableCell>
                                    </>}
                                    <TableCell className="min-w-[120px]">
                                        <Input type="number" value={field.rate ?? ''} onChange={e => handleInputChange(field.id, 'rate', e)} onBlur={() => handleBlur(field.id, 'rate')}/>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button type="button" variant="destructive" size="icon" onClick={() => remove(field.id)}>
                                            <Trash2 />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {localRates.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={withBasicRange ? (withPayLevelRange ? 7 : 5) : (withPayLevelRange ? 6: 4)} className="text-center text-muted-foreground py-4">
                                        No rates defined. Click 'Add Row' to start.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            {isModified && (
                <CardFooter className="flex justify-end border-t pt-6">
                    <Button onClick={handleSaveChanges}>
                        <Save className="mr-2 h-4 w-4" /> Save Changes
                    </Button>
                </CardFooter>
            )}
        </Card>
    )
}

export default function RatesPage() {
    const { 
        daRates, setDaRates, 
        hraRates, setHraRates,
        npaRates, setNpaRates,
        taRates, setTaRates
    } = useRates();

    return (
        <main className="container mx-auto px-4 py-8 md:py-12">
            <header className="mb-8">
                <Button asChild variant="outline">
                    <Link href="/">
                        <ArrowLeft className="mr-2" /> Back to Calculator
                    </Link>
                </Button>
                <h1 className="font-headline text-4xl md:text-5xl font-bold text-primary text-center mt-4">
                    Allowances Rate Configuration
                </h1>
                <p className="text-muted-foreground mt-2 text-lg text-center">
                    Define the applicable rates for various allowances. These rates are saved in your browser for future use.
                </p>
            </header>
            
            <div className="space-y-8">
                <RateTable title="DA Rate Master" initialRates={daRates} setGlobalRates={setDaRates} />
                <RateTable title="HRA Rate Master" withBasicRange initialRates={hraRates} setGlobalRates={setHraRates} />
                <RateTable title="NPA Rate Master" initialRates={npaRates} setGlobalRates={setNpaRates} />
                <RateTable title="TA Master" description="Define fixed transport allowance amounts." withBasicRange withPayLevelRange isAmount initialRates={taRates} setGlobalRates={setTaRates} />
            </div>
        </main>
    );
}

    
