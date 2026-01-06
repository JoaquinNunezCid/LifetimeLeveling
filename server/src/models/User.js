import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "Usuario" },
    email: { type: String, trim: true, lowercase: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    avatar: { type: String, default: "" },
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    avatar: this.avatar || "",
    createdAt: this.createdAt,
  };
};

export default mongoose.model("User", userSchema);
