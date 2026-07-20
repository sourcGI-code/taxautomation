# Compliance notes

## Product scope

Single-firm tax website: booking, secure documents, client account, staff ops, e-sign.
Not multi-tenant SaaS for many unrelated firms without further work.

## E-sign

- In-app ESIGN with consent, typed name, optional drawn signature, audit trail.
- Optional DocuSign when `DOCUSIGN_*` env is configured.

## E-file (MeF)

- Package build + validation always available.
- Production IRS transmit only with ERO/EFIN and `IRS_MEF_PRODUCTION=true`.
- Sandbox is never a real IRS filing.

## SOC 2

- Control catalog + `/admin/compliance` readiness scoring.
- Not a CPA SOC 2 attestation. Do not claim “SOC 2 certified” without an audit.

## Go-live

Public booking is gated until firm affirmations + `PUBLISH_GO_LIVE` (or Admin → Go live).
See `HOW_TO_LAUNCH_THIS_PRODUCT.txt`.
