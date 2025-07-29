
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Added currency formatting function
export function formatCurrency(amount: number | null | undefined, currency = 'BRL', locale = 'pt-BR'): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return 'N/A'; // Or return 'R$ 0,00' or handle as needed
  }
  return amount.toLocaleString(locale, { style: 'currency', currency: currency });
}
