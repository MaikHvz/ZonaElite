"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import FormModal from "@/components/admin/FormModal";
import DeleteConfirm from "@/components/admin/DeleteConfirm";
import Toast from "@/components/admin/Toast";
import { formatRut } from "@/lib/rut";

// Migración de cargas a cuentas propias (migración 040,
// contexto/requisitos/cuenta-unica-por-alumno.md). La carga queda guardada
// en dependents hasta migrarla; al migrar, su historial (que cuelga de
// beneficiaries) se re-ancla a la cuenta nueva y la carga pasa completa a
// dependents_archive. Todo vía RPC SECURITY DEFINER que exigen is_admin().

type Summary = Record<string, number>;

interface PendingDependent {
  dependent_id: string;
  full_name: string;
  rut: string | null;
  birth_date: string;
  category: string;
  address: string | null;
  tutor_id: string;
  tutor_name: string;
  tutor_email: string;
  tutor_phone: string | null;
  beneficiary_id: string | null;
  summary: Summary;
}

interface ArchiveRow {
  id: string;
  dependent_id: string;
  full_name: string;
  category: string;
  migrated_at: string;
  reverted_at: string | null;
  moved_summary: Summary | null;
  tutor: { full_name: string } | null;
  profile: { full_name: string; email: string } | null;
}

interface TargetAccount {
  id: string;
  full_name: string;
  email: string;
  tempPassword?: string;
}

interface Conflict {
  profileId: string;
  fullName: string;
  email: string;
  match: "rut" | "email" | "name_birth";
}

const SUMMARY_LABELS: Record<string, string> = {
  memberships: "membresías",
  academy_enrollments: "matrículas",
  personalized_packs: "packs personalizados",
  class_enrollments: "inscripciones a clases",
  personalized_enrollments: "clases personalizadas",
  attendance: "asistencias",
  debts: "deudas",
  payments: "pagos",
  event_attendees: "eventos",
  medical_records: "ficha médica",
  sport_profiles: "perfil deportivo",
  sports_podiums: "podios",
  consent_forms: "consentimientos",
  body_metrics: "métricas corporales",
};

const CATEGORY_LABEL: Record<string, string> = { nino: "Niño", juvenil: "Juvenil", adulto: "Adulto" };

const inputClass =
  "w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary/50";
const labelClass =
  "block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5";

function SummaryChips({ summary }: { summary: Summary | null }) {
  const entries = Object.entries(summary || {}).filter(([k, v]) => k in SUMMARY_LABELS && Number(v) > 0);
  if (entries.length === 0) {
    return <span className="text-[12px] text-on-surface-variant">Sin historial</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([k, v]) => (
        <span key={k} className="text-[11px] px-2 py-0.5 rounded-full bg-on-surface/5 text-on-surface-variant">
          {v} {SUMMARY_LABELS[k]}
        </span>
      ))}
      {Number(summary?.memberships_active || 0) > 0 && (
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">membresía activa</span>
      )}
    </div>
  );
}

export default function AdminMigracionCargasPage() {
  const [tab, setTab] = useState<"pendientes" | "migradas">("pendientes");
  const [pending, setPending] = useState<PendingDependent[]>([]);
  const [history, setHistory] = useState<ArchiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Asistente
  const [selected, setSelected] = useState<PendingDependent | null>(null);
  const [step, setStep] = useState<"account" | "review" | "done">("account");
  const [accountMode, setAccountMode] = useState<"new" | "existing">("new");
  const [form, setForm] = useState({ email: "", full_name: "", rut: "", birth_date: "", phone: "" });
  const [conflict, setConflict] = useState<{ message: string; warning: boolean; conflicts: Conflict[] } | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; full_name: string; email: string; rut: string | null }[]>([]);
  const [target, setTarget] = useState<TargetAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [moved, setMoved] = useState<Summary | null>(null);

  const [revertTarget, setRevertTarget] = useState<ArchiveRow | null>(null);
  const [reverting, setReverting] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [pendingRes, historyRes] = await Promise.all([
      supabase.rpc("get_pending_dependents"),
      supabase
        .from("dependents_archive")
        .select(
          "id, dependent_id, full_name, category, migrated_at, reverted_at, moved_summary, " +
            "tutor:profiles!dependents_archive_tutor_id_fkey(full_name), " +
            "profile:profiles!dependents_archive_profile_fkey(full_name, email)"
        )
        .order("migrated_at", { ascending: false }),
    ]);
    if (pendingRes.error) setToast({ msg: pendingRes.error.message, type: "error" });
    if (historyRes.error) setToast({ msg: historyRes.error.message, type: "error" });
    setPending((pendingRes.data as PendingDependent[]) || []);
    setHistory((historyRes.data as unknown as ArchiveRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openWizard = (dep: PendingDependent) => {
    setSelected(dep);
    setStep("account");
    setAccountMode("new");
    setForm({
      email: "",
      full_name: dep.full_name,
      rut: dep.rut ? formatRut(dep.rut) : "",
      birth_date: dep.birth_date || "",
      phone: dep.tutor_phone || "",
    });
    setConflict(null);
    setSearch("");
    setSearchResults([]);
    setTarget(null);
    setWizardError(null);
    setMoved(null);
  };

  const closeWizard = () => {
    const finished = step === "done";
    setSelected(null);
    if (finished) {
      setLoading(true);
      load();
    }
  };

  const createAccount = async (force = false) => {
    if (!form.email.trim() || !form.full_name.trim()) {
      setWizardError("El correo y el nombre son obligatorios");
      return;
    }
    setBusy(true);
    setWizardError(null);
    setConflict(null);
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, email: form.email.trim(), role_id: 4, force }),
      });
      const data = await res.json();
      if (res.status === 409 && Array.isArray(data.conflicts)) {
        setConflict({ message: data.error, warning: Boolean(data.warning), conflicts: data.conflicts });
        return;
      }
      if (!res.ok) {
        setWizardError(data.error || "No se pudo crear la cuenta");
        return;
      }
      setTarget({ id: data.user.id, full_name: data.user.full_name, email: data.user.email, tempPassword: data.tempPassword });
      setStep("review");
    } catch {
      setWizardError("No se pudo crear la cuenta");
    } finally {
      setBusy(false);
    }
  };

  const searchAccounts = async () => {
    const q = search.trim().replace(/[,()]/g, " ");
    if (q.length < 2) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, rut")
      .eq("role_id", 4)
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,rut.ilike.%${q}%`)
      .order("full_name")
      .limit(10);
    setSearchResults(data || []);
  };

  const migrate = async () => {
    if (!selected || !target) return;
    setBusy(true);
    setWizardError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("migrate_dependent_to_profile", {
      p_dependent_id: selected.dependent_id,
      p_profile_id: target.id,
    });
    setBusy(false);
    if (error) {
      setWizardError(error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    setMoved((row?.moved as Summary) || {});
    setStep("done");
  };

  const revert = async () => {
    if (!revertTarget) return;
    setReverting(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("revert_dependent_migration", { p_archive_id: revertTarget.id });
    setReverting(false);
    setRevertTarget(null);
    if (error) {
      setToast({ msg: error.message, type: "error" });
      return;
    }
    setToast({ msg: "Migración revertida: la carga volvió a su tutor", type: "success" });
    setLoading(true);
    load();
  };

  const migratedCount = history.filter((h) => !h.reverted_at).length;
  const isMinor = selected ? selected.category !== "adulto" : false;

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-[family-name:var(--font-headline-lg)] text-[26px] text-on-surface uppercase tracking-tighter">
            Migración de cargas
          </h1>
          <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant mt-1">
            Cada alumno pasa a tener su propia cuenta. Crea la cuenta y traslada su historial (membresías, matrículas, asistencia, pagos, eventos, ficha y perfil deportivo).
            {" "}{pending.length} pendientes · {migratedCount} migradas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(
            [
              ["pendientes", `Pendientes (${pending.length})`],
              ["migradas", `Migradas (${history.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-lg font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider transition-colors cursor-pointer ${
                tab === key ? "bg-primary/15 text-primary" : "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : tab === "pendientes" ? (
        pending.length === 0 ? (
          <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-10 text-center">
            <span className="material-symbols-outlined text-on-surface-variant/40 text-[40px] mb-2 block">task_alt</span>
            <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant">
              No quedan cargas por migrar.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pending.map((d) => (
              <div key={d.dependent_id} className="bg-surface-container border border-on-surface/5 rounded-2xl p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-[family-name:var(--font-headline-md)] text-[15px] text-on-surface uppercase truncate">{d.full_name}</p>
                    <p className="text-[12px] text-on-surface-variant mt-0.5">
                      {CATEGORY_LABEL[d.category] || d.category}
                      {d.birth_date && ` · ${new Date(d.birth_date + "T12:00:00").toLocaleDateString("es-CL")}`}
                      {d.rut ? ` · ${formatRut(d.rut)}` : " · sin RUT"}
                    </p>
                    <p className="text-[12px] text-on-surface-variant mt-0.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">supervisor_account</span>
                      Carga de {d.tutor_name}
                    </p>
                  </div>
                  <button
                    onClick={() => openWizard(d)}
                    className="shrink-0 px-3 py-2 rounded-lg btn-primary-gradient text-white font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider cursor-pointer"
                  >
                    Migrar a cuenta propia
                  </button>
                </div>
                <SummaryChips summary={d.summary} />
              </div>
            ))}
          </div>
        )
      ) : history.length === 0 ? (
        <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-10 text-center">
          <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface-variant">Aún no hay migraciones.</p>
        </div>
      ) : (
        <div className="bg-surface-container border border-on-surface/5 rounded-2xl overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider text-on-surface-variant">
                <th className="px-5 py-3">Alumno</th>
                <th className="px-5 py-3">Tutor anterior</th>
                <th className="px-5 py-3">Cuenta</th>
                <th className="px-5 py-3">Trasladado</th>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-on-surface/5 align-top">
                  <td className="px-5 py-3 text-[13px] text-on-surface">
                    {h.full_name}
                    <span className="block text-[11px] text-on-surface-variant">{CATEGORY_LABEL[h.category] || h.category}</span>
                  </td>
                  <td className="px-5 py-3 text-[13px] text-on-surface-variant">{h.tutor?.full_name || "—"}</td>
                  <td className="px-5 py-3 text-[13px] text-on-surface-variant">
                    {h.profile?.full_name || "—"}
                    <span className="block text-[11px]">{h.profile?.email}</span>
                  </td>
                  <td className="px-5 py-3"><SummaryChips summary={h.moved_summary} /></td>
                  <td className="px-5 py-3 text-[12px] text-on-surface-variant whitespace-nowrap">
                    {new Date(h.migrated_at).toLocaleDateString("es-CL")}
                  </td>
                  <td className="px-5 py-3">
                    {h.reverted_at ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-on-surface/10 text-on-surface-variant">Revertida</span>
                    ) : (
                      <button
                        onClick={() => setRevertTarget(h)}
                        className="px-3 py-1.5 bg-on-surface/10 text-on-surface-variant font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider rounded-lg hover:bg-on-surface/15 transition-colors cursor-pointer"
                      >
                        Revertir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FormModal open={!!selected} title={selected ? `Migrar a ${selected.full_name}` : ""} onClose={closeWizard}>
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-[family-name:var(--font-label-sm)]">
              {(["account", "review", "done"] as const).map((s, i) => (
                <span key={s} className={step === s ? "text-primary" : "text-on-surface-variant/50"}>
                  {i + 1}. {s === "account" ? "Cuenta" : s === "review" ? "Revisar" : "Listo"}
                  {i < 2 && <span className="mx-2 text-on-surface-variant/30">›</span>}
                </span>
              ))}
            </div>

            {step === "account" && (
              <>
                <div className="flex gap-2">
                  {(
                    [
                      ["new", "Crear cuenta nueva"],
                      ["existing", "Usar cuenta existente"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => { setAccountMode(key); setWizardError(null); setConflict(null); }}
                      className={`flex-1 px-3 py-2 rounded-lg text-[13px] transition-colors cursor-pointer ${
                        accountMode === key ? "bg-primary/15 text-primary" : "bg-on-surface/5 text-on-surface-variant hover:bg-on-surface/10"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {accountMode === "new" ? (
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Correo del alumno *</label>
                      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="correo-del-alumno@gmail.com" className={inputClass} />
                      <p className="text-[11px] text-on-surface-variant mt-1">
                        Un correo propio para el alumno (el apoderado puede crearlo). Ahí llegará la contraseña de acceso.
                      </p>
                    </div>
                    <div>
                      <label className={labelClass}>Nombre completo *</label>
                      <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inputClass} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>RUT</label>
                        <input type="text" value={form.rut} onChange={(e) => setForm({ ...form, rut: e.target.value })} placeholder="12.345.678-9" className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Fecha de nacimiento</label>
                        <input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} className={inputClass} />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Teléfono</label>
                      <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+569..." className={inputClass} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && searchAccounts()}
                        placeholder="Buscar por nombre, correo o RUT" className={inputClass} />
                      <button onClick={searchAccounts}
                        className="px-4 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer">
                        <span className="material-symbols-outlined text-[20px]">search</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-on-surface-variant">
                      La cuenta debe estar vacía (sin membresías, asistencia ni otro historial).
                    </p>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto">
                      {searchResults.map((p) => (
                        <button key={p.id}
                          onClick={() => { setTarget({ id: p.id, full_name: p.full_name, email: p.email }); setStep("review"); }}
                          className="w-full text-left px-3 py-2 rounded-lg bg-on-surface/5 hover:bg-on-surface/10 transition-colors cursor-pointer">
                          <span className="text-[13px] text-on-surface">{p.full_name || "Sin nombre"}</span>
                          <span className="block text-[11px] text-on-surface-variant">{p.email}{p.rut ? ` · ${p.rut}` : ""}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {conflict && (
                  <div className={`p-4 rounded-xl border ${conflict.warning ? "bg-amber-500/10 border-amber-500/30" : "bg-red-500/10 border-red-500/30"}`}>
                    <p className={`text-[14px] font-medium mb-2 ${conflict.warning ? "text-amber-300" : "text-red-300"}`}>{conflict.message}</p>
                    <ul className="space-y-1.5">
                      {conflict.conflicts.map((c) => (
                        <li key={`${c.profileId}-${c.match}`} className="flex items-center justify-between gap-2 text-[13px] text-on-surface-variant">
                          <span>
                            <span className="text-on-surface">{c.fullName || "Sin nombre"}</span> · {c.email} ·{" "}
                            {c.match === "rut" ? "mismo RUT" : c.match === "email" ? "correo equivalente" : "mismo nombre y fecha de nacimiento"}
                          </span>
                          <button
                            onClick={() => { setTarget({ id: c.profileId, full_name: c.fullName, email: c.email }); setStep("review"); }}
                            className="shrink-0 px-2 py-1 rounded-lg bg-primary/10 text-primary text-[11px] hover:bg-primary/20 cursor-pointer">
                            Usar esta cuenta
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {wizardError && <p className="text-[13px] text-red-400">{wizardError}</p>}

                <div className="flex justify-end gap-3 pt-4 border-t border-on-surface/5">
                  <button onClick={closeWizard}
                    className="px-4 py-2.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] cursor-pointer">
                    Cancelar
                  </button>
                  {accountMode === "new" && conflict?.warning && (
                    <button onClick={() => createAccount(true)} disabled={busy}
                      className="px-4 py-2.5 rounded-lg border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 transition-colors text-[14px] disabled:opacity-50 cursor-pointer">
                      Crear de todas formas
                    </button>
                  )}
                  {accountMode === "new" && (
                    <button onClick={() => createAccount()} disabled={busy}
                      className="px-4 py-2.5 rounded-lg btn-primary-gradient text-white text-[14px] disabled:opacity-50 cursor-pointer">
                      {busy ? "Creando..." : "Crear cuenta y continuar"}
                    </button>
                  )}
                </div>
              </>
            )}

            {step === "review" && target && (
              <>
                {target.tempPassword && (
                  <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 space-y-2">
                    <p className="text-[13px] text-on-surface">
                      Cuenta creada para <strong>{target.full_name}</strong> ({target.email}). Se envió un correo con sus credenciales.
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-surface-container border border-on-surface/10 rounded-lg px-3 py-2 text-[16px] font-[family-name:var(--font-jetbrains)] text-primary select-all">
                        {target.tempPassword}
                      </code>
                      <button
                        onClick={() => { navigator.clipboard.writeText(target.tempPassword || ""); setToast({ msg: "Contraseña copiada", type: "success" }); }}
                        className="px-3 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer"
                        title="Copiar contraseña">
                        <span className="material-symbols-outlined text-[18px]">content_copy</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-yellow-300/80">La contraseña solo se muestra una vez.</p>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-on-surface/5">
                    <p className={labelClass}>Se trasladará a la cuenta</p>
                    <p className="text-[14px] text-on-surface">{target.full_name} · {target.email}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-on-surface/5">
                    <p className={labelClass}>Historial de {selected.full_name}</p>
                    <SummaryChips summary={selected.summary} />
                  </div>
                  {isMinor && (
                    <div className="p-4 rounded-xl bg-on-surface/5">
                      <p className={labelClass}>Apoderado (se guarda en el perfil del alumno)</p>
                      <p className="text-[13px] text-on-surface">
                        {selected.tutor_name}
                        <span className="text-on-surface-variant"> · {selected.tutor_email}{selected.tutor_phone ? ` · ${selected.tutor_phone}` : ""}</span>
                      </p>
                    </div>
                  )}
                  <p className="text-[12px] text-on-surface-variant">
                    La carga dejará de aparecer en el panel de {selected.tutor_name} y ambos recibirán un aviso. Se puede revertir desde la pestaña &quot;Migradas&quot; mientras la cuenta no registre historial nuevo.
                  </p>
                </div>

                {wizardError && <p className="text-[13px] text-red-400">{wizardError}</p>}

                <div className="flex justify-end gap-3 pt-4 border-t border-on-surface/5">
                  {!target.tempPassword && (
                    <button onClick={() => { setTarget(null); setStep("account"); setWizardError(null); }}
                      className="px-4 py-2.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] cursor-pointer">
                      Volver
                    </button>
                  )}
                  <button onClick={migrate} disabled={busy}
                    className="px-4 py-2.5 rounded-lg btn-primary-gradient text-white text-[14px] disabled:opacity-50 cursor-pointer">
                    {busy ? "Migrando..." : "Migrar historial"}
                  </button>
                </div>
              </>
            )}

            {step === "done" && target && (
              <>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <span className="material-symbols-outlined text-[32px] text-green-400">check_circle</span>
                  <div>
                    <p className="text-[14px] text-on-surface font-semibold">{selected.full_name} ya tiene su propia cuenta</p>
                    <p className="text-[12px] text-on-surface-variant">{target.email}</p>
                  </div>
                </div>
                <div>
                  <p className={labelClass}>Trasladado</p>
                  <SummaryChips summary={moved} />
                </div>
                <div className="flex justify-end pt-2">
                  <button onClick={closeWizard} className="px-6 py-2.5 rounded-lg btn-primary-gradient text-white text-[14px] cursor-pointer">
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </FormModal>

      <DeleteConfirm
        open={!!revertTarget}
        title="Revertir migración"
        message={revertTarget ? `${revertTarget.full_name} volverá a ser carga de ${revertTarget.tutor?.full_name || "su tutor"} con todo su historial. La cuenta ${revertTarget.profile?.email || ""} queda vacía (no se borra).` : ""}
        onConfirm={revert}
        onCancel={() => setRevertTarget(null)}
        loading={reverting}
        confirmLabel="Revertir"
      />

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
