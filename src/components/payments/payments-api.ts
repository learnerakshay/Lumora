// Thin fetch wrapper for the /api/payments/* JSON envelope
// ({ success, data } | { success: false, error: { code, message } }),
// shared by CouponField and CheckoutDialog so both parse responses the
// same way and neither hand-rolls its own error-shape guessing.
import { API_PATHS } from '../../lib/api-paths';
import type { PaidPlan } from '../../lib/payments/config';
import type { PlanName } from '../../lib/usage/config';

export interface PaymentsApiSuccess<T> {
  // A string-literal discriminant, not a boolean one: this repo's
  // tsconfig does not enable `strict` (see CLAUDE.md), and without
  // strictNullChecks, TypeScript's control-flow analysis fails to narrow
  // a `ok: true | false` boolean-literal union — `if (!result.ok)` leaves
  // `result` typed as the full union instead of the error branch. A
  // string-literal tag ('ok' | 'error') narrows correctly under this
  // project's actual compiler settings; verified in isolation before
  // choosing this shape.
  status: 'ok';
  data: T;
}

export interface PaymentsApiError {
  status: 'error';
  code: string;
  message: string;
  httpStatus: number;
}

export type PaymentsApiResult<T> = PaymentsApiSuccess<T> | PaymentsApiError;

async function callPaymentsApi<T>(path: string, init?: RequestInit): Promise<PaymentsApiResult<T>> {
  try {
    const response = await fetch(`${API_PATHS.payments}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init?.headers || {}),
      },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success || !payload.data) {
      return {
        status: 'error',
        code: payload?.error?.code || 'UNKNOWN_ERROR',
        message: payload?.error?.message || 'Something went wrong. Please try again.',
        httpStatus: response.status,
      };
    }
    return { status: 'ok', data: payload.data as T };
  } catch {
    return {
      status: 'error',
      code: 'NETWORK_ERROR',
      message: 'Network error — please check your connection and try again.',
      httpStatus: 0,
    };
  }
}

export function postPaymentsApi<T>(path: string, body: unknown): Promise<PaymentsApiResult<T>> {
  return callPaymentsApi<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

export function getPaymentsApi<T>(path: string): Promise<PaymentsApiResult<T>> {
  return callPaymentsApi<T>(path, { method: 'GET' });
}

// --- Response shapes, matching src/routes/payments.ts exactly -----------

export interface QuoteResponse {
  plan: PaidPlan;
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  currency: string;
  couponApplied: boolean;
  couponCode: string | null;
}

export interface OrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  plan: PaidPlan;
}

export interface VerifyResponse {
  captured: boolean;
  plan: PlanName;
  planExpiresAt: string | null;
}

export interface AccessRefreshResponse {
  plan: PlanName;
  planExpiresAt: string | null;
}
