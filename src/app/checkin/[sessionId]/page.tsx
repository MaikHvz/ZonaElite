"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/providers/SessionProvider";
import { createClient } from "@/lib/supabase/client";

interface Beneficiary {
  id: string;
  name: string;
  is_self: boolean;
}

interface CheckinResult {
  beneficiary_id: string;
  name: string;
  ok: boolean;
  message: string;
  membership_status: "al_dia" | "atrasado" | "sin_membresia";
}

export default function CheckinPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const { user, loading: authLoading } = useSession();
  const router = useRouter();

  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<CheckinResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState<boolean | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/auth?redirect=/checkin/${sessionId}`);
    }
  }, [user, authLoading, router, sessionId]);

  useEffect(() => {
    if (!user) return;

    const supabase = createClient();

    supabase
      .from("class_sessions")
      .select("id, status")
      .eq("id", sessionId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setError("Sesión no encontrada");
          setLoadingSession(false);
          return;
        }
        setSessionActive(data.status === "activa");
        setLoadingSession(false);
      });
  }, [user, sessionId]);

  useEffect(() => {
    if (!user) return;

    const supabase = createClient();

    const loadBeneficiaries = async () => {
      const { data: ownBen } = await supabase
        .from("beneficiaries")
        .select("id")
        .eq("profile_id", user.id)
        .maybeSingle();

      const all: Beneficiary[] = [];

      if (ownBen) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        all.push({
          id: ownBen.id,
          name: profile?.full_name || "Yo",
          is_self: true,
        });
      }

      const { data: deps } = await supabase
        .from("dependents")
        .select("id, full_name")
        .eq("tutor_id", user.id);

      if (deps && deps.length > 0) {
        const depIds = deps.map((d) => d.id);
        const { data: depBen } = await supabase
          .from("beneficiaries")
          .select("id, dependent_id")
          .in("dependent_id", depIds);

        if (depBen) {
          for (const b of depBen) {
            const dep = deps.find((d) => d.id === b.dependent_id);
            if (dep) {
              all.push({
                id: b.id,
                name: dep.full_name,
                is_self: false,
              });
            }
          }
        }
      }

      setBeneficiaries(all);
      if (all.length > 0) {
        setSelected(new Set(all.map((b) => b.id)));
      }
    };

    loadBeneficiaries();
  }, [user]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === beneficiaries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(beneficiaries.map((b) => b.id)));
    }
  };

  const handleSubmit = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          beneficiary_ids: Array.from(selected),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al registrar asistencia");
        return;
      }

      setResults(data.results);
    } catch {
      setError("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loadingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  if (error && !sessionActive) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <span className="material-symbols-outlined text-primary text-[48px] mb-4 block">
            qr_code_scanner
          </span>
          <h1 className="font-[family-name:var(--font-headline-md)] text-[24px] text-on-surface uppercase mb-3">
            {error}
          </h1>
          <p className="font-[family-name:var(--font-body-md)] text-[15px] text-on-surface-variant">
            Esta sesión de clase no está recibiendo check-ins en este momento.
          </p>
        </div>
      </div>
    );
  }

  if (results) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-5">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <span className="material-symbols-outlined text-primary text-[48px] mb-3 block">
              check_circle
            </span>
            <h1 className="font-[family-name:var(--font-headline-md)] text-[24px] text-on-surface uppercase">
              Resultado del check-in
            </h1>
          </div>

          <div className="space-y-3 mb-8">
            {results.map((r) => (
              <div
                key={r.beneficiary_id}
                className={`rounded-xl p-4 border ${
                  r.ok
                    ? "bg-surface-container-low border-on-surface/5"
                    : "bg-error-container/10 border-error/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-[family-name:var(--font-headline-md)] text-[15px] text-on-surface uppercase block">
                      {r.name || "Alumno"}
                    </span>
                    <span
                      className={`font-[family-name:var(--font-body-md)] text-[13px] ${
                        r.ok ? "text-primary" : "text-error"
                      }`}
                    >
                      {r.message}
                    </span>
                  </div>
                  {r.ok && (
                    <span
                      className={`font-[family-name:var(--font-label-sm)] text-[10px] uppercase px-2 py-0.5 rounded-full ${
                        r.membership_status === "al_dia"
                          ? "bg-green-500/10 text-green-400"
                          : r.membership_status === "atrasado"
                            ? "bg-yellow-500/10 text-yellow-400"
                            : "bg-on-surface/10 text-on-surface-variant"
                      }`}
                    >
                      {r.membership_status === "al_dia"
                        ? "Al día"
                        : r.membership_status === "atrasado"
                          ? "Atrasado"
                          : "Sin membresía"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              setResults(null);
              setSelected(new Set(beneficiaries.map((b) => b.id)));
            }}
            className="w-full py-3 border border-on-surface/15 text-on-surface font-[family-name:var(--font-headline-md)] text-[13px] uppercase rounded-lg hover:bg-on-surface/5 transition-colors cursor-pointer"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="material-symbols-outlined text-primary text-[40px] mb-3 block">
            qr_code_scanner
          </span>
          <h1 className="font-[family-name:var(--font-headline-md)] text-[22px] text-on-surface uppercase mb-2">
            Check-in de asistencia
          </h1>
          <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant">
            Selecciona quiénes asistieron y confirma
          </p>
        </div>

        {beneficiaries.length === 0 ? (
          <div className="text-center py-8">
            <p className="font-[family-name:var(--font-body-md)] text-[15px] text-on-surface-variant">
              No se encontraron beneficiarios asociados a tu cuenta.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <button
                onClick={toggleAll}
                className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-[0.1em] text-primary hover:text-primary/80 transition-colors cursor-pointer"
              >
                {selected.size === beneficiaries.length
                  ? "Deseleccionar todos"
                  : "Seleccionar todos"}
              </button>
            </div>

            <div className="space-y-2 mb-8">
              {beneficiaries.map((b) => (
                <button
                  key={b.id}
                  onClick={() => toggle(b.id)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 cursor-pointer text-left ${
                    selected.has(b.id)
                      ? "bg-primary/10 border-primary/30"
                      : "bg-surface-container-low border-on-surface/5 hover:border-on-surface/10"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      selected.has(b.id)
                        ? "bg-primary border-primary"
                        : "border-on-surface/20"
                    }`}
                  >
                    {selected.has(b.id) && (
                      <span className="material-symbols-outlined text-[14px] text-white">
                        check
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="font-[family-name:var(--font-headline-md)] text-[15px] text-on-surface uppercase block">
                      {b.name}
                    </span>
                    {b.is_self && (
                      <span className="font-[family-name:var(--font-label-sm)] text-[10px] text-on-surface-variant uppercase">
                        Yo
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-error-container/10 border border-error/20">
                <span className="font-[family-name:var(--font-body-md)] text-[13px] text-error">
                  {error}
                </span>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || selected.size === 0}
              className="w-full py-3.5 btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[14px] uppercase rounded-lg shadow-[0_0_20px_rgba(229,57,53,0.3)] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting
                ? "Registrando..."
                : `Marcar presente (${selected.size})`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
