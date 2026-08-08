// Modo de pago manual por transferencia.
// Isomorphic: recibe el cliente supabase (browser o server/admin) para no
// forzar el lado de ejecución. Los defaults mantienen TODO en "online"
// (Flow) hasta que el admin active el modo manual por tipo de producto.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export type PaymentMode = "online" | "manual";
export type PaymentProductType = "memberships" | "personalized" | "enrollment";

export interface BankAccount {
  bank_name: string;
  account_type: string;
  account_number: string;
  account_holder: string;
  rut: string;
  email: string;
}

export interface PaymentSettings {
  memberships: PaymentMode;
  personalized: PaymentMode;
  enrollment: PaymentMode;
  bank: BankAccount | null;
}

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  memberships: "online",
  personalized: "online",
  enrollment: "online",
  bank: null,
};

export function normalizePaymentSettings(raw: unknown): PaymentSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const mode = (v: unknown): PaymentMode => (v === "manual" ? "manual" : "online");
  const bankRaw = r.bank as Record<string, unknown> | null | undefined;
  return {
    memberships: mode(r.memberships),
    personalized: mode(r.personalized),
    enrollment: mode(r.enrollment),
    bank: bankRaw
      ? {
          bank_name: String(bankRaw.bank_name || ""),
          account_type: String(bankRaw.account_type || ""),
          account_number: String(bankRaw.account_number || ""),
          account_holder: String(bankRaw.account_holder || ""),
          rut: String(bankRaw.rut || ""),
          email: String(bankRaw.email || ""),
        }
      : null,
  };
}

export async function getPaymentSettings(
  supabase: SupabaseClient
): Promise<PaymentSettings> {
  const { data } = await supabase
    .from("academy_settings")
    .select("payment_settings")
    .limit(1)
    .maybeSingle();
  return normalizePaymentSettings(data?.payment_settings);
}

export async function updatePaymentSettings(
  supabase: SupabaseClient,
  settings: PaymentSettings
): Promise<{ error: string | null }> {
  const { data: row } = await supabase
    .from("academy_settings")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (!row?.id) {
    return { error: "No se encontró la configuración de la academia" };
  }

  const { error } = await supabase
    .from("academy_settings")
    .update({ payment_settings: settings })
    .eq("id", row.id);

  return { error: error ? error.message : null };
}
