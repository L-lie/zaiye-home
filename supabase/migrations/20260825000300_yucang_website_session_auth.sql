-- One-time extension-session to Yucang website-session bridge.
-- Only hashes and an encrypted, short-lived Supabase session envelope are stored.

create table public.yucang_website_session_auth_codes (
  code_hash text primary key,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  extension_id text not null check (extension_id ~ '^[a-p]{32}$'),
  target_origin text not null,
  code_challenge text not null,
  state_hash text not null,
  nonce_hash text not null,
  encrypted_session text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index yucang_website_session_auth_codes_expiry_idx
  on public.yucang_website_session_auth_codes (expires_at)
  where consumed_at is null;

alter table public.yucang_website_session_auth_codes enable row level security;
revoke all on table public.yucang_website_session_auth_codes from public, anon, authenticated;
grant select, insert, update, delete on table public.yucang_website_session_auth_codes to service_role;

create or replace function public.yucang_consume_website_session_auth_code(
  p_code_hash text,
  p_target_origin text,
  p_code_challenge text,
  p_state_hash text,
  p_nonce_hash text
)
returns table (
  encrypted_session text,
  auth_user_id uuid,
  extension_id text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.yucang_website_session_auth_codes code
  set consumed_at = now()
  where code.code_hash = p_code_hash
    and code.target_origin = p_target_origin
    and code.code_challenge = p_code_challenge
    and code.state_hash = p_state_hash
    and code.nonce_hash = p_nonce_hash
    and code.consumed_at is null
    and code.expires_at > now()
  returning code.encrypted_session, code.auth_user_id, code.extension_id, code.expires_at;
end;
$$;

revoke all on function public.yucang_consume_website_session_auth_code(text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.yucang_consume_website_session_auth_code(text, text, text, text, text)
  to service_role;

comment on table public.yucang_website_session_auth_codes is
  'Short-lived one-time Authorization Code + PKCE bridge from an authenticated Prompt Vault extension to the Yucang website. No plaintext code or session tokens are stored.';
