import bcrypt from "bcryptjs";
import User from "../models/User.js";

// Seed the fixed HR account on startup so the dashboard is usable out of the box.
// Credentials intentionally hardcoded here per product spec — change before shipping.
const HR_EMAIL = process.env.HR_SEED_EMAIL || "bsailalan@gmail.com";
const HR_PASSWORD = process.env.HR_SEED_PASSWORD || "Sailalan@2003";

// An older schema marked `walletAddress` unique. The new email/password flow
// stores null there for most users, which trips the unique constraint. Drop it
// if it's still around — idempotent and safe.
const dropLegacyWalletIndex = async () => {
  try {
    const indexes = await User.collection.indexes();
    const legacy = indexes.find(
      (i) => i.name === "walletAddress_1" && i.unique
    );
    if (legacy) {
      await User.collection.dropIndex("walletAddress_1");
      console.log("[seed] dropped legacy unique walletAddress index");
    }
  } catch (err) {
    // Collection might not exist yet on a fresh DB — safe to ignore.
    if (err.codeName !== "NamespaceNotFound") {
      console.warn("[seed] could not check legacy index:", err.message);
    }
  }
};

export const seedHrUser = async () => {
  await dropLegacyWalletIndex();
  const existing = await User.findOne({ email: HR_EMAIL.toLowerCase() });
  if (existing) {
    // Keep the role in sync in case someone flipped it manually.
    if (existing.role !== "hr") {
      existing.role = "hr";
      await existing.save();
      console.log(`[seed] promoted ${HR_EMAIL} to HR`);
    }
    return;
  }

  const passwordHash = await bcrypt.hash(HR_PASSWORD, 10);
  await User.create({
    email: HR_EMAIL.toLowerCase(),
    passwordHash,
    role: "hr",
    mustChangePassword: false, // HR knows their own password — no forced change
  });
  console.log(`[seed] created HR account: ${HR_EMAIL}`);
};
