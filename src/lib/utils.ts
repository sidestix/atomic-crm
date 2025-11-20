import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Validates if a value can be converted to a valid Date
 * Returns true if the value is a valid date, false otherwise
 */
export function isValidDate(value: unknown): boolean {
  if (!value) return false;
  
  const date = new Date(String(value));
  return !isNaN(date.getTime());
}
