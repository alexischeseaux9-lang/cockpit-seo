import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Client serveur avec la Service Role key. A n'utiliser que cote serveur
// (route handlers, server components, crons). Jamais expose au navigateur.
export function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Next.js met en cache global.fetch par defaut. On force no-store pour
      // que les lectures Supabase soient toujours fraiches.
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
