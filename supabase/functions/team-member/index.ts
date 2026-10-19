// Adds or removes a gardener on the signed-in owner's team.
// Only an approved owner (public.is_allowed()) can call it. Adding creates the
// gardener's login (no password; they sign in with an email link) so sign-ups
// can stay switched off for everyone else.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json(401, { error: "Please sign in again" });
  const { data: ok } = await userClient.rpc("is_allowed");
  if (ok !== true) return json(403, { error: "Only the business owner can manage the team" });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "Bad request" }); }
  const action = body?.action, email = String(body?.email ?? "").trim().toLowerCase(), name = String(body?.name ?? "").trim().slice(0, 80);
  if (!["add", "remove"].includes(action) || !EMAIL_RE.test(email)) return json(400, { error: "Check the email address" });
  if (email === (user.email ?? "").toLowerCase()) return json(400, { error: "That's your own email" });

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  if (action === "remove") {
    const { error } = await admin.from("team_members").delete().eq("owner_id", user.id).eq("email", email);
    if (error) return json(500, { error: "Couldn't remove them. Try again." });
    return json(200, { ok: true });
  }
  const { data: owner } = await admin.from("allowed_emails").select("email").ilike("email", email).maybeSingle();
  if (owner) return json(400, { error: "That email belongs to a business owner" });
  const { data: other } = await admin.from("team_members").select("owner_id").ilike("email", email).neq("owner_id", user.id).maybeSingle();
  if (other) return json(400, { error: "That gardener is already on another team" });
  const { error: insErr } = await admin.from("team_members").upsert({ owner_id: user.id, email, name, role: "gardener" }, { onConflict: "owner_id,email" });
  if (insErr) return json(500, { error: "Couldn't add them. Try again." });
  const { error: cErr } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (cErr && !/already|exists|registered/i.test(cErr.message)) return json(500, { error: "Added to the team, but their login couldn't be created: " + cErr.message });
  return json(200, { ok: true });
});
