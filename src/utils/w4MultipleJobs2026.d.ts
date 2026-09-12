export type W4MultipleJobsResult = {line1Cents:number|null;line2aCents:number|null;line2bCents:number|null;line2cCents:number|null;line3:number;line4Cents:number;additionalCents:number;step4cCents:number}
export function w4MultipleJobs2026(input:{filingStatus:string;annualWagesCents:number[];payPeriods:number;additionalCents?:number}):W4MultipleJobsResult
