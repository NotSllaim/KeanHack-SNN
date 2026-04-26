import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    profile: {
      goals: [{ type: String }],
      preferredBot: { type: String, default: "sana" },
      companionElement: {
        id: {
          type: String,
          enum: ["fire", "water", "leaf", "lightning"]
        },
        name: String,
        description: String,
        scores: {
          fire: { type: Number, default: 0 },
          water: { type: Number, default: 0 },
          leaf: { type: Number, default: 0 },
          lightning: { type: Number, default: 0 }
        }
      },
      companionSurvey: mongoose.Schema.Types.Mixed
    },
    scores: {
      confidenceAverage: { type: Number, default: 0 },
      clarityAverage: { type: Number, default: 0 },
      sessionsCompleted: { type: Number, default: 0 }
    },
    lastLoginAt: Date
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.statics.hashPassword = function hashPassword(password) {
  return bcrypt.hash(password, 12);
};

export const User = mongoose.model("User", userSchema);

