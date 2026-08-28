import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL('../supabase/migrations/20260828000500_yucang_share_credit_ledger.sql', import.meta.url);
const sql = await readFile(migrationUrl, 'utf8');

for (const needle of [
  'create table if not exists public.yucang_share_credit_ledger',
  "event_type in ('publication_reward', 'founder_grant', 'share_debit')",
  'before update or delete on public.yucang_share_credit_ledger',
  "'publication-version:' || new.id::text",
  'on conflict (event_key) do nothing',
  'create or replace function public.yucang_get_share_credit_entitlement()',
  'daily_free_limit := 3',
  'permanent_credit_balance := private.yucang_share_credit_balance(caller)',
  'create or replace function public.yucang_admin_grant_share_credits(',
  "raise exception 'admin_required'",
  "raise exception 'idempotency_conflict'",
  'target_recipient_count integer := 1',
  'and member_row.user_id <> caller',
  'free_charge := least(target_recipient_count, free_remaining)',
  'permanent_charge := target_recipient_count - free_charge',
  "raise exception 'insufficient_share_credits'",
  "'share:' || share_id::text",
  'recipient_count, daily_free_charged, permanent_credits_charged',
  'perform pg_catalog.pg_advisory_xact_lock',
]) {
  assert.ok(sql.includes(needle), `missing share-credit contract: ${needle}`);
}

assert.match(sql, /where sender_id = caller and request_id = p_request_id for update;[\s\S]*result_status := 'already_shared';[\s\S]*return;/);
assert.match(sql, /if permanent_balance < permanent_charge then raise exception 'insufficient_share_credits'; end if;[\s\S]*insert into public\.yucang_prompt_shares/);
assert.match(sql, /insert into public\.yucang_prompt_shares[\s\S]*if permanent_charge > 0 then[\s\S]*insert into public\.yucang_share_credit_ledger/);
assert.doesNotMatch(sql, /grant\s+(insert|update|delete)\s+on\s+public\.yucang_share_credit_ledger\s+to\s+authenticated/i);

console.log('Yucang durable share-credit contract checks passed.');
