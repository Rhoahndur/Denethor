#!/usr/bin/env node
/**
 * Cleanup Script - Kill all active Browserbase sessions
 */

import { Browserbase } from "@browserbasehq/sdk";
import * as dotenv from "dotenv";

dotenv.config();

async function cleanup() {
  console.log("🧹 Cleaning up Browserbase sessions...\n");

  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;

  if (!apiKey || !projectId) {
    console.error("❌ Error: Missing environment variables");
    console.error(
      "   Please set BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID",
    );
    return;
  }

  const browserbase = new Browserbase({
    apiKey,
  });

  try {
    // List all sessions (SDK doesn't accept projectId in list)
    const sessions = await browserbase.sessions.list();

    console.log(`Found ${sessions.length} sessions`);

    for (const session of sessions) {
      console.log(`\nSession ${session.id}:`);
      console.log(`  Status: ${session.status}`);
      console.log(`  Created: ${session.createdAt}`);

      // Only try to stop if status indicates it's running
      if (session.status === "RUNNING" || session.status !== "COMPLETED") {
        console.log(`  ❌ Stopping session...`);
        try {
          await browserbase.sessions.update(session.id, {
            projectId,
            status: "REQUEST_RELEASE",
          });
          console.log(`  ✅ Session stopped`);
        } catch (err) {
          console.log(`  ⚠️  Could not stop: ${err}`);
        }
      }
    }

    console.log("\n✅ Cleanup complete!");
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

cleanup();
