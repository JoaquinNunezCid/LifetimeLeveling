import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

function signToken(userId) {
  const secret = process.env.JWT_SECRET || "";
  if (!secret) {
    throw new Error("missing_jwt_secret");
  }
  return jwt.sign({ sub: userId }, secret, { expiresIn: "7d" });
}

router.post("/register", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "").trim();

    if (!email || !password) {
      return res.status(400).json({ error: "invalid_input" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "email_taken" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name || "Usuario",
      email,
      passwordHash,
    });

    const token = signToken(user._id.toString());
    return res.status(201).json({ token, user: user.toPublic() });
  } catch (err) {
    if (err?.message === "missing_jwt_secret") {
      return res.status(500).json({ error: "server_misconfigured" });
    }
    return res.status(500).json({ error: "server_error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "").trim();

    if (!email || !password) {
      return res.status(400).json({ error: "invalid_input" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    const token = signToken(user._id.toString());
    return res.json({ token, user: user.toPublic() });
  } catch (err) {
    if (err?.message === "missing_jwt_secret") {
      return res.status(500).json({ error: "server_misconfigured" });
    }
    return res.status(500).json({ error: "server_error" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "not_found" });
    return res.json({ user: user.toPublic() });
  } catch {
    return res.status(500).json({ error: "server_error" });
  }
});

router.patch("/me", requireAuth, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const avatar = req.body?.avatar;

    const update = {};
    if (name) update.name = name;
    if (avatar !== undefined) update.avatar = avatar;

    const user = await User.findByIdAndUpdate(req.userId, update, { new: true });
    if (!user) return res.status(404).json({ error: "not_found" });
    return res.json({ user: user.toPublic() });
  } catch {
    return res.status(500).json({ error: "server_error" });
  }
});

router.patch("/me/password", requireAuth, async (req, res) => {
  try {
    const password = String(req.body?.password || "").trim();
    if (!password) return res.status(400).json({ error: "invalid_input" });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.findByIdAndUpdate(req.userId, { passwordHash }, { new: true });
    if (!user) return res.status(404).json({ error: "not_found" });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "server_error" });
  }
});

export default router;
