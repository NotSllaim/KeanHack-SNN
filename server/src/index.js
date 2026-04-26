import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";
import historyRoutes from "./routes/historyRoutes.js";
import meRoutes from "./routes/meRoutes.js";
import readingRoutes from "./routes/readingRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import verbiageRoutes from "./routes/verbiageRoutes.js";
import voiceRoutes from "./routes/voiceRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env"), override: false });
dotenv.config({ override: false });

const SOLANA_REQUIRED_VARS = [
  "HELIUS_DEVNET_RPC",
  "MERCHANT_WALLET",
  "USDC_MINT_DEVNET",
  "SUBSCRIPTION_PRICE_USDC",
  "SUBSCRIPTION_DURATION_DAYS"
];
const missingSolanaVars = SOLANA_REQUIRED_VARS.filter((k) => !process.env[k]);
if (missingSolanaVars.length > 0) {
  console.warn(
    `[solana] missing env vars — subscription verification will reject requests: ${missingSolanaVars.join(", ")}`
  );
}

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "Lingo API" });
});

app.use("/api/auth", authRoutes);
app.use("/api/me", meRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/conversation", conversationRoutes);
app.use("/api/reading", readingRoutes);
app.use("/api/verbiage", verbiageRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/history", historyRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.message || "Something went wrong"
  });
});

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`Lingo API running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed", error);
    process.exit(1);
  });
