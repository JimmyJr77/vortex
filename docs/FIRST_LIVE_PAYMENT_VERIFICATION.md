# First Live Payment Verification

Use this procedure for the first legitimate customer payment. Do not manufacture a production charge merely to satisfy this check.

## Capture

- Customer/family and athlete
- Program, class, and enrollment type
- Stripe PaymentIntent and Checkout Session IDs
- Amount and currency
- GA4 transaction ID
- Google Ads campaign/click context, when present

## Verify the payment lifecycle

1. Stripe reports the PaymentIntent as succeeded in live mode.
2. The webhook delivery reports success and is processed exactly once.
3. The local `billing_payment` record has the same PaymentIntent, amount, currency context, and family account.
4. The associated enrollment/subscription is active with the expected paid-period dates.
5. The customer receives one payment/enrollment receipt whose Reply-To is `billing@vortexathletics.com`.
6. The daily or manual reconciliation reports no amount mismatch or unmapped-payment alert.

## Verify analytics and advertising

1. GA4 property `539662954` receives one `purchase` event.
2. The event uses the Stripe-backed transaction ID and correct value/currency.
3. Program, class, enrollment type, athlete context, source, campaign, and landing-page parameters are present where applicable.
4. GA4 does not receive a duplicate purchase when the success page reloads or the webhook is replayed.
5. The designated Google Ads conversion imports/receives the purchase and retains the originating campaign attribution when a Google Ads click initiated the enrollment.

## Sign-off

Record the verification date, staff reviewer, transaction identifiers, findings, and any corrective action in `BILLING_REQUIREMENTS_LOG.md`. Avoid recording card data or other sensitive payment credentials.
