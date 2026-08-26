"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DataTable from "@/components/admin/DataTable";
import FormModal from "@/components/admin/FormModal";
import CreateDependentModal from "@/components/admin/CreateDependentModal";
import VerFichaModal from "@/components/admin/VerFichaModal";
import SportProfileModal from "@/components/admin/SportProfileModal";
import StatusBadge from "@/components/admin/StatusBadge";
import Toast from "@/components/admin/Toast";
import { getSupabaseErrorMessage } from "@/lib/admin-helpers";
import { exportProfessionalExcel, type ProfessionalSheetConfig } from "@/lib/excel";
import { chileMonthStartDate, chileMonthEndDate } from "@/lib/dates";

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role_id: number;
  active: boolean;
  created_at: string;
  birth_date?: string | null;
  rut?: string | null;
  address?: string | null;
  _isDependent?: boolean;
  _tutorName?: string;
  _tutorId?: string;
  _birthDate?: string | null;
  _category?: string;
  _address?: string | null;
  _weight?: number | null;
  _height?: number | null;
  _dominantHand?: string | null;
}

interface Role { id: number; name: string; }
interface Dependent { id: string; full_name: string; tutor_id: string; birth_date: string; category: string; rut?: string | null; address?: string | null; weight?: number | null; height?: number | null; dominant_hand?: string | null; created_at?: string; }

const ROLE_LABELS: Record<number, string> = { 1: "Administrador", 2: "Instructor", 3: "Recepción", 4: "Alumno" };

function computeCategoryFromBirth(birthDate: string | null | undefined): string {
  if (!birthDate) return "adulto";
  const birth = new Date(birthDate + "T12:00:00");
  const now = new Date();
  const ageMs = now.getTime() - birth.getTime();
  const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
  if (ageYears < 10) return "nino";
  if (ageYears < 16) return "juvenil";
  return "adulto";
}

function categoryLabel(cat: string): string {
  return cat === "nino" ? "Niño" : cat === "juvenil" ? "Juvenil" : "Adulto";
}

function categoryBadgeClass(cat: string): string {
  if (cat === "nino") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  if (cat === "juvenil") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  return "bg-green-500/10 text-green-400 border-green-500/20";
}

export default function AdminUsuariosPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ role_id: 4, active: true });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [exportTimeframe, setExportTimeframe] = useState<"mes" | "ano" | "historico">("historico");
  const [exporting, setExporting] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", full_name: "", role_id: 4, birth_date: "", phone: "", rut: "" });
  const [creating, setCreating] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [createdUser, setCreatedUser] = useState<{ email: string; full_name: string } | null>(null);
  const [tempPassword, setTempPassword] = useState("");

  const [dependentModalOpen, setDependentModalOpen] = useState(false);
  const [editingDependent, setEditingDependent] = useState<{
    id: string;
    full_name: string;
    rut: string | null;
    birth_date: string | null;
    category: string;
    tutor_id: string;
    address: string | null;
    weight: number | null;
    height: number | null;
    dominant_hand: string | null;
  } | null>(null);

  const [fichaOpen, setFichaOpen] = useState(false);
  const [fichaRow, setFichaRow] = useState<{
    full_name: string;
    category: string;
    rut?: string | null;
    address?: string | null;
    birth_date?: string | null;
    weight?: number | null;
    height?: number | null;
    dominant_hand?: string | null;
  } | null>(null);

  const [sportOpen, setSportOpen] = useState(false);
  const [sportBeneficiaryId, setSportBeneficiaryId] = useState<string | null>(null);
  const [sportStudentName, setSportStudentName] = useState("");

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const supabase = createClient();
      const now = new Date();

      // 1. Obtain all beneficiaries mapping
      const { data: beneficiariesData } = await supabase
        .from("beneficiaries")
        .select("id, profile_id, dependent_id");

      const benByProfile = new Map<string, string>();
      const benByDependent = new Map<string, string>();
      (beneficiariesData || []).forEach((b: any) => {
        if (b.profile_id) benByProfile.set(b.profile_id, b.id);
        if (b.dependent_id) benByDependent.set(b.dependent_id, b.id);
      });

      // 2. Query memberships
      let mQuery = supabase
        .from("memberships")
        .select(`id, beneficiary_id, start_date, end_date, status, created_at, membership_plans(name, price)`);

      if (exportTimeframe === "mes") {
        mQuery = mQuery.gte("start_date", chileMonthStartDate()).lte("start_date", chileMonthEndDate());
      } else if (exportTimeframe === "ano") {
        const yearStart = chileMonthStartDate().slice(0, 4) + "-01-01";
        const yearEnd = chileMonthStartDate().slice(0, 4) + "-12-31";
        mQuery = mQuery.gte("start_date", yearStart).lte("start_date", yearEnd);
      }

      const { data: memberships } = await mQuery;
      const activeMembershipsByBen = new Map<string, any>();
      (memberships || []).forEach((m: any) => {
        if (m.status === "activa" || !activeMembershipsByBen.has(m.beneficiary_id)) {
          activeMembershipsByBen.set(m.beneficiary_id, m);
        }
      });

      // 3. Query academy enrollments (inscripciones)
      let eQuery = supabase
        .from("academy_enrollments")
        .select(`id, beneficiary_id, start_date, end_date, status, created_at, enrollment_plans(name)`);

      if (exportTimeframe === "mes") {
        eQuery = eQuery.gte("start_date", chileMonthStartDate()).lte("start_date", chileMonthEndDate());
      } else if (exportTimeframe === "ano") {
        const yearStart = chileMonthStartDate().slice(0, 4) + "-01-01";
        const yearEnd = chileMonthStartDate().slice(0, 4) + "-12-31";
        eQuery = eQuery.gte("start_date", yearStart).lte("start_date", yearEnd);
      }

      const { data: enrollments } = await eQuery;
      const activeEnrollmentsByBen = new Map<string, any>();
      (enrollments || []).forEach((e: any) => {
        if (e.status === "activa" || !activeEnrollmentsByBen.has(e.beneficiary_id)) {
          activeEnrollmentsByBen.set(e.beneficiary_id, e);
        }
      });

      // Build report data
      const reportData: any[] = [];
      let totalConMembresia = 0;
      let totalConInscripcion = 0;
      let totalActivosAmbos = 0;
      const rolCounts: Record<string, number> = {
        "Administrador": 0,
        "Instructor": 0,
        "Recepción": 0,
        "Alumno": 0,
        "Carga (Niño)": 0,
        "Carga (Juvenil)": 0,
        "Carga (Adulto)": 0,
      };

      users.forEach(u => {
        const benId = u._isDependent ? benByDependent.get(u.id) : benByProfile.get(u.id);
        const membership = benId ? activeMembershipsByBen.get(benId) : null;
        const enrollment = benId ? activeEnrollmentsByBen.get(benId) : null;

        const tieneMembresia = !!membership && membership.status === "activa";
        const tieneInscripcion = !!enrollment && enrollment.status === "activa";

        if (tieneMembresia) totalConMembresia++;
        if (tieneInscripcion) totalConInscripcion++;
        if (tieneMembresia && tieneInscripcion) totalActivosAmbos++;

        const rolTipo = u._isDependent
          ? `Carga (${u._category === "nino" ? "Niño" : u._category === "juvenil" ? "Juvenil" : "Adulto"})`
          : ROLE_LABELS[u.role_id] || `Rol ${u.role_id}`;

        if (rolCounts[rolTipo] !== undefined) rolCounts[rolTipo]++;

        const fechaNacimiento = u._isDependent
          ? (u._birthDate ? new Date(u._birthDate + "T12:00:00").toLocaleDateString("es-CL") : "—")
          : (u.birth_date ? new Date(u.birth_date + "T12:00:00").toLocaleDateString("es-CL") : "—");

        const fechaRegistro = new Date(u.created_at).toLocaleDateString("es-CL");

        reportData.push({
          "Nombre": u.full_name,
          "Email": u.email,
          "RUT": u.rut || "—",
          "Teléfono": u.phone || "—",
          "Rol / Tipo": rolTipo,
          "Tutor (si es carga)": u._tutorName || "—",
          "Fecha Nacimiento": fechaNacimiento,
          "Fecha Registro Ingreso": fechaRegistro,
          "Estado Cuenta": u._isDependent ? "—" : (u.active ? "Activo" : "Inactivo"),
          "Membresía Activa": tieneMembresia ? ((membership.membership_plans as any)?.name || "Sí") : "Sin membresía",
          "Vencimiento Membresía": tieneMembresia ? new Date(membership.end_date).toLocaleDateString("es-CL") : "—",
          "Estado Inscripción": tieneInscripcion ? `Vigente (${(enrollment.enrollment_plans as any)?.name || "Inscripción"})` : "Sin inscripción",
          "Vencimiento Inscripción": tieneInscripcion ? new Date(enrollment.end_date).toLocaleDateString("es-CL") : "—",
        });
      });

      const alumnos = users.filter(u => !u._isDependent && u.role_id === 4);
      const cargas = users.filter(u => u._isDependent);
      const periodoLabel =
        exportTimeframe === "mes"
          ? now.toLocaleString("es-CL", { month: "long", year: "numeric" })
          : exportTimeframe === "ano"
          ? `Año ${now.getFullYear()}`
          : "Histórico Completo";

      const resumenSheet: ProfessionalSheetConfig = {
        sheetName: "Resumen Ejecutivo",
        reportTitle: "Reporte de Usuarios y Alumnos",
        subtitle: `Período: ${periodoLabel}`,
        kpiBlocks: [
          {
            title: "INDICADORES GENERALES",
            rows: [
              ["Total Perfiles Registrados", users.filter(u => !u._isDependent).length],
              ["Total Alumnos Directos", alumnos.length],
              ["Total Cargas / Dependientes", cargas.length],
              ["Total General Registros", users.length],
            ],
          },
          {
            title: "ESTADO DE PLANES Y MEMBRESÍAS",
            rows: [
              ["Con Membresía Activa", totalConMembresia, true],
              ["Sin Membresía Activa", users.length - totalConMembresia, users.length - totalConMembresia === 0],
              ["Con Inscripción Vigente", totalConInscripcion, true],
              ["Sin Inscripción Vigente", users.length - totalConInscripcion, users.length - totalConInscripcion === 0],
              ["Al Día (Membresía + Inscripción)", totalActivosAmbos, true],
            ],
          },
          {
            title: "DISTRIBUCIÓN POR ROL Y TIPO",
            rows: [
              ["Administradores", rolCounts["Administrador"] || 0],
              ["Instructores", rolCounts["Instructor"] || 0],
              ["Personal Recepción", rolCounts["Recepción"] || 0],
              ["Alumnos Titulares", rolCounts["Alumno"] || 0],
              ["Cargas (Niños)", rolCounts["Carga (Niño)"] || 0],
              ["Cargas (Juveniles)", rolCounts["Carga (Juvenil)"] || 0],
              ["Cargas (Adultos)", rolCounts["Carga (Adulto)"] || 0],
            ],
          },
        ],
      };

      const detalleSheet: ProfessionalSheetConfig = {
        sheetName: "Usuarios Detalle",
        reportTitle: "Listado Completo de Usuarios",
        subtitle: `Período: ${periodoLabel} — ${users.length} registros totales`,
        tableData: reportData,
      };

      const graficosSheet: ProfessionalSheetConfig = {
        sheetName: "Tablas para Gráficos",
        reportTitle: "Datos para Gráficos Visuales",
        subtitle: "Seleccione los rangos de datos y use Insertar > Gráfico en Excel para generar gráficos",
        kpiBlocks: [
          {
            title: "TABLA 1: DISTRIBUCIÓN POR TIPO DE USUARIO — Para Gráfico de Torta",
            rows: [
              ["Administradores", rolCounts["Administrador"] || 0],
              ["Instructores", rolCounts["Instructor"] || 0],
              ["Personal Recepción", rolCounts["Recepción"] || 0],
              ["Alumnos Titulares", rolCounts["Alumno"] || 0],
              ["Cargas Niños", rolCounts["Carga (Niño)"] || 0],
              ["Cargas Adultos", rolCounts["Carga (Adulto)"] || 0],
            ],
          },
          {
            title: "TABLA 2: ESTADO DE PLANES — Para Gráfico de Barras Comparativas",
            rows: [
              ["Membresías Activas", totalConMembresia, true],
              ["Sin Membresía", users.length - totalConMembresia, false],
              ["Inscripciones Vigentes", totalConInscripcion, true],
              ["Sin Inscripción", users.length - totalConInscripcion, false],
            ],
          },
        ],
      };

      await exportProfessionalExcel(
        [resumenSheet, detalleSheet, graficosSheet],
        `Reporte_Usuarios_ZonaElite_${exportTimeframe}_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`
      );
    } finally {
      setExporting(false);
    }
  };

  const load = async () => {
    const supabase = createClient();
    const [uRes, rRes, dRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("roles").select("*").order("id"),
      supabase.from("dependents").select("id, full_name, tutor_id, birth_date, category, rut, address, weight, height, dominant_hand, created_at"),
    ]);

    const profiles = (uRes.data as UserRow[]) || [];
    const deps = (dRes.data as Dependent[]) || [];
    setRoles((rRes.data as Role[]) || []);

    const rows: UserRow[] = [];

    for (const p of profiles) {
      rows.push(p);
      const userDeps = deps.filter((d) => d.tutor_id === p.id);
      for (const d of userDeps) {
        rows.push({
          id: d.id,
          full_name: d.full_name,
          email: `—`,
          phone: null,
          role_id: 0,
          active: true,
          created_at: (d as any).created_at || p.created_at,
          birth_date: d.birth_date,
          rut: d.rut || null,
          _isDependent: true,
          _tutorName: p.full_name,
          _tutorId: p.id,
          _birthDate: d.birth_date,
          _category: computeCategoryFromBirth(d.birth_date),
          _address: d.address || null,
          _weight: d.weight ?? null,
          _height: d.height ?? null,
          _dominantHand: d.dominant_hand || null,
        });
      }
    }

    setUsers(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (u: UserRow) => {
    if (u._isDependent) {
      setEditingDependent({
        id: u.id,
        full_name: u.full_name,
        rut: u.rut || null,
        birth_date: u._birthDate || null,
        category: u._category || "nino",
        tutor_id: u._tutorId || "",
        address: u._address || null,
        weight: u._weight ?? null,
        height: u._height ?? null,
        dominant_hand: u._dominantHand || null,
      });
      setDependentModalOpen(true);
      return;
    }
    setEditing(u);
    setForm({ role_id: u.role_id, active: u.active });
    setModalOpen(true);
  };

  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.full_name) {
      setToast({ msg: "Email y nombre son obligatorios", type: "error" });
      return;
    }
    try {
      setCreating(true);
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ msg: data.error || "Error al crear usuario", type: "error" });
        return;
      }
      setCreatedUser({ email: data.user.email, full_name: data.user.full_name });
      setTempPassword(data.tempPassword);
      setCreateModalOpen(false);
      setResultModalOpen(true);
      setCreateForm({ email: "", full_name: "", role_id: 4, birth_date: "", phone: "", rut: "" });
      await load();
    } catch (e) {
      setToast({ msg: getSupabaseErrorMessage(e, "crear usuario"), type: "error" });
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      setSaving(true);
      const supabase = createClient();
      const { error } = await supabase.from("profiles").update({ role_id: form.role_id, active: form.active }).eq("id", editing.id);
      if (error) { setToast({ msg: getSupabaseErrorMessage(error, "actualizar usuario"), type: "error" }); return; }
      setModalOpen(false);
      await load();
    } catch (e) {
      setToast({ msg: getSupabaseErrorMessage(e, "guardar usuario"), type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const openFicha = (u: UserRow) => {
    setFichaRow({
      full_name: u.full_name,
      category: u._category || "nino",
      rut: u.rut || null,
      address: u._address || null,
      birth_date: u._birthDate || null,
      weight: u._weight ?? null,
      height: u._height ?? null,
      dominant_hand: u._dominantHand || null,
    });
    setFichaOpen(true);
  };

  const openSportProfile = async (u: UserRow) => {
    const supabase = createClient();
    const query = u._isDependent
      ? supabase.from("beneficiaries").select("id").eq("dependent_id", u.id).maybeSingle()
      : supabase.from("beneficiaries").select("id").eq("profile_id", u.id).maybeSingle();
    const { data } = await query;
    if (!data) {
      setToast({ msg: "Este alumno no tiene un beneficiario registrado", type: "error" });
      return;
    }
    setSportStudentName(u.full_name);
    setSportBeneficiaryId(data.id);
    setSportOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-[family-name:var(--font-headline-lg)] text-[28px] text-on-surface uppercase tracking-tighter">
            Usuarios
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={exportTimeframe}
            onChange={(e) => setExportTimeframe(e.target.value as any)}
            className="bg-surface-container border border-on-surface/10 rounded-lg px-3 py-2 text-[13px] font-[family-name:var(--font-body-md)] text-on-surface focus:outline-none focus:border-primary/50"
          >
            <option value="mes">Este Mes</option>
            <option value="ano">Este Año</option>
            <option value="historico">Histórico Completo</option>
          </select>
          <button
            onClick={() => { setEditingDependent(null); setDependentModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors text-[13px] font-[family-name:var(--font-headline-md)] uppercase"
          >
            <span className="material-symbols-outlined text-[18px]">child_care</span>
            Crear y Asignar Carga
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors text-[13px] font-[family-name:var(--font-headline-md)] uppercase"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Crear Usuario
          </button>
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600/10 text-green-500 border border-green-500/20 hover:bg-green-600/20 transition-colors text-[13px] font-[family-name:var(--font-headline-md)] uppercase disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">{exporting ? "hourglass_empty" : "download"}</span>
            {exporting ? "Generando..." : "Excel"}
          </button>
        </div>
      </div>

      <DataTable
        columns={[
          { key: "full_name", label: "Nombre", render: (u) => (
            <div className={`flex items-center gap-3 ${u._isDependent ? "pl-6" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${u._isDependent ? "bg-surface-container" : "bg-surface-container"}`}>
                <span className={`material-symbols-outlined text-[16px] ${u._isDependent ? "text-on-surface-variant" : "text-primary"}`}>
                  {u._isDependent ? "child_care" : "person"}
                </span>
              </div>
              <div>
                <p className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">{u.full_name}</p>
                {u._isDependent ? (
                  <p className="font-[family-name:var(--font-body-md)] text-[11px] text-on-surface-variant">Carga de {u._tutorName}</p>
                ) : (
                  <p className="font-[family-name:var(--font-body-md)] text-[11px] text-on-surface-variant">{u.email}</p>
                )}
              </div>
            </div>
          )},
          { key: "role_id", label: "Rol / Tipo", render: (u) => {
            if (u._isDependent) return <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">Carga</span>;
            return ROLE_LABELS[u.role_id] || `Rol ${u.role_id}`;
          }},
          { key: "_category", label: "Categoría", render: (u) => {
            const cat = u._isDependent ? (u._category || "adulto") : computeCategoryFromBirth(u.birth_date);
            return (
              <span className={`inline-block font-[family-name:var(--font-label-sm)] text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${categoryBadgeClass(cat)}`}>
                {categoryLabel(cat)}
              </span>
            );
          }},
          { key: "phone", label: "Teléfono", render: (u) => u._isDependent ? "—" : (u.phone || "—") },
          { key: "rut", label: "RUT", render: (u) => u.rut || "—" },
          { key: "active", label: "Estado", render: (u) => {
            if (u._isDependent) return <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant">—</span>;
            return <StatusBadge status={u.active ? "activo" : "cancelado"} />;
          }},
          { key: "created_at", label: "Registro", render: (u) => new Date(u.created_at).toLocaleDateString("es-CL") },
        ]}
        data={users}
        loading={loading}
        searchKey={["full_name", "email", "rut"]}
        searchPlaceholder="Buscar por nombre, email o RUT..."
        onEdit={openEdit}
        onView={openFicha}
        onSport={openSportProfile}
        canView={(u) => !!u._isDependent}
        canSport={(u) => !!u._isDependent || u.role_id === 4}
        emptyMessage="No hay usuarios registrados"
      />

      <FormModal open={modalOpen} title={editing ? `Editar: ${editing.full_name}` : ""} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Rol</label>
            <select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })} className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer">
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-primary" />
            <span className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface">Activo</span>
          </label>
          <div className="flex justify-end gap-3 pt-4 border-t border-on-surface/5">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] cursor-pointer">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2.5 rounded-lg btn-primary-gradient text-white text-[14px] disabled:opacity-50 cursor-pointer">{saving ? "Guardando..." : "Guardar Cambios"}</button>
          </div>
        </div>
      </FormModal>
      <FormModal open={createModalOpen} title="Crear Usuario" onClose={() => setCreateModalOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Email</label>
            <input
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              placeholder="usuario@ejemplo.cl"
              className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 placeholder:text-on-surface/30"
            />
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Nombre Completo</label>
            <input
              type="text"
              value={createForm.full_name}
              onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
              placeholder="Nombre del usuario"
              className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 placeholder:text-on-surface/30"
            />
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Rol</label>
            <select
              value={createForm.role_id}
              onChange={(e) => setCreateForm({ ...createForm, role_id: Number(e.target.value) })}
              className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50 cursor-pointer"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Fecha de Nacimiento (opcional)</label>
              <input
                type="date"
                value={createForm.birth_date}
                onChange={(e) => setCreateForm({ ...createForm, birth_date: e.target.value })}
                className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Teléfono (opcional)</label>
              <input
                type="tel"
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                placeholder="+569..."
                className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">RUT (opcional)</label>
            <input
              type="text"
              value={createForm.rut}
              onChange={(e) => setCreateForm({ ...createForm, rut: e.target.value })}
              placeholder="12.345.678-9"
              className="w-full bg-surface-container border border-on-surface/10 rounded-lg px-4 py-2.5 text-[14px] text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary/50"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-on-surface/5">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2.5 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateUser}
              disabled={creating}
              className="px-4 py-2.5 rounded-lg btn-primary-gradient text-white text-[14px] disabled:opacity-50 cursor-pointer"
            >
              {creating ? "Creando..." : "Crear Usuario"}
            </button>
          </div>
        </div>
      </FormModal>

      <FormModal open={resultModalOpen} title="Usuario Creado" onClose={() => setResultModalOpen(false)}>
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
            <span className="material-symbols-outlined text-[32px] text-green-400">check_circle</span>
            <div>
              <p className="font-[family-name:var(--font-body-md)] text-[14px] text-on-surface font-semibold">Usuario creado exitosamente</p>
              {createdUser && (
                <p className="font-[family-name:var(--font-body-md)] text-[12px] text-on-surface-variant">{createdUser.full_name} — {createdUser.email}</p>
              )}
            </div>
          </div>
          <div>
            <label className="block font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant mb-1.5">Contraseña Generada</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-surface-container border border-on-surface/10 rounded-lg px-4 py-3">
                <code className="text-[18px] font-[family-name:var(--font-jetbrains)] text-primary tracking-wider select-all">{tempPassword}</code>
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(tempPassword); setToast({ msg: "Contraseña copiada al portapapeles", type: "success" }); }}
                className="px-3 py-3 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer"
                title="Copiar contraseña"
              >
                <span className="material-symbols-outlined text-[20px]">content_copy</span>
              </button>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px] text-yellow-400 flex-shrink-0 mt-0.5">warning</span>
            <p className="font-[family-name:var(--font-body-md)] text-[12px] text-yellow-300/80">
              Esta contraseña solo se muestra una vez. Cópiala ahora y compártela con el usuario.
              También se ha enviado un correo de bienvenida a <strong>{createdUser?.email}</strong> con sus credenciales.
            </p>
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setResultModalOpen(false)}
              className="px-6 py-2.5 rounded-lg btn-primary-gradient text-white text-[14px] cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </FormModal>

      <CreateDependentModal
        open={dependentModalOpen}
        onClose={() => setDependentModalOpen(false)}
        onSaved={async () => {
          await load();
          setToast({ msg: editingDependent ? "Carga actualizada" : "Carga creada y asignada", type: "success" });
        }}
        tutors={users.filter((u) => !u._isDependent).map((u) => ({ id: u.id, full_name: u.full_name, email: u.email, address: u.address || null }))}
        editingDependent={editingDependent}
      />

      <VerFichaModal
        open={fichaOpen}
        onClose={() => setFichaOpen(false)}
        dependent={fichaRow}
      />

      <SportProfileModal
        open={sportOpen}
        onClose={() => setSportOpen(false)}
        onSaved={load}
        beneficiaryId={sportBeneficiaryId}
        studentName={sportStudentName}
      />

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
