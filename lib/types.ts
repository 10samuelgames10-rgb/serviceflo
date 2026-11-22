import type { Size, Status } from "./format";

export type Business = { id: string; name: string; brand_color: string; timezone: string };
export type Location = { id: string; name: string; short: string };
export type Employee = {
  id: string; name: string; role: string; wage: number; color: string;
  location_id: string | null; active: boolean; user_id: string | null;
};
export type Service = {
  id: string; name: string; description: string; duration_hours: number;
  price_sedan: number; price_suv: number; price_large: number;
  includes: string[]; checklist: string[]; is_plan: boolean; bookable: boolean; sort: number;
};
export type Customer = {
  id: string; name: string; phone: string; email: string; address: string;
  vehicle: string; vehicle_size: Size; source: string; location_id: string | null; created_at: string;
  referral_code: string; referred_by: string | null;
};
export type Job = {
  id: string; number: number; location_id: string | null; customer_id: string;
  service_id: string | null; employee_id: string | null; vehicle_size: Size;
  service_name: string; price: number; discount: number; tip: number;
  date: string; start_time: string; duration_hours: number; status: Status;
  checklist_done: number[]; notes: string;
};

export const servicePrice = (s: Service, size: Size) =>
  Number(size === "sedan" ? s.price_sedan : size === "suv" ? s.price_suv : s.price_large);
