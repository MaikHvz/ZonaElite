import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  clearQrLockFailures,
  hashQrLockPassword,
  isQrLockRateLimited,
  isValidQrLockPassword,
  QR_LOCK_MIN_PASSWORD_LENGTH,
  registerQrLockFailure,
  verifyQrLockPassword,
  type QrLockRecord,
} from "@/lib/qr-lock";

const LOCK_ID = "00000000-0000-0000-0000-000000000001";
const NO_STORE = { "Cache-Control": "no-store" } as const;

async function requireAdmin() {
  const server = await createClient();
  const { data: { user }, error: authError } = await server.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401, headers: NO_STORE }) };
  }

  const { data: profile } = await server
    .from("profiles")
    .select("role_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role_id !== 1) {
    return {
      error: NextResponse.json(
        { error: "Solo los administradores pueden gestionar la contraseña del QR" },
        { status: 403, headers: NO_STORE }
      ),
    };
  }

  return { user };
}

async function readLock(): Promise<QrLockRecord | null> {
  const admin = getAdminClient();
  const { data } = await admin
    .from("qr_session_lock")
    .select("password_hash, password_salt")
    .eq("id", LOCK_ID)
    .maybeSingle();

  return data ?? null;
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const lock = await readLock();

    return NextResponse.json(
      { configured: Boolean(lock), min_length: QR_LOCK_MIN_PASSWORD_LENGTH },
      { headers: NO_STORE }
    );
  } catch (err) {
    console.error("[QR-LOCK] Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Error interno del servidor";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const admin = getAdminClient();
    const body = await request.json().catch(() => ({}));
    const { action, password, current_password: currentPassword } = body as {
      action?: string;
      password?: string;
      current_password?: string;
    };

    const existing = await readLock();

    if (action === "set") {
      if (!isValidQrLockPassword(password || "")) {
        return NextResponse.json(
          { error: `La contraseña debe tener al menos ${QR_LOCK_MIN_PASSWORD_LENGTH} caracteres` },
          { status: 400, headers: NO_STORE }
        );
      }

      if (existing) {
        if (isQrLockRateLimited(auth.user.id)) {
          return NextResponse.json(
            { error: "Demasiados intentos. Espera 15 minutos." },
            { status: 429, headers: NO_STORE }
          );
        }
        if (!verifyQrLockPassword(currentPassword || "", existing)) {
          registerQrLockFailure(auth.user.id);
          await admin.from("audit_logs").insert({
            user_id: auth.user.id,
            action: "set_qr_lock_password_denied",
            entity: "qr_session_lock",
            metadata: { reason: "current_password_incorrect" },
          });
          return NextResponse.json(
            { error: "La contraseña actual no es correcta" },
            { status: 401, headers: NO_STORE }
          );
        }
      }

      const { password_hash, password_salt } = hashQrLockPassword(password!.trim());

      const { error } = await admin.from("qr_session_lock").upsert(
        {
          id: LOCK_ID,
          password_hash,
          password_salt,
          updated_by: auth.user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400, headers: NO_STORE });
      }

      clearQrLockFailures(auth.user.id);
      await admin.from("audit_logs").insert({
        user_id: auth.user.id,
        action: "set_qr_lock_password",
        entity: "qr_session_lock",
        entity_id: LOCK_ID,
        metadata: { replaced: Boolean(existing) },
      });

      return NextResponse.json({ ok: true, configured: true }, { headers: NO_STORE });
    }

    if (action === "clear") {
      if (!existing) {
        return NextResponse.json({ ok: true, configured: false }, { headers: NO_STORE });
      }

      if (isQrLockRateLimited(auth.user.id)) {
        return NextResponse.json(
          { error: "Demasiados intentos. Espera 15 minutos." },
          { status: 429, headers: NO_STORE }
        );
      }

      if (!verifyQrLockPassword(currentPassword || "", existing)) {
        registerQrLockFailure(auth.user.id);
        await admin.from("audit_logs").insert({
          user_id: auth.user.id,
          action: "clear_qr_lock_password_denied",
          entity: "qr_session_lock",
          metadata: { reason: "current_password_incorrect" },
        });
        return NextResponse.json(
          { error: "La contraseña actual no es correcta" },
          { status: 401, headers: NO_STORE }
        );
      }

      const { error } = await admin
        .from("qr_session_lock")
        .delete()
        .eq("id", LOCK_ID);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400, headers: NO_STORE });
      }

      clearQrLockFailures(auth.user.id);
      await admin.from("audit_logs").insert({
        user_id: auth.user.id,
        action: "clear_qr_lock_password",
        entity: "qr_session_lock",
        entity_id: LOCK_ID,
        metadata: {},
      });

      return NextResponse.json({ ok: true, configured: false }, { headers: NO_STORE });
    }

    if (action === "verify") {
      if (!existing) {
        return NextResponse.json({ ok: true, configured: false }, { headers: NO_STORE });
      }

      if (isQrLockRateLimited(auth.user.id)) {
        return NextResponse.json(
          { error: "Demasiados intentos. Espera 15 minutos." },
          { status: 429, headers: NO_STORE }
        );
      }

      if (!verifyQrLockPassword(password || "", existing)) {
        registerQrLockFailure(auth.user.id);
        await admin.from("audit_logs").insert({
          user_id: auth.user.id,
          action: "verify_qr_lock_denied",
          entity: "qr_session_lock",
          entity_id: LOCK_ID,
          metadata: {},
        });
        return NextResponse.json(
          { error: "Contraseña incorrecta" },
          { status: 401, headers: NO_STORE }
        );
      }

      clearQrLockFailures(auth.user.id);
      await admin.from("audit_logs").insert({
        user_id: auth.user.id,
        action: "verify_qr_lock",
        entity: "qr_session_lock",
        entity_id: LOCK_ID,
        metadata: {},
      });

      return NextResponse.json({ ok: true, configured: true }, { headers: NO_STORE });
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400, headers: NO_STORE });
  } catch (err) {
    console.error("[QR-LOCK] Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Error interno del servidor";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
