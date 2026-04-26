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
    console.error("Missing MONGODB_URI env var");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);

  const collection = User.collection;

  const upgradedUsers = await collection
    .find({ upgraded: true })
    .project({ _id: 1, walletAddress: 1, upgradeWalletAddress: 1 })
    .toArray();

  let promotedCount = 0;
  let walletCopiedCount = 0;

  for (const u of upgradedUsers) {
    const set = { tier: "pro" };
    if ((u.walletAddress === null || u.walletAddress === undefined) && u.upgradeWalletAddress) {
      set.walletAddress = u.upgradeWalletAddress;
    }

    const result = await collection.updateOne({ _id: u._id }, { $set: set });
    if (result.modifiedCount > 0) {
      promotedCount += 1;
      if (set.walletAddress) {
        walletCopiedCount += 1;
      }
    }
  }

  const cleanup = await collection.updateMany(
    {
      $or: [
        { upgraded: { $exists: true } },
        { upgradeWalletAddress: { $exists: true } },
        { upgradeTransactionSignature: { $exists: true } },
        { upgradedAt: { $exists: true } }
      ]
    },
    {
      $unset: {
        upgraded: "",
        upgradeWalletAddress: "",
        upgradeTransactionSignature: "",
        upgradedAt: ""
      }
    }
  );

  console.log(`Promoted to pro: ${promotedCount}`);
  console.log(`Wallet addresses copied: ${walletCopiedCount}`);
  console.log(`Documents cleaned of old fields: ${cleanup.modifiedCount}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
