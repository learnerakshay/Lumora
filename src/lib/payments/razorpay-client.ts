// Raw fetch against the Razorpay REST API, matching the repo's existing
// no-SDK convention (see lib/chat/openai-provider.ts). Only the three Orders
// endpoints needed for a one-time-payment flow are implemented — no
// Subscriptions/Plans surface.

const DEFAULT_BASE_URL = 'https://api.razorpay.com/v1';
const DEFAULT_TIMEOUT_MS = 15_000;

export class RazorpayApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly providerCode?: string,
  ) {
    super(message);
    this.name = 'RazorpayApiError';
  }
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt?: string | null;
  status: string;
  created_at: number;
}

export interface RazorpayPayment {
  id: string;
  order_id: string;
  status: string;
  method?: string;
  amount: number;
  currency: string;
  error_code?: string | null;
  error_description?: string | null;
  created_at: number;
}

export interface RazorpayClientConfig {
  keyId: string;
  keySecret: string;
  timeoutMs?: number;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class RazorpayClient {
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly timeoutMs: number;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: RazorpayClientConfig) {
    if (!config.keyId || !config.keySecret) {
      throw new Error('RazorpayClient requires both keyId and keySecret');
    }
    this.keyId = config.keyId;
    this.keySecret = config.keySecret;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`;
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: this.authHeader(),
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const errorPayload = (payload as { error?: { code?: string; description?: string } } | null)?.error;
        // Never include keySecret or any header in this message — it can
        // reach logs and, via AppError, client-facing error responses.
        throw new RazorpayApiError(
          errorPayload?.description || 'Razorpay request failed.',
          response.status,
          errorPayload?.code,
        );
      }
      return payload as T;
    } catch (error) {
      if (error instanceof RazorpayApiError) throw error;
      if (controller.signal.aborted) {
        throw new RazorpayApiError('Razorpay request timed out.', 504);
      }
      throw new RazorpayApiError('Could not reach Razorpay.', 502);
    } finally {
      clearTimeout(timeout);
    }
  }

  // amount is integer paise. payment_capture: 1 means Razorpay auto-captures
  // on successful authorization — there is no separate manual-capture step
  // in this one-time-payment flow.
  async createOrder(input: {
    amount: number;
    currency: string;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<RazorpayOrder> {
    return this.request<RazorpayOrder>('POST', '/orders', {
      amount: input.amount,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
      payment_capture: 1,
    });
  }

  // Fetches the order itself (id, amount, currency, status) — distinct from
  // fetchOrderPayments, which lists payments made against the order and is
  // empty until a checkout actually completes.
  async fetchOrder(orderId: string): Promise<RazorpayOrder> {
    return this.request<RazorpayOrder>('GET', `/orders/${orderId}`);
  }

  async fetchOrderPayments(orderId: string): Promise<{ items: RazorpayPayment[] }> {
    return this.request<{ items: RazorpayPayment[] }>('GET', `/orders/${orderId}/payments`);
  }

  async fetchPayment(paymentId: string): Promise<RazorpayPayment> {
    return this.request<RazorpayPayment>('GET', `/payments/${paymentId}`);
  }
}
