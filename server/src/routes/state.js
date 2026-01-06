import express from "express";
import State from "../models/State.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { defaultState } from "../utils/defaultState.js";

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "not_found" });

    let state = await State.findOne({ userId: req.userId });
    if (!state) {
      const data = defaultState({ name: user.name });
      state = await State.create({ userId: req.userId, data });
    }

    return res.json({ state: state.data });
  } catch {
    return res.status(500).json({ error: "server_error" });
  }
});

router.put("/", requireAuth, async (req, res) => {
  try {
    const payload = req.body?.state ?? null;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "invalid_input" });
    }

    const state = await State.findOneAndUpdate(
      { userId: req.userId },
      { data: payload },
      { new: true, upsert: true }
    );

    return res.json({ state: state.data });
  } catch {
    return res.status(500).json({ error: "server_error" });
  }
});

router.post("/reset", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "not_found" });

    const name = String(req.body?.name || "").trim();
    const data = defaultState({ name: name || user.name });

    const state = await State.findOneAndUpdate(
      { userId: req.userId },
      { data },
      { new: true, upsert: true }
    );

    return res.json({ state: state.data });
  } catch {
    return res.status(500).json({ error: "server_error" });
  }
});

export default router;
