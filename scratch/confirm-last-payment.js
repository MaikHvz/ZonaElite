const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const envPath = path.resolve(__dirname, "../.env.local");
let supabaseUrl = "";
let supabaseServiceKey = "";
let apiUrl = "";
let apiKey = "";
let secretKey = "";

const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let v = m[2] || "";
    if (v.startsWith('"') && v.endsWith('"')) v = v.substring(1, v.length - 1);
    if (m[1] === "NEXT_PUBLIC_SUPABASE_URL") supabaseUrl = v;
    if (m[1] === "SUPABASE_SERVICE_ROLE_KEY") supabaseServiceKey = v;
    if (m[1] === "FLOW_API_URL") apiUrl = v;
    if (m[1] === "FLOW_API_KEY") apiKey = v;
    if (m[1] === "FLOW_SECRET_KEY") secretKey = v;
  }
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function signFlowParams(params) {
  const keys = Object.keys(params).sort();
  let toSign = "";
  for (const key of keys) toSign += key + params[key];
  return crypto.createHmac("sha256", secretKey).update(toSign).digest("hex");
}

async function main() {
  const paymentId = "ff70e384-b2aa-416d-9936-61a620798ae8";
  const token = "2ADFF6ADABEB4FA5573C25493EC6109964BCFF8M";
  const userId = "8b509706-3f5d-4fe4-8002-2d9da964a266";

  // Verify with Flow API
  const signParams = { apiKey, token };
  const s = signFlowParams(signParams);
  const url = `${apiUrl}/payment/getStatus?apiKey=${apiKey}&token=${token}&s=${s}`;

  const resp = await fetch(url);
  const flowData = await resp.json();
  console.log("Flow API response:", JSON.stringify(flowData, null, 2));

  if (flowData.status !== 2) {
    console.log("Payment NOT approved in Flow. Status:", flowData.status);
    return;
  }

  console.log("Payment IS approved in Flow! Updating DB...");

  const { error: updateErr } = await supabase
    .from("payments")
    .update({
      status: "pagado",
      paid_at: new Date().toISOString(),
      flow_order: flowData.flowOrder || null,
    })
    .eq("id", paymentId);

  if (updateErr) {
    console.error("Update payment error:", updateErr);
    return;
  }
  console.log("Payment updated to pagado");

  // Check if payment already has a beneficiary
  const { data: payRow } = await supabase
    .from("payments")
    .select("beneficiary_id")
    .eq("id", paymentId)
    .single();

  let beneficiaryId = payRow?.beneficiary_id;

  if (!beneficiaryId) {
    // Find own beneficiary
    const { data: beneficiary } = await supabase
      .from("beneficiaries")
      .select("id")
      .eq("profile_id", userId)
      .maybeSingle();
    beneficiaryId = beneficiary?.id;
  }

  if (!beneficiaryId) {
    console.error("No beneficiary found for user:", userId);
    return;
  }
  console.log("Beneficiary:", beneficiaryId);

  // Find plan
  const { data: plan } = await supabase
    .from("membership_plans")
    .select("id, duration_days, name")
    .eq("active", true)
    .order("price", { ascending: true })
    .limit(1)
    .single();

  if (!plan) {
    console.error("No active plan found");
    return;
  }

  // Check existing membership
  const { data: existing } = await supabase
    .from("memberships")
    .select("id")
    .eq("purchased_by", userId)
    .eq("plan_id", plan.id)
    .eq("status", "activa")
    .maybeSingle();

  if (existing) {
    console.log("Active membership exists:", existing.id);
    await supabase.from("payments").update({ membership_id: existing.id }).eq("id", paymentId);
    console.log("Payment linked to existing membership");
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const endDate = new Date(Date.now() + plan.duration_days * 86400000).toISOString().split("T")[0];

  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .insert({
      beneficiary_id: beneficiaryId,
      plan_id: plan.id,
      purchased_by: userId,
      start_date: today,
      end_date: endDate,
      status: "activa",
    })
    .select("id")
    .single();

  if (memErr) {
    console.error("Membership error:", memErr);
    return;
  }

  await supabase.from("payments").update({ membership_id: membership.id }).eq("id", paymentId);
  console.log("Done! Membership created:", membership.id);
}

main().catch(console.error);
