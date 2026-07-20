export function getPracticeConfig() {
  return {
    name: process.env.PRACTICE_NAME || process.env.NEXT_PUBLIC_PRACTICE_NAME || "Collins Fast Tax",
    email: process.env.PRACTICE_EMAIL || process.env.FROM_EMAIL || "support@example.com",
    phone: process.env.PRACTICE_PHONE || "",
    address: process.env.PRACTICE_ADDRESS || "",
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  };
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface EmailLayoutOptions {
  preheader?: string;
  body: string;
}

export function emailLayout({ preheader, body }: EmailLayoutOptions): string {
  const practice = getPracticeConfig();
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(practice.name)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>` : ""}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:#1e3a5f;border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;">${escapeHtml(practice.name)}</h1>
              <p style="margin:8px 0 0;color:#94b8d9;font-size:14px;">Secure Client Portal</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-radius:0 0 12px 12px;padding:24px 32px;border:1px solid #e2e8f0;border-top:none;text-align:center;">
              <p style="margin:0 0 8px;color:#64748b;font-size:13px;">${escapeHtml(practice.name)}</p>
              ${practice.phone ? `<p style="margin:0 0 4px;color:#94a3b8;font-size:12px;">${escapeHtml(practice.phone)}</p>` : ""}
              ${practice.email ? `<p style="margin:0 0 4px;color:#94a3b8;font-size:12px;">${escapeHtml(practice.email)}</p>` : ""}
              <p style="margin:12px 0 0;color:#cbd5e1;font-size:11px;">&copy; ${year} ${escapeHtml(practice.name)}. All rights reserved.</p>
              <p style="margin:8px 0 0;color:#cbd5e1;font-size:11px;">This message contains confidential tax information.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function emailButton(href: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">
  <tr>
    <td style="border-radius:8px;background:#1e3a5f;">
      <a href="${href}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

export function emailHeading(text: string): string {
  return `<h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;font-weight:600;">${escapeHtml(text)}</h2>`;
}

export function emailParagraph(text: string): string {
  return `<p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.6;">${text}</p>`;
}

export function emailInfoBox(items: { label: string; value: string }[]): string {
  const rows = items
    .map(
      (item) => `<tr>
        <td style="padding:8px 0;color:#64748b;font-size:14px;width:120px;vertical-align:top;">${escapeHtml(item.label)}</td>
        <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:500;">${escapeHtml(item.value)}</td>
      </tr>`
    )
    .join("");

  return `<table role="presentation" width="100%" style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin:16px 0;border:1px solid #e2e8f0;">
    ${rows}
  </table>`;
}

export function emailChecklist(items: string[]): string {
  const rows = items
    .map(
      (item) => `<tr>
        <td style="padding:6px 8px 6px 0;color:#1e3a5f;font-size:14px;vertical-align:top;">&#10003;</td>
        <td style="padding:6px 0;color:#475569;font-size:14px;line-height:1.5;">${escapeHtml(item)}</td>
      </tr>`
    )
    .join("");

  return `<table role="presentation" style="margin:16px 0;">${rows}</table>`;
}

export function emailDivider(): string {
  return `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">`;
}

export function emailSmall(text: string): string {
  return `<p style="margin:16px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">${text}</p>`;
}
