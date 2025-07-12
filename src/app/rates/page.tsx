"use client";

import * as React from "react";
import Link from "next/link";
import {
  Trash2,
  PlusCircle,
  CalendarDays,
  ArrowLeft,
} from "lucide-react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { useRates, Rate } from "@/context/rates-context";

export default function RatesPage() {
    const { 
        daRates, setDaRates, 
        hraRates, setHraRates,
        npaRates, setNpaRates,
        taRates, setTaRates
    } = useRates();

    const DateInput = ({ value, onChange }: { value: Date; onChange: (date?: Date) => void }) => (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-[240px] pl-3 text-left font-normal", !value && "text-muted-foreground")}>
                    {value ? format(value, "PPP") : <span>Pick a date</span>}
                    <CalendarDays className="ml-auto h-4 w-4 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={value} onSelect={onChange} captionLayout="dropdown-buttons" fromYear={1990} toYear={2050} initialFocus />
            </PopoverContent>
        </Popover>
    );

    const RateTable = ({ title, withBasicRange, rates, setRates }: { title: string, withBasicRange?: boolean, rates: Rate[], setRates: React.Dispatch<React.SetStateAction<Rate[]>> }) => {
        const [localRates, setLocalRates] = React.useState(rates);

        React.useEffect(() => {
            setLocalRates(rates);
        }, [rates]);

        const append = () => {
            const newRate = { id: crypto.randomUUID(), fromDate: new Date(), toDate: new Date(), rate: 0, basicFrom: 0, basicTo: 0 };
            setRates(prev => [...prev, newRate]);
        }
  
        const remove = (id: string) => {
            setRates(prev => prev.filter(r => r.id !== id));
        }
  
        const updateParentRate = (id: string, field: keyof Rate, value: any) => {
            setRates(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
        }

        const handleDateChange = (id: string, field: 'fromDate' | 'toDate', date?: Date) => {
            if (date) {
                updateParentRate(id, field, date);
            }
        };

        const handleLocalChange = (id: string, field: keyof Rate, value: string) => {
             setLocalRates(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
        };

        const handleBlur = (id: string, field: keyof Rate, e: React.FocusEvent<HTMLInputElement>) => {
            const value = e.target.value;
            const numericValue = parseFloat(value);
            updateParentRate(id, field, isNaN(numericValue) ? 0 : numericValue);
        };
  
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">{title}
                        <Button type="button" size="sm" onClick={append}>
                            <PlusCircle className="mr-2"/> Add Row
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>From Date</TableHead>
                                    <TableHead>To Date</TableHead>
                                    {withBasicRange && <><TableHead>Basic From</TableHead><TableHead>Basic To</TableHead></>}
                                    <TableHead>Rate (%)</TableHead>
                                    <TableHead>Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {localRates.map((field) => (
                                    <TableRow key={field.id}>
                                        <TableCell>
                                            <DateInput 
                                              value={field.fromDate} 
                                              onChange={(date) => handleDateChange(field.id, 'fromDate', date)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                           <DateInput 
                                              value={field.toDate} 
                                              onChange={(date) => handleDateChange(field.id, 'toDate', date)}
                                            />
                                        </TableCell>
                                        {withBasicRange && <>
                                            <TableCell><Input type="number" value={field.basicFrom ?? ''} onChange={e => handleLocalChange(field.id, 'basicFrom', e.target.value)} onBlur={e => handleBlur(field.id, 'basicFrom', e)} /></TableCell>
                                            <TableCell><Input type="number" value={field.basicTo ?? ''} onChange={e => handleLocalChange(field.id, 'basicTo', e.target.value)} onBlur={e => handleBlur(field.id, 'basicTo', e)} /></TableCell>
                                        </>}
                                        <TableCell>
                                            <Input type="number" value={field.rate ?? ''} onChange={e => handleLocalChange(field.id, 'rate', e.target.value)} onBlur={e => handleBlur(field.id, 'rate', e)}/>
                                        </TableCell>
                                        <TableCell>
                                            <Button type="button" variant="destructive" size="icon" onClick={() => remove(field.id)}>
                                                <Trash2 />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <main className="container mx-auto px-4 py-8 md:py-12">
            <header className="mb-8">
                <Button asChild variant="outline">
                    <Link href="/">
                        <ArrowLeft className="mr-2" /> Back to Calculator
                    </Link>
                </Button>
                <h1 className="font-headline text-4xl md:text-5xl font-bold text-primary text-center mt-4">
                    Allowance Rate Configuration
                </h1>
                <p className="text-muted-foreground mt-2 text-lg text-center">
                    Define the applicable rates for various allowances. These rates are saved for your current session.
                </p>
            </header>
            
            <div className="space-y-8">
                <RateTable title="DA Rate Master" rates={daRates} setRates={setDaRates} />
                <RateTable title="HRA Rate Master" withBasicRange rates={hraRates} setRates={setHraRates} />
                <RateTable title="NPA Rate Master" rates={npaRates} setRates={setNpaRates} />
                {/* For TA, 'rate' is treated as a fixed amount, not percentage. We should clarify UI for this */}
                <RateTable title="TA Rate Master" withBasicRange rates={taRates} setRates={setTaRates} />
            </div>
        </main>
    );
}
