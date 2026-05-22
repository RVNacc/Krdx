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

export function parsePersianDate(dateString: string): Date | null {
    // Basic fallback parsing if dates are simple strings or serial numbers
    if (!dateString) return null;
    
    // Check if it's an excel serial number
    if (typeof dateString === 'number') {
        const d = new Date(Math.round((dateString - 25569)*86400*1000));
        return d;
    }

    try {
        return new Date(dateString);
    } catch {
        return new Date();
    }
}
