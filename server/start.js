import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting Invest Tracker...");

  // Try to run prisma db push with retries
  for (let i = 0; i < 5; i++) {
    try {
      console.log(`⏳ DB push attempt ${i + 1}/5...`);
      execSync("npx prisma db push --accept-data-loss", { 
        stdio: "inherit",
        timeout: 60000 
      });
      console.log("✅ Database schema pushed");
      break;
    } catch (e) {
      console.log(`❌ DB push failed: ${e.message}`);
      if (i < 4) {
        console.log("⏳ Retrying in 5 seconds...");
        await new Promise(r => setTimeout(r, 5000));
      } else {
        console.log("⚠️ Could not push DB schema, continuing anyway...");
      }
    }
  }

  // Test DB connection
  try {
    await prisma.$connect();
    console.log("✅ Database connected");
    await prisma.$disconnect();
  } catch (e) {
    console.log("⚠️ Database not connected, app may not work correctly");
  }

  // Start the server
  console.log("🌐 Starting server...");
  await import("./src/index.js");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
