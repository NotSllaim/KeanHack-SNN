import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { User } from "../src/models/User.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function run() {
  if (!MONGO_URI) {
    console.error("Missing MONGO_URI / MONGODB_URI env var");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);

  const result = await User.collection.updateMany(
    {
      $or: [
        { tier: { $exists: false } },
        { walletAddress: { $exists: false } },
        { subscriptionExpiresAt: { $exists: false } },
        { paymentHistory: { $exists: false } }
      ]
    },
    {
      $set: {
        tier: "free",
        walletAddress: null,
        subscriptionExpiresAt: null,
        paymentHistory: []
      }
    }
  );

  console.log(
    `Matched ${result.matchedCount} users, modified ${result.modifiedCount}.`
  );

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
