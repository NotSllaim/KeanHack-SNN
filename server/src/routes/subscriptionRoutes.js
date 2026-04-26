import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { verifyUsdcPayment } from "../services/solanaVerification.js";
import { applyVerifiedPayment } from "../services/subscriptionService.js";

const router = express.Router();

router.post("/verify", requireAuth, async (req, res) => {
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

  let result;
  try {
    result = await verifyUsdcPayment({
      signature,
      expectedSenderWallet: walletAddress
    });
  } catch (err) {
    console.error("[subscription/verify] unexpected verification error:", err);
    return res.status(500).json({
      valid: false,
      reason: "Internal error verifying payment",
      message: "Internal error verifying payment"
    });
  }

  if (!result.valid) {
    console.warn(
      `[subscription/verify] reject user=${req.user._id} sig=${signature.slice(0, 8)}... reason="${result.reason}"`
    );
    return res.status(400).json({ ...result, message: result.reason });
  }

  try {
    const updatedUser = await applyVerifiedPayment({
      userId: req.user._id,
      signature,
      walletAddress,
      verificationDetails: result.details
    });
    console.log(
      `[subscription/verify] ok user=${req.user._id} sig=${signature.slice(0, 8)}... amount=${result.details.amount} USDC`
    );
    return res.json({ valid: true, user: updatedUser });
  } catch (err) {
    if (err.message === "DUPLICATE_SIGNATURE") {
      console.warn(
        `[subscription/verify] duplicate sig user=${req.user._id} sig=${signature.slice(0, 8)}...`
      );
      return res.status(409).json({
        valid: false,
        reason: "This payment has already been processed",
        message: "This payment has already been used to upgrade an account."
      });
    }
    console.error("[subscription/verify] DB error applying payment:", err);
    return res.status(500).json({
      valid: false,
      reason: "Internal error applying payment",
      message: "Internal error applying payment"
    });
  }
});

export default router;
