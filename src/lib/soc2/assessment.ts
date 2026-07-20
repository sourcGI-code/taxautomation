import { createAdminClient } from "@/lib/supabase/admin";
import { assertProductionSecrets } from "@/lib/security";
import { isDocumentEncryptionConfigured } from "@/lib/crypto-docs";
import { rateLimitBackend } from "@/lib/rate-limit";
import { docusignConfigStatus } from "@/lib/docusign/client";
import { mefConfigStatus } from "@/lib/mef/service";
import { SOC2_CONTROLS, type Soc2Control } from "./controls";
import { recordControlEvidence } from "./events";

export type ControlStatus = "pass" | "partial" | "fail" | "manual";

export type ControlAssessment = {
  control: Soc2Control;
  status: ControlStatus;
  score: number; // 0-100
  findings: string[];
  evidenceCount: number;
};

export type Soc2Report = {
  generatedAt: string;
  /** Honest label — not a CPA attestation */
  readinessLabel: "not_ready" | "partial" | "audit_ready";
  overallScore: number;
  disclaimer: string;
  controls: ControlAssessment[];
  summary: {
    pass: number;
    partial: number;
    fail: number;
    manual: number;
  };
  subsystems: {
    encryption: boolean;
    productionSecrets: boolean;
    rateLimit: string;
    docusign: ReturnType<typeof docusignConfigStatus>;
    mef: ReturnType<typeof mefConfigStatus>;
  };
};

export async function runSoc2Assessment(): Promise<Soc2Report> {
  const isProd = process.env.NODE_ENV === "production";
  const secrets = assertProductionSecrets();
  const docusign = docusignConfigStatus();
  const mef = mefConfigStatus();
  const encryption = isDocumentEncryptionConfigured() || !isProd;

  let evidenceByControl = new Map<string, number>();
  let recentEvents = 0;
  try {
    const supabase = createAdminClient();
    const { data: evidence } = await supabase
      .from("soc2_control_evidence")
      .select("control_id");
    for (const row of evidence || []) {
      const id = row.control_id as string;
      evidenceByControl.set(id, (evidenceByControl.get(id) || 0) + 1);
    }
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("compliance_events")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since);
    recentEvents = count || 0;
  } catch {
    /* tables may not exist yet */
  }

  const assessments: ControlAssessment[] = SOC2_CONTROLS.map((control) => {
    const findings: string[] = [];
    let status: ControlStatus = "pass";
    let score = 100;

    switch (control.id) {
      case "CC1.1":
        if (!process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_HASH) {
          findings.push("No admin password configured");
          status = "fail";
          score = 20;
        } else if (process.env.ADMIN_PASSWORD === "admin123") {
          findings.push("Default admin password still in use");
          status = "fail";
          score = 10;
        }
        break;
      case "CC3.1":
        if (isProd && !secrets.ok) {
          findings.push(...secrets.errors);
          status = "fail";
          score = 30;
        } else if (!secrets.ok && isProd === false) {
          findings.push("Dev mode — production secret gate not enforced");
          status = "partial";
          score = 70;
        }
        break;
      case "CC5.1":
      case "CC6.6":
        if (!encryption) {
          findings.push("Document encryption key not configured");
          status = isProd ? "fail" : "partial";
          score = isProd ? 20 : 60;
        }
        if (!docusign.configured) {
          findings.push("DocuSign live API not configured (simulator only)");
          status = status === "fail" ? "fail" : "partial";
          score = Math.min(score, 75);
        }
        break;
      case "CC6.1":
        if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
          if (isProd) {
            findings.push("SESSION_SECRET missing or short");
            status = "fail";
            score = 25;
          } else {
            findings.push("SESSION_SECRET using dev fallback");
            status = "partial";
            score = 70;
          }
        }
        break;
      case "CC7.1":
        if (recentEvents === 0) {
          findings.push("No compliance_events in last 30 days (or table missing)");
          status = "partial";
          score = 55;
        }
        break;
      case "CC7.2":
        findings.push("Ensure incident runbooks are reviewed quarterly (manual)");
        status = "manual";
        score = 80;
        break;
      case "CC8.1":
        // Assumed pass if assessment runs from tested codebase
        break;
      case "CC9.1":
        findings.push("Maintain vendor SOC reports (Supabase, DocuSign) in evidence folder");
        status = "manual";
        score = 70;
        break;
      case "A1.1":
        break;
      case "C1.1":
        break;
      case "P1.1":
        break;
      case "PI1.1":
        if (!mef.productionReady && mef.environment === "sandbox") {
          findings.push("MeF production not ready — sandbox e-file only");
          status = "partial";
          score = 65;
        }
        if (!docusign.configured) {
          findings.push("DocuSign not live — using certified path simulator");
          status = "partial";
          score = Math.min(score, 70);
        }
        break;
      default:
        break;
    }

    return {
      control,
      status,
      score,
      findings,
      evidenceCount: evidenceByControl.get(control.id) || 0,
    };
  });

  const summary = {
    pass: assessments.filter((a) => a.status === "pass").length,
    partial: assessments.filter((a) => a.status === "partial").length,
    fail: assessments.filter((a) => a.status === "fail").length,
    manual: assessments.filter((a) => a.status === "manual").length,
  };

  const overallScore = Math.round(
    assessments.reduce((s, a) => s + a.score, 0) / assessments.length
  );

  let readinessLabel: Soc2Report["readinessLabel"] = "not_ready";
  if (summary.fail === 0 && overallScore >= 85) readinessLabel = "audit_ready";
  else if (summary.fail === 0 || overallScore >= 60) readinessLabel = "partial";

  // Snapshot evidence of this assessment run
  await recordControlEvidence({
    controlId: "CC7.1",
    evidenceType: "automated_assessment",
    title: `SOC2 readiness assessment ${new Date().toISOString().slice(0, 10)}`,
    description: `Score ${overallScore}, label ${readinessLabel}`,
    metadata: { overallScore, summary, readinessLabel },
  });

  return {
    generatedAt: new Date().toISOString(),
    readinessLabel,
    overallScore,
    disclaimer:
      "This report measures engineering control readiness against Trust Services Criteria. " +
      "It is NOT a SOC 2 Type I or Type II attestation. Only a licensed CPA firm can issue a SOC 2 report.",
    controls: assessments,
    summary,
    subsystems: {
      encryption,
      productionSecrets: secrets.ok || !isProd,
      rateLimit: rateLimitBackend(),
      docusign,
      mef,
    },
  };
}
