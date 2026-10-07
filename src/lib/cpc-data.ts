// Default 5th CPC DA Rates (As per 5th Pay Commission)
// Applicable from 01.01.1996 to upto August 2008
// DA rates as per the 5th Pay Commission schedule
export const default5thCpcDaRates = [
  { fromDate: new Date("1996-01-01"), rate: 0 },          // Nil
  { fromDate: new Date("1996-07-01"), rate: 4 },
  { fromDate: new Date("1997-01-01"), rate: 8 },
  { fromDate: new Date("1997-07-01"), rate: 13 },
  { fromDate: new Date("1998-01-01"), rate: 16 },
  { fromDate: new Date("1998-07-01"), rate: 22 },
  { fromDate: new Date("1999-01-01"), rate: 32 },
  { fromDate: new Date("1999-07-01"), rate: 37 },
  { fromDate: new Date("2000-01-01"), rate: 38 },
  { fromDate: new Date("2000-07-01"), rate: 41 },
  { fromDate: new Date("2001-01-01"), rate: 43 },
  { fromDate: new Date("2001-07-01"), rate: 45 },
  { fromDate: new Date("2002-01-01"), rate: 49 },
  { fromDate: new Date("2002-07-01"), rate: 52 },
  { fromDate: new Date("2003-01-01"), rate: 55 },
  { fromDate: new Date("2003-07-01"), rate: 59 },
  { fromDate: new Date("2004-01-01"), rate: 61 },
  // From 01.04.2004 onwards, DA is expressed as "50 + X%" (i.e. DA% beyond 50% is called DP merger)
  // In 5th CPC, once DA crossed 50%, the DA beyond 50% was merged as Dearness Pay (DP).
  // So effective DA calculation: Basic Pay is treated as (Basic + DP), and DA is applied on it.
  // For simplicity, we store the effective combined rate.
  // 50+11% means: DP = 50% of Basic merged, then 11% DA on (Basic + DP)
  // Effective total DA on original basic = 50 + 11 + (50*11/100) = 66.5% — but for arrear calc,
  // user enters Basic as the 5th CPC basic (without DP), and the system applies:
  //   DP = 50% of Basic, New Basic (for DA) = Basic + DP, DA = X% of New Basic
  // We store the "additional DA%" after DP merger. The DP merger flag is indicated by rate > 50.
  { fromDate: new Date("2004-04-01"), dpMerged: true, rate: 11 },   // 50+11%
  { fromDate: new Date("2004-07-01"), dpMerged: true, rate: 14 },   // 50+14%
  { fromDate: new Date("2005-01-01"), dpMerged: true, rate: 17 },   // 50+17%
  { fromDate: new Date("2005-07-01"), dpMerged: true, rate: 21 },   // 50+21%
  { fromDate: new Date("2006-01-01"), dpMerged: true, rate: 24 },   // 50+24%
  { fromDate: new Date("2006-07-01"), dpMerged: true, rate: 29 },   // 50+29%
  { fromDate: new Date("2007-01-01"), dpMerged: true, rate: 35 },   // 50+35%
  { fromDate: new Date("2007-07-01"), dpMerged: true, rate: 41 },   // 50+41%
  { fromDate: new Date("2008-01-01"), dpMerged: true, rate: 47 },   // 50+47%
  { fromDate: new Date("2008-07-01"), dpMerged: true, rate: 14 },   // 50+14% (revised after 6th CPC onset)
];

// 5th CPC Pay Scales
export const fifthCpcPayScales = [
  { scale: "2550-55-2660-60-3200", minPay: 2550, maxPay: 3200, description: "Group D - Peon, Attendant" },
  { scale: "2610-60-3150-65-3540", minPay: 2610, maxPay: 3540, description: "Group D - Daftry, Jamadar" },
  { scale: "2650-65-3300-70-4000", minPay: 2650, maxPay: 4000, description: "Group D - Senior Peon" },
  { scale: "2750-70-3800-75-4400", minPay: 2750, maxPay: 4400, description: "Group C - LDC, Jr. Typist" },
  { scale: "3050-75-3950-80-4590", minPay: 3050, maxPay: 4590, description: "Group C - UDC, Stenographer" },
  { scale: "3200-85-4900", minPay: 3200, maxPay: 4900, description: "Group C - Assistant, Auditor" },
  { scale: "4000-100-6000", minPay: 4000, maxPay: 6000, description: "Group C - Senior Assistant" },
  { scale: "4500-125-7000", minPay: 4500, maxPay: 7000, description: "Group C - Head Clerk, Supervisor" },
  { scale: "5000-150-8000", minPay: 5000, maxPay: 8000, description: "Group B - Section Officer" },
  { scale: "5500-175-9000", minPay: 5500, maxPay: 9000, description: "Group B - Assistant Section Officer" },
  { scale: "6500-200-10500", minPay: 6500, maxPay: 10500, description: "Group A - Under Secretary" },
  { scale: "7450-225-11500", minPay: 7450, maxPay: 11500, description: "Group A - Deputy Secretary" },
  { scale: "7500-250-12000", minPay: 7500, maxPay: 12000, description: "Group A - Senior Scale" },
  { scale: "8000-275-13500", minPay: 8000, maxPay: 13500, description: "Group A - JAG" },
  { scale: "10000-325-15200", minPay: 10000, maxPay: 15200, description: "Group A - Selection Grade" },
  { scale: "10650-325-15850", minPay: 10650, maxPay: 15850, description: "Group A - NFSG" },
  { scale: "12000-375-16500", minPay: 12000, maxPay: 16500, description: "Group A - SAG" },
  { scale: "14300-400-18300", minPay: 14300, maxPay: 18300, description: "Group A - HAG" },
  { scale: "16400-450-20000", minPay: 16400, maxPay: 20000, description: "Group A - HAG+" },
  { scale: "22400-525-24500", minPay: 22400, maxPay: 24500, description: "Apex Scale" },
  { scale: "26000 (Fixed)", minPay: 26000, maxPay: 26000, description: "Cabinet Secretary" },
];

// 5th CPC CCA (City Compensatory Allowance) slabs
export const fifthCpcCcaSlabs = [
  { basicFrom: 0, basicTo: 2999, rate: 25 },
  { basicFrom: 3000, basicTo: 4499, rate: 35 },
  { basicFrom: 4500, basicTo: 5999, rate: 65 },
  { basicFrom: 6000, basicTo: 999999, rate: 120 },
];

// 5th CPC TRA (Transport/Conveyance Allowance) slabs
// Applicable based on pay scale
export const fifthCpcTraSlabs = [
  { basicFrom: 0, basicTo: 9000, rate: 75 },
  { basicFrom: 6500, basicTo: 12000, rate: 200 },
  { basicFrom: 8000, basicTo: 999999, rate: 400 },
];

// Default 6th CPC DA Rates (As per 6th Pay Commission)
// These are used to seed the database on first load.
export const default6thCpcDaRates = [
  { fromDate: new Date("2006-01-01"), rate: 0 },
  { fromDate: new Date("2006-07-01"), rate: 2 },
  { fromDate: new Date("2007-01-01"), rate: 6 },
  { fromDate: new Date("2007-07-01"), rate: 9 },
  { fromDate: new Date("2008-01-01"), rate: 12 },
  { fromDate: new Date("2008-07-01"), rate: 16 },
  { fromDate: new Date("2009-01-01"), rate: 22 },
  { fromDate: new Date("2009-07-01"), rate: 27 },
  { fromDate: new Date("2010-01-01"), rate: 35 },
  { fromDate: new Date("2010-07-01"), rate: 45 },
  { fromDate: new Date("2011-01-01"), rate: 51 },
  { fromDate: new Date("2011-07-01"), rate: 58 },
  { fromDate: new Date("2012-01-01"), rate: 65 },
  { fromDate: new Date("2012-07-01"), rate: 72 },
  { fromDate: new Date("2013-01-01"), rate: 80 },
  { fromDate: new Date("2013-07-01"), rate: 90 },
  { fromDate: new Date("2014-01-01"), rate: 100 },
  { fromDate: new Date("2014-07-01"), rate: 107 },
  { fromDate: new Date("2015-01-01"), rate: 113 },
  { fromDate: new Date("2015-07-01"), rate: 119 },
  { fromDate: new Date("2016-01-01"), rate: 125 },
  { fromDate: new Date("2016-07-01"), rate: 132 },
  { fromDate: new Date("2017-01-01"), rate: 136 },
  { fromDate: new Date("2017-07-01"), rate: 139 },
];

export const cpcData: Record<string, { payLevels: Array<{ level: string; gradePay?: number | null; payBand?: string; scale?: string; values: number[] }> }> = {
  "5th": {
    payLevels: [
      { level: "S-1", scale: "2550-55-2660-60-3200", payBand: "2550-3200", values: [] },
      { level: "S-2", scale: "2610-60-3150-65-3540", payBand: "2610-3540", values: [] },
      { level: "S-3", scale: "2650-65-3300-70-4000", payBand: "2650-4000", values: [] },
      { level: "S-4", scale: "2750-70-3800-75-4400", payBand: "2750-4400", values: [] },
      { level: "S-5", scale: "3050-75-3950-80-4590", payBand: "3050-4590", values: [] },
      { level: "S-6", scale: "3200-85-4900", payBand: "3200-4900", values: [] },
      { level: "S-7", scale: "4000-100-6000", payBand: "4000-6000", values: [] },
      { level: "S-8", scale: "4500-125-7000", payBand: "4500-7000", values: [] },
      { level: "S-9", scale: "5000-150-8000", payBand: "5000-8000", values: [] },
      { level: "S-10", scale: "5500-175-9000", payBand: "5500-9000", values: [] },
      { level: "S-11", scale: "6500-200-10500", payBand: "6500-10500", values: [] },
      { level: "S-12", scale: "7450-225-11500", payBand: "7450-11500", values: [] },
      { level: "S-13", scale: "7500-250-12000", payBand: "7500-12000", values: [] },
      { level: "S-14", scale: "8000-275-13500", payBand: "8000-13500", values: [] },
      { level: "S-15", scale: "10000-325-15200", payBand: "10000-15200", values: [] },
      { level: "S-16", scale: "10650-325-15850", payBand: "10650-15850", values: [] },
      { level: "S-17", scale: "12000-375-16500", payBand: "12000-16500", values: [] },
      { level: "S-18", scale: "14300-400-18300", payBand: "14300-18300", values: [] },
      { level: "S-19", scale: "16400-450-20000", payBand: "16400-20000", values: [] },
      { level: "S-20", scale: "22400-525-24500", payBand: "22400-24500", values: [] },
      { level: "S-21", scale: "26000 (Fixed)", payBand: "26000", values: [] },
    ],
  },
  "6th": {
    payLevels: [
      { level: "1", gradePay: 1800, payBand: "5200-20200", values: [] },
      { level: "2", gradePay: 1900, payBand: "5200-20200", values: [] },
      { level: "3", gradePay: 2000, payBand: "5200-20200", values: [] },
      { level: "4", gradePay: 2400, payBand: "5200-20200", values: [] },
      { level: "5", gradePay: 2800, payBand: "5200-20200", values: [] },
      { level: "6", gradePay: 4200, payBand: "9300-34800", values: [] },
      { level: "7", gradePay: 4600, payBand: "9300-34800", values: [] },
      { level: "8", gradePay: 4800, payBand: "9300-34800", values: [] },
      { level: "9", gradePay: 5400, payBand: "9300-34800", values: [] },
      { level: "10", gradePay: 5400, payBand: "15600-39100", values: [] },
      { level: "AL-10", gradePay: 6000, payBand: "15600-39100", values: [] },
      { level: "11", gradePay: 6600, payBand: "15600-39100", values: [] },
      { level: "AL-11", gradePay: 7000, payBand: "15600-39100", values: [] },
      { level: "12", gradePay: 7600, payBand: "15600-39100", values: [] },
      { level: "AL-12", gradePay: 8000, payBand: "15600-39100", values: [] },
      { level: "13", gradePay: 8700, payBand: "37400-67000", values: [] },
      { level: "13-A", gradePay: 8900, payBand: "37400-67000", values: [] },
      { level: "AL-13-A", gradePay: 9000, payBand: "37400-67000", values: [] },
      { level: "14/AL-14", gradePay: 10000, payBand: "37400-67000", values: [] },
      { level: "15VC", gradePay: null, payBand: "75000", values: [] }
    ],
  },
  "7th": {
    payLevels: [
      {
        level: '1',
        values: [
          18000, 18500, 19100, 19700, 20300, 20900, 21500, 22100, 22800, 23500,
          24200, 24900, 25600, 26400, 27200, 28000, 28800, 29700, 30600, 31500, 
          32400, 33400, 34400, 35400, 36500, 37600, 38700, 39900, 41100, 42300, 
          43600, 44900, 46200, 47600, 49000, 50500, 52000, 53600, 55200, 56900,
        ],
      },
      {
        level: '2',
        values: [
          19900, 20500, 21100, 21700, 22400, 23100, 23800, 24500, 25200, 26000,
          26800, 27600, 28400, 29300, 30200, 31100, 32000, 33000, 34000, 35000,
          36100, 37200, 38300, 39400, 40600, 41800, 43100, 44400, 45700, 47100,
          48500, 50000, 51500, 53000, 54600, 56200, 57900, 59600, 61400, 63200,
        ],
      },
      {
        level: '3',
        values: [
          21700, 22400, 23100, 23800, 24500, 25200, 26000, 26800, 27600, 28400,
          29300, 30200, 31100, 32000, 33000, 34000, 35000, 36100, 37200, 38300,
          39400, 40600, 41800, 43100, 44400, 45700, 47100, 48500, 50000, 51500,
          53000, 54600, 56200, 57900, 59600, 61400, 63200, 65100, 67100, 69100,

        ],
      },
      {
        level: '4',
        values: [
          25500, 26300, 27100, 27900, 28700, 29600, 30500, 31400, 32300, 33300,
          34300, 35300, 36400, 37500, 38600, 39800, 41000, 42200, 43500, 44800,
          46100, 47500, 48900, 50400, 51900, 53500, 55100, 56800, 58500, 60300,
          62100, 64000, 65900, 67900, 69900, 72000, 74200, 76400, 78700, 81100,

        ],
      },
      {
        level: '5',
        values: [
          29200, 30100, 31000, 31900, 32900, 33900, 34900, 35900, 37000, 38100,
          39200, 40400, 41600, 42800, 44100, 45400, 46800, 48200, 49600, 51100,
          52600, 54200, 55800, 57500, 59200, 61000, 62800, 64700, 66600, 68600,
          70700, 72800, 75000, 77300, 79600, 82000, 84500, 87000, 89600, 92300,

        ],
      },
      {
        level: '6',
        values: [
          35400, 36500, 37600, 38700, 39900, 41100, 42300, 43600, 44900, 46200,
          47600, 49000, 50500, 52000, 53600, 55200, 56900, 58600, 60400, 62200,
          64100, 66000, 68000, 70000, 72100, 74300, 76500, 78800, 81200, 83600,
          86100, 88700, 91400, 94100, 96900, 99800, 102800, 105900, 109100, 112400,

        ],
      },
      {
        level: '7',
        values: [
          44900, 46200, 47600, 49000, 50500, 52000, 53600, 55200, 56900,
          58600, 60400, 62200, 64100, 66000, 68000, 70000, 72100, 74300,
          76500, 78800, 81200, 83600, 86100, 88700, 91400, 94100, 96900,
          99800, 102800, 105900, 109100, 112400, 115800, 119300, 122900,
          126600, 130400, 134300, 138300, 142400,
        ],
      },
      {
        level: '8',
        values: [
          47600, 49000, 50500, 52000, 53600, 55200, 56900, 58600, 60400,
          62200, 64100, 66000, 68000, 70000, 72100, 74300, 76500, 78800,
          81200, 83600, 86100, 88700, 91400, 94100, 96900, 99800, 102800,
          105900, 109100, 112400, 115800, 119300, 122900, 126600, 130400,
          134300, 138300, 142400, 146700, 151100,
        ],
      },
      {
        level: '9',
        values: [
          53100, 54700, 56300, 58000, 59700, 61500, 63300, 65200, 67200,
          69200, 71300, 73400, 75600, 77900, 80200, 82600, 85100, 87700,
          90300, 93000, 95800, 98700, 101700, 104800, 107900, 111100,
          114400, 117800, 121300, 124900, 128600, 132500, 136500,
          140600, 144800, 149100, 153600, 158200, 162900, 167800,

        ],
      },
      {
        level: '10',
        values: [
          56100, 57800, 59500, 61300, 63100, 65000, 67000, 69000, 71100,
          73200, 75400, 77700, 80000, 82400, 84900, 87400, 90000, 92700,
          95500, 98400, 101400, 104400, 107500, 110700, 114000, 117400,
          120900, 124500, 128200, 132000, 136000, 140100, 144300,
          148600, 153100, 157700, 162400, 167300, 172300, 177500,

        ],
      },
      {
        level: 'AL-10',
        values: [
          57700, 59400, 61200, 63000, 64900, 66800, 68800, 70900, 73000,
          75200, 77500, 79800, 82200, 84700, 87200, 89800, 92500, 95300,
          98200, 101100, 104100, 107200, 110400, 113700, 117100, 120600,
          124200, 127900, 131700, 135700, 139800, 144000, 148300,
          152700, 157300, 162000, 166900, 171900, 177100, 182400,
        ],
      },
      {
        level: '11',
        values: [
          67700, 69700, 71800, 74000, 76200, 78500, 80900, 83300, 85800,
          88400, 91100, 93800, 96600, 99500, 102500, 105600, 108800, 112100,
          115500, 119000, 122600, 126300, 130100, 134000, 138000, 142100,
          146400, 150800, 155300, 160000, 164800, 169700, 174800,
          180000, 185400, 191000, 196700, 202600, 208700,
        ],
      },
      {
        level: 'AL-11',
        values: [
          68900, 71000, 73100, 75300, 77600, 79900, 82300, 84800, 87300,
          89900, 92600, 95400, 98300, 101200, 104200, 107300, 110500, 113800,
          117200, 120700, 124300, 128000, 131800, 135800, 139900, 144100,
          148400, 152900, 157500, 162200, 167100, 172100, 177300, 182600,
          188100, 193700, 199500, 205500,
        ],
      },
      {
        level: '12',
        values: [
          78800, 81200, 83600, 86100, 88700, 91400, 94100, 96900, 99800,
          102800, 105900, 109100, 112400, 115800, 119300, 122900,
          126600, 130400, 134300, 138300, 142400, 146700, 151100,
          155600, 160300, 165100, 170100, 175200, 180500, 185900,
          191500, 197200, 203100, 209200,

        ],
      },
      {
        level: 'AL-12',
        values: [
          79800, 82200, 84700, 87200, 89800, 92500, 95300, 98200, 101100,
          104100, 107200, 110400, 113700, 117100, 120600, 124200,
          127900, 131700, 135700, 139800, 144000, 148300, 152700, 157300,
          162000, 166900, 171900, 177100, 182400, 187900, 193500,
          199300, 205300, 211500,

        ],
      },
      {
        level: '13',
        values: [
          123100, 126800, 130600, 134500, 138500, 142700, 147000,
          151400, 155900, 160600, 165400, 170400, 175500, 180800,
          186200, 191800, 197600, 203500, 209600, 215900,
        ],
      },
      {
        level: '13-A',
        values: [
          131100, 135000, 139100, 143300, 147600, 152000, 156600,
          161300, 166100, 171100, 176200, 181500, 186900, 192500,
          198300, 204200, 210300, 216600,
        ],
      },
      {
        level: 'AL-13-A',
        values: [
          131400, 135300, 139400, 143600, 147900, 152300, 156900, 161600,
          166400, 171400, 176500, 181800, 187300, 192900, 198700, 204700,
          210800, 217100,

        ],
      },
      {
        level: '14/AL-14',
        values: [
          144200, 148500, 153000, 157600, 162300, 167200, 172200, 177400,
          182700, 188200, 193800, 199600, 205600, 211800, 218200,
        ],
      },
      { level: '15VC', values: [210000] },
    ],
  },
};

/**
 * Calculates the next incremental stage in a 5th CPC Pay Scale.
 * Examples of 5th CPC scales:
 * - "2550-55-2660-60-3200" (two-stage: 55 increment up to 2660, then 60 up to 3200)
 * - "5000-150-8000" (single-stage: 150 increment up to 8000)
 * - "26000 (Fixed)" (fixed: no increment)
 */
export function calculate5thCpcIncrement(currentBasic: number, scaleString?: string): number {
  if (!scaleString || scaleString.includes("Fixed")) return currentBasic;
  const tokens = scaleString.split('-').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
  if (tokens.length === 3) {
    const [min, inc, max] = tokens;
    if (currentBasic < min) return min;
    if (currentBasic >= max) return currentBasic;
    return Math.min(currentBasic + inc, max);
  }
  if (tokens.length >= 5) {
    for (let i = 1; i < tokens.length; i += 2) {
      const inc = tokens[i];
      const limit = tokens[i + 1];
      if (currentBasic < limit) {
        return Math.min(currentBasic + inc, limit);
      }
    }
  }
  return currentBasic;
}
