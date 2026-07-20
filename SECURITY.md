# Security

## Document encryption

- Files are encrypted with AES-256-GCM **before** upload to Supabase Storage.
- Set `DOCUMENT_ENCRYPTION_KEY` (`openssl rand -hex 32`). Back it up offline — losing it means you cannot decrypt old files.
- Bucket `client-documents` must stay **private**.

## Sessions and auth

- Client: magic-link + signed HTTP-only cookies (`SESSION_SECRET` ≥ 32 chars).
- Staff: password (prefer `ADMIN_PASSWORD_HASH`) + signed admin cookie.
- Production refuses weak/missing secrets at startup.

## Production requirements

- `NEXT_PUBLIC_APP_URL` must be your public **HTTPS** domain (not localhost).
- `CRON_SECRET` required for cron routes.
- Never put `SUPABASE_SERVICE_ROLE_KEY` in `NEXT_PUBLIC_*` vars.
- Prefer Upstash Redis for rate limits on multi-instance hosts.

## Incident basics

1. Rotate `SESSION_SECRET`, admin password, Supabase keys if exposed.
2. Null magic tokens on clients if links leaked.
3. Review `activity_log` / `compliance_events` / document access logs.
4. Do not rotate `DOCUMENT_ENCRYPTION_KEY` without a re-encryption plan.
