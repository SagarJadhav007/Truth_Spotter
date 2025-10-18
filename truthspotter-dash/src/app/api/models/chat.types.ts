
export interface ChatRequest {
  message: string;
  session_id?: string; // Optional session ID
}

export interface ChatResponse {
  reply: string;
  saved: boolean;
  id?: string | number;
  session_id?: string; // Include session ID in response
}