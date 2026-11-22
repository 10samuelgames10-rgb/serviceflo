export const GST_RATE = 0.05;

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type Size = "sedan" | "suv" | "large";
export const SIZES: Record<Size, string> = {
  sedan: "Car / Sedan",
  suv: "SUV / Crossover",
  large: "Truck / 7-seat",
};
export const SIZE_EXTRA_HOURS: Record<Size, number> = { sedan: 0, suv: 0.5, large: 1 };

export type Status = "quote" | "scheduled" | "progress" | "completed" | "paid" | "cancelled";
export const STATUSES: { id: Status; label: string; color: string }[] = [
  { id: "quote", label: "Quote", color: "#8b5cf6" },
  { id: "scheduled", label: "Scheduled", color: "#2f7ae5" },
  { id: "progress", label: "In Progress", color: "#f5c518" },
  { id: "completed", label: "Completed", color: "#14a8b8" },
  { id: "paid", label: "Paid", color: "#22a36a" },
  { id: "cancelled", label: "Cancelled", color: "#e05252" },
];
export const statusInfo = (s: string) => STATUSES.find((x) => x.id === s) ?? STATUSES[1];

export function money(n: number, cents = false): string {
  const v = Math.abs(Number(n) || 0).toLocaleString("en-CA", {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
  return (n < 0 ? "-$" : "$") + v;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function parseDate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const fmtDate = (s: string) => {
  const d = parseDate(s);
  return `${DOW[d.getDay()]} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
};
export const fmtLongDate = (s: string) => {
  const d = parseDate(s);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

/** "09:30:00" or 9.5 -> "9:30 AM" */
export function fmtTime(t: string | number): string {
  const h = typeof t === "number" ? t : Number(t.slice(0, 2)) + Number(t.slice(3, 5)) / 60;
  const H = Math.floor(h), M = Math.round((h - H) * 60);
  return `${((H + 11) % 12) + 1}:${pad(M)} ${H >= 12 ? "PM" : "AM"}`;
}
export const timeToHours = (t: string) => Number(t.slice(0, 2)) + Number(t.slice(3, 5)) / 60;

export function hrs(h: number): string {
  const H = Math.floor(h + 1e-9), M = Math.round((h - H) * 60);
  return M ? `${H}h ${M}m` : `${H}h`;
}

/** Today's date (YYYY-MM-DD) in the business's timezone. */
export function todayIn(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function jobTotals(job: { price: number; discount: number; tip?: number }) {
  const subtotal = Math.max(0, Number(job.price) - Number(job.discount || 0));
  const gst = Math.round(subtotal * GST_RATE * 100) / 100;
  return { subtotal, gst, total: subtotal + gst, tip: Number(job.tip || 0) };
}
