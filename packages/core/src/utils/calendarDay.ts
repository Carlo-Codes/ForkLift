// A Date as the calendar day it falls on where the phone is, e.g. "2026-10-27".
export function toCalendarDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
