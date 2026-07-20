import { loadFirmAffirmations } from "./runtime";

/**
 * When true, public client acquisition (booking) is allowed.
 * Admin always remains available so the firm can finish setup.
 */
export async function isPublicGoLiveEnabled(): Promise<boolean> {
  // Local/dev: always allow testing
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  // Explicit kill switch
  if (process.env.PUBLISH_FORCE_CLOSED === "true") {
    return false;
  }

  try {
    const firm = await loadFirmAffirmations();
    return firm.goLive === true;
  } catch {
    return process.env.PUBLISH_GO_LIVE === "true";
  }
}

export function notLiveResponse() {
  return {
    error:
      "This practice portal is not open for public booking yet. Contact the firm directly, or complete Go Live in the staff admin.",
    code: "NOT_LIVE",
  };
}
