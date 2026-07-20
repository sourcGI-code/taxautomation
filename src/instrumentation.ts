/**
 * Server startup instrumentation — fail closed in production if secrets missing.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { assertProductionSecrets } = await import("@/lib/security");
  const result = assertProductionSecrets();

  if (process.env.NODE_ENV === "production" && !result.ok) {
    console.error(
      "[FATAL] Production secrets incomplete — refusing unsafe start:\n",
      result.errors.join("\n")
    );
    // Throw so misconfigured production does not silently serve
    throw new Error(
      `Production configuration invalid: ${result.errors.join("; ")}`
    );
  }

  if (process.env.NODE_ENV === "production") {
    console.info(
      "[tax-portal] Production secrets OK. App version ready for traffic when PUBLISH_GO_LIVE is set."
    );
  }
}
