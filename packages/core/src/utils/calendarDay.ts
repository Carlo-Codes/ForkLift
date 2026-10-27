// A Date as the calendar day it falls on where the phone is, e.g. "2026-10-27".
export function toCalendarDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// A YYYY-MM-DD calendar day as a Date at local midday on that day, e.g. for a
// date picker; midday keeps it on the same day across a daylight-saving shift.
export function fromCalendarDay(day: string): Date {
  const [
    year,
    month,
    date
  ] = day.split("-").map(Number);

  return new Date(year!, month! - 1, date, 12);
}
