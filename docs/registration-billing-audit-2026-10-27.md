# Registration billing audit — October 27, 2026

## Business rule

Paid monthly class enrollment requires annual membership for the enrolled athlete. An existing active membership satisfies that requirement; a parent's or sibling's membership does not. Configured free trials, passes, and discounts remain valid. Free initial periods defer membership billing until paid monthly tuition begins. Drop-ins do not require membership and retain member/non-member pricing.

## Route coverage

| Route / transition | Enforcement |
| --- | --- |
| Public single and batch scheduling signup | Server pricing; paid registrations require verified checkout context. Missing class pricing fails closed. |
| Member portal and embedded signup | Checkout required for paid selections; checkout failures cannot fall back to direct enrollment. |
| Public family signup and invitations | Account creation prepares athlete-specific selections for authenticated checkout; does not confirm unpaid class registrations. |
| Staff family signup | Validates the selected class/time and persists tuition and required membership in the account-creation transaction. |
| Staff scheduling signup | Prices tuition and membership and persists both before committing admission. |
| Orphan re-enrollment | New registration and billing commit together; retries reuse the replacement registration. |
| Waitlist promotion, including capacity changes and cancellation | Bills the promoted athlete inside the same transaction/savepoint. Billing failure prevents promotion. |
| Manual status confirmation / resumption | Bills previously unbilled registrations; preserves existing billed prices and discounts. Subscription reactivation errors propagate. |
| Administrative class swap | Existing tuition adjustment flow plus required participant membership billing. |
| First paid month after a free period; subsequent recurring posting | Both canonical and legacy monthly posting ensure the participant has membership or an outstanding membership charge. Advance provisional billing does not prematurely add membership. |
| Drop-in signup and pending drop-in completion | Existing benefit and member/non-member price rules retained; missing paid drop-in pricing cannot silently create a free booking. |
| Stripe fulfillment and recovery | Existing verified payment binding, idempotency, and allocation retained; an annual fee alone cannot conceal missing class tuition pricing. |

Staff admissions post obligations to the household ledger for collection. Posting a positive membership bill does **not** activate membership: the existing payment allocator activates it only after satisfaction. Public paid registration uses checkout.

## Membership safeguards

- Canonical entitlement lookup checks the enrolled athlete and fails closed on lookup errors.
- An ended/transferred entitlement cannot be revived by the old creation-date fallback.
- Paid monthly enrollment requires an available annual fee, including when old fee configuration has an inappropriate class scope or new-member trigger.
- Active membership suppresses a replacement annual fee ID as well as the original fee.
- Staff billing reuses an outstanding annual bill. Checkout rejects a second membership purchase while an unpaid bill exists.
- Billing writes use the account transaction lock; conflicting annual charge identities fail for review rather than silently dropping the fee.

## Verification

Backend scheduling, billing, and family-signup regression suites; browser family-enrollment tests with mocked APIs; TypeScript build checking; whitespace/diff checking. Browser tests cover separate athlete selections, payment-service failure, disabled checkout, and the account-creation handoff.

No production enrollment or billing records were changed, no live payment was initiated, and these changes have not been deployed. Database-dependent tests requiring an external test database are skipped when that database is not configured. Existing uncommitted checkout/UI work was preserved and included in verification.
