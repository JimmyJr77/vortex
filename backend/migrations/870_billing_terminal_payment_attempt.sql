ALTER TABLE billing_payment_attempt
  DROP CONSTRAINT billing_payment_attempt_attempt_type_check,
  ADD CONSTRAINT billing_payment_attempt_attempt_type_check CHECK (attempt_type IN (
    'member_balance_checkout',
    'admin_balance_checkout',
    'admin_balance_saved_card',
    'charge_checkout',
    'charge_saved_card',
    'admin_balance_terminal'
  ));
