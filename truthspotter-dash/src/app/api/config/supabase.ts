import { createClient } from "@supabase/supabase-js";
import { ENV } from "./environment";

if (!ENV.SUPABASE_URL || !ENV.SUPABASE_SERVICE_KEY) {
  // Fail fast during boot if missing env
  console.warn("[supabase] Missing SUPABASE env vars.");
}

const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_KEY);
export default supabase;
