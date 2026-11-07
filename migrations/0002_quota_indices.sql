-- The authenticated user id, category and billing window isolate all quota usage.
-- "free:lifetime" never expires; paid windows are derived from the verified subscription.
CREATE INDEX IF NOT EXISTS idx_usage_user_kind_period
  ON usage_events(user_id,kind,billing_period);
