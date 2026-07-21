# Vortex Billing Operations Policy

**Owner:** Vortex Athletics LLC

**Operational mailbox:** `billing@vortexathletics.com`

**Status:** Approved operating policy

**Effective date:** July 20, 2026

**Review cadence:** Annually and after any material billing-system or program-policy change

## 1. Purpose and scope

This document is the source of truth for payment recovery, refunds, cancellations, disputes, account access, and related customer communications across Vortex Athletics and Vortex Gymnastics. It applies to Stripe payments, recurring memberships, multi-month programs, registration and membership fees, camps, classes, and other paid services recorded in the Vortex billing ledger.

Financial questions, notices, alerts, and customer communications must be sent through `billing@vortexathletics.com`. Staff should not conduct financial matters through personal email accounts or informal messaging channels.

## 2. Roles and authority

### Owner or Administrator

Only an Owner or authorized Administrator may:

- approve or issue a full or partial refund;
- approve an exception to a nonrefundable fee or no-proration rule;
- approve account suspension following failed-payment recovery;
- approve a cancellation exception for a multi-month program;
- accept, contest, or settle a payment dispute; or
- approve an alternate refund method when the original payment method is unavailable.

### Staff

Staff may document requests, collect supporting information, communicate approved decisions, and recommend an action. Staff may not independently issue refunds, suspend billing access, or resolve disputes unless separately granted Owner/Admin authority.

## 3. Failed-payment recovery

1. Stripe Smart Retries is the authoritative retry schedule for failed recurring card payments.
2. The production configuration is eight retry attempts within fourteen days.
3. Stripe and Vortex customer notifications remain enabled during recovery. Customers must receive a direct path to update their payment method.
4. The member remains active during the Smart Retry period unless an Owner/Admin identifies fraud, safety concerns, or another exceptional reason for immediate action.
5. When the retry period is exhausted, staff must receive a billing alert with account, athlete, program, outstanding balance, last failure, and recovery-attempt information.
6. The alert must provide a quick action to **Suspend access**. Suspension is not automatic; a staff member reviews the account and intentionally selects the action.
7. The suspension action must record the acting user, timestamp, reason, affected enrollments, and customer-notification result.
8. Payment recovery or an Owner/Admin override restores access and must also be recorded.

## 4. Refund policy

### Approval

All refunds require Owner/Admin approval. The approval record must include:

- customer and family account;
- original payment;
- requested and approved amount;
- reason category and supporting notes;
- approving Owner/Admin;
- date of approval; and
- Stripe refund identifier and final status when applicable.

### Eligible exceptions

A refund may be considered for:

- a duplicate charge;
- cancellation of a class, program, or service by Vortex;
- a documented medical issue;
- documented relocation;
- an Owner-approved discretionary exception.

Eligibility permits review but does not guarantee approval.

### Nonrefundable items

Registration, membership, administrative, and processing fees are nonrefundable unless an Owner/Admin documents an explicit exception.

### Refund method

Card payments must be refunded to the original payment method. Checks, cash, credits in place of a refund, or other manual methods are prohibited unless the original payment method is unavailable and an Owner/Admin approves and documents the alternate method.

Refunds must never exceed the remaining refundable amount of the original payment. Partial refunds and prior refunds must be considered before approval.

## 5. Cancellation and proration

### Recurring memberships

- A cancellation request may be submitted at any time.
- The membership remains active through the end of the current paid billing period.
- Cancellation takes effect at the end of that paid period.
- No prorated refund is provided for the unused portion of the paid period, except for a documented, Owner/Admin-approved exception.
- The request and effective date must be recorded in the Billing dashboard.

### Multi-month programs

Multi-month programs require Billing review before cancellation. A request does not automatically cancel the remaining program commitment. Staff must route the request to the Billing dashboard, review the applicable program terms and documented circumstances, and record the approved outcome.

The system should treat all cancellation requests as reviewable Billing work items so staff can distinguish ordinary recurring memberships from multi-month commitments before changing enrollment or Stripe subscription state.

## 6. Missed classes

Missed-class accommodations are available only when approved by staff. A missed class does not automatically create a refund, account credit, makeup class, or extension.

Every reported missed class must be tracked on the athlete's user profile with:

- athlete and class;
- scheduled date;
- absence reason, when provided;
- date reported;
- reporting party;
- staff decision;
- approved accommodation, if any; and
- staff member and decision timestamp.

**Implementation decision pending:** the exact staff entry interface and attendance-to-profile workflow have not yet been selected. Until implemented, staff must record the information in the approved account-note mechanism and must not promise an accommodation before approval.

## 7. Disputes and chargebacks

1. All dispute notifications and financial correspondence must route to `billing@vortexathletics.com`.
2. Billing staff collect the enrollment agreement, signed waiver, attendance records, receipts, customer correspondence, cancellation history, and relevant policy acceptance.
3. An Owner/Admin owns the final dispute response and decision.
4. Disputes must be reviewed promptly against Stripe's response deadline; the internal target is to prepare the response at least two business days before that deadline.
5. Every dispute must remain an unresolved Billing alert until evidence is submitted or an Owner/Admin approves acceptance of the dispute.
6. The final result, financial impact, evidence submitted, and any account action must be recorded.

Opening a dispute does not automatically suspend an athlete. Any suspension requires Owner/Admin review under the same documented-control standard used for failed payments.

## 8. Customer communication standards

- Financial communications originate from or direct replies to `billing@vortexathletics.com`.
- Messages must state the amount, affected service, requested action, relevant date, and a clear support path.
- Sensitive payment credentials must never be requested by email, phone, or staff messaging. Customers update payment methods through the authenticated Vortex member portal or Stripe-hosted portal.
- Refund and cancellation communications must state the approved amount or effective date and whether access continues through a paid period.
- Customer communications and delivery results must be retained with the account or related Billing work item.

## 9. Required Billing dashboard workflows

The Billing dashboard should provide the following auditable work queues and actions:

1. **Failed recovery:** review details, contact customer, suspend access, record exception, or mark resolved.
2. **Cancellation request:** identify recurring versus multi-month terms, set end-of-paid-period cancellation, approve an exception, or deny with reason.
3. **Refund request:** select the original payment, validate refundable balance, record evidence, approve/deny, and issue the Stripe refund.
4. **Dispute:** display Stripe deadline, assemble evidence, submit/accept, and record outcome.
5. **Missed class:** record absence and approved accommodation on the athlete profile once the entry workflow is finalized.

Every consequential action must retain an immutable audit record of the actor, timestamp, prior state, resulting state, reason, and external Stripe identifier when applicable.

## 10. Operational review

Billing staff should review unresolved alerts each business day. At least monthly, an Owner/Admin should review:

- failed payments and recovery outcomes;
- suspended and restored accounts;
- refunds and refund exceptions;
- cancellations and multi-month-program decisions;
- disputes and approaching deadlines;
- Stripe-to-Vortex payment reconciliation; and
- missed-class accommodations and unresolved profile entries.

## 11. Current implementation requirements

The following requirements are approved by this policy but must be verified or completed in the product workflow:

- route every financial alert and reply to `billing@vortexathletics.com`;
- provide a quick **Suspend access** action on exhausted-retry alerts;
- create Billing-dashboard cancellation review items, especially for multi-month programs;
- capture Owner/Admin approval and evidence for refund exceptions;
- provide a structured missed-class entry workflow on athlete profiles; and
- preserve audit history for suspension, restoration, cancellation, refund, and dispute actions.

No sales tax is calculated or collected at checkout under the current Vortex policy.
