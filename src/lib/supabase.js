
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.sb_publishable_z-OayYL20D_7SC2HhQY1GQ_GItuWwU9;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Supabase environment variables are missing.");
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
);