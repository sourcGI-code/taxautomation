export function getAppUrl(path = "") {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

export function getPortalUrl(token: string) {
  return getAppUrl(`/portal?token=${token}`);
}
