-- 「完済」状態で新規作成された月謝管理の支払い（student_payments）が、
-- 損益管理（transactions）に一度も計上されないバグがあったため、
-- 既存の completed 支払いのうち transactions 未計上のものを一括で計上する。

insert into transactions (transaction_date, type, category, amount, description)
select
  sp.payment_date,
  'income',
  case sp.payment_type
    when 'ticket_purchase' then 'チケット販売'
    when 'subscription_payment' then 'レッスン収入'
    when 'trial_lesson_payment' then '体験レッスン収入'
    else 'その他収入'
  end,
  sp.amount,
  case sp.payment_type
    when 'ticket_purchase' then 'チケット販売'
    when 'subscription_payment' then 'レッスン収入'
    when 'trial_lesson_payment' then '体験レッスン収入'
    else 'その他収入'
  end || coalesce('（' || s.name || '）', '') || ' [ref:' || sp.id || ']'
from student_payments sp
join students s on s.id = sp.student_id
where sp.status = 'completed'
  and not exists (
    select 1 from transactions t
    where t.description ilike '%[ref:' || sp.id || ']%'
  );
