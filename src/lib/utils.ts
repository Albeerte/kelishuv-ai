import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function money(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })
    .format(value)
    .replace(/,/g, " ");
}
const months = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];
function dateParts(value: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "Asia/Tashkent",
  }).formatToParts(new Date(value));
  return {
    day: parts.find((part) => part.type === "day")!.value,
    month:
      months[Number(parts.find((part) => part.type === "month")!.value) - 1],
    year: parts.find((part) => part.type === "year")!.value,
  };
}
export function shortDate(value: string) {
  const parts = dateParts(value);
  return `${parts.day}-${parts.month}`;
}
export function fullDate(value: string) {
  const parts = dateParts(value);
  return `${parts.day}-${parts.month}, ${parts.year}`;
}
export function timeOf(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tashkent",
  }).format(new Date(value));
}
export function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options?.headers,
    },
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(data.error || "So‘rov bajarilmadi. Qayta urinib ko‘ring."),
      { status: response.status, caseId: data.caseId },
    );
  return data as T;
}
