// Arrear calculation engine (pure functions, no React) — shared by the calculator page
// and the automated tests. Logic moved verbatim from src/app/page.tsx.
import * as z from "zod";
import { format, addMonths, differenceInCalendarMonths, getDaysInMonth, startOfMonth, endOfMonth, startOfDay, endOfDay, max, min, isWithinInterval, differenceInDays } from "date-fns";
import { cpcData, calculate5thCpcIncrement } from "@/lib/cpc-data";
import type { Rate, SixthCpcConfig, FifthCpcConfig } from "@/context/rates-context";
import {
  resolveCitySettings,
  DEFAULT_6TH_HRA_BY_CLASS,
  DEFAULT_5TH_HRA_BY_CLASS,
  FIFTH_CPC_CCA_BY_CLASS,
  type TaCityType,
} from "@/lib/city-class";

// A cleared date picker stores null (so it does not fall back to a loaded value);
// treat null / "" as "no date".
const emptyToUndefined = (v: unknown) => (v === null || v === "" ? undefined : v);
const optionalDate = z.preprocess(emptyToUndefined, z.date().optional());

export const salaryComponentSchema = z.object({
  cpc: z.enum(["5th", "6th", "7th"], { required_error: "CPC selection is required." }),
  basicPay: z.coerce.number({ required_error: "Basic Pay is required." }).min(0, "Cannot be negative"),
  payLevel: z.string({ required_error: "Pay Level is required." }).min(1, "Pay Level is required."),
  incrementMonth: z.string({ required_error: "Increment month is required." }).min(1, "Increment month is required."),
  incrementDate: optionalDate,

  fixedBasicPayApplicable: z.boolean().default(false),
  fixedBasicPayValue: z.coerce.number().min(0).optional(),
  fixedBasicPayFromDate: optionalDate,
  fixedBasicPayToDate: optionalDate,

  daApplicable: z.boolean().default(true),
  daFixedRateApplicable: z.boolean().default(false),
  daFixedRate: z.coerce.number().min(0).optional(),
  daFixedRateFromDate: optionalDate,
  daFixedRateToDate: optionalDate,

  hraApplicable: z.boolean().default(true),
  hraFromDate: optionalDate,
  hraToDate: optionalDate,
  hraFixedRateApplicable: z.boolean().default(false),
  hraFixedRate: z.coerce.number().min(0).optional(),
  hraFixedRateFromDate: optionalDate,
  hraFixedRateToDate: optionalDate,

  npaApplicable: z.boolean().default(false),
  npaFromDate: optionalDate,
  npaToDate: optionalDate,

  taApplicable: z.boolean().default(false),
  doubleTaApplicable: z.boolean().default(false),
  taFromDate: optionalDate,
  taToDate: optionalDate,
  taFixedRateApplicable: z.boolean().default(false),
  taFixedRate: z.coerce.number().min(0).optional(),
  taFixedRateFromDate: optionalDate,
  taFixedRateToDate: optionalDate,

  otherAllowanceName: z.string().optional(),
  otherAllowance: z.coerce.number().min(0).optional().default(0),
  otherAllowanceFromDate: optionalDate,
  otherAllowanceToDate: optionalDate,
  otherAllowanceFixedRateApplicable: z.boolean().default(false),
  otherAllowanceFixedRate: z.coerce.number().min(0).optional(),
  otherAllowanceFixedRateFromDate: optionalDate,
  otherAllowanceFixedRateToDate: optionalDate,

  refixedBasicPay: z.coerce.number().min(0).optional(),
  refixedBasicPayDate: optionalDate,
});

export const formSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
  employeeName: z.string().min(1, "Employee name is required"),
  designation: z.string().min(1, "Designation is required"),
  department: z.string().min(1, "Department is required"),
  fromDate: z.preprocess(emptyToUndefined, z.date({ required_error: "From date is required." })),
  toDate: z.preprocess(emptyToUndefined, z.date({ required_error: "To date is required." })),
  payFixationRef: z.string().optional(),
  salaryRegisterNo: z.string().optional(),
  remark: z.string().optional(),
  // City classification for HRA / TA / CCA (missing in old statements => Aligarh: Y / other / B-2)
  hraCityClass: z.enum(["X", "Y", "Z"]).optional(),
  taCityType: z.enum(["higher", "other"]).optional(),
  fifthCpcCityClass: z.enum(["A-1", "A", "B-1", "B-2", "C", "UC"]).optional(),
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
}).refine(data => {
  if (data.paid.refixedBasicPay && data.paid.refixedBasicPay > 0 && !data.paid.refixedBasicPayDate) {
    return false;
  }
  return true;
}, {
  message: "Refixation date is required if refixed basic pay is provided.",
  path: ["paid", "refixedBasicPayDate"],
});

export type ArrearFormData = z.infer<typeof formSchema>;

export type StatementComponent = {
  basic: number;
  da: number;
  hra: number;
  npa: number;
  ta: number;
  other: number;
  total: number;
  dp?: number;
  basicDisplay?: string;
};

export type StatementRow = {
  month: string;
  drawn: StatementComponent;
  due: StatementComponent;
  difference: number;
};

export type StatementTotals = {
  drawn: { total: number };
  due: { total: number };
  difference: number;
};

// 6th CPC revised HRA & Transport Allowance were payable only w.e.f. 01.09.2008
// (MoF OM No. 2(13)/2008-E.II(B) dated 29.08.2008). Before that, allowances were
// drawn at pre-revised rates, so no HRA/TA arrear arises for 01.01.2006–31.08.2008.
export const SIXTH_CPC_ALLOWANCES_START = new Date(2008, 8, 1);

// 6th CPC Transport Allowance for "other places" (Aligarh is not an A-1/A city):
// GP 5400 & above: 1600 | GP 4200–4800: 800 | GP below 4200: 400,
// but 800 if pay in pay band >= 7440. DA is payable on TA.
// A-1/A class cities (higher rates): 3200 | 1600 | 600 (1600 if pay in pay band >= 7440).
export const getSixthCpcTaAmount = (payLevel: string | undefined, basicPay: number, taCityType: TaCityType = "other"): number => {
  const level = cpcData["6th"].payLevels.find((l) => l.level === payLevel);
  const gradePay = level?.gradePay;
  if (!gradePay) return 0; // e.g. VC fixed pay — use TA fixed-rate override if needed
  const higher = taCityType === "higher";
  if (gradePay >= 5400) return higher ? 3200 : 1600;
  if (gradePay >= 4200) return higher ? 1600 : 800;
  const payInPayBand = basicPay - gradePay;
  if (payInPayBand >= 7440) return higher ? 1600 : 800;
  return higher ? 600 : 400;
};

export const payLevelIndexMap = new Map<string, number>();
cpcData["5th"].payLevels.forEach((level, index) => payLevelIndexMap.set(level.level, index));
const offset5th = cpcData["5th"].payLevels.length;
cpcData["6th"].payLevels.forEach((level, index) => payLevelIndexMap.set(level.level, index + offset5th));
cpcData["7th"].payLevels.forEach((level, index) => payLevelIndexMap.set(level.level, index + offset5th + cpcData["6th"].payLevels.length));


export interface EngineRates {
  daRates: Rate[];
  hraRates: Rate[];
  npaRates: Rate[];
  taRates: Rate[];
  da6thRates: Rate[];
  sixthCpcConfig: SixthCpcConfig;
  da5thRates: Rate[];
  fifthCpcConfig: FifthCpcConfig;
}

export function createArrearEngine(rates: EngineRates) {
  const { daRates, hraRates, npaRates, taRates, da6thRates, sixthCpcConfig, da5thRates, fifthCpcConfig } = rates;

  const getRateForDate = (
    rates: Rate[],
    date: Date,
    options: { basicPay?: number, payLevel?: string, daRate?: number, cityClass?: string, defaultCityClass?: string } = {}
  ): Rate | null => {
    const { basicPay, payLevel, daRate, cityClass, defaultCityClass } = options;
    const calcDate = startOfDay(date);
    // City class filter (HRA: X/Y/Z, TA: higher/other). Rows without a class belong to the default class.
    const matchesCity = (r: Rate) => cityClass === undefined || (r.cityClass || defaultCityClass) === cityClass;

    // First attempt: exact match within fromDate and toDate interval
    let applicableRates = rates.filter(r => {
      if (!matchesCity(r)) return false;
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
        if (!matchesCity(r)) return false;
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

      if (sideData.incrementMonth || sideData.incrementDate) {
        const incrementMonthValue = sideData.incrementMonth
          ? parseInt(sideData.incrementMonth, 10)
          : (sideData.incrementDate ? sideData.incrementDate.getMonth() + 1 : 0);
        let incrementTriggerDate: Date | null = null;

        if (!sideData.incrementDate && currentMonth === incrementMonthValue && currentDate >= new Date(currentYear, incrementMonthValue - 1, 1)) {
          incrementTriggerDate = new Date(currentYear, incrementMonthValue - 1, 1);
        }
        else if (sideData.incrementDate) {
          const incMonth = sideData.incrementDate.getMonth() + 1;
          const incDay = sideData.incrementDate.getDate();

          // Determine starting year for anniversary increment:
          // If the selected year is beyond arrearToDate (e.g. default calendar year),
          // treat as an annual recurring anniversary starting in arrearFromDate's year.
          const incStartYear = (sideData.incrementDate.getFullYear() > arrearToDate.getFullYear())
            ? arrearFromDate.getFullYear()
            : sideData.incrementDate.getFullYear();

          if (currentMonth === incMonth && currentYear >= incStartYear) {
            incrementTriggerDate = new Date(currentYear, incMonth - 1, incDay);
          }
        }

        // The Basic Pay entered is the pay ON the From Date, so an increment falling on
        // the From Date itself is already included — only later increments apply.
        if (incrementTriggerDate && isWithinInterval(incrementTriggerDate, { start: monthStart, end: monthEnd }) && startOfDay(incrementTriggerDate) > startOfDay(arrearFromDate)) {
          let newBasic: number | null = null;

          // Fixed pay (e.g. Vice Chancellor "15VC": 7th CPC 2,10,000 / 6th CPC 75,000,
          // or 5th CPC fixed scale) has no annual increment.
          const isFixedPayLevel =
            String(sideData.payLevel) === '15VC' ||
            (sideData.cpc === '5th' &&
              String(cpcData['5th'].payLevels.find(l => l.level === sideData.payLevel)?.scale || '').includes('Fixed'));

          if (isFixedPayLevel) {
            newBasic = trackerBasic;
          } else if (sideData.cpc === '7th' && trackerBasic >= 218200) {
            newBasic = trackerBasic; // Freeze at 218200 or above
          } else if (sideData.cpc === '7th' && sideData.payLevel) {
            // 7th CPC: increment = next cell in the same Level of the Pay Matrix.
            // At the maximum of the Level there is no further increment (no figure
            // outside the matrix and no cell borrowed from another Level).
            let levelData = cpcData['7th'].payLevels.find(l => l.level === sideData.payLevel);

            if (!levelData) {
              levelData = cpcData['7th'].payLevels.find(l => l.level.includes('/') && l.level.split('/').includes(sideData.payLevel));
            }

            if (levelData && levelData.values.length > 0) {
              const cells = levelData.values;
              const currentBasicIndex = cells.indexOf(trackerBasic);
              if (currentBasicIndex !== -1) {
                newBasic = currentBasicIndex + 1 < cells.length ? cells[currentBasicIndex + 1] : trackerBasic;
              } else if (trackerBasic >= cells[0]) {
                // Within this Level's range but not an exact cell: move to the next higher cell
                // of this Level (or stay, if already above the Level's maximum).
                const nextCell = cells.find(v => v > trackerBasic);
                newBasic = nextCell !== undefined ? nextCell : trackerBasic;
              } else {
                // Below this Level's minimum (e.g. pay re-fixed in a lower Level):
                // use the next stage of the Level that contains this cell.
                for (const l of cpcData['7th'].payLevels) {
                  const idx = l.values.indexOf(trackerBasic);
                  if (idx !== -1) {
                    newBasic = idx + 1 < l.values.length ? l.values[idx + 1] : trackerBasic;
                    break;
                  }
                }
                if (newBasic === null) newBasic = cells[0];
              }
            } else {
              newBasic = trackerBasic; // Unknown Level: never invent a non-matrix figure
            }
          } else if (sideData.cpc === '5th' && sideData.payLevel) {
            const levelData = cpcData['5th'].payLevels.find(l => l.level === sideData.payLevel);
            if (levelData && levelData.scale) {
              newBasic = calculate5thCpcIncrement(trackerBasic, levelData.scale);
            }
          }

          if (newBasic === null) {
            // 6th CPC (and fallback): Annual increment @ 3% of Basic Pay (Pay in Pay Band + Grade Pay).
            // Per Rule 9 & Rule 13 of CCS (RP) Rules, 2008 and Ministry of Finance OM No. 1/1/2008-IC dated 29.01.2009:
            // "paise should be ignored, but any amount of a rupee or more should be rounded off to next multiple of 10."
            const incrementAmount = Math.floor(trackerBasic * 0.03); // Discard/ignore paise
            const roundedIncrement = Math.ceil(incrementAmount / 10) * 10; // Round off to next multiple of 10
            newBasic = trackerBasic + roundedIncrement;
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

    if (data.paid.refixedBasicPay && data.paid.refixedBasicPay > 0 && data.paid.refixedBasicPayDate) {
      const refixDate = data.paid.refixedBasicPayDate;
      if (currentDate >= startOfMonth(refixDate)) {
        if (isWithinInterval(refixDate, { start: monthStart, end: monthEnd })) {
          const refixDay = refixDate.getDate();
          const basicBeforeRefix = drawnBasicForMonth;

          if (refixDay > 1) {
            const daysBefore = refixDay - 1;
            const daysAfter = daysInMonth - daysBefore;
            drawnBasicForMonth = ((basicBeforeRefix * daysBefore) + (data.paid.refixedBasicPay * daysAfter)) / daysInMonth;
          } else {
            drawnBasicForMonth = data.paid.refixedBasicPay;
          }
          newDrawnTracker = data.paid.refixedBasicPay;
        } else if (currentDate > refixDate) {
          drawnBasicForMonth = newDrawnTracker;
        }
      }
    }

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

      const is5thCpc = sideData.cpc === '5th';
      const is6thCpc = sideData.cpc === '6th';
      const city = resolveCitySettings(data);

      const getEffectiveDaRate = (): { rate: number; dpMerged: boolean } => {
        // Fixed rate override (applies to 5th, 6th and 7th CPC)
        if (sideData.daFixedRateApplicable && sideData.daFixedRate && sideData.daFixedRateFromDate && sideData.daFixedRateToDate) {
          if (isWithinInterval(currentDate, { start: sideData.daFixedRateFromDate, end: sideData.daFixedRateToDate })) {
            return { rate: sideData.daFixedRate, dpMerged: false };
          }
        }
        // 5th CPC: use da5thRates table (tracks DP merger w.e.f 01.04.2004)
        if (is5thCpc) {
          const daRateDetails = getRateForDate(da5thRates, currentDate);
          return {
            rate: daRateDetails ? daRateDetails.rate : 0,
            dpMerged: Boolean((daRateDetails as any)?.dpMerged),
          };
        }
        // 6th CPC: use da6thRates table
        if (is6thCpc) {
          const daRateDetails = getRateForDate(da6thRates, currentDate);
          return { rate: daRateDetails ? daRateDetails.rate : 0, dpMerged: false };
        }
        // 7th CPC: use daRates table
        const daRateDetails = getRateForDate(daRates, currentDate);
        return { rate: daRateDetails ? daRateDetails.rate : 0, dpMerged: false };
      };

      const { rate: effectiveDaRate, dpMerged: isDpMerged } = getEffectiveDaRate();

      // For 5th CPC w.e.f. 01.04.2004, 50% of Basic Pay is treated as Dearness Pay (DP)
      const fullMonthDp = (is5thCpc && isDpMerged) ? Math.round(fullMonthBasic * 0.50) : 0;
      const dpOnBasic = (is5thCpc && isDpMerged) ? (proratedBasic * 0.50) : 0;
      const dpAmount = Math.round(dpOnBasic);

      // Calculate NPA
      let npa = 0;
      let fullMonthNpaCalculated = 0;
      if (sideData.npaApplicable) {
        if (is5thCpc) {
          // 5th CPC: NPA rate is 25% (or configured rate)
          // w.e.f. 01.04.2004: NPA is calculated on (Basic Pay + DP)
          // Prior to 01.04.2004: NPA is calculated on Basic Pay
          const npaBase = isDpMerged ? (fullMonthBasic + fullMonthDp) : fullMonthBasic;
          fullMonthNpaCalculated = npaBase * (fifthCpcConfig.npa5thRate / 100);
          // Ceiling: Basic Pay + NPA shall not exceed ₹29,500 per month
          if (fullMonthBasic + fullMonthNpaCalculated > 29500) {
            fullMonthNpaCalculated = Math.max(0, 29500 - fullMonthBasic);
          }
        } else if (is6thCpc) {
          fullMonthNpaCalculated = fullMonthBasic * (sixthCpcConfig.npa6thRate / 100);
          // 6th CPC Ceiling: Basic Pay + NPA shall not exceed ₹85,000 per month
          if (fullMonthBasic + fullMonthNpaCalculated > 85000) {
            fullMonthNpaCalculated = Math.max(0, 85000 - fullMonthBasic);
          }
        } else {
          const npaRateDetails = getRateForDate(npaRates, currentDate);
          if (npaRateDetails) {
            fullMonthNpaCalculated = fullMonthBasic * (npaRateDetails.rate / 100);
          }
          // 7th CPC Ceiling: Basic Pay + NPA shall not exceed ₹2,37,500 per month (MoF OM dated 07.07.2017)
          if (fullMonthBasic + fullMonthNpaCalculated > 237500) {
            fullMonthNpaCalculated = Math.max(0, 237500 - fullMonthBasic);
          }
        }
        const prorationFactor = getProratedFactorForAllowance(sideData.npaFromDate, sideData.npaToDate);
        if (prorationFactor > 0) {
          npa = fullMonthNpaCalculated * prorationFactor;
        }
      }

      // Calculate DA & DP
      let da = 0;
      let reportedBasic = proratedBasic;
      let basicDisplay = `${Math.round(proratedBasic)}`;

      if (sideData.daApplicable) {
        if (is5thCpc && isDpMerged) {
          // 5th CPC DP Merger w.e.f. 01.04.2004 (MoF OM No. 105/1/2004-IC dated 01.03.2004):
          // Base for DA = Basic Pay + DP + NPA (since NPA is 25% of Basic+DP)
          // Applicable DA rate (11%, 14%, 17%, 21%) is calculated on (Basic Pay + DP + NPA)
          const baseForDaWithDp = proratedBasic + dpAmount + npa;
          const daAmount = baseForDaWithDp * (effectiveDaRate / 100);

          if (fifthCpcConfig.mergeDpInBasic) {
            // Option 1 (Standard Accounts Practice / User Request):
            // Merge 50% DP into Basic Pay column for display & summation
            reportedBasic = proratedBasic + dpAmount;
            const pureBasic = Math.round(proratedBasic);
            const dpPart = dpAmount;
            // Display as "10000+5000" with plus sign per user requirement
            basicDisplay = `${pureBasic}+${dpPart}`;

            // DA column reflects the DA% on (Basic + DP + NPA)
            da = daAmount;
          } else {
            // Option 2 (Unmerged display):
            // Keep pure basic in Basic column, and include DP in DA column
            reportedBasic = proratedBasic;
            basicDisplay = `${Math.round(proratedBasic)}`;
            da = dpAmount + daAmount;
          }
        } else {
          // 5th CPC pre-2004, 6th CPC, 7th CPC: DA base = Basic Pay + NPA
          const baseForDA = proratedBasic + npa;
          da = baseForDA * (effectiveDaRate / 100);
          basicDisplay = `${Math.round(proratedBasic)}`;
        }
      } else {
        if (is5thCpc && isDpMerged && fifthCpcConfig.mergeDpInBasic) {
          reportedBasic = proratedBasic + dpAmount;
          const pureBasic = Math.round(proratedBasic);
          const dpPart = dpAmount;
          basicDisplay = `${pureBasic}+${dpPart}`;
        } else {
          basicDisplay = `${Math.round(proratedBasic)}`;
        }
      }

      // Calculate HRA
      let hra = 0;
      if (sideData.hraApplicable) {
        const hraFixedActiveThisMonth = Boolean(
          sideData.hraFixedRateApplicable && sideData.hraFixedRate && sideData.hraFixedRateFromDate && sideData.hraFixedRateToDate &&
          isWithinInterval(currentDate, { start: sideData.hraFixedRateFromDate, end: sideData.hraFixedRateToDate })
        );
        // 6th CPC revised HRA only from 01.09.2008 (unless a fixed HRA rate is set for this month)
        const hraFromDate = (is6thCpc && !hraFixedActiveThisMonth)
          ? (sideData.hraFromDate ? max([sideData.hraFromDate, SIXTH_CPC_ALLOWANCES_START]) : SIXTH_CPC_ALLOWANCES_START)
          : sideData.hraFromDate;
        const prorationFactor = getProratedFactorForAllowance(hraFromDate, sideData.hraToDate);
        if (prorationFactor > 0) {
          if (is5thCpc) {
            // 5th CPC: HRA rate (default 15% w.e.f. 01.08.1997)
            // Prior to 01.04.2004: HRA base = Basic Pay (+ NPA if applicable)
            // w.e.f. 01.04.2004: HRA base = (Basic Pay + DP) (+ NPA if applicable)
            const hraBase = fullMonthBasic + (isDpMerged ? fullMonthDp : 0) + (sideData.npaApplicable ? fullMonthNpaCalculated : 0);
            // B-2 (Aligarh) uses the configured 5th CPC HRA rate; other classes use their own rate
            const hra5thRate = city.fifthCpcCityClass === 'B-2'
              ? fifthCpcConfig.hra5thRate
              : (fifthCpcConfig.hra5thRateByClass?.[city.fifthCpcCityClass] ?? DEFAULT_5TH_HRA_BY_CLASS[city.fifthCpcCityClass]);
            let fullMonthHra = hraBase * (hra5thRate / 100);
            if (sideData.hraFixedRateApplicable && sideData.hraFixedRate && sideData.hraFixedRateFromDate && sideData.hraFixedRateToDate) {
              if (isWithinInterval(currentDate, { start: sideData.hraFixedRateFromDate, end: sideData.hraFixedRateToDate })) {
                fullMonthHra = hraBase * (sideData.hraFixedRate / 100);
              }
            }
            hra = fullMonthHra * prorationFactor;
          } else if (is6thCpc) {
            // 6th CPC: HRA is on (Basic Pay + NPA)
            const hraBase = fullMonthBasic + (sideData.npaApplicable ? fullMonthNpaCalculated : 0);
            const hra6thRate = city.hraCityClass === 'X'
              ? (sixthCpcConfig.hra6thRateX ?? DEFAULT_6TH_HRA_BY_CLASS.X)
              : city.hraCityClass === 'Z'
                ? (sixthCpcConfig.hra6thRateZ ?? DEFAULT_6TH_HRA_BY_CLASS.Z)
                : sixthCpcConfig.hra6thRate;
            let fullMonthHra = hraBase * (hra6thRate / 100);
            if (sideData.hraFixedRateApplicable && sideData.hraFixedRate && sideData.hraFixedRateFromDate && sideData.hraFixedRateToDate) {
              if (isWithinInterval(currentDate, { start: sideData.hraFixedRateFromDate, end: sideData.hraFixedRateToDate })) {
                fullMonthHra = hraBase * (sideData.hraFixedRate / 100);
              }
            }
            hra = fullMonthHra * prorationFactor;
          } else {
            // 7th CPC: HRA is DA-slab based from hraRates table, or fixed rate override if active
            const hraBase = fullMonthBasic;
            let fullMonthHra = 0;
            if (sideData.hraFixedRateApplicable && sideData.hraFixedRate && sideData.hraFixedRateFromDate && sideData.hraFixedRateToDate && isWithinInterval(currentDate, { start: sideData.hraFixedRateFromDate, end: sideData.hraFixedRateToDate })) {
              fullMonthHra = hraBase * (sideData.hraFixedRate / 100);
            } else {
              const hraRateDetails = getRateForDate(hraRates, currentDate, { daRate: effectiveDaRate, cityClass: city.hraCityClass, defaultCityClass: 'Y' });
              if (hraRateDetails) {
                fullMonthHra = hraBase * (hraRateDetails.rate / 100);
                if (hraRateDetails.minAmount && hraRateDetails.minAmount > 0) {
                  fullMonthHra = Math.max(fullMonthHra, hraRateDetails.minAmount);
                }
              }
            }
            hra = fullMonthHra * prorationFactor;
          }
        }
      }

      // Calculate TA / TRA
      let ta = 0;
      if (sideData.taApplicable) {
        const taFixedActiveThisMonth = Boolean(
          sideData.taFixedRateApplicable && sideData.taFixedRate && sideData.taFixedRateFromDate && sideData.taFixedRateToDate &&
          isWithinInterval(currentDate, { start: sideData.taFixedRateFromDate, end: sideData.taFixedRateToDate })
        );
        // 6th CPC TA only from 01.09.2008 (unless a fixed TA amount is set for this month)
        const taFromDate = (is6thCpc && !taFixedActiveThisMonth)
          ? (sideData.taFromDate ? max([sideData.taFromDate, SIXTH_CPC_ALLOWANCES_START]) : SIXTH_CPC_ALLOWANCES_START)
          : sideData.taFromDate;
        const prorationFactor = getProratedFactorForAllowance(taFromDate, sideData.taToDate);
        if (prorationFactor > 0) {
          if (is5thCpc) {
            // 5th CPC Transport Allowance (T.R.A.):
            // Upto 5500-9000: Rs 75 | 6500-10500 to 7500-12000: Rs 200 | 8000-13500 & Above: Rs 400
            let traBaseAmount = 0;
            if (sideData.taFixedRateApplicable && sideData.taFixedRate && sideData.taFixedRateFromDate && sideData.taFixedRateToDate && isWithinInterval(currentDate, { start: sideData.taFixedRateFromDate, end: sideData.taFixedRateToDate })) {
              traBaseAmount = sideData.taFixedRate;
            } else {
              const levelNum = parseInt(String(payLevel).replace('S-', ''), 10);
              // A-1/A class cities: Rs 100 / 400 / 800 | other places: Rs 75 / 200 / 400
              const [traLow, traMid, traHigh] = city.taCityType === 'higher' ? [100, 400, 800] : [75, 200, 400];
              if (!isNaN(levelNum)) {
                if (levelNum <= 10) traBaseAmount = traLow;
                else if (levelNum <= 13) traBaseAmount = traMid;
                else traBaseAmount = traHigh;
              } else {
                const curBasic = side === 'paid' ? newDrawnTracker : newDueTracker;
                if (curBasic < 6500) traBaseAmount = traLow;
                else if (curBasic < 8000) traBaseAmount = traMid;
                else traBaseAmount = traHigh;
              }
            }
            if (sideData.doubleTaApplicable) {
              traBaseAmount *= 2;
            }
            // In 5th CPC, TRA was flat fixed and did not have DA added on it
            ta = traBaseAmount * prorationFactor;
          } else if (is6thCpc) {
            // 6th CPC TA (+ DA on TA), by Grade Pay
            let taBaseAmount = 0;
            if (taFixedActiveThisMonth) {
              taBaseAmount = sideData.taFixedRate!;
            } else {
              taBaseAmount = getSixthCpcTaAmount(payLevel, side === 'paid' ? newDrawnTracker : newDueTracker, city.taCityType);
              if (sideData.doubleTaApplicable && taBaseAmount > 0) {
                // Physically handicapped: double TA, subject to minimum Rs. 1000 + DA
                taBaseAmount = Math.max(taBaseAmount * 2, 1000);
              }
            }
            if (taBaseAmount > 0) {
              const fullMonthTa = taBaseAmount + (taBaseAmount * (effectiveDaRate / 100));
              ta = fullMonthTa * prorationFactor;
            }
          } else {
            // 7th CPC (TA + DA on TA) from the TA Master
            let taBaseAmount = 0;
            if (sideData.taFixedRateApplicable && sideData.taFixedRate && sideData.taFixedRateFromDate && sideData.taFixedRateToDate && isWithinInterval(currentDate, { start: sideData.taFixedRateFromDate, end: sideData.taFixedRateToDate })) {
              taBaseAmount = sideData.taFixedRate;
            } else {
              const taRateDetails = getRateForDate(taRates, currentDate, { basicPay: (side === 'paid' ? newDrawnTracker : newDueTracker), payLevel, cityClass: city.taCityType, defaultCityClass: 'other' });
              if (taRateDetails) {
                taBaseAmount = taRateDetails.rate;
                if (sideData.doubleTaApplicable) {
                  taBaseAmount *= 2;
                  if (sideData.cpc === '7th' && taBaseAmount < 2250) {
                    taBaseAmount = 2250;
                  }
                }
              }
            }
            if (taBaseAmount > 0) {
              let fullMonthTa = taBaseAmount + (taBaseAmount * (effectiveDaRate / 100));
              ta = fullMonthTa * prorationFactor;
            }
          }
        }
      }

      // Calculate Other Allowance (including 5th CPC CCA if enabled)
      let other = 0;
      let otherAmount = sideData.otherAllowance || 0;
      if (sideData.otherAllowanceFixedRateApplicable && sideData.otherAllowanceFixedRate && sideData.otherAllowanceFixedRateFromDate && sideData.otherAllowanceFixedRateToDate && isWithinInterval(currentDate, { start: sideData.otherAllowanceFixedRateFromDate, end: sideData.otherAllowanceFixedRateToDate })) {
        otherAmount = sideData.otherAllowanceFixedRate;
      }
      if (is5thCpc && fifthCpcConfig.ccaApplicable) {
        // 5th CPC CCA Slabs (B-2 / Aligarh shown; other classes in FIFTH_CPC_CCA_BY_CLASS):
        // Upto 2999: Rs 25 | 3000 to 4499: Rs 35 | 4500 to 5999: Rs 65 | 6000 & Above: Rs 120
        // w.e.f. 01.04.2004: DP counts for CCA slabs
        const ccaBase = isDpMerged ? (fullMonthBasic + fullMonthDp) : fullMonthBasic;
        // Slab amounts depend on the 5th CPC city class (B-2 / Aligarh: 25 / 35 / 65 / 120; nil in C & Unclassified)
        const ccaSlabs = FIFTH_CPC_CCA_BY_CLASS[city.fifthCpcCityClass];
        let ccaAmount = 0;
        if (ccaBase < 3000) ccaAmount = ccaSlabs[0];
        else if (ccaBase < 4500) ccaAmount = ccaSlabs[1];
        else if (ccaBase < 6000) ccaAmount = ccaSlabs[2];
        else ccaAmount = ccaSlabs[3];
        otherAmount += ccaAmount;
      }
      if (otherAmount > 0) {
        const prorationFactor = getProratedFactorForAllowance(sideData.otherAllowanceFromDate, sideData.otherAllowanceToDate);
        if (prorationFactor > 0) {
          other = otherAmount * prorationFactor;
        }
      }

      return { basic: reportedBasic, da, hra, npa, ta, other, dp: dpAmount, basicDisplay };
    };

    const drawnComponents = calculateAllowancesForSide('paid');
    const dueComponents = calculateAllowancesForSide('toBePaid');

    const drawnBasic = Math.round(drawnComponents.basic);
    const drawnDa = Math.round(drawnComponents.da);
    const drawnHra = Math.round(drawnComponents.hra);
    const drawnNpa = Math.round(drawnComponents.npa);
    const drawnTa = Math.round(drawnComponents.ta);
    const drawnOther = Math.round(drawnComponents.other);
    const drawnTotal = drawnBasic + drawnDa + drawnHra + drawnNpa + drawnTa + drawnOther;

    const dueBasic = Math.round(dueComponents.basic);
    const dueDa = Math.round(dueComponents.da);
    const dueHra = Math.round(dueComponents.hra);
    const dueNpa = Math.round(dueComponents.npa);
    const dueTa = Math.round(dueComponents.ta);
    const dueOther = Math.round(dueComponents.other);
    const dueTotal = dueBasic + dueDa + dueHra + dueNpa + dueTa + dueOther;

    const difference = dueTotal - drawnTotal;

    const row: StatementRow = {
      month: format(currentDate, "MMM yy"),
      drawn: {
        basic: drawnBasic,
        da: drawnDa,
        hra: drawnHra,
        npa: drawnNpa,
        ta: drawnTa,
        other: drawnOther,
        total: drawnTotal,
        dp: drawnComponents.dp,
        basicDisplay: drawnComponents.basicDisplay,
      },
      due: {
        basic: dueBasic,
        da: dueDa,
        hra: dueHra,
        npa: dueNpa,
        ta: dueTa,
        other: dueOther,
        total: dueTotal,
        dp: dueComponents.dp,
        basicDisplay: dueComponents.basicDisplay,
      },
      difference: difference,
    };

    return { row, newTrackers: { drawnBasic: newDrawnTracker, dueBasic: newDueTracker } };
  };

  const generatePeriodRows = (pData: ArrearFormData): { rows: StatementRow[]; totals: StatementTotals } => {
    const toDateObj = (val: any): Date => (val instanceof Date ? val : new Date(val));
    const toOptionalDateObj = (val: any): Date | undefined => {
      if (!val) return undefined;
      const d = val instanceof Date ? val : new Date(val);
      return isNaN(d.getTime()) ? undefined : d;
    };

    const normalizedData: ArrearFormData = {
      ...pData,
      fromDate: toDateObj(pData.fromDate),
      toDate: toDateObj(pData.toDate),
      paid: {
        ...pData.paid,
        incrementDate: toOptionalDateObj(pData.paid?.incrementDate),
        refixedBasicPayDate: toOptionalDateObj(pData.paid?.refixedBasicPayDate),
      },
      toBePaid: {
        ...pData.toBePaid,
        incrementDate: toOptionalDateObj(pData.toBePaid?.incrementDate),
        refixedBasicPayDate: toOptionalDateObj(pData.toBePaid?.refixedBasicPayDate),
      },
    };

    const rows: StatementRow[] = [];
    const totals: StatementTotals = { drawn: { total: 0 }, due: { total: 0 }, difference: 0 };

    const arrearFromDate = normalizedData.fromDate;
    const arrearToDate = normalizedData.toDate;
    const firstMonth = startOfMonth(arrearFromDate);
    const monthCount = differenceInCalendarMonths(arrearToDate, arrearFromDate);

    let trackers = {
      drawnBasic: Number(normalizedData.paid.basicPay),
      dueBasic: Number(normalizedData.toBePaid.basicPay)
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

      const { row, newTrackers } = calculateMonthlyRow(currentDate, arrearFromDate, arrearToDate, normalizedData, trackers);
      rows.push(row);
      trackers = newTrackers;
    }

    totals.drawn.total = rows.reduce((acc, row) => acc + row.drawn.total, 0);
    totals.due.total = rows.reduce((acc, row) => acc + row.due.total, 0);
    totals.difference = rows.reduce((acc, row) => acc + row.difference, 0);

    return { rows, totals };
  };

  return { getRateForDate, calculateMonthlyRow, generatePeriodRows };
}
