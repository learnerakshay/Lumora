import { Router, Request, Response } from 'express';
import { requireApiAuth } from '../lib/auth';
import { AppError } from '../lib/errors';
import { successResponse, errorResponse } from '../lib/api-response';
import { logger } from '../lib/logger';
import { getServerEnv } from '../lib/env';
import { PLAN_LIMITS } from '../lib/usage/config';
import {
  isPaidPlan,
  launchAmountFor,
  listAmountFor,
  PAID_PLANS,
  type PaidPlan,
} from '../lib/payments/config';
import { capturePayment } from '../lib/payments/capture-service';
import { validateCoupon, type CouponValidationResult } from '../lib/payments/coupon';
import { findCouponByCode } from '../lib/payments/coupon-store';
import { syncUserEntitlement } from '../lib/payments/entitlement-sync';
import {
  countUserCapturedCouponRedemptions,
  createPendingPayment,
  getPaymentByOrderId,
  getPaymentHistoryForUser,
} from '../lib/payments/payment-store';
import { RazorpayApiError, RazorpayClient } from '../lib/payments/razorpay-client';
import { verifyOrderSignature } from '../lib/payments/signature';

export const paymentsRouter = Router();

paymentsRouter.use(requireApiAuth);

function requirePaymentsEnabled(): { keyId: string; keySecret: string; currency: string } {
  const env = getServerEnv();
  if (!env.PAYMENTS_ENABLED || !env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new AppError('Payments are not currently available.', 503, 'PAYMENTS_DISABLED');
  }
  return { keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET, currency: env.PAYMENTS_CURRENCY };
}

paymentsRouter.get('/config', (_req: Request, res: Response) => {
  const env = getServerEnv();
  const paymentsEnabled = Boolean(env.PAYMENTS_ENABLED && env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
  return res.status(200).json(
    successResponse({
      keyId: paymentsEnabled ? env.RAZORPAY_KEY_ID : null,
      currency: env.PAYMENTS_CURRENCY,
      paymentsEnabled,
    }),
  );
});

paymentsRouter.get('/plans', (_req: Request, res: Response) => {
  const env = getServerEnv();
  const plans = PAID_PLANS.map((plan) => ({
    plan,
    launchAmount: launchAmountFor(plan),
    listAmount: listAmountFor(plan),
    currency: env.PAYMENTS_CURRENCY,
    limits: PLAN_LIMITS[plan],
  }));
  return res.status(200).json(successResponse({ plans, freeLimits: PLAN_LIMITS.FREE }));
});

paymentsRouter.get('/access', async (_req: Request, res: Response) => {
  const userId = res.locals.userId;
  try {
    const entitlement = await syncUserEntitlement(userId, 'ACCESS_REFRESH');
    return res.status(200).json(
      successResponse({
        plan: entitlement.plan,
        planExpiresAt: entitlement.planExpiresAt ? entitlement.planExpiresAt.toISOString() : null,
      }),
    );
  } catch (error) {
    logger.error('Failed to resolve access', error, { userId });
    const response = errorResponse(new Error('Failed to resolve access'));
    return res.status(response.statusCode).json(response.payload);
  }
});

// Body: { plan: 'CORE' | 'MAX', couponCode?: string } ONLY. The amount is
// always resolved server-side from config — this handler must never read
// amount/price/currency off the request body.
paymentsRouter.post('/order', async (req: Request, res: Response) => {
  const userId = res.locals.userId;
  try {
    const { keyId, keySecret, currency } = requirePaymentsEnabled();

    const requestedPlan = typeof req.body?.plan === 'string' ? req.body.plan.trim().toUpperCase() : '';
    if (!isPaidPlan(requestedPlan)) {
      const response = errorResponse(AppError.badRequest('plan must be CORE or MAX.', 'PAYMENT_INVALID_PLAN'));
      return res.status(response.statusCode).json(response.payload);
    }
    const plan = requestedPlan as PaidPlan;

    const baseAmount = launchAmountFor(plan);
    let finalAmount = baseAmount;
    let discountAmount = 0;
    let couponId: string | null = null;

    const rawCouponCode = typeof req.body?.couponCode === 'string' ? req.body.couponCode.trim() : '';
    if (rawCouponCode) {
      const coupon = await findCouponByCode(rawCouponCode);
      const userRedemptions = coupon ? await countUserCapturedCouponRedemptions(userId, coupon.id) : 0;
      const validation: CouponValidationResult = validateCoupon({
        coupon,
        plan,
        amount: baseAmount,
        userCapturedRedemptions: userRedemptions,
        now: new Date(),
      });
      if (validation.valid === true) {
        finalAmount = validation.finalAmount;
        discountAmount = validation.discountAmount;
        couponId = coupon!.id;
      } else {
        const response = errorResponse(new AppError(validation.message, 400, validation.code));
        return res.status(response.statusCode).json(response.payload);
      }
    }

    const client = new RazorpayClient({ keyId, keySecret });
    const receipt = `lumora-${plan.toLowerCase()}-${Date.now()}`;
    const order = await client.createOrder({
      amount: finalAmount,
      currency,
      receipt,
      notes: { userId, plan },
    });

    await createPendingPayment({
      userId,
      plan,
      providerOrderId: order.id,
      amount: finalAmount,
      discountAmount,
      currency,
      couponId,
    });

    return res.status(201).json(
      successResponse({ orderId: order.id, amount: finalAmount, currency, keyId, plan }),
    );
  } catch (error) {
    if (error instanceof RazorpayApiError) {
      logger.error('Razorpay order creation failed', error, { userId });
      const response = errorResponse(
        new AppError('Could not start the payment. Please try again.', 502, 'PAYMENT_ORDER_CREATE_FAILED'),
      );
      return res.status(response.statusCode).json(response.payload);
    }
    logger.error('Order creation failed', error, { userId });
    const response = errorResponse(error);
    return res.status(response.statusCode).json(response.payload);
  }
});

// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature } ONLY.
// Verifies the HMAC, re-reads the payment directly from Razorpay (never
// trusts the signature alone), then grants access through the same
// capturePayment routine the webhook uses.
paymentsRouter.post('/order/verify', async (req: Request, res: Response) => {
  const userId = res.locals.userId;
  try {
    const { keyId, keySecret } = requirePaymentsEnabled();

    const orderId = typeof req.body?.razorpay_order_id === 'string' ? req.body.razorpay_order_id : '';
    const paymentId = typeof req.body?.razorpay_payment_id === 'string' ? req.body.razorpay_payment_id : '';
    const signature = typeof req.body?.razorpay_signature === 'string' ? req.body.razorpay_signature : '';
    if (!orderId || !paymentId || !signature) {
      const response = errorResponse(
        AppError.badRequest('Missing payment verification fields.', 'PAYMENT_VERIFY_FIELDS_MISSING'),
      );
      return res.status(response.statusCode).json(response.payload);
    }

    const payment = await getPaymentByOrderId(orderId);
    if (!payment || payment.userId !== userId) {
      const response = errorResponse(
        AppError.notFound('This order was not found for your account.', 'PAYMENT_ORDER_NOT_FOUND'),
      );
      return res.status(response.statusCode).json(response.payload);
    }

    const signatureValid = verifyOrderSignature({ orderId, paymentId, signature, keySecret });
    if (!signatureValid) {
      logger.warn('Order verify signature mismatch', { userId, orderId });
      const response = errorResponse(new AppError('Payment verification failed.', 400, 'PAYMENT_SIGNATURE_INVALID'));
      return res.status(response.statusCode).json(response.payload);
    }

    const client = new RazorpayClient({ keyId, keySecret });
    const providerPayment = await client.fetchPayment(paymentId);
    if (providerPayment.order_id !== orderId) {
      logger.error('Provider payment order_id does not match the verified order', undefined, {
        userId,
        orderId,
        paymentId,
      });
      const response = errorResponse(new AppError('Payment verification failed.', 400, 'PAYMENT_ORDER_MISMATCH'));
      return res.status(response.statusCode).json(response.payload);
    }
    if (providerPayment.status !== 'captured' && providerPayment.status !== 'authorized') {
      const response = errorResponse(
        new AppError(`Payment is not complete (status: ${providerPayment.status}).`, 409, 'PAYMENT_NOT_CAPTURED'),
      );
      return res.status(response.statusCode).json(response.payload);
    }

    const result = await capturePayment({
      providerOrderId: orderId,
      providerPaymentId: paymentId,
      method: providerPayment.method ?? null,
      signatureVerified: true,
      reason: 'PAYMENT_VERIFIED',
    });

    if (!result.entitlement) {
      const response = errorResponse(
        AppError.notFound('This order was not found for your account.', 'PAYMENT_ORDER_NOT_FOUND'),
      );
      return res.status(response.statusCode).json(response.payload);
    }

    return res.status(200).json(
      successResponse({
        captured: result.captured,
        plan: result.entitlement.plan,
        planExpiresAt: result.entitlement.planExpiresAt ? result.entitlement.planExpiresAt.toISOString() : null,
      }),
    );
  } catch (error) {
    if (error instanceof RazorpayApiError) {
      logger.error('Razorpay payment lookup failed during verify', error, { userId });
      const response = errorResponse(
        new AppError('Could not verify payment right now. Please try again.', 502, 'PAYMENT_VERIFY_LOOKUP_FAILED'),
      );
      return res.status(response.statusCode).json(response.payload);
    }
    logger.error('Payment verification failed', error, { userId });
    const response = errorResponse(error);
    return res.status(response.statusCode).json(response.payload);
  }
});

// Recovers from a dropped webhook (and a dropped /verify call): if the
// caller names an order still stuck in CREATED, re-reads it directly from
// Razorpay before falling back to a plain resync. Body: { orderId?: string }.
paymentsRouter.post('/access/refresh', async (req: Request, res: Response) => {
  const userId = res.locals.userId;
  try {
    const { keyId, keySecret } = requirePaymentsEnabled();
    const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId : '';

    let entitlement = null;
    if (orderId) {
      const payment = await getPaymentByOrderId(orderId);
      if (payment && payment.userId === userId && payment.status === 'CREATED') {
        const client = new RazorpayClient({ keyId, keySecret });
        const { items } = await client.fetchOrderPayments(orderId);
        const capturedPayment = items.find((item) => item.status === 'captured');
        if (capturedPayment) {
          const result = await capturePayment({
            providerOrderId: orderId,
            providerPaymentId: capturedPayment.id,
            method: capturedPayment.method ?? null,
            signatureVerified: false, // recovered via authoritative read, not a signed callback
            reason: 'ACCESS_REFRESH',
          });
          entitlement = result.entitlement ?? null;
        }
      }
    }
    if (!entitlement) {
      entitlement = await syncUserEntitlement(userId, 'ACCESS_REFRESH');
    }

    return res.status(200).json(
      successResponse({
        plan: entitlement.plan,
        planExpiresAt: entitlement.planExpiresAt ? entitlement.planExpiresAt.toISOString() : null,
      }),
    );
  } catch (error) {
    if (error instanceof RazorpayApiError) {
      logger.error('Razorpay lookup failed during access refresh', error, { userId });
      const response = errorResponse(
        new AppError('Could not check payment status right now. Please try again.', 502, 'PAYMENT_REFRESH_LOOKUP_FAILED'),
      );
      return res.status(response.statusCode).json(response.payload);
    }
    logger.error('Access refresh failed', error, { userId });
    const response = errorResponse(error);
    return res.status(response.statusCode).json(response.payload);
  }
});

paymentsRouter.get('/payments', async (_req: Request, res: Response) => {
  const userId = res.locals.userId;
  try {
    const history = await getPaymentHistoryForUser(userId);
    return res.status(200).json(successResponse({ payments: history }));
  } catch (error) {
    logger.error('Failed to fetch payment history', error, { userId });
    const response = errorResponse(new Error('Failed to retrieve payment history'));
    return res.status(response.statusCode).json(response.payload);
  }
});
