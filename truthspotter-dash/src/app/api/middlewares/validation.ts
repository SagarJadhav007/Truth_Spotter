import type { ChatRequest } from "../models/chat.types";

export function validateChatInput(body: unknown): asserts body is ChatRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body");
  }
  const b = body as Record<string, unknown>;
  if (typeof b.message !== "string" || b.message.trim().length === 0) {
    throw new Error("Field 'message' is required");
  }
}
