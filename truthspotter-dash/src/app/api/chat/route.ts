import { NextResponse } from "next/server";
import { handleChatRequest } from "../models/chat.service";
import { validateChatInput } from "../middlewares/validation";
import { applySecurity } from "../middlewares/security";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    applySecurity(req);
    validateChatInput(body);
    const data = await handleChatRequest(body);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    const status = err?.message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ success: false, error: err?.message || "Bad Request" }, { status });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Chat API is alive" });
}
