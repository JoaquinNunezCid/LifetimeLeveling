import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import stateRoutes from "./routes/state.js";

const app = express();
const port = process.env.PORT || 4000;
const mongoUri = process.env.MONGODB_URI || "";

if (!mongoUri) {
  console.error("Missing MONGODB_URI in environment.");
  process.exit(1);
}

app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true,
}));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/state", stateRoutes);

mongoose.connect(mongoUri)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(port, () => {
      console.log(`API listening on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });
