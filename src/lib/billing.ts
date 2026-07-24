import { RateLimitError } from "@cursor/sdk";

const BILLING_MESSAGE_RE =
  /billing|quota|usage[_\s-]?limit|insufficient[_\s-]?(credit|fund|balance|usage)|payment[_\s-]?(required|failed)|spend[_\s-]?limit|out of credits?|exceeded.*usage|usage.*exceeded|plan[_\s-]?limit|on[_\s-]?demand.*(disabled|required)|credit[_\s-]?limit/i;

export function isBillingHaltError(err: unknown): boolean {
  if (err instanceof RateLimitError) return true;

  if (err && typeof err === "object") {
    const e = err as { status?: number; code?: string; message?: string };
    if (e.status === 402) return true;
    if (typeof e.code === "string" && /billing|quota|usage|payment/i.test(e.code)) {
      return true;
    }
    if (typeof e.message === "string" && BILLING_MESSAGE_RE.test(e.message)) {
      return true;
    }
  }

  if (typeof err === "string" && BILLING_MESSAGE_RE.test(err)) return true;

  return false;
}

export function isBillingHaltText(...parts: Array<string | undefined | null>): boolean {
  return parts.some((p) => typeof p === "string" && BILLING_MESSAGE_RE.test(p));
}
