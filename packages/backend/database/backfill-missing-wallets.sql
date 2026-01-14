-- Backfill missing wallets for existing deposit addresses
-- This SQL creates wallets for users who have deposit addresses but no corresponding wallet

-- First, let's see what's missing
SELECT
  da.user_id,
  da.currency,
  da.address,
  CASE WHEN w.id IS NULL THEN 'MISSING WALLET' ELSE 'Wallet exists' END as status
FROM deposit_addresses da
LEFT JOIN wallets w ON da.user_id = w.user_id AND da.currency = w.currency
ORDER BY da.user_id, da.currency;

-- Create missing wallets
-- This will insert wallets for deposit addresses that don't have a corresponding wallet
INSERT INTO wallets (user_id, currency, balance)
SELECT DISTINCT
  da.user_id,
  da.currency,
  0 as balance
FROM deposit_addresses da
LEFT JOIN wallets w ON da.user_id = w.user_id AND da.currency = w.currency
WHERE w.id IS NULL
ON CONFLICT (user_id, currency) DO NOTHING;

-- Reset last_checked_balance to NULL so monitoring service re-detects deposits
UPDATE deposit_addresses
SET last_checked_balance = NULL
WHERE EXISTS (
  SELECT 1 FROM wallets w
  WHERE w.user_id = deposit_addresses.user_id
  AND w.currency = deposit_addresses.currency
  AND w.balance = 0
);

-- Show results
SELECT
  da.user_id,
  da.currency,
  da.address,
  w.balance as wallet_balance,
  da.last_checked_balance
FROM deposit_addresses da
JOIN wallets w ON da.user_id = w.user_id AND da.currency = w.currency
ORDER BY da.user_id, da.currency;
