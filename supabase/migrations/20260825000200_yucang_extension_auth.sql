-- Yucang Prompt Vault website authorization-code bridge.
-- Stores only hashes and an encrypted, short-lived Supabase session envelope.

create table public.yucang_extension_auth_codes (
  code_hash text primary key,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  state_hash text not null,
  provider text check (provider is null or provider in ('github', 'google', 'email')),
  action text not null check (action in ('signin', 'link')),
  encrypted_session text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index yucang_extension_auth_codes_expiry_idx
  on public.yucang_extension_auth_codes (expires_at)
  where consumed_at is null;

alter table public.yucang_extension_auth_codes enable row level security;
revoke all on table public.yucang_extension_auth_codes from public, anon, authenticated;
grant select, insert, update, delete on table public.yucang_extension_auth_codes to service_role;

create or replace function public.yucang_consume_extension_auth_code(
  p_code_hash text,
  p_redirect_uri text,
  p_code_challenge text
)
returns table (
  encrypted_session text,
  auth_user_id uuid,
  action text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.yucang_extension_auth_codes code
  set consumed_at = now()
  where code.code_hash = p_code_hash
    and code.redirect_uri = p_redirect_uri
    and code.code_challenge = p_code_challenge
    and code.consumed_at is null
    and code.expires_at > now()
  returning code.encrypted_session, code.auth_user_id, code.action, code.expires_at;
end;
$$;

revoke all on function public.yucang_consume_extension_auth_code(text, text, text)
  from public, anon, authenticated;
grant execute on function public.yucang_consume_extension_auth_code(text, text, text)
  to service_role;

comment on table public.yucang_extension_auth_codes is
  'Short-lived one-time Authorization Code + PKCE bridge for Prompt Vault extension login. No plaintext code or session tokens are stored.';
