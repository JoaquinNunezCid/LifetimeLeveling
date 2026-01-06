import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return res.status(401).json({ error: "missing_token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "");
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
}
