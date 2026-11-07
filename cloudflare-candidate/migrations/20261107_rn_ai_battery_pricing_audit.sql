-- RecordNote-only append-only audit for Owner-approved AI Battery task pricing.
-- Additive migration: never modifies existing media, accounts, balances or receipts.
CREATE TABLE IF NOT EXISTS rn_ai_battery_policy_audit (
 id TEXT PRIMARY KEY,
 actor_user_id TEXT NOT NULL,
 old_revision INTEGER NOT NULL,
 new_revision INTEGER NOT NULL,
 policy_json TEXT NOT NULL CHECK (json_valid(policy_json)),
 created_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rn_ai_battery_policy_audit_at
 ON rn_ai_battery_policy_audit(created_at_ms);
