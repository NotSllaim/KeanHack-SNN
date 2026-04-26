import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { verifyUsdcPayment } from "../services/solanaVerification.js";

const router = express.Router();

router.post("/verify", requireAuth, async (req, res) => {
  // TODO Step 8: reject duplicate signatures (cross-check req.user.paymentHistory)
  const { signature, walletAddress } = req.body || {};

  if (!signature || typeof signature !== "string") {
    return res.status(400).json({
      valid: false,
      reason: "signature is required",
      message: "signature is required"
    });
  }
  if (!walletAddress || typeof walletAddress !== "string") {
    return res.status(400).json({
      valid: false,
      reason: "walletAddress is required",
      message: "walletAddress is required"
    });
  }

  try {
    const result = await verifyUsdcPayment({
      signature,
      expectedSenderWallet: walletAddress
    });

    if (result.valid) {
      console.log(
        `[subscription/verify] ok user=${req.user._id} sig=${signature.slice(0, 8)}... amount=${result.details.amount} USDC`
      );
      return res.json(result);
    }

    console.warn(
      `[subscription/verify] reject user=${req.user._id} sig=${signature.slice(0, 8)}... reason="${result.reason}"`
    );
    return res.status(400).json({ ...result, message: result.reason });
  } catch (err) {
    console.error("[subscription/verify] unexpected error:", err);
    return res.status(500).json({
      valid: false,
      reason: "Internal error verifying payment",
      message: "Internal error verifying payment"
    });
  }
});

export default router;
