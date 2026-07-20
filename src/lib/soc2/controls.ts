/**
 * SOC 2 Trust Services Criteria (2017) — control catalog implemented by this app.
 *
 * IMPORTANT: Implementing these controls supports Type I/II audit readiness.
 * "SOC 2 certified / compliant" is an attestation issued by a licensed CPA firm
 * after examination — not a software flag.
 */

export type TrustCategory = "CC" | "A" | "C" | "P" | "PI";

export type Soc2Control = {
  id: string;
  category: TrustCategory;
  title: string;
  criteria: string;
  description: string;
  implementation: string[];
  evidenceSources: string[];
  automated: boolean;
};

export const SOC2_CONTROLS: Soc2Control[] = [
  {
    id: "CC1.1",
    category: "CC",
    title: "Control environment — integrity & ethics",
    criteria: "COSO Control Environment",
    description: "The entity demonstrates a commitment to integrity and ethical values.",
    implementation: [
      "Written security policy and acceptable use (SECURITY.md + COMPLIANCE.md)",
      "Staff role separation (owner/preparer/viewer)",
      "No default admin passwords in production",
    ],
    evidenceSources: ["compliance_events", "staff auth logs", "policy documents"],
    automated: true,
  },
  {
    id: "CC2.1",
    category: "CC",
    title: "Communication of security responsibilities",
    criteria: "Communication & Information",
    description: "Security responsibilities are communicated to personnel.",
    implementation: [
      "Admin role permissions enforced in API",
      "Privacy and terms pages for clients",
      "Security headers and CSP on all responses",
    ],
    evidenceSources: ["proxy headers", "privacy page", "staff permission checks"],
    automated: true,
  },
  {
    id: "CC3.1",
    category: "CC",
    title: "Risk assessment",
    criteria: "Risk Assessment",
    description: "The entity specifies objectives and identifies risks.",
    implementation: [
      "Documented threat model for tax documents and PII",
      "Production secret validation (assertProductionSecrets)",
      "Health endpoint continuous readiness checks",
    ],
    evidenceSources: ["/api/health", "COMPLIANCE.md risk section"],
    automated: true,
  },
  {
    id: "CC5.1",
    category: "CC",
    title: "Control activities",
    criteria: "Control Activities",
    description: "Controls selected and developed to mitigate risks.",
    implementation: [
      "AES-256-GCM document encryption at rest",
      "HMAC-signed session cookies",
      "Rate limiting (memory or Upstash)",
      "Same-origin CSRF checks",
      "Magic-link one-time auth",
    ],
    evidenceSources: ["crypto-docs", "auth", "rate-limit", "security.ts"],
    automated: true,
  },
  {
    id: "CC6.1",
    category: "CC",
    title: "Logical access — credentials",
    criteria: "Logical & Physical Access",
    description: "Logical access security software and infrastructure.",
    implementation: [
      "Staff scrypt password hashes",
      "Client magic links with TTL",
      "Service role key server-only",
      "RLS-enabled Supabase schema",
    ],
    evidenceSources: ["auth events", "compliance_events"],
    automated: true,
  },
  {
    id: "CC6.6",
    category: "CC",
    title: "Encryption & key management",
    criteria: "Logical Access",
    description: "Encryption to protect data at rest and in transit.",
    implementation: [
      "TLS via hosting platform (HSTS enabled)",
      "Document encryption master key",
      "DocuSign certified e-sign channel",
      "SSN redaction in MeF XML previews",
    ],
    evidenceSources: ["document_access_log", "docusign_envelopes", "mef_submissions"],
    automated: true,
  },
  {
    id: "CC7.1",
    category: "CC",
    title: "System monitoring",
    criteria: "System Operations",
    description: "Detection of anomalies and security events.",
    implementation: [
      "compliance_events table",
      "activity_log per client",
      "document_access_log",
      "Health monitoring endpoint",
    ],
    evidenceSources: ["compliance_events", "activity_log", "/api/health"],
    automated: true,
  },
  {
    id: "CC7.2",
    category: "CC",
    title: "Incident evaluation & response",
    criteria: "System Operations",
    description: "Incidents are evaluated and responded to.",
    implementation: [
      "Severity-tagged compliance events",
      "SECURITY.md incident basics",
      "Failed MeF/DocuSign logged as high severity",
    ],
    evidenceSources: ["compliance_events severity", "SECURITY.md"],
    automated: true,
  },
  {
    id: "CC8.1",
    category: "CC",
    title: "Change management",
    criteria: "Change Management",
    description: "Changes to infrastructure and software are authorized.",
    implementation: [
      "Versioned SQL migrations",
      "Automated unit tests (npm test)",
      "TypeScript production build gate",
    ],
    evidenceSources: ["supabase/migrations", "tests/", "CI build"],
    automated: true,
  },
  {
    id: "CC9.1",
    category: "CC",
    title: "Risk mitigation — vendors",
    criteria: "Risk Mitigation",
    description: "Vendor risk managed for processors of customer data.",
    implementation: [
      "Documented subprocessors: Supabase, Resend, Twilio, DocuSign, IRS MeF",
      "Private storage buckets only",
      "No public document URLs",
    ],
    evidenceSources: ["COMPLIANCE.md subprocessors", "storage policies"],
    automated: false,
  },
  {
    id: "A1.1",
    category: "A",
    title: "Availability commitments",
    criteria: "Availability",
    description: "Availability commitments are met.",
    implementation: [
      "Health endpoint for uptime monitors",
      "Cron-based reminder jobs",
      "Error boundaries in UI",
    ],
    evidenceSources: ["/api/health", "vercel cron"],
    automated: true,
  },
  {
    id: "C1.1",
    category: "C",
    title: "Confidentiality",
    criteria: "Confidentiality",
    description: "Confidential information is protected.",
    implementation: [
      "Staff notes never exposed to portal",
      "Document path opacity",
      "Role-based download permissions",
    ],
    evidenceSources: ["portal API sanitization", "staff roles"],
    automated: true,
  },
  {
    id: "P1.1",
    category: "P",
    title: "Privacy notice",
    criteria: "Privacy",
    description: "Privacy notice provided to data subjects.",
    implementation: ["/privacy page", "intake consent context", "e-sign consent text"],
    evidenceSources: ["privacy page", "e_signatures.consent_text"],
    automated: true,
  },
  {
    id: "PI1.1",
    category: "PI",
    title: "Processing integrity — e-file",
    criteria: "Processing Integrity",
    description: "System processing is complete, valid, accurate, timely, authorized.",
    implementation: [
      "MeF business-rule validation before transmit",
      "DocuSign completion required evidence for signature",
      "Status pipeline with audit trail",
    ],
    evidenceSources: ["mef_submissions", "docusign_envelopes", "activity_log"],
    automated: true,
  },
];

export function getControl(id: string): Soc2Control | undefined {
  return SOC2_CONTROLS.find((c) => c.id === id);
}

export function controlsByCategory(): Record<string, Soc2Control[]> {
  return SOC2_CONTROLS.reduce(
    (acc, c) => {
      (acc[c.category] ||= []).push(c);
      return acc;
    },
    {} as Record<string, Soc2Control[]>
  );
}
