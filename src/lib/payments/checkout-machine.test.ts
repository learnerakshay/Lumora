import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INITIAL_CHECKOUT_MACHINE_STATE,
  TERMINAL_STATES,
  checkoutReducer,
  isTerminalState,
  type CheckoutMachineState,
  type CheckoutState,
} from './checkout-machine';

function send(machine: CheckoutMachineState, event: Parameters<typeof checkoutReducer>[1]): CheckoutMachineState {
  return checkoutReducer(machine, event);
}

test('starts idle with an empty context', () => {
  assert.equal(INITIAL_CHECKOUT_MACHINE_STATE.state, 'idle');
  assert.equal(INITIAL_CHECKOUT_MACHINE_STATE.context.plan, null);
  assert.equal(INITIAL_CHECKOUT_MACHINE_STATE.context.orderId, null);
});

test('full happy path: idle -> creating_order -> gateway_opening -> awaiting_payment -> verifying -> activating -> success', () => {
  let m = INITIAL_CHECKOUT_MACHINE_STATE;
  m = send(m, { type: 'START', plan: 'CORE', couponCode: 'LAUNCH50' });
  assert.equal(m.state, 'creating_order');
  assert.equal(m.context.plan, 'CORE');
  assert.equal(m.context.couponCode, 'LAUNCH50');

  m = send(m, { type: 'ORDER_CREATED', orderId: 'order_abc', amount: 49900, currency: 'INR' });
  assert.equal(m.state, 'gateway_opening');
  assert.equal(m.context.orderId, 'order_abc');
  assert.equal(m.context.amount, 49900);

  m = send(m, { type: 'GATEWAY_READY' });
  assert.equal(m.state, 'awaiting_payment');

  m = send(m, { type: 'RAZORPAY_SUCCESS', paymentId: 'pay_xyz' });
  assert.equal(m.state, 'verifying');
  assert.equal(m.context.paymentId, 'pay_xyz');

  m = send(m, { type: 'VERIFY_OK' });
  assert.equal(m.state, 'activating');

  m = send(m, { type: 'ACTIVATED' });
  assert.equal(m.state, 'success');
});

test('every non-terminal state has at least one transition that reaches a success-direction state and one that reaches failure/recovery', () => {
  // idle only ever moves forward via START -> creating_order; treat that as
  // its single required exit (there is nothing to fail yet).
  const nonTerminalExpectations: Record<
    'creating_order' | 'gateway_opening' | 'awaiting_payment' | 'verifying' | 'activating',
    { success: CheckoutState; recovery: CheckoutState }
  > = {
    creating_order: { success: 'gateway_opening', recovery: 'failed' },
    gateway_opening: { success: 'awaiting_payment', recovery: 'failed' },
    awaiting_payment: { success: 'verifying', recovery: 'failed' },
    verifying: { success: 'activating', recovery: 'failed' },
    activating: { success: 'success', recovery: 'failed' },
  };

  const base = send(INITIAL_CHECKOUT_MACHINE_STATE, { type: 'START', plan: 'CORE' });
  assert.equal(base.state, 'creating_order');

  {
    const ok = send(base, { type: 'ORDER_CREATED', orderId: 'o', amount: 1, currency: 'INR' });
    assert.equal(ok.state, nonTerminalExpectations.creating_order.success);
    const fail = send(base, { type: 'ORDER_FAILED', code: 'X', message: 'x' });
    assert.equal(fail.state, nonTerminalExpectations.creating_order.recovery);
  }

  const atGatewayOpening = send(base, { type: 'ORDER_CREATED', orderId: 'o', amount: 1, currency: 'INR' });
  {
    const ok = send(atGatewayOpening, { type: 'GATEWAY_READY' });
    assert.equal(ok.state, nonTerminalExpectations.gateway_opening.success);
    const fail = send(atGatewayOpening, { type: 'GATEWAY_LOAD_FAILED', message: 'no script' });
    assert.equal(fail.state, nonTerminalExpectations.gateway_opening.recovery);
  }

  const atAwaitingPayment = send(atGatewayOpening, { type: 'GATEWAY_READY' });
  {
    const ok = send(atAwaitingPayment, { type: 'RAZORPAY_SUCCESS', paymentId: 'p' });
    assert.equal(ok.state, nonTerminalExpectations.awaiting_payment.success);
    const fail = send(atAwaitingPayment, { type: 'RAZORPAY_FAILED', message: 'declined' });
    assert.equal(fail.state, nonTerminalExpectations.awaiting_payment.recovery);
    const dismissed = send(atAwaitingPayment, { type: 'DISMISSED' });
    assert.equal(dismissed.state, 'dismissed');
  }

  const atVerifying = send(atAwaitingPayment, { type: 'RAZORPAY_SUCCESS', paymentId: 'p' });
  {
    const ok = send(atVerifying, { type: 'VERIFY_OK' });
    assert.equal(ok.state, nonTerminalExpectations.verifying.success);
    const fail = send(atVerifying, { type: 'VERIFY_FAILED', code: 'PAYMENT_SIGNATURE_INVALID', message: 'bad sig' });
    assert.equal(fail.state, nonTerminalExpectations.verifying.recovery);
    const notCaptured = send(atVerifying, { type: 'VERIFY_NOT_CAPTURED', message: 'not captured yet' });
    assert.equal(notCaptured.state, 'awaiting_bank_confirmation');
  }

  const atActivating = send(atVerifying, { type: 'VERIFY_OK' });
  {
    const ok = send(atActivating, { type: 'ACTIVATED' });
    assert.equal(ok.state, nonTerminalExpectations.activating.success);
    const fail = send(atActivating, { type: 'VERIFY_FAILED', code: 'ACCESS_REFRESH_FAILED', message: 'refresh failed' });
    assert.equal(fail.state, nonTerminalExpectations.activating.recovery);
  }
});

test('dismissed is a distinct terminal state, never routed through failed', () => {
  let m = send(INITIAL_CHECKOUT_MACHINE_STATE, { type: 'START', plan: 'MAX' });
  m = send(m, { type: 'ORDER_CREATED', orderId: 'o', amount: 1, currency: 'INR' });
  m = send(m, { type: 'GATEWAY_READY' });
  m = send(m, { type: 'DISMISSED' });
  assert.equal(m.state, 'dismissed');
  assert.notEqual(m.state, 'failed');
  // Dismissal must not carry an error code — the UI must not say "payment
  // failed" for a user who simply closed the window.
  assert.equal(m.context.errorCode, null);
});

test('awaiting_bank_confirmation is recoverable, not a dead end', () => {
  let m = send(INITIAL_CHECKOUT_MACHINE_STATE, { type: 'START', plan: 'CORE' });
  m = send(m, { type: 'ORDER_CREATED', orderId: 'o', amount: 1, currency: 'INR' });
  m = send(m, { type: 'GATEWAY_READY' });
  m = send(m, { type: 'RAZORPAY_SUCCESS', paymentId: 'p' });
  m = send(m, { type: 'VERIFY_NOT_CAPTURED', message: 'awaiting bank confirmation' });
  assert.equal(m.state, 'awaiting_bank_confirmation');

  const retried = send(m, { type: 'RETRY' });
  assert.equal(retried.state, 'idle');

  const laterCaptured = send(m, { type: 'VERIFY_OK' });
  assert.equal(laterCaptured.state, 'activating');
});

test('every terminal state can return to idle via RETRY or RESET', () => {
  for (const terminal of TERMINAL_STATES) {
    const machine: CheckoutMachineState = { state: terminal, context: { ...INITIAL_CHECKOUT_MACHINE_STATE.context } };
    const viaReset = checkoutReducer(machine, { type: 'RESET' });
    assert.equal(viaReset.state, 'idle', `expected RESET from ${terminal} to reach idle`);
  }
});

test('isTerminalState / TERMINAL_STATES agree on exactly the four terminal states', () => {
  assert.deepEqual(new Set(TERMINAL_STATES), new Set(['success', 'failed', 'dismissed', 'awaiting_bank_confirmation']));
  for (const state of TERMINAL_STATES) assert.equal(isTerminalState(state), true);
  assert.equal(isTerminalState('idle'), false);
  assert.equal(isTerminalState('verifying'), false);
});

test('every reachable state has at least one outgoing transition defined (no accidental dead ends)', () => {
  // idle is entered fresh, so its only required exit is START (already
  // covered above). Assert every OTHER state has at least one transition.
  const ALL_STATES: CheckoutState[] = [
    'idle',
    'creating_order',
    'gateway_opening',
    'awaiting_payment',
    'verifying',
    'activating',
    'success',
    'failed',
    'dismissed',
    'awaiting_bank_confirmation',
  ];
  for (const state of ALL_STATES) {
    const machine: CheckoutMachineState = { state, context: { ...INITIAL_CHECKOUT_MACHINE_STATE.context } };
    // Fire every known event type against this state and confirm at least
    // one produces a state transition (i.e. is not silently ignored).
    const eventsToTry: Parameters<typeof checkoutReducer>[1][] = [
      { type: 'START', plan: 'CORE' },
      { type: 'ORDER_CREATED', orderId: 'o', amount: 1, currency: 'INR' },
      { type: 'ORDER_FAILED', code: 'X', message: 'x' },
      { type: 'GATEWAY_READY' },
      { type: 'GATEWAY_LOAD_FAILED', message: 'x' },
      { type: 'RAZORPAY_SUCCESS', paymentId: 'p' },
      { type: 'RAZORPAY_FAILED', message: 'x' },
      { type: 'DISMISSED' },
      { type: 'VERIFY_OK' },
      { type: 'VERIFY_FAILED', code: 'X', message: 'x' },
      { type: 'VERIFY_NOT_CAPTURED', message: 'x' },
      { type: 'ACTIVATED' },
      { type: 'RESET' },
      { type: 'RETRY' },
    ];
    const anyTransition = eventsToTry.some((event) => checkoutReducer(machine, event).state !== state);
    assert.ok(anyTransition, `state "${state}" has no outgoing transition at all`);
  }
});

test('unhandled events are a no-op, not a crash', () => {
  const m = INITIAL_CHECKOUT_MACHINE_STATE;
  const unchanged = checkoutReducer(m, { type: 'VERIFY_OK' });
  assert.equal(unchanged.state, 'idle');
  assert.equal(unchanged, m);
});

test('starting a new checkout resets stale context from a previous attempt', () => {
  let m = send(INITIAL_CHECKOUT_MACHINE_STATE, { type: 'START', plan: 'CORE' });
  m = send(m, { type: 'ORDER_CREATED', orderId: 'order_1', amount: 49900, currency: 'INR' });
  assert.equal(m.context.orderId, 'order_1');

  m = send(m, { type: 'GATEWAY_READY' });
  m = send(m, { type: 'RAZORPAY_FAILED', message: 'declined' });
  assert.equal(m.state, 'failed');

  // Retry then start again for a fresh attempt — the new order must not
  // inherit the previous order's id (every attempt uses a fresh order).
  m = send(m, { type: 'RETRY' });
  assert.equal(m.state, 'idle');
  m = send(m, { type: 'START', plan: 'CORE' });
  assert.equal(m.context.orderId, null);
  assert.equal(m.context.errorCode, null);
});
