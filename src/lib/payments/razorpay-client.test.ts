import assert from 'node:assert/strict';
import test from 'node:test';
import { RazorpayApiError, RazorpayClient } from './razorpay-client';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('createOrder sends Basic auth built from keyId:keySecret and posts amount/currency/receipt', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  const fetchImpl = async (url: string | URL, init?: RequestInit) => {
    capturedUrl = String(url);
    capturedInit = init;
    return jsonResponse(200, { id: 'order_1', amount: 49_900, currency: 'INR', status: 'created', created_at: 0 });
  };

  const client = new RazorpayClient({ keyId: 'rzp_test_abc', keySecret: 'secret_xyz', fetchImpl: fetchImpl as typeof fetch });
  const order = await client.createOrder({ amount: 49_900, currency: 'INR', receipt: 'receipt_1', notes: { userId: 'u1' } });

  assert.equal(order.id, 'order_1');
  assert.equal(capturedUrl, 'https://api.razorpay.com/v1/orders');
  assert.equal(capturedInit?.method, 'POST');
  const expectedAuth = `Basic ${Buffer.from('rzp_test_abc:secret_xyz').toString('base64')}`;
  assert.equal((capturedInit?.headers as Record<string, string>).Authorization, expectedAuth);
  const body = JSON.parse(capturedInit?.body as string);
  assert.equal(body.amount, 49_900);
  assert.equal(body.currency, 'INR');
  assert.equal(body.receipt, 'receipt_1');
  assert.equal(body.payment_capture, 1);
});

test('fetchOrder issues a GET against /orders/:id and returns the order payload', async () => {
  let capturedUrl = '';
  let capturedMethod = '';
  const fetchImpl = async (url: string | URL, init?: RequestInit) => {
    capturedUrl = String(url);
    capturedMethod = init?.method || 'GET';
    return jsonResponse(200, { id: 'order_1', amount: 49_900, currency: 'INR', status: 'created', created_at: 0 });
  };
  const client = new RazorpayClient({ keyId: 'k', keySecret: 's', fetchImpl: fetchImpl as typeof fetch });
  const order = await client.fetchOrder('order_1');
  assert.equal(capturedUrl, 'https://api.razorpay.com/v1/orders/order_1');
  assert.equal(capturedMethod, 'GET');
  assert.equal(order.id, 'order_1');
  assert.equal(order.amount, 49_900);
  assert.equal(order.currency, 'INR');
  assert.equal(order.status, 'created');
});

test('fetchOrderPayments issues a GET against /orders/:id/payments', async () => {
  let capturedUrl = '';
  let capturedMethod = '';
  const fetchImpl = async (url: string | URL, init?: RequestInit) => {
    capturedUrl = String(url);
    capturedMethod = init?.method || 'GET';
    return jsonResponse(200, { items: [{ id: 'pay_1', order_id: 'order_1', status: 'captured', amount: 49_900, currency: 'INR', created_at: 0 }] });
  };
  const client = new RazorpayClient({ keyId: 'k', keySecret: 's', fetchImpl: fetchImpl as typeof fetch });
  const result = await client.fetchOrderPayments('order_1');
  assert.equal(capturedUrl, 'https://api.razorpay.com/v1/orders/order_1/payments');
  assert.equal(capturedMethod, 'GET');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, 'pay_1');
});

test('fetchPayment issues a GET against /payments/:id', async () => {
  const fetchImpl = async () =>
    jsonResponse(200, { id: 'pay_1', order_id: 'order_1', status: 'captured', amount: 49_900, currency: 'INR', created_at: 0 });
  const client = new RazorpayClient({ keyId: 'k', keySecret: 's', fetchImpl: fetchImpl as typeof fetch });
  const payment = await client.fetchPayment('pay_1');
  assert.equal(payment.status, 'captured');
});

test('a non-ok response throws RazorpayApiError with the provider message and code, never the secret', async () => {
  const fetchImpl = async () =>
    jsonResponse(400, { error: { code: 'BAD_REQUEST_ERROR', description: 'Amount is invalid.' } });
  const client = new RazorpayClient({ keyId: 'k', keySecret: 'super_secret_value', fetchImpl: fetchImpl as typeof fetch });

  await assert.rejects(
    () => client.createOrder({ amount: 0, currency: 'INR', receipt: 'r1' }),
    (error: unknown) => {
      assert.ok(error instanceof RazorpayApiError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.providerCode, 'BAD_REQUEST_ERROR');
      assert.equal(error.message, 'Amount is invalid.');
      assert.doesNotMatch(error.message, /super_secret_value/);
      return true;
    },
  );
});

test('a network failure is wrapped as a RazorpayApiError, not a raw exception', async () => {
  const fetchImpl = async () => {
    throw new Error('ECONNREFUSED');
  };
  const client = new RazorpayClient({ keyId: 'k', keySecret: 's', fetchImpl: fetchImpl as typeof fetch });
  await assert.rejects(
    () => client.fetchPayment('pay_1'),
    (error: unknown) => {
      assert.ok(error instanceof RazorpayApiError);
      assert.doesNotMatch(error.message, /ECONNREFUSED/);
      return true;
    },
  );
});

test('a request exceeding the configured timeout aborts and throws a 504 RazorpayApiError', async () => {
  const fetchImpl = (_url: string | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const abortError = new Error('The operation was aborted.');
        abortError.name = 'AbortError';
        reject(abortError);
      });
    });
  const client = new RazorpayClient({ keyId: 'k', keySecret: 's', timeoutMs: 20, fetchImpl: fetchImpl as typeof fetch });
  await assert.rejects(
    () => client.fetchPayment('pay_1'),
    (error: unknown) => {
      assert.ok(error instanceof RazorpayApiError);
      assert.equal(error.statusCode, 504);
      return true;
    },
  );
});

test('the constructor rejects a missing keyId or keySecret', () => {
  assert.throws(() => new RazorpayClient({ keyId: '', keySecret: 's' }));
  assert.throws(() => new RazorpayClient({ keyId: 'k', keySecret: '' }));
});
