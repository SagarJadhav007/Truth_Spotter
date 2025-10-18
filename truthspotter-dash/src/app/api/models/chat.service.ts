import supabase from "../config/supabase";
import type { ChatRequest, ChatResponse } from "./chat.types";

// Enhanced types to include session support
export interface EnhancedChatRequest extends ChatRequest {
  session_id?: string;
}

export async function handleChatRequest(input: EnhancedChatRequest): Promise<ChatResponse> {
  let sessionId = input.session_id;

  // Create a new session if none provided
  if (!sessionId) {
    const { data: sessionData, error: sessionError } = await supabase
      .from("chat_sessions")
      .insert([{ 
        title: `Chat ${new Date().toLocaleString()}` 
      }])
      .select("id")
      .single();

    if (sessionError) {
      console.error('Session creation error:', sessionError);
      throw new Error(sessionError.message);
    }
    
    sessionId = sessionData.id;
  }

  // Insert user message
  const { data: userMessage, error: userError } = await supabase
    .from("chat_messages")
    .insert([{ 
      content: input.message,
      role: 'user',
      session_id: sessionId
    }])
    .select("*")
    .single();

  if (userError) {
    console.error('User message error:', userError);
    throw new Error(userError.message);
  }

  // Generate bot response
  const botResponse = `Echo: ${input.message}`;

  // Insert bot message
  const { data: botMessage, error: botError } = await supabase
    .from("chat_messages")
    .insert([{ 
      content: botResponse,
      role: 'assistant',
      session_id: sessionId
    }])
    .select("*")
    .single();

  if (botError) {
    console.error('Bot message error:', botError);
    throw new Error(botError.message);
  }

  return {
    reply: botResponse,
    saved: true,
    id: botMessage?.id,
    session_id: sessionId
  };
}