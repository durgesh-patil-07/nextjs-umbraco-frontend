// Read API key directly from environment variables

/**
 * Full flow:
 *
 * 1. ApiKeyRotationService (Umbraco background service) generates a new key
 *    every 6 minutes → saves + publishes it to the "apiConfiguration" node.
 *
 * 2. ContentPublishedNotification fires → ApiKeyPublishedHandler sends webhook
 *    → POST /api/sync-key → Vercel Edge Config is updated with the new key.
 *
 * 3. THIS PAGE reads the key from Edge Config, then sends it to the
 *    Umbraco Delivery API as the "Api-Key" header.
 *
 * 4. DeliveryApiKeyMiddleware in Umbraco validates the header against the
 *    published "apiConfiguration" node:
 *      ✅ Keys match  → 200 OK  → content is displayed
 *      ❌ Keys differ → 401     → error is shown, no content
 *
 * Works identically locally (localhost:44317) and on Vercel
 * (set UMBRACO_BASE_URL env var to the public Umbraco URL for Vercel).
 */

// Umbraco base URL — set UMBRACO_BASE_URL env var for Vercel production.
// Defaults to localhost for local development.
const UMBRACO_BASE_URL =
  process.env.UMBRACO_BASE_URL ?? "https://localhost:44317";

const DELIVERY_API_URL = `${UMBRACO_BASE_URL}/umbraco/delivery/api/v2/content/item/home`;

export default async function Home() {
  // ── Step 1: Read the current API key from Environment Variables ──────────
  // This key is updated on Vercel by the Umbraco webhook and built into the deployment.
  const apiKey = process.env.UMBRACO_API_KEY;

  // ── Step 2: Call Umbraco Delivery API with the Environment Variable key ──
  let contentData: Record<string, unknown> | null = null;
  let httpStatus: number | null = null;
  let errorMessage: string | null = null;

  try {
    const res = await fetch(DELIVERY_API_URL, {
      headers: {
        "Api-Key": String(apiKey ?? ""), // key from environment variables
        "Accept-Language": "en-US",
      },
      cache: "no-store",                 // always fetch fresh
    });

    httpStatus = res.status;

    if (res.ok) {
      contentData = await res.json();
    } else {
      // Read error body so we can display it
      const errBody = await res.text().catch(() => "");
      errorMessage = errBody || res.statusText;
    }
  } catch (err: any) {
    // Network error (e.g. Umbraco not running, wrong URL)
    errorMessage = err.message;
  }

  // Derived state
  const keysMatch    = httpStatus === 200;
  const keysMismatch = httpStatus === 401;
  const networkError = !httpStatus;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#07090e",
        backgroundImage: "radial-gradient(circle at top, #111726 0%, #07090e 100%)",
        color: "#f3f4f6",
        fontFamily: "var(--font-sans), system-ui, -apple-system, sans-serif",
        padding: "3rem 1.5rem",
        boxSizing: "border-box",
      }}
    >
      <main
        style={{
          maxWidth: "800px",
          margin: "0 auto",
        }}
      >
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: "2.5rem" }}>
          <h1
            style={{
              fontSize: "2.25rem",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              margin: "0 0 0.5rem 0",
              background: "linear-gradient(135deg, #ffffff 30%, #a5b4fc 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            🔑 Umbraco API Key Rotation
          </h1>
          <p style={{ color: "#9ca3af", fontSize: "0.95rem", margin: 0 }}>
            Secure Automated Content Delivery API Synchronization
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#10b981",
                boxShadow: "0 0 8px #10b981",
                display: "inline-block",
                animation: "pulse 2s infinite ease-in-out",
              }}
            />
            <span style={{ color: "#6b7280", fontSize: "0.8rem", fontWeight: 500 }}>
              Live key rotated by Umbraco background service
            </span>
          </div>
        </div>

        {/* ── Key Status Card ───────────────────────────────────────────────── */}
        <div
          style={{
            background: "rgba(17, 24, 39, 0.45)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "16px",
            padding: "1.75rem",
            marginBottom: "2.5rem",
            boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.5)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Field 1: Edge Config Key */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ fontSize: "0.75rem", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                Vercel Environment Variable Key
              </div>
            
            </div>

            {/* Field 2: Delivery API URL */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ fontSize: "0.75rem", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                Delivery API Endpoint
              </div>
              <div>
                <code
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    color: "#cbd5e1",
                    padding: "0.4rem 0.75rem",
                    borderRadius: "8px",
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: "0.775rem",
                    wordBreak: "break-all",
                    display: "inline-block",
                  }}
                >
                  {DELIVERY_API_URL}
                </code>
              </div>
            </div>

            {/* Field 3: Validation Status */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ fontSize: "0.75rem", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                Security Validation
              </div>
              <div>
                {keysMatch && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      background: "rgba(52, 211, 153, 0.1)",
                      border: "1px solid rgba(52, 211, 153, 0.25)",
                      color: "#34d399",
                      padding: "0.4rem 0.85rem",
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      boxShadow: "0 0 15px rgba(52, 211, 153, 0.05)",
                    }}
                  >
                    ● Valid — Environment Variable matches Umbraco backend
                  </span>
                )}
                {keysMismatch && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      background: "rgba(248, 113, 113, 0.1)",
                      border: "1px solid rgba(248, 113, 113, 0.25)",
                      color: "#f87171",
                      padding: "0.4rem 0.85rem",
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      boxShadow: "0 0 15px rgba(248, 113, 113, 0.05)",
                    }}
                  >
                    ● Unauthorized — Environment Variable ≠ Umbraco key (401)
                  </span>
                )}
                {networkError && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      background: "rgba(251, 146, 60, 0.1)",
                      border: "1px solid rgba(251, 146, 60, 0.25)",
                      color: "#fb923c",
                      padding: "0.4rem 0.85rem",
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      boxShadow: "0 0 15px rgba(251, 146, 60, 0.05)",
                    }}
                  >
                    ● Connection Error — Umbraco backend unreachable
                  </span>
                )}
                {!keysMatch && !keysMismatch && !networkError && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      background: "rgba(248, 113, 113, 0.1)",
                      border: "1px solid rgba(248, 113, 113, 0.25)",
                      color: "#f87171",
                      padding: "0.4rem 0.85rem",
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                    }}
                  >
                    ● Error — HTTP {httpStatus}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Content Area ──────────────────────────────────────────────────── */}
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 1rem 0", color: "#f3f4f6" }}>
          📦 Delivery API Response
        </h2>

        {keysMatch && contentData ? (
          // ✅ Keys match — show full Umbraco content
          <>
            {/* Friendly property display */}
            <div
              style={{
                background: "rgba(16, 185, 129, 0.01)",
                border: "1px solid rgba(16, 185, 129, 0.15)",
                borderLeft: "4px solid #10b981",
                borderRadius: "12px",
                padding: "1.5rem",
                marginBottom: "1.5rem",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "1rem" }}>
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "#9ca3af", textTransform: "uppercase", fontWeight: 600 }}>Content Type</div>
                    <div style={{ color: "#ffffff", fontSize: "0.95rem", fontWeight: 500, marginTop: "0.15rem" }}>
                      <code>{String(contentData.contentType ?? "")}</code>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "#9ca3af", textTransform: "uppercase", fontWeight: 600 }}>Name</div>
                    <div style={{ color: "#ffffff", fontSize: "0.95rem", fontWeight: 500, marginTop: "0.15rem" }}>
                      {String(contentData.name ?? "")}
                    </div>
                  </div>
                </div>

                {(() => {
                  const props = contentData.properties;
                  if (!props || typeof props !== "object") return null;
                  const entries = Object.entries(props as Record<string, string | number | boolean | null>);
                  return (
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.75rem" }}>
                        Properties
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.75rem" }}>
                        {entries.map(([k, v]) => (
                          <div
                            key={k}
                            style={{
                              background: "rgba(255, 255, 255, 0.02)",
                              border: "1px solid rgba(255, 255, 255, 0.05)",
                              borderRadius: "8px",
                              padding: "0.75rem 1rem",
                            }}
                          >
                            <div style={{ color: "#9ca3af", fontSize: "0.65rem", textTransform: "uppercase", fontWeight: 600 }}>
                              {k}
                            </div>
                            <div style={{ color: "#ffffff", fontSize: "0.9rem", marginTop: "0.25rem", fontWeight: 500 }}>
                              {String(v)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Raw JSON */}
            <details style={{ marginTop: "1rem" }}>
              <summary style={{ cursor: "pointer", color: "#818cf8", fontSize: "0.875rem", fontWeight: 500, userSelect: "none" }}>
                View raw JSON Response
              </summary>
              <pre
                style={{
                  background: "#090c12",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  padding: "1.25rem",
                  borderRadius: "10px",
                  overflowX: "auto",
                  marginTop: "0.75rem",
                  fontSize: "0.775rem",
                  color: "#cbd5e1",
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                {JSON.stringify(contentData, null, 2)}
              </pre>
            </details>
          </>
        ) : (
          // ❌ Keys don't match OR network error — show error panel
          <div
            style={{
              background: "rgba(239, 68, 68, 0.01)",
              border: "1px solid rgba(239, 68, 68, 0.15)",
              borderLeft: "4px solid #ef4444",
              borderRadius: "12px",
              padding: "1.5rem",
            }}
          >
            {keysMismatch ? (
              <>
                <h3 style={{ color: "#ef4444", fontWeight: 700, margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>
                  ❌ 401 Unauthorized — API key mismatch
                </h3>
                <p style={{ color: "#d1d5db", margin: "0 0 1rem 0", fontSize: "0.9rem", lineHeight: "1.4" }}>
                  The API key retrieved from Vercel environment variables does not match the key currently stored in your Umbraco CMS database.
                </p>
                <p style={{ color: "#9ca3af", margin: 0, fontSize: "0.8rem", lineHeight: "1.4" }}>
                  This will resolve automatically on the next background key rotation cycle (occurs every 6 minutes) when the new key gets synced via the webhook.
                </p>
              </>
            ) : (
              <>
                <h3 style={{ color: "#fb923c", fontWeight: 700, margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>
                  ⚠️ Connection Error
                </h3>
                <p style={{ color: "#d1d5db", margin: "0 0 1rem 0", fontSize: "0.9rem", lineHeight: "1.4" }}>
                  The Next.js frontend is unable to reach your local Umbraco backend.
                </p>
                <p style={{ color: "#9ca3af", margin: "0 0 1rem 0", fontSize: "0.8rem", lineHeight: "1.4" }}>
                  Please ensure your C# project is running (`dotnet run` on port 44317) and that your ngrok tunnel is online.
                </p>
              </>
            )}
            {errorMessage && (
              <div style={{ marginTop: "1.25rem" }}>
                <div style={{ fontSize: "0.65rem", color: "#f87171", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Error Details
                </div>
                <pre
                  style={{
                    background: "#090c12",
                    border: "1px solid rgba(239, 68, 68, 0.1)",
                    padding: "0.75rem 1rem",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    color: "#fca5a5",
                    overflowX: "auto",
                    fontFamily: "var(--font-mono), monospace",
                    margin: 0,
                  }}
                >
                  {errorMessage}
                </pre>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}