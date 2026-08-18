// Pure checkout state machine for the Phase 3 payment UI. No React, no
// fetch, no Razorpay SDK reference — this module only describes legal
// transitions so the UI can never render a stuck or ambiguous state.
//
// Every non-terminal state has an explicit exit for both its success path
// and its failure/recovery path. `dismissed` is a distinct terminal state,
// never routed through `failed` — closing the Razorpay modal is not a
// payment failure, and the UI must not tell the user their payment failed
// when they simply closed the window.
import type { PaidPlan } from './config';

export type CheckoutState =
  | 'idle'
  | 'creating_order'
  | 'gateway_opening'
  | 'awaiting_payment'
  | 'verifying'
  | 'activating'
  | 'success'
  | 'failed'
  | 'dismissed'
  | 'awaiting_bank_confirmation';

export const TERMINAL_STATES: readonly CheckoutState[] = [
  'success',
  'failed',
  'dismissed',
  'awaiting_bank_confirmation',
];

export function isTerminalState(state: CheckoutState): boolean {
  return (TERMINAL_STATES as readonly CheckoutState[]).includes(state);
}

export interface CheckoutContext {
  plan: PaidPlan | null;
  couponCode: string | null;
  orderId: string | null;
  amount: number | null; // paise, server-authoritative
  currency: string | null;
  paymentId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export const INITIAL_CHECKOUT_CONTEXT: CheckoutContext = {
  plan: null,
  couponCode: null,
  orderId: null,
  amount: null,
  currency: null,
  paymentId: null,
  errorCode: null,
  errorMessage: null,
};

export type CheckoutEvent =
  | { type: 'START'; plan: PaidPlan; couponCode?: string | null }
  | { type: 'ORDER_CREATED'; orderId: string; amount: number; currency: string }
  | { type: 'ORDER_FAILED'; code: string; message: string }
  | { type: 'GATEWAY_READY' }
  | { type: 'GATEWAY_LOAD_FAILED'; message: string }
  | { type: 'RAZORPAY_SUCCESS'; paymentId: string }
  | { type: 'RAZORPAY_FAILED'; code?: string; message: string }
  | { type: 'DISMISSED' }
  | { type: 'VERIFY_OK' }
  | { type: 'VERIFY_FAILED'; code: string; message: string }
  | { type: 'VERIFY_NOT_CAPTURED'; message: string }
  | { type: 'ACTIVATED' }
  | { type: 'RESET' }
  | { type: 'RETRY' };

export interface CheckoutMachineState {
  state: CheckoutState;
  context: CheckoutContext;
}

export const INITIAL_CHECKOUT_MACHINE_STATE: CheckoutMachineState = {
  state: 'idle',
  context: INITIAL_CHECKOUT_CONTEXT,
};

// A single explicit transition table keeps "every state has a defined
// exit" verifiable by inspection (and by the accompanying test) rather
// than scattered across an if/else chain.
const TRANSITIONS: Record<CheckoutState, Partial<Record<CheckoutEvent['type'], CheckoutState>>> = {
  idle: {
    START: 'creating_order',
  },
  creating_order: {
    ORDER_CREATED: 'gateway_opening',
    ORDER_FAILED: 'failed',
    RESET: 'idle',
  },
  gateway_opening: {
    GATEWAY_READY: 'awaiting_payment',
    GATEWAY_LOAD_FAILED: 'failed',
    RESET: 'idle',
  },
  awaiting_payment: {
    RAZORPAY_SUCCESS: 'verifying',
    RAZORPAY_FAILED: 'failed',
    DISMISSED: 'dismissed',
    RESET: 'idle',
  },
  verifying: {
    VERIFY_OK: 'activating',
    VERIFY_FAILED: 'failed',
    VERIFY_NOT_CAPTURED: 'awaiting_bank_confirmation',
  },
  activating: {
    ACTIVATED: 'success',
    // If activation itself throws (e.g. the access refresh network call
    // fails after a verified capture), the payment already succeeded
    // server-side — VERIFY_FAILED here still routes to `failed`, but the
    // caller must surface it as "payment succeeded, refreshing your access
    // failed" rather than "payment failed". The machine only guarantees a
    // defined exit; the UI copy for this specific transition carries that
    // nuance.
    VERIFY_FAILED: 'failed',
  },
  success: {
    RESET: 'idle',
  },
  failed: {
    RETRY: 'idle',
    RESET: 'idle',
  },
  dismissed: {
    RETRY: 'idle',
    RESET: 'idle',
  },
  awaiting_bank_confirmation: {
    RETRY: 'idle',
    VERIFY_OK: 'activating',
    VERIFY_FAILED: 'failed',
    RESET: 'idle',
  },
};

function nextContext(context: CheckoutContext, event: CheckoutEvent): CheckoutContext {
  switch (event.type) {
    case 'START':
      return {
        ...INITIAL_CHECKOUT_CONTEXT,
        plan: event.plan,
        couponCode: event.couponCode ?? null,
      };
    case 'ORDER_CREATED':
      return { ...context, orderId: event.orderId, amount: event.amount, currency: event.currency };
    case 'ORDER_FAILED':
      return { ...context, errorCode: event.code, errorMessage: event.message };
    case 'GATEWAY_LOAD_FAILED':
      return { ...context, errorCode: 'GATEWAY_LOAD_FAILED', errorMessage: event.message };
    case 'RAZORPAY_SUCCESS':
      return { ...context, paymentId: event.paymentId, errorCode: null, errorMessage: null };
    case 'RAZORPAY_FAILED':
      return { ...context, errorCode: event.code ?? 'RAZORPAY_FAILED', errorMessage: event.message };
    case 'VERIFY_FAILED':
      return { ...context, errorCode: event.code, errorMessage: event.message };
    case 'VERIFY_NOT_CAPTURED':
      return { ...context, errorMessage: event.message };
    case 'RESET':
      return INITIAL_CHECKOUT_CONTEXT;
    default:
      return context;
  }
}

export function checkoutReducer(
  current: CheckoutMachineState,
  event: CheckoutEvent,
): CheckoutMachineState {
  const nextState = TRANSITIONS[current.state]?.[event.type];
  if (!nextState) {
    // Unhandled event for this state: state is left unchanged. This is a
    // deliberate no-op, not a crash — e.g. a stray DISMISSED after the
    // dialog already reached `success` must not corrupt the finished flow.
    return current;
  }
  return { state: nextState, context: nextContext(current.context, event) };
}
