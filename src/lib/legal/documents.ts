const practice = () =>
  process.env.NEXT_PUBLIC_PRACTICE_NAME ||
  process.env.PRACTICE_NAME ||
  "Collins Fast Tax";

const email = () => process.env.PRACTICE_EMAIL || "practice@example.com";
const phone = () => process.env.PRACTICE_PHONE || "";
const address = () => process.env.PRACTICE_ADDRESS || "";

export function engagementLetterText(clientName: string, taxYear: number): string {
  const firm = practice();
  return `
ENGAGEMENT LETTER — ${firm}
Tax Year ${taxYear}

Client: ${clientName}
Date: ${new Date().toISOString().slice(0, 10)}

1. SCOPE OF SERVICES
${firm} ("we", "us") will prepare your federal (and if agreed, state) individual income tax return(s) for tax year ${taxYear} based on information you provide. We will also provide secure portal access for scheduling, intake, document exchange, status updates, and electronic signature of authorizations.

2. YOUR RESPONSIBILITIES
You agree to provide complete and accurate information and documents on a timely basis, including income, deductions, credits, identity documents, and banking information needed for refunds or payments. You remain responsible for the accuracy of the return and for retaining copies of your records.

3. OUR RESPONSIBILITIES
We will prepare returns with professional care consistent with applicable standards. We will not audit or verify information you provide unless we separately agree in writing. We will use secure systems to store documents you upload.

4. ELECTRONIC COMMUNICATIONS & SIGNATURES
You consent to receive communications by email and SMS regarding your engagement. You consent to electronic signatures (including DocuSign when used, or in-portal ESIGN signatures) for authorizations related to this engagement, with the same legal effect as handwritten signatures under applicable law (including the ESIGN Act).

5. E-FILE
If we electronically file your return, filing will be performed only by an authorized IRS e-file provider / ERO, either through configured production MeF credentials or through the firm's authorized desktop/tax software workflow. Sandbox or test transmissions are never production IRS filings.

6. FEES
Fees will be communicated before filing. You agree to pay fees as agreed. Unpaid fees may delay release of work product as permitted by professional standards and law.

7. CONFIDENTIALITY & DATA SECURITY
We maintain administrative, technical, and physical safeguards appropriate to tax return information, including encryption of stored client documents, access controls, and audit logging. See our Privacy Policy.

8. RETENTION
We generally retain engagement records for at least ${process.env.DATA_RETENTION_YEARS || "7"} years unless law requires longer or you request earlier deletion where permitted.

9. LIMITATION
Our liability arising from this engagement is limited to the fees paid for the services giving rise to the claim, except where prohibited by law or caused by our gross negligence or willful misconduct.

10. TERMINATION
Either party may terminate this engagement in writing. You remain responsible for fees for work performed.

11. GOVERNING LAW
This engagement is governed by the laws of the state in which ${firm} primarily practices, without conflict-of-law principles.

ACKNOWLEDGMENT
By accepting this engagement in the client portal or by continuing to provide information after receipt of this letter, you acknowledge that you have read and agree to these terms.

${firm}
${address}
${email} ${phone}
`.trim();
}

export function wispText(): string {
  const firm = practice();
  return `
WRITTEN INFORMATION SECURITY PROGRAM (WISP)
${firm}
Effective: ${new Date().toISOString().slice(0, 10)}
Version: 1.0.0

1. PURPOSE
This WISP describes safeguards to protect personal information and tax return information processed by ${firm} through the Tax Portal application and related systems.

2. SCOPE
Applies to all staff, contractors, and systems that access client PII, tax documents, or return data.

3. DESIGNATED SECURITY COORDINATOR
The firm owner (or designee) is responsible for maintaining this WISP, reviewing incidents, and authorizing access.

4. RISK ASSESSMENT
We identify risks including unauthorized access, lost devices, phishing, misconfigured storage, and third-party processor failure. Controls are mapped in the application SOC 2 readiness catalog (Trust Services Criteria alignment) and reviewed at least annually.

5. ADMINISTRATIVE SAFEGUARDS
- Role-based staff access (owner / preparer / viewer)
- Unique credentials; no shared default passwords
- Security awareness expectations for all staff
- Vendor review for Supabase, email, SMS, DocuSign, hosting

6. TECHNICAL SAFEGUARDS
- TLS in transit (HTTPS)
- AES-256-GCM encryption of documents at rest before storage
- HMAC-signed session cookies; short-lived magic links
- Rate limiting; CSRF same-origin checks; security headers (CSP, HSTS)
- Private object storage; no public document URLs
- Audit logs: activity_log, compliance_events, document_access_log, e_signatures

7. PHYSICAL SAFEGUARDS
- Workstations locked when unattended
- No unencrypted portable media with client tax files

8. INCIDENT RESPONSE
1) Contain (revoke sessions, rotate keys if needed)
2) Investigate using compliance_events and access logs
3) Notify affected clients and regulators as required by law
4) Remediate and document

9. RETENTION & DISPOSAL
Default retention ${process.env.DATA_RETENTION_YEARS || "7"} years for filed clients; anonymization/purge procedures documented in application retention job.

10. EMPLOYEE TRAINING
Staff must complete onboarding on phishing, password hygiene, and portal procedures before accessing live client data.

11. REVIEW
This WISP is reviewed at least annually or after material system changes.

Prepared for: ${firm}
Contact: ${email()}
`.trim();
}

export function subprocessorsList(): { name: string; purpose: string }[] {
  return [
    { name: "Supabase", purpose: "PostgreSQL database and private document storage" },
    { name: "Hosting provider (e.g. Vercel)", purpose: "Application compute and HTTPS edge" },
    { name: "Resend", purpose: "Transactional email delivery" },
    { name: "Twilio", purpose: "SMS notifications (when enabled)" },
    { name: "DocuSign", purpose: "Certified electronic signatures (when enabled)" },
    { name: "IRS MeF / authorized gateway", purpose: "Federal e-file transmission (when authorized)" },
  ];
}
