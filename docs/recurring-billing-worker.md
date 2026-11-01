# Recurring billing worker recovery

The daily job reconciles existing Stripe payments before running the account sweep. Automatic collection remains limited to the first and fourth in each facility's timezone. Deploying this change does not run collection.

The worker handles both idle-pool and checked-out PostgreSQL connection errors. A failed connection is permanently marked unusable and discarded. The current callback must finish before recovery starts; it is never abandoned through a promise race. Monthly invoice creation, finalization, voiding, item creation, and payment dispatch check connection health immediately before the Stripe mutation.

A connection failure in the collection sweep gets one recovery attempt on a fresh account lock. Before processing again, the worker verifies existing monthly invoices against Stripe and records any successful payment. Existing invoice state, payment reservations, and Stripe idempotency keys still control collection. Unknown payment outcomes remain blocked. An ordinary decline or accounting hold does not trigger this connection-recovery retry. A second connection failure records the account hold and allows later accounts to proceed, provided progress can still be saved.

Migration `839_recurring_billing_progress.sql` adds operational tables only. Each run records its complete active-account inventory before preparation starts, then saves preparation, collection, and enrollment-recovery progress per account. Progress writes are idempotent and have bounded connection retries. If progress cannot be persisted, financial work stops. Normal completion cannot be recorded while pending or running accounts remain. A hard process kill leaves the last committed pending/running rows visible; a graceful shutdown marks the run interrupted after current work returns. A new run rechecks financial state rather than trusting a previous progress marker as proof of payment.

Inspect the latest five runs without making changes:

```sh
npm run billing:worker-status --prefix backend
```

`completed` on an account means its processing finished, not necessarily that money was received. The collection result's `invoiceOutcome.status` distinguishes paid, failed, and payment-method-required invoices. A run still marked running with an old `updated_at`, or any pending/running/retrying account, needs investigation against the scheduler and Stripe before recovery. The existing Stripe alerts receive account holds as they happen rather than only after the whole sweep.

Regression coverage includes real termination of a checked-out PostgreSQL test connection while no query is active, durable unfinished-account visibility across worker instances, bounded recovery and continued processing, failed progress writes blocking work, loss of the connection during the final Stripe check, and successful Stripe payment followed by database loss without a second charge. The PostgreSQL tests use only loopback disposable databases and synthetic accounts.
