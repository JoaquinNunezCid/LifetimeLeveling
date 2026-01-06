import mongoose from "mongoose";

const stateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, index: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("State", stateSchema);
