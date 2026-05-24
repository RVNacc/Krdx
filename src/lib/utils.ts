import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: 2,
  }).format(value);
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): Date {
  const g_days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const j_days_in_month = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];

  let jy_fixed = jy - 979;
  let jm_fixed = jm - 1;
  let jd_fixed = jd - 1;

  let j_day_no = 365 * jy_fixed + Math.floor(jy_fixed / 33) * 8 + Math.floor((jy_fixed % 33 + 3) / 4);
  for (let i = 0; i < jm_fixed; ++i) {
    j_day_no += j_days_in_month[i];
  }
  j_day_no += jd_fixed;

  let g_day_no = j_day_no + 79;

  let gy = 1600 + 400 * Math.floor(g_day_no / 146097);
  g_day_no = g_day_no % 146097;

  let leap = true;
  if (g_day_no >= 36524) {
    g_day_no--;
    gy += 100 * Math.floor(g_day_no / 36524);
    g_day_no = g_day_no % 36524;

    if (g_day_no >= 365) {
      g_day_no++;
    } else {
      leap = false;
    }
  }

  gy += 4 * Math.floor(g_day_no / 1461);
  g_day_no = g_day_no % 1461;

  if (g_day_no >= 366) {
    leap = false;
    g_day_no--;
    gy += Math.floor(g_day_no / 365);
    g_day_no = g_day_no % 365;
  }

  let i = 0;
  for (i = 0; g_day_no >= g_days_in_month[i] + (i === 1 && leap ? 1 : 0); i++) {
    g_day_no -= g_days_in_month[i] + (i === 1 && leap ? 1 : 0);
  }
  let gm = i + 1;
  let gd = g_day_no + 1;

  return new Date(gy, gm - 1, gd);
}

export function parsePersianDate(dateString: any): Date | null {
    if (dateString === undefined || dateString === null || dateString === '') return null;
    
    // Check if it's already a date object
    if (dateString instanceof Date) {
        return isNaN(dateString.getTime()) ? null : dateString;
    }

    // Check if it's an excel serial number
    if (typeof dateString === 'number' || !isNaN(Number(dateString))) {
        const val = Number(dateString);
        if (val > 20000 && val < 60000) { // Excel date serial bounds
            const d = new Date(Math.round((val - 25569) * 86400 * 1000));
            return isNaN(d.getTime()) ? null : d;
        }
    }

    const str = String(dateString).trim();
    if (!str) return null;

    // Detect Jalali / Gregorian patterns like: 1402/10/25 or 2024-05-12
    const match = str.match(/(\d{4})[/|-](\d{1,2})[/|-](\d{1,2})/);
    if (match) {
        const y = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const d = parseInt(match[3], 10);

        if (y > 1300 && y < 1600) {
            return jalaliToGregorian(y, m, d);
        } else if (y >= 1900) {
            return new Date(y, m - 1, d);
        }
    }

    // Attempt native parsing
    const nativeDate = new Date(str);
    if (!isNaN(nativeDate.getTime())) {
        return nativeDate;
    }

    return new Date();
}
