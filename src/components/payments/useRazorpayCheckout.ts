// On-demand loader for the Razorpay Checkout.js script. Deliberately NOT
// added to index.html — it should only ever be fetched when a signed-in
// user actually opens a checkout dialog, not on every page load. The
// promise is memoized at module scope so concurrent/repeated calls (e.g.
// re-opening the dialog) never inject the script twice.
//
// This module only loads the script and reports readiness/failure. Opening
// the actual Checkout UI (`new window.Razorpay(options).open()`) is Phase
// 3B's CheckoutDialog — kept out of this hook so the loader stays testable
// in isolation.
import { useCallback, useEffect, useRef, useState } from 'react';

export const RAZORPAY_CHECKOUT_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

// Minimal shape of the global Razorpay constructor Checkout.js attaches to
// `window`. Only the pieces Lumora actually uses are typed here.
export interface RazorpayInstance {
  open: () => void;
  close: () => void;
  on: (event: 'payment.failed', handler: (response: { error: { code?: string; description: string } }) => void) => void;
}

export interface RazorpayCheckoutOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

let checkoutScriptPromise: Promise<void> | null = null;

// Resolves once window.Razorpay is available; rejects with a real,
// user-presentable message on script-load failure (ad blocker, offline,
// CSP, etc.) rather than leaving callers to guess from a generic event.
export function loadRazorpayCheckoutScript(): Promise<void> {
  if (typeof window !== 'undefined' && window.Razorpay) {
    return Promise.resolve();
  }
  if (checkoutScriptPromise) {
    return checkoutScriptPromise;
  }

  checkoutScriptPromise = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Razorpay Checkout can only be loaded in a browser.'));
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_CHECKOUT_SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Could not load the payment gateway. Disable your ad-blocker and try again.')),
        { once: true },
      );
      // The script tag may already have finished loading before this
      // effect ran (e.g. a second dialog open) — check window.Razorpay
      // again rather than waiting forever on an event that already fired.
      if (window.Razorpay) resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_CHECKOUT_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) resolve();
      else reject(new Error('Could not load the payment gateway. Please try again.'));
    };
    script.onerror = () => {
      reject(new Error('Could not load the payment gateway. Disable your ad-blocker and try again.'));
    };
    document.head.appendChild(script);
  });

  // On failure, clear the memoized promise so a later retry attempts a
  // fresh load instead of replaying the same rejection forever.
  checkoutScriptPromise.catch(() => {
    checkoutScriptPromise = null;
  });

  return checkoutScriptPromise;
}

export type RazorpayLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseRazorpayCheckoutResult {
  status: RazorpayLoadStatus;
  error: string | null;
  ensureLoaded: () => Promise<boolean>;
}

// React hook wrapper: exposes load status and an idempotent ensureLoaded()
// callers can await before constructing `new window.Razorpay(...)`.
export function useRazorpayCheckout(): UseRazorpayCheckoutResult {
  const [status, setStatus] = useState<RazorpayLoadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const ensureLoaded = useCallback(async (): Promise<boolean> => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      setStatus('ready');
      setError(null);
      return true;
    }
    setStatus('loading');
    setError(null);
    try {
      await loadRazorpayCheckoutScript();
      if (!mountedRef.current) return true;
      setStatus('ready');
      return true;
    } catch (loadError) {
      if (!mountedRef.current) return false;
      const message = loadError instanceof Error ? loadError.message : 'Could not load the payment gateway.';
      setStatus('error');
      setError(message);
      return false;
    }
  }, []);

  return { status, error, ensureLoaded };
}
