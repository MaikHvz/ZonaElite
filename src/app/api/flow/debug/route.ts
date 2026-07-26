import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { FLOW_LOG_PREFIX } from "@/lib/flow";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const DEBUG_LOG = `${FLOW_LOG_PREFIX}/debug`;

export async function GET() {
  try {
    const admin = getAdminClient();
    const { data: payments, error } = await admin
      .from("payments")
      .select("id, status, flow_token, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    console.log(`${DEBUG_LOG} returning ${payments?.length ?? 0} recent payments`);

    return NextResponse.json({
      success: true,
      recentPayments: payments ?? [],
    });
  } catch (err) {
    console.error(`${DEBUG_LOG} error`, err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
