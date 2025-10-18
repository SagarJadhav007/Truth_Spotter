
import type { NextRequest } from "next/server";

export function applySecurity(req: Request | NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const required = `Bearer ${process.env.API_KEY}`;
  if (!process.env.API_KEY) {
    console.warn("[security] API_KEY not set; skipping auth check.");
    return;
  }
  if (auth !== required) {
    throw new Error("Unauthorized");
  }
}
