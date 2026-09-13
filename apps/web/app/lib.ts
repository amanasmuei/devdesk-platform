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
  "in_progress",
  "delivered",
  "declined",
] as const;

export function statusLabel(s: string): string {
  const map: Record<string, string> = {
    submitted: "Submitted",
    quoted: "Quoted",
    in_progress: "In progress",
    delivered: "Delivered",
    declined: "Declined",
  };
  return map[s] ?? s;
}
