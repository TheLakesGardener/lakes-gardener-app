// Sends an invoice or receipt PDF to the customer through Resend.
// The caller must be signed in; the invoice is read with their own login,
// so row-level security decides whether they can send it. The recipient
// address always comes from the stored invoice, never from the request.
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

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return json(500, { error: "Email sending isn't set up yet (Resend key missing)" });
  const from = Deno.env.get("LAKES_FROM_EMAIL") ?? "The Lakes Gardener <alan@thelakesgardener.co.uk>";

  const auth = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json(401, { error: "Please sign in again" });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "Bad request" }); }
  const { invoiceId, kind, subject, text, filename, pdf, replyTo } = body ?? {};
  if (typeof invoiceId !== "string" || !["invoice", "receipt"].includes(kind)) return json(400, { error: "Bad request" });
  if (typeof pdf !== "string" || pdf.length < 100 || pdf.length > 7_000_000) return json(400, { error: "The PDF is missing or too large" });
  if (!atob(pdf.slice(0, 8)).startsWith("%PDF")) return json(400, { error: "That isn't a PDF" });

  // Read the invoice as the signed-in user (RLS applies).
  const { data: row, error } = await userClient.from("invoices").select("data").eq("id", invoiceId).maybeSingle();
  if (error || !row) return json(404, { error: "Invoice not found" });
  const inv = row.data as Record<string, unknown>;
  const to = String(inv.customerEmail ?? "").split(/[,;]/).map((s) => s.trim()).filter((s) => EMAIL_RE.test(s));
  if (!to.length) return json(400, { error: "This customer has no valid email address" });

  const safeName = String(filename || `${kind}.pdf`).replace(/[^\w .()-]+/g, " ").slice(0, 120);
  const payload: Record<string, unknown> = {
    from,
    to,
    subject: String(subject || (kind === "receipt" ? "Your receipt" : "Your invoice")).slice(0, 200),
    text: String(text || "").slice(0, 10_000),
    attachments: [{ filename: safeName.endsWith(".pdf") ? safeName : safeName + ".pdf", content: pdf }],
  };
  if (typeof replyTo === "string" && EMAIL_RE.test(replyTo.trim())) payload.reply_to = replyTo.trim();

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) return json(502, { error: out?.message ?? `Resend error ${r.status}` });

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  await admin.from("email_log").insert({ owner_id: user.id, kind, invoice_id: invoiceId, to_email: to.join(", "), resend_id: out?.id ?? null });

  return json(200, { ok: true, id: out?.id, to });
});
