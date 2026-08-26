-- Serialize receipt creation per author so concurrent handoffs cannot bypass the RPC rate check.
create or replace function private.yucang_enforce_handoff_receipt_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('yucang-handoff-rate:' || new.author_id::text, 0));
  if (
    select count(*) from private.yucang_handoff_receipts
    where author_id = new.author_id and created_at >= now() - interval '1 minute'
  ) >= 5 then
    raise exception 'rate_limited';
  end if;
  return new;
end;
$$;

revoke all on function private.yucang_enforce_handoff_receipt_rate() from public, anon, authenticated;

create trigger yucang_handoff_receipt_rate_guard
  before insert on private.yucang_handoff_receipts
  for each row execute procedure private.yucang_enforce_handoff_receipt_rate();

comment on function private.yucang_enforce_handoff_receipt_rate() is
  'Database-enforced per-author creation rate guard. Idempotent replay does not insert a receipt and is not counted.';
