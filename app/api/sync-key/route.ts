import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * POST /api/sync-key
 *
 * Called automatically by Umbraco's ApiKeyPublishedHandler every time
 * a new API key is generated and published.
 *
 * Flow:
 *   Umbraco Background/Rotation Service
 *     → POST http://localhost:3000/api/sync-key (Local) or Production URL
 *     → If Local: updates UMBRACO_API_KEY in .env.local
 *     → If Vercel:
 *          1. Updates UMBRACO_API_KEY in Vercel Environment Variables using Vercel API
 *          2. Triggers Vercel rebuild/redeploy via Vercel Deploy Hook
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    console.log("[sync-key] WEBHOOK HIT");

    const apiKey: string = body?.properties?.apiKey;

    if (!apiKey) {
      // Umbraco fires ContentPublishedNotification for ALL content types.
      // Skip silently with 200 so Umbraco doesn't see an error.
      console.log(
        `[sync-key] ⏭️ Skipped — no apiKey in body (contentType: ${body?.contentType ?? "unknown"})`
      );
      return NextResponse.json({ skipped: true, contentType: body?.contentType });
    }

    console.log("[sync-key] ✅ New API Key received:", apiKey);

    // ── Local Development Handling ───────────────────────────────────────────
    // If running locally, we update the local .env.local file directly.
    const isLocal = process.env.NODE_ENV === "development" || !process.env.VERCEL;
    if (isLocal) {
      try {
        const envPath = path.join(process.cwd(), ".env.local");
        if (fs.existsSync(envPath)) {
          let envContent = fs.readFileSync(envPath, "utf8");
          if (envContent.includes("UMBRACO_API_KEY=")) {
            envContent = envContent.replace(/UMBRACO_API_KEY=.*/, `UMBRACO_API_KEY=${apiKey}`);
          } else {
            envContent += `\nUMBRACO_API_KEY=${apiKey}`;
          }
          fs.writeFileSync(envPath, envContent, "utf8");
          console.log("[sync-key] ✅ Updated UMBRACO_API_KEY locally in .env.local");
        } else {
          fs.writeFileSync(envPath, `UMBRACO_API_KEY=${apiKey}\n`, "utf8");
          console.log("[sync-key] ✅ Created .env.local with UMBRACO_API_KEY");
        }
      } catch (localError: any) {
        console.error("[sync-key] ⚠️ Failed to update .env.local file locally:", localError.message);
      }
    }

    // ── Vercel Production Environment Variables Update ───────────────────────
    const projectId = process.env.VERCEL_PROJECT_ID;
    const teamId = process.env.VERCEL_TEAM_ID;
    const authToken = process.env.VERCEL_AUTH_TOKEN;

    if (projectId && authToken) {
      const url = new URL(`https://api.vercel.com/v10/projects/${projectId}/env`);
      url.searchParams.append("upsert", "true");
      if (teamId) {
        url.searchParams.append("teamId", teamId);
      }

      console.log(`[sync-key] Updating Vercel Env Var for project ${projectId}...`);
      const envResponse = await fetch(url.toString(), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "UMBRACO_API_KEY",
          value: apiKey,
          type: "plain",
          target: ["production", "preview", "development"],
        }),
      });

      if (!envResponse.ok) {
        const errorText = await envResponse.text();
        console.error(`[sync-key] ❌ Vercel env update failed:`, errorText);
        return NextResponse.json(
          { error: "Failed to update Vercel env var", detail: errorText },
          { status: 502 }
        );
      }

      console.log("[sync-key] ✅ Vercel environment variable updated successfully");

      // ── Trigger Vercel Redeployment ─────────────────────────────────────────
      const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
      if (deployHookUrl) {
        console.log("[sync-key] Triggering Vercel Redeployment via Deploy Hook...");
        const deployResponse = await fetch(deployHookUrl, {
          method: "POST",
        });

        if (!deployResponse.ok) {
          const deployErr = await deployResponse.text();
          console.error("[sync-key] ❌ Vercel Redeployment trigger failed:", deployErr);
        } else {
          console.log("[sync-key] ✅ Vercel Redeployment triggered successfully");
        }
      } else {
        console.warn("[sync-key] ⚠️ VERCEL_DEPLOY_HOOK_URL not configured. Cannot trigger redeployment.");
      }
    } else {
      console.log("[sync-key] Vercel Project ID or Auth Token is not configured. Skipping Vercel updates.");
    }

    return NextResponse.json({ success: true, apiKey });
  } catch (error: any) {
    console.error("[sync-key] ❌ Unhandled error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}