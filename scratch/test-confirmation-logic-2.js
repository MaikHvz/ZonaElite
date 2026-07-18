const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "../.env.local");
let supabaseUrl = "";
let supabaseServiceKey = "";

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  const lines = envContent.split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      if (key === "NEXT_PUBLIC_SUPABASE_URL") supabaseUrl = value;
      if (key === "SUPABASE_SERVICE_ROLE_KEY") supabaseServiceKey = value;
    }
  }
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const token = "8E39044CFE259E26CBA590E061996468B0EEB7DH";
  
  const { data: payment } = await supabase
    .from("payments")
    .select("id, user_id, commerce_order, status, amount, concept, flow_token, beneficiary_id")
    .eq("flow_token", token)
    .maybeSingle();

  if (!payment) {
    console.log("Payment not found");
    return;
  }

  console.log("Payment found:", payment);

  const metadataMatch = payment.concept?.match(/^Membresía\s+(.+)$/);
  const planName = metadataMatch ? metadataMatch[1].trim() : null;

  if (!planName) {
    console.log("Could not extract plan name from:", payment.concept);
    return;
  }

  console.log("Extracted plan name:", planName);

  const { data: plan, error: planErr } = await supabase
    .from("membership_plans")
    .select("id, duration_days")
    .ilike("name", planName)
    .single();

  if (planErr || !plan) {
    console.log("Plan not found in DB:", planName, planErr);
    return;
  }

  console.log("Plan found:", plan);

  let targetBeneficiaryId = payment.beneficiary_id;

  // Fallback to titular ownBeneficiary since beneficiary_id is null on this payment (created before local UI updates)
  if (!targetBeneficiaryId) {
    const { data: ownBeneficiary, error: benErr } = await supabase
      .from("beneficiaries")
      .select("id")
      .eq("profile_id", payment.user_id)
      .maybeSingle();

    if (benErr || !ownBeneficiary) {
      console.log("No beneficiary found for user:", payment.user_id, benErr);
      return;
    }
    targetBeneficiaryId = ownBeneficiary.id;
  }

  console.log("Using Beneficiary ID:", targetBeneficiaryId);

  const today = new Date().toISOString().split("T")[0];
  const endDate = new Date(Date.now() + plan.duration_days * 86400000)
    .toISOString()
    .split("T")[0];

  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .insert({
      beneficiary_id: targetBeneficiaryId,
      plan_id: plan.id,
      purchased_by: payment.user_id,
      start_date: today,
      end_date: endDate,
      status: "activa",
    })
    .select("id")
    .single();

  if (memErr) {
    console.error("Error inserting membership:", memErr);
    return;
  }

  console.log("Membership inserted successfully:", membership);

  const { data: updateRes, error: updateErr } = await supabase
    .from("payments")
    .update({ 
      status: "pagado", 
      paid_at: new Date().toISOString(),
      membership_id: membership.id 
    })
    .eq("id", payment.id)
    .select();

  if (updateErr) {
    console.error("Error updating payment:", updateErr);
  } else {
    console.log("Payment updated successfully:", updateRes);
  }
}

main().catch(console.error);
