import { createClient } from "npm:@supabase/supabase-js@2.57.4";

// JWT verification is performed explicitly so this works with publishable keys.
// Service credentials remain in Supabase's function environment, never the app.
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", {headers});
  if (request.method !== "POST") return new Response("{}", {status:405,headers});
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return new Response("{}", {status:401,headers});
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data:{user},error:authError} = await admin.auth.getUser(token);
  if (authError || !user) return new Response("{}", {status:401,headers});
  // Never accept a user ID from the request body.
  try {
    // Revoke refresh sessions before deleting the user. Existing access JWTs
    // expire normally; getUser rejects them once their user is deleted.
    const revoked = await admin.auth.admin.signOut(token, "global");
    if (revoked.error) throw revoked.error;
    const bucket = admin.storage.from("profile-photos");
    for (;;) {
      const {data,error} = await bucket.list(user.id, {limit:1000});
      if (error) throw error;
      if (!data?.length) break;
      const removed = await bucket.remove(data.map(file => `${user.id}/${file.name}`));
      if (removed.error) throw removed.error;
    }
    const {error} = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    // family_state is deleted by the foreign key cascade.
    return new Response(JSON.stringify({deleted:true}), {headers});
  } catch (_) {
    return new Response(JSON.stringify({error:"Deletion could not be completed"}), {status:500,headers});
  }
});
