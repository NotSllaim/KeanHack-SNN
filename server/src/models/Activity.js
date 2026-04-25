import mongoose from "mongoose";

const scoreSchema = new mongoose.Schema(
  {
    confidence: { type: Number, default: 0 },
    clarity: { type: Number, default: 0 },
    engagement: { type: Number, default: 0 },
    pacing: { type: Number, default: 0 },
    wording: { type: Number, default: 0 }
  },
  { _id: false }
);

const activitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ["conversation", "reading", "verbiage"],
      required: true
    },
    prompt: String,
    userResponse: String,
    botId: String,
    botReply: String,
    feedback: {
      summary: String,
      strengths: [{ type: String }],
      improvements: [{ type: String }],
      fillerWords: [{ type: String }],
      thoughtBubble: String,
      highlights: [
        {
          text: String,
          reason: String,
          suggestion: String
        }
      ]
    },
    scores: scoreSchema,
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

export const Activity = mongoose.model("Activity", activitySchema);

