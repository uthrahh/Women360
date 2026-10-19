import clsx, { type ClassValue } from "clsx";

/** Joins class names, dropping falsy ones. (No tailwind-merge: later classes don't override earlier ones.) */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
