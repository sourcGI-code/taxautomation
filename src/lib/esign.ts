/**
 * Electronic signature validation and audit payload shaping.
 * Not a substitute for state-specific e-sign counsel — captures intent + evidence.
 */

export type SignatureMethod = "drawn" | "typed" | "both";

export type SignatureInput = {
  typedName: string;
  clientLegalName: string;
  agreedToElectronicSignature: boolean;
  signatureDataUrl?: string | null;
  consentText?: string;
};

export type ValidSignature = {
  typedName: string;
  method: SignatureMethod;
  signatureDataUrl: string | null;
  consentText: string;
};

const DEFAULT_CONSENT =
  "I have reviewed my tax return and authorize my tax preparer to file it. " +
  "I understand this electronic signature has the same legal effect as a handwritten signature.";

const MAX_DATA_URL_CHARS = 400_000; // ~300KB base64 PNG

function namesRoughlyMatch(typed: string, legal: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const a = norm(typed);
  const b = norm(legal);
  if (!a || !b) return false;
  if (a === b) return true;
  // Require first + last token overlap when multi-part
  const aParts = a.split(" ").filter(Boolean);
  const bParts = b.split(" ").filter(Boolean);
  if (aParts.length >= 2 && bParts.length >= 2) {
    return (
      aParts[0] === bParts[0] &&
      aParts[aParts.length - 1] === bParts[bParts.length - 1]
    );
  }
  return a.includes(b) || b.includes(a);
}

function isValidPngDataUrl(dataUrl: string): boolean {
  if (!dataUrl.startsWith("data:image/png;base64,")) return false;
  if (dataUrl.length > MAX_DATA_URL_CHARS) return false;
  const b64 = dataUrl.slice("data:image/png;base64,".length);
  return b64.length > 32 && /^[A-Za-z0-9+/=\s]+$/.test(b64);
}

export function validateSignatureInput(
  input: SignatureInput
): { ok: true; value: ValidSignature } | { ok: false; error: string } {
  if (!input.agreedToElectronicSignature) {
    return {
      ok: false,
      error: "You must agree to the electronic signature disclosure",
    };
  }

  const typedName = (input.typedName || "").trim();
  if (typedName.length < 2) {
    return { ok: false, error: "Type your full legal name to sign" };
  }
  if (typedName.length > 120) {
    return { ok: false, error: "Name is too long" };
  }

  if (!namesRoughlyMatch(typedName, input.clientLegalName)) {
    return {
      ok: false,
      error: "Typed name must match the name on your account",
    };
  }

  const dataUrl = input.signatureDataUrl?.trim() || null;
  if (dataUrl) {
    if (!isValidPngDataUrl(dataUrl)) {
      return {
        ok: false,
        error: "Invalid signature image — redraw your signature",
      };
    }
  }

  const method: SignatureMethod = dataUrl ? "both" : "typed";

  return {
    ok: true,
    value: {
      typedName,
      method,
      signatureDataUrl: dataUrl,
      consentText: (input.consentText || DEFAULT_CONSENT).slice(0, 2000),
    },
  };
}

export function buildSignatureAudit(meta: {
  clientId: string;
  ip: string;
  userAgent: string;
  valid: ValidSignature;
}): Record<string, unknown> {
  return {
    client_id: meta.clientId,
    typed_name: meta.valid.typedName,
    method: meta.valid.method,
    has_drawn_signature: !!meta.valid.signatureDataUrl,
    consent_text: meta.valid.consentText,
    ip: meta.ip,
    user_agent: meta.userAgent.slice(0, 500),
    signed_at: new Date().toISOString(),
  };
}

export { DEFAULT_CONSENT };
