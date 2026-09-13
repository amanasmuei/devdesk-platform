// The API is served from the same origin via the reverse proxy (/api/*),
// so relative URLs work in every environment with no build-time config.
// Override with NEXT_PUBLIC_API_URL only for split-origin deployments.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "";

export interface PortalRequest {
  id: string | number;
  service: string;
  details: string;
  status: string;
  quote_price: number | null;
  quote_date: string | null;
  preview_url?: string | null;
  created_at?: string;
  urgency?: string;
}

export interface AdminRequest extends PortalRequest {
  name: string;
  email: string;
  admin_notes?: string | null;
}

export const STATUS_VALUES = [
  "submitted",
  "quoted",
  "accepted",
  "in_progress",
  "delivered",
  "paid",
  "declined",
] as const;

// The one legal forward transition from each status. Client-owned
// transitions (accept/decline) happen in the portal; the admin walks
// the ladder one step at a time.
export const NEXT_STATUS: Record<string, string> = {
  submitted: "quoted",
  quoted: "accepted", // manual override; normally the client accepts
  accepted: "in_progress",
  in_progress: "delivered",
  delivered: "paid",
  paid: "",
  declined: "",
};

export function statusLabel(s: string): string {
  const map: Record<string, string> = {
    submitted: "Submitted",
    quoted: "Quoted",
    accepted: "Accepted",
    in_progress: "In progress",
    delivered: "Delivered",
    paid: "Paid",
    declined: "Declined",
  };
  return map[s] ?? s;
}
