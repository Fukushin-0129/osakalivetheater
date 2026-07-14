-- student_payments.payment_type に 'trial_lesson_payment' を追加できるようにする
-- 既存のCHECK制約名が環境によって異なる可能性があるため、動的に探して張り替える
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'student_payments'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%payment_type%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE student_payments DROP CONSTRAINT %I', con_name);
  END IF;

  ALTER TABLE student_payments
    ADD CONSTRAINT student_payments_payment_type_check
    CHECK (payment_type IN ('ticket_purchase', 'subscription_payment', 'trial_lesson_payment', 'manual'));
END $$;
