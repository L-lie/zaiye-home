import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL('../supabase/migrations/20260829000100_yucang_share_credit_unit_rules.sql', import.meta.url);
const sql = await readFile(migrationUrl, 'utf8');
const currentSql = await readFile(new URL('../supabase/migrations/20260830000100_yucang_five_daily_share_units.sql', import.meta.url), 'utf8');

for (const needle of [
  'add column if not exists charge_units integer',
  'set charge_units = recipient_count',
  'check (daily_free_charged + permanent_credits_charged in (0, charge_units))',
  "'publication-work:' || new.work_id::text",
  "entry.event_type = 'publication_reward'",
  'share_unlimited := is_admin',
  'daily_free_limit := 3',
  'share_charge_units integer := 1',
  'free_charge := least(share_charge_units, free_remaining)',
  'permanent_charge := share_charge_units - free_charge',
  'target_recipient_count, share_charge_units, free_charge, permanent_charge',
  "'chargeUnits', share_charge_units",
]) {
  assert.ok(sql.includes(needle), `missing unit-rule contract: ${needle}`);
}

assert.match(sql, /not exists \([\s\S]*entry\.work_id = new\.work_id[\s\S]*event_type = 'publication_reward'/);
assert.doesNotMatch(sql, /share_unlimited := is_admin or is_paid/);
assert.doesNotMatch(sql, /public\.yucang_group_membership_periods/);
assert.doesNotMatch(sql, /free_charge := least\(target_recipient_count, free_remaining\)/);
assert.doesNotMatch(sql, /permanent_charge := target_recipient_count - free_charge/);
assert.match(currentSql, /daily_free_limit := 5/);
assert.match(currentSql, /greatest\(0, 5 - used_today\)/);
assert.match(currentSql, /share_charge_units integer := 1/);
assert.doesNotMatch(currentSql, /target_recipient_count - free_charge/);

console.log('Yucang one-target share units and first-publication reward checks passed.');
