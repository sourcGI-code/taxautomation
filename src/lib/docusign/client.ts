import {
  createSign,
  createPrivateKey,
  randomBytes,
  createHmac,
  timingSafeEqual,
} from "crypto";

export type DocuSignEnvironment = "demo" | "production";

export type EnvelopeCreateInput = {
  signerEmail: string;
  signerName: string;
  subject: string;
  emailBlurb: string;
  documentBase64: string;
  documentName: string;
  documentExtension: string; // pdf
  clientUserId?: string; // for embedded signing
  returnUrl: string;
};

export type EnvelopeCreateResult = {
  envelopeId: string;
  status: string;
  environment: DocuSignEnvironment;
  signingUrl?: string;
  simulated: boolean;
};

function env(): DocuSignEnvironment {
  return process.env.DOCUSIGN_PRODUCTION === "true" ? "production" : "demo";
}

function baseUri(): string {
  if (process.env.DOCUSIGN_BASE_URI) return process.env.DOCUSIGN_BASE_URI.replace(/\/$/, "");
  return env() === "production"
    ? "https://na3.docusign.net"
    : "https://demo.docusign.net";
}

function authBase(): string {
  return env() === "production"
    ? "https://account.docusign.com"
    : "https://account-d.docusign.com";
}

export function isDocuSignConfigured(): boolean {
  return !!(
    process.env.DOCUSIGN_INTEGRATION_KEY?.trim() &&
    process.env.DOCUSIGN_USER_ID?.trim() &&
    process.env.DOCUSIGN_ACCOUNT_ID?.trim() &&
    (process.env.DOCUSIGN_RSA_PRIVATE_KEY?.trim() ||
      process.env.DOCUSIGN_ACCESS_TOKEN?.trim())
  );
}

export function docusignConfigStatus() {
  return {
    configured: isDocuSignConfigured(),
    environment: env(),
    hasIntegrationKey: !!process.env.DOCUSIGN_INTEGRATION_KEY,
    hasUserId: !!process.env.DOCUSIGN_USER_ID,
    hasAccountId: !!process.env.DOCUSIGN_ACCOUNT_ID,
    hasRsaKey: !!process.env.DOCUSIGN_RSA_PRIVATE_KEY,
    hasAccessToken: !!process.env.DOCUSIGN_ACCESS_TOKEN,
    baseUri: baseUri(),
    note: isDocuSignConfigured()
      ? "Live DocuSign API credentials detected"
      : "Sandbox simulator active until DocuSign API credentials are set",
  };
}

/** JWT grant access token (RS256) for DocuSign eSignature */
export async function getDocuSignAccessToken(): Promise<string> {
  if (process.env.DOCUSIGN_ACCESS_TOKEN?.trim()) {
    return process.env.DOCUSIGN_ACCESS_TOKEN.trim();
  }

  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
  const userId = process.env.DOCUSIGN_USER_ID;
  let privateKeyPem = process.env.DOCUSIGN_RSA_PRIVATE_KEY;
  if (!integrationKey || !userId || !privateKeyPem) {
    throw new Error("DocuSign JWT credentials not configured");
  }

  // Support \n escaped keys from env
  privateKeyPem = privateKeyPem.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: integrationKey,
    sub: userId,
    aud: authBase().replace("https://", ""),
    iat: now,
    exp: now + 3600,
    scope: "signature impersonation",
  };

  const enc = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${enc(header)}.${enc(payload)}`;
  const key = createPrivateKey(privateKeyPem);
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(key, "base64url");
  const assertion = `${unsigned}.${signature}`;

  const res = await fetch(`${authBase()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DocuSign auth failed: ${res.status} ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export async function createEnvelope(
  input: EnvelopeCreateInput
): Promise<EnvelopeCreateResult> {
  if (!isDocuSignConfigured()) {
    return simulateEnvelope(input);
  }

  const token = await getDocuSignAccessToken();
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID!;
  const apiBase = `${baseUri()}/restapi/v2.1/accounts/${accountId}`;

  const body = {
    emailSubject: input.subject,
    emailBlurb: input.emailBlurb,
    status: "sent",
    documents: [
      {
        documentBase64: input.documentBase64,
        name: input.documentName,
        fileExtension: input.documentExtension,
        documentId: "1",
      },
    ],
    recipients: {
      signers: [
        {
          email: input.signerEmail,
          name: input.signerName,
          recipientId: "1",
          routingOrder: "1",
          clientUserId: input.clientUserId || undefined,
          tabs: {
            signHereTabs: [
              {
                documentId: "1",
                pageNumber: "1",
                xPosition: "100",
                yPosition: "700",
              },
            ],
            dateSignedTabs: [
              {
                documentId: "1",
                pageNumber: "1",
                xPosition: "350",
                yPosition: "700",
              },
            ],
          },
        },
      ],
    },
  };

  const res = await fetch(`${apiBase}/envelopes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DocuSign create envelope failed: ${res.status} ${text.slice(0, 400)}`);
  }

  const json = (await res.json()) as { envelopeId: string; status: string };
  let signingUrl: string | undefined;

  if (input.clientUserId) {
    signingUrl = await createRecipientView({
      envelopeId: json.envelopeId,
      signerEmail: input.signerEmail,
      signerName: input.signerName,
      clientUserId: input.clientUserId,
      returnUrl: input.returnUrl,
      token,
      apiBase,
    });
  }

  return {
    envelopeId: json.envelopeId,
    status: json.status || "sent",
    environment: env(),
    signingUrl,
    simulated: false,
  };
}

async function createRecipientView(opts: {
  envelopeId: string;
  signerEmail: string;
  signerName: string;
  clientUserId: string;
  returnUrl: string;
  token: string;
  apiBase: string;
}): Promise<string> {
  const res = await fetch(
    `${opts.apiBase}/envelopes/${opts.envelopeId}/views/recipient`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        returnUrl: opts.returnUrl,
        authenticationMethod: "none",
        email: opts.signerEmail,
        userName: opts.signerName,
        clientUserId: opts.clientUserId,
      }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DocuSign recipient view failed: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { url: string };
  return json.url;
}

export async function getEnvelopeStatus(envelopeId: string): Promise<{
  status: string;
  simulated: boolean;
}> {
  if (envelopeId.startsWith("SIM-")) {
    return { status: "completed", simulated: true };
  }
  if (!isDocuSignConfigured()) {
    return { status: "sent", simulated: true };
  }
  const token = await getDocuSignAccessToken();
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID!;
  const res = await fetch(
    `${baseUri()}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`DocuSign status failed: ${res.status}`);
  const json = (await res.json()) as { status: string };
  return { status: json.status, simulated: false };
}

function simulateEnvelope(input: EnvelopeCreateInput): EnvelopeCreateResult {
  const envelopeId = `SIM-${randomBytes(8).toString("hex")}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const signingUrl = `${appUrl}/portal?docusign=sim&envelope=${envelopeId}`;
  return {
    envelopeId,
    status: "sent",
    environment: "demo",
    signingUrl: input.clientUserId ? signingUrl : undefined,
    simulated: true,
  };
}

/**
 * Verify DocuSign Connect HMAC (v2) if DOCUSIGN_CONNECT_SECRET is set.
 */
export function verifyDocuSignConnectHmac(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const secret = process.env.DOCUSIGN_CONNECT_SECRET?.trim();
  if (!secret) {
    // Allow in non-production for simulator webhooks
    return process.env.NODE_ENV !== "production";
  }
  if (!signatureHeader) return false;

  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");

  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function mapDocuSignStatus(
  status: string
): "created" | "sent" | "delivered" | "signed" | "completed" | "declined" | "voided" | "error" {
  const s = status.toLowerCase();
  if (s === "created") return "created";
  if (s === "sent") return "sent";
  if (s === "delivered") return "delivered";
  if (s === "signed" || s === "completed") return s === "signed" ? "signed" : "completed";
  if (s === "declined") return "declined";
  if (s === "voided") return "voided";
  return "error";
}
