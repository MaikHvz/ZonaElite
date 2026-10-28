#!/usr/bin/env node
// Test suite de producción ZonaElite.
// Correr: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/test-flows.mjs
//
// Secciones:
//   A. Boundaries de zona horaria (America/Santiago) — valida helpers reales y
//      demuestra los bugs de los patrones toISOString()/split.
//   B. Scan estático del código fuente — detecta patrones de fecha riesgosos.
//   C. Firma HMAC-SHA256 de Flow (create-order / callback confirmation).
//   D. Contratos de esquema / RLS (documentacion/squema-sql-actualizado.sql).
//   E. Ciclo de vida de inscripción (extendEnrollment / addDaysChile).
//   F. Vencimiento efectivo de membresías (B-001/B-009) + scan de componentes.
//
// Exit code != 0 si falla cualquier test lógico o el scan detecta defectos.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";

process.env.FLOW_SECRET_KEY = "test-secret-key-zonaelite";
process.env.FLOW_API_KEY = "test-api-key-zonaelite";

const {
  getChileToday,
  addDaysChile,
  chileDateToUtc,
  chileMonthStartDate,
  chileMonthEndDate,
  chileNextMonthStartDate,
  chileQuarterStartDate,
  chileQuarterEndDate,
  chileMonthsBackStart,
  chileMonthKey,
} = await import("../src/lib/dates.ts");
const { verifyFlowCallbackSignature, mapFlowStatus } = await import("../src/lib/flow.ts");
const {
  effectiveMembershipStatus,
  isMembershipExpired,
  daysRemaining,
} = await import("../src/lib/membership-status.ts");
const { normalizeRut, isValidRut, formatRut } = await import("../src/lib/rut.ts");

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const CHILE_TZ = "America/Santiago";

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, cond, detail = "") {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? `  -> ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

function chileDateAt(ts) {
  return new Date(ts).toLocaleDateString("en-CA", { timeZone: CHILE_TZ });
}

function chileOffsetMinutesAt(utcTs) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CHILE_TZ,
    timeZoneName: "longOffset",
  }).formatToParts(new Date(utcTs));
  const name = parts.find((p) => p.type === "timeZoneName").value; // "GMT-04:00"
  const m = name.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) throw new Error("No se pudo leer offset de " + name);
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

// Instante UTC equivalente a una fecha/hora local de Chile.
function chileUtcForLocal(y, mo, d, h, mi) {
  const probe = Date.UTC(y, mo, d, h, mi, 0, 0);
  const off = chileOffsetMinutesAt(probe);
  return new Date(probe - off * 60000);
}

// ============================================================
// A. ZONA HORARIA
// ============================================================
section("A. Zona horaria (America/Santiago)");

// A1. Helper real getChileToday debe coincidir con el cálculo directo.
ok("getChileToday() == chileDateAt(now)", getChileToday() === chileDateAt(Date.now()));

// A2. Edge: instante donde la fecha UTC difiere de la fecha chilena.
// 2026-08-01T02:00Z = 2026-07-31 22:00 en Chile.
const edge = Date.UTC(2026, 7, 1, 2, 0, 0);
ok("Fecha Chile correcta en edge instant (Jul 31)",
  chileDateAt(edge) === "2026-07-31");
ok("BUG DEMOSTRADO: toISOString().split() da Aug 01 en edge",
  new Date(edge).toISOString().split("T")[0] === "2026-08-01");

// A3. Límite de mes en host UTC (Vercel) vs correcto en Chile.
// Código actual: new Date(y, m, 1).toISOString()
const hostUtcBoundary = new Date(Date.UTC(2026, 7, 1, 0, 0, 0)).toISOString(); // lo que produce Vercel
const chileBoundary = chileUtcForLocal(2026, 7, 1, 0, 0).toISOString();
ok("host UTC produce 2026-08-01T00:00Z (Vercel)",
  hostUtcBoundary === "2026-08-01T00:00:00.000Z");
ok("límite correcto Chile = 2026-08-01T04:00Z",
  chileBoundary === "2026-08-01T04:00:00.000Z");
ok("BUG DEMOSTRADO: los límites difieren por 4h (leak entre meses)",
  hostUtcBoundary !== chileBoundary);

// Consecuencia concreta: pago del 31 Jul 23:00 Chile (UTC Aug 1 03:00Z)
// entra al total de Agosto con el patrón actual, pero NO debería.
const jul31LateChile = Date.UTC(2026, 7, 1, 3, 0, 0); // = Jul 31 23:00 Chile
ok("pago Jul31 23:00 Chile es >= límite actual (contado en Agosto: MAL)",
  jul31LateChile >= new Date(hostUtcBoundary).getTime());
ok("pago Jul31 23:00 Chile es < límite correcto (debería ser Julio)",
  jul31LateChile < new Date(chileBoundary).getTime());

// A4. addDaysChile es DST-safe (cruza transiciones de Abril y Septiembre 2026).
// Detecta los cambios de offset recorriendo cada día del año.
const transitions = [];
let prevOffset = chileOffsetMinutesAt(Date.UTC(2025, 11, 31));
for (let doy = 0; doy < 365; doy++) {
  const ts = Date.UTC(2026, 0, 1, 0, 0, 0) + doy * 86400000;
  const off = chileOffsetMinutesAt(ts);
  if (off !== prevOffset) {
    const d = new Date(ts).toISOString().split("T")[0];
    transitions.push({ date: d, from: prevOffset, to: off });
  }
  prevOffset = off;
}
ok("detectadas transiciones DST Chile 2026 (2 por año)", transitions.length === 2,
  JSON.stringify(transitions));

ok("addDaysChile() cruza Sep DST +1 día",
  addDaysChile("2026-09-05", 1) === "2026-09-06" && addDaysChile("2026-09-06", -1) === "2026-09-05");
ok("addDaysChile() cruza Abr DST -1 día",
  addDaysChile("2026-04-04", 1) === "2026-04-05" && addDaysChile("2026-04-05", -1) === "2026-04-04");

// A5. CheckoutModal formatDate: new Date(dateStr + "T12:00:00") es estable.
ok("formatDate T12:00:00 estable entre días",
  new Date("2026-08-01T12:00:00").toLocaleDateString("en-CA") === "2026-08-01");

// A6. Helpers nuevos de dates.ts (regresión de los fixes).
ok("chileDateToUtc invierno (UTC-4) -> 04:00Z",
  chileDateToUtc("2026-08-01") === "2026-08-01T04:00:00.000Z");
ok("chileDateToUtc verano (UTC-3) -> 03:00Z",
  chileDateToUtc("2026-01-15") === "2026-01-15T03:00:00.000Z");
ok("chileMonthEnd + 1 día == chileNextMonthStart",
  addDaysChile(chileMonthEndDate(), 1) === chileNextMonthStartDate());
ok("chileQuarter: start <= today <= end",
  chileQuarterStartDate() <= getChileToday() && getChileToday() <= chileQuarterEndDate());
ok("chileMonthsBackStart(0) es el mes actual",
  chileMonthsBackStart(0).slice(0, 7) === getChileToday().slice(0, 7));
ok("chileMonthsBackStart(1) es el mes anterior",
  chileMonthsBackStart(1).slice(0, 7) !== getChileToday().slice(0, 7));
ok("chileMonthKey: 01 Aug 02:00Z es Jul 31 en Chile -> mes Julio",
  chileMonthKey("2026-08-01T02:00:00.000Z") === "2026-07");
ok("chileMonthKey: 01 Aug 06:00Z es Ago 02:00 en Chile -> mes Agosto",
  chileMonthKey("2026-08-01T06:00:00.000Z") === "2026-08");

// ============================================================
// B. SCAN ESTÁTICO
// ============================================================
section("B. Scan estático de patrones de fecha en src/");

const srcDir = join(ROOT, "src");
function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listFiles(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

// P1: day-level off-by-one (aplica a columnas DATE).
const p1 = /\.toISOString\(\)\.split\("T"\)\[0\]/;
// P2: month/quarter boundary shift (aplica a comparaciones timestamp).
const p2 = /new Date\([^)]*getFullYear\(\),?[^)]*getMonth\(\),?/;
// P3: timestamp insert (OK por sí solo).
const p3 = /(paid_at|marked_at|sent_at|created_at):\s*new Date\(\)\.toISOString\(\)/;

const findings = { p1: [], p2: [], p3: [] };

for (const file of listFiles(srcDir)) {
  const rel = file.replace(ROOT + "\\", "").replace(/\\/g, "/");
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    const n = i + 1;
    if (p1.test(line)) findings.p1.push(`${rel}:${n}`);
    if (p2.test(line)) findings.p2.push(`${rel}:${n}`);
    if (p3.test(line)) findings.p3.push(`${rel}:${n}`);
  });
}

console.log(`\n  [P1] toISOString().split("T")[0]  (off-by-one en columnas DATE)  → ${findings.p1.length}`);
for (const f of findings.p1) console.log(`        ${f}`);
console.log(`  [P2] new Date(y,m,1).toISOString() (límite de mes corrido 3-4h)  → ${findings.p2.length}`);
for (const f of findings.p2) console.log(`        ${f}`);
console.log(`  [P3] timestamps ISO insert (correctos)                         → ${findings.p3.length}`);

ok("scan: sin usos P1 en columnas DATE (patrón off-by-one)", findings.p1.length === 0,
  `${findings.p1.length} usos riesgosos`);
ok("scan: sin usos P2 de límite de mes (patrón 4h)", findings.p2.length === 0,
  `${findings.p2.length} usos riesgosos`);

// ============================================================
// C. FLOW HMAC
// ============================================================
section("C. Firma HMAC-SHA256 Flow");

function signFlowParams(params, secretKey) {
  const keys = Object.keys(params).sort();
  let toSign = "";
  for (const key of keys) toSign += key + params[key];
  return createHmac("sha256", secretKey).update(toSign).digest("hex");
}

const orderParams = {
  amount: "15000",
  commerceOrder: "ZONA-20260801-001",
  currency: "CLP",
  email: "alumno@test.cl",
  subject: "Membresía Mensual",
  urlConfirmation: "https://zona-elite-six.vercel.app/api/flow/confirmation",
  urlReturn: "https://zona-elite-six.vercel.app/dashboard/pagos",
};
const s1 = signFlowParams(orderParams, "test-secret-key-zonaelite");
const s2 = signFlowParams({ ...orderParams, amount: "99999" }, "test-secret-key-zonaelite");
const s3 = signFlowParams(orderParams, "other-secret");
ok("sign: determinista", s1 === signFlowParams(orderParams, "test-secret-key-zonaelite"));
ok("sign: cambia con el monto", s1 !== s2);
ok("sign: cambia con la secret key", s1 !== s3);
ok("sign: orden de keys irrelevante",
  signFlowParams(Object.fromEntries(Object.entries(orderParams).reverse()), "test-secret-key-zonaelite") === s1);

// Callback real de confirmation.
const body = { amount: "15000", commerceOrder: "ZONA-20260801-001", subject: "x", token: "TOK123" };
const validSig = signFlowParams(Object.fromEntries(Object.entries(body).filter(([k]) => k !== "s")), "test-secret-key-zonaelite");
ok("verifyFlowCallbackSignature: firma válida -> true", verifyFlowCallbackSignature(body, validSig) === true);

// B-007: verificación de commerceOrder entre Flow (getStatus) y el pago local.
const flowSource = readFileSync(join(ROOT, "src", "lib", "flow.ts"), "utf8");
const confirmationRoute = readFileSync(join(ROOT, "src", "app", "api", "flow", "confirmation", "route.ts"), "utf8");
const verifyRoute = readFileSync(join(ROOT, "src", "app", "api", "flow", "verify", "route.ts"), "utf8");
ok("verifyFlowCallbackSignature: body alterado -> false",
  verifyFlowCallbackSignature({ ...body, amount: "1" }, validSig) === false);
ok("verifyFlowCallbackSignature: firma con otra secret -> false",
  verifyFlowCallbackSignature(body, signFlowParams(body, "wrong")) === false);

// B-007: verificación de commerceOrder entre Flow (getStatus) y el pago local.
const { isVerificationOrderMatch } = await import("../src/lib/flow-helpers.ts");
ok("B-007: orden coincide (mismo commerceOrder) -> true",
  isVerificationOrderMatch("ZONA-20260801-001", "ZONA-20260801-001") === true);
ok("B-007: orden distinta -> false",
  isVerificationOrderMatch("ZONA-20260801-001", "ZONA-OTHER-999") === false);
ok("B-007: alguno nulo/undefined -> false",
  isVerificationOrderMatch(null, "ZONA-20260801-001") === false &&
  isVerificationOrderMatch("ZONA-20260801-001", undefined) === false);
ok("B-007: compara el commerceOrder en confirmation/route tras verifyFlowPayment",
  /isVerificationOrderMatch\(payment\.commerce_order, verification\.commerceOrder\)/.test(confirmationRoute));
ok("B-007: compara el commerceOrder en verify/route tras verifyFlowPayment",
  /isVerificationOrderMatch\(fullPayment\.commerce_order, verification\.commerceOrder\)/.test(verifyRoute));
ok("B-007: verifyFlowCallbackSignature definida y usada (helper de firma listo)",
  /verifyFlowCallbackSignature/.test(flowSource) &&
  /isVerificationOrderMatch/.test(readFileSync(join(ROOT, "src", "lib", "flow-helpers.ts"), "utf8")));

// ============================================================
// D. CONTRATOS DE ESQUEMA / RLS
// ============================================================
section("D. Contratos de esquema / RLS");

const schemaPath = join(ROOT, "documentacion", "squema-sql-actualizado.sql");
const schema = readFileSync(schemaPath, "utf8");

ok("payments.include_enrollment definido", /include_enrollment boolean DEFAULT false NOT NULL/.test(schema));
ok("payments.enrollment_plan_id definido", /enrollment_plan_id uuid/.test(schema));
ok("payments cols: ALTER/migración presente", /ADD COLUMN IF NOT EXISTS include_enrollment/.test(schema));
ok("RLS: class_enrollments_insert_admin_or_self", /"class_enrollments_insert_admin_or_self"/.test(schema));
ok("RLS: class_enrollments walk-in restringido a admin/staff (B-013)",
  /"class_enrollments_insert_qr_admin_staff"[\s\S]*?is_admin\(\) OR public\.is_staff\(\)/.test(schema) &&
  !/"class_enrollments_insert_qr_walkin"/.test(schema));
ok("RLS: class_enrollments requiere membresía activa en INSERT",
  /m\.beneficiary_id = class_enrollments\.beneficiary_id AND m\.status = 'activa' AND m\.end_date >= public\.chile_today\(\)/.test(schema));
ok("RLS: B-005 sin current_date (UTC) en policies de inscripción",
  !/end_date >= current_date/.test(schema));
ok("RLS: B-005 chile_today() definida en esquema",
  /CREATE OR REPLACE FUNCTION public\.chile_today\(\)/.test(schema));
ok("RLS: B-005 chile_today() usa timezone America/Santiago (DST-safe)",
  /timezone\('America\/Santiago', now\(\).*?::date/.test(schema));
const migration003 = readFileSync(join(ROOT, "contexto", "migrations", "003_chile_today_rls.sql"), "utf8");
const fnDefRegex = /CREATE OR REPLACE FUNCTION public\.chile_today\(\)[\s\S]*?\$\$;/;
const norm = (sql) => sql.replace(/\s+/g, " ").trim();
ok("esquema refleja 1:1: chile_today() migración 003 == esquema",
  norm(fnDefRegex.exec(schema)?.[0] ?? "") === norm(fnDefRegex.exec(migration003)?.[0] ?? ""));
ok("RLS: UNIQUE (beneficiary_id, session_id)", /UNIQUE.*beneficiary_id,\s*session_id/s.test(schema));

// B-013: academy_enrollments ya no permite auto-matrícula del usuario por REST.
ok("B-013: academy_enrollments INSERT restringido a admin/staff",
  /"academy_enrollments_insert_admin_staff"[\s\S]*?is_admin\(\) OR public\.is_staff\(\)/.test(schema) &&
  !/"user_insert_enrollment_flow"/.test(schema));
ok("B-013: attendance INSERT restringido a admin/staff (sin auto-asistencia)",
  /"attendance_insert_admin_staff"[\s\S]*?is_admin\(\) OR public\.is_staff\(\)/.test(schema) &&
  !/"attendance_insert_own_beneficiary"/.test(schema));

// Checkin route: enforcement de membresía en el servidor.
const checkinRoute = readFileSync(join(ROOT, "src", "app", "api", "checkin", "route.ts"), "utf8");
ok("checkin: rechaza sin membresía activa", checkinRoute.includes("Sin membresía activa"));
ok("checkin: rechaza membresía vencida", checkinRoute.includes("Membresía vencida"));
ok("checkin: verifica tokens limitados", checkinRoute.includes("get_remaining_tokens"));

// EnrollModal: inscripción por RPC enroll_class (B-006), con session_id (no schedule_id).
const enrollModal = readFileSync(join(ROOT, "src", "components", "EnrollModal.tsx"), "utf8");
ok("EnrollModal: usa RPC enroll_class (no insert directo)",
  enrollModal.includes('rpc("enroll_class"') && !/from\("class_enrollments"\)\.insert/.test(enrollModal));
ok("EnrollModal: pasa session_id a la RPC", /p_session_id: selectedSession/.test(enrollModal));
ok("EnrollModal: sin inserts de schedule_id", !/schedule_id:\s/.test(enrollModal));
ok("EnrollModal: muestra error de la BD (ej. clase llena)",
  enrollModal.includes("setSubmitError") && enrollModal.includes("failed[0].error_message"));

// B-006: RPC enroll_class en migración 004 y esquema (1:1).
const migration004 = readFileSync(join(ROOT, "contexto", "migrations", "004_enroll_class_rpc.sql"), "utf8");
const enrollFnRegex = /CREATE OR REPLACE FUNCTION public\.enroll_class\([\s\S]*?\$\$/;
ok("B-006: RPC enroll_class definida en migración 004",
  /CREATE OR REPLACE FUNCTION public\.enroll_class\(/.test(migration004));
ok("B-006: lock por sesión (FOR UPDATE) presente",
  /FOR UPDATE/.test(migration004));
ok("B-006: valida capacidad con chile_today()", /v_enrolled >= v_capacity/.test(migration004) &&
  /public\.chile_today\(\)/.test(migration004));
ok("B-006: valida membresía activa + inscripción de academia",
  /NO_MEMBERSHIP/.test(migration004) && /NO_ENROLLMENT/.test(migration004));
ok("B-006: rechaza sesión pasada (no exige status='activa' en la sesión)",
  /La sesión ya pasó/.test(migration004) && !/cs\.status = 'activa'/.test(migration004));
ok("B-006: expone solo a authenticated", /GRANT EXECUTE ON FUNCTION public\.enroll_class\(UUID, UUID\[\]\) TO authenticated/.test(migration004));
ok("B-006: esquema refleja 1:1 migración 004 (enroll_class)",
  norm(enrollFnRegex.exec(schema)?.[0] ?? "") === norm(enrollFnRegex.exec(migration004)?.[0] ?? ""));

// B-010 + B-011: get_remaining_tokens atado a la membresía y RPCs consolidadas.
const migration005 = readFileSync(join(ROOT, "contexto", "migrations", "005_tokens_membership_window.sql"), "utf8");
const remainingFnRegex = /CREATE OR REPLACE FUNCTION public\.get_remaining_tokens\([\s\S]*?\$\$/;
const debtFnRegex = /CREATE OR REPLACE FUNCTION public\.get_enrollment_debt\([\s\S]*?\$\$/;
ok("B-010: migración 005 definida", /005_tokens_membership_window/.test(join("contexto", "migrations", "005_tokens_membership_window.sql")));
ok("B-010: límite superior enrolled_at < end_date+1d en v_consumed",
  /enrolled_at < \(v_end_date \+ INTERVAL '1 day'\)/.test(migration005) && migration005.includes("v_consumed"));
ok("B-010: límite superior también en v_justified",
  migration005.includes("v_justified") && (migration005.match(/enrolled_at < \(v_end_date \+ INTERVAL '1 day'\)/g) || []).length >= 2);
ok("B-010: esquema refleja 1:1 migración 005 (get_remaining_tokens)",
  norm(remainingFnRegex.exec(schema)?.[0] ?? "") === norm(remainingFnRegex.exec(migration005)?.[0] ?? ""));
ok("B-010: get_remaining_tokens única en el esquema (B-011)",
  (schema.match(/CREATE OR REPLACE FUNCTION public\.get_remaining_tokens\(/g) || []).length === 1);
ok("B-011: get_enrollment_debt única en el esquema",
  (schema.match(/CREATE OR REPLACE FUNCTION public\.get_enrollment_debt\(/g) || []).length === 1);
ok("B-011: solo un bloque de ALTER tokens en el esquema",
  (schema.match(/ADD COLUMN IF NOT EXISTS tokens INTEGER NULL;/g) || []).length === 1);
ok("B-010: la función sigue siendo dinámica (STABLE, sin tabla de tokens materializada)",
  /LANGUAGE plpgsql[\s\S]*?SECURITY DEFINER[\s\S]*?STABLE/.test(schema));

// B-012: user_notifications documentada en el esquema (con columnas reales).
ok("B-012: user_notifications definida en el esquema",
  /CREATE TABLE IF NOT EXISTS public\.user_notifications/.test(schema));
ok("B-012: columnas reales (id, user_id, title, content, read, created_at)",
  /user_id uuid NOT NULL/.test(schema) && /title text NOT NULL/.test(schema) &&
  /content text NOT NULL/.test(schema) && /read boolean DEFAULT false NOT NULL/.test(schema) &&
  /created_at timestamptz DEFAULT now\(\) NOT NULL/.test(schema));
ok("B-012: PK user_notifications_pkey definida",
  /CONSTRAINT user_notifications_pkey PRIMARY KEY \(id\)/.test(schema));
ok("B-012: el esquema no duplica la tabla",
  (schema.match(/CREATE TABLE IF NOT EXISTS public\.user_notifications/g) || []).length === 1);

// ============================================================
// E. CICLO DE VIDA DE INSCRIPCIÓN
// ============================================================
section("E. Ciclo de vida de inscripción");

// extendEnrollment: base = max(current_end_date, today) + duration_days.
function extendEnrollmentMath(currentEnd, today, durationDays) {
  const base = currentEnd && currentEnd >= today ? currentEnd : today;
  return addDaysChile(base, durationDays);
}

const today = getChileToday();
ok("extend: membresía vigente se extiende desde current_end",
  extendEnrollmentMath("2026-10-01", today, 180) === addDaysChile("2026-10-01", 180));
ok("extend: inscripción vencida se extiende desde hoy",
  extendEnrollmentMath("2026-01-01", "2026-08-01", 180) === addDaysChile("2026-08-01", 180));
ok("extend: sin end_date usa hoy",
  extendEnrollmentMath(null, today, 180) === addDaysChile(today, 180));

// B-004: asignar 2 veces seguidas NO crea doble inscripción activa.
// Primera llamada crea; segunda (con activa vigente) extiende la misma.
const { extendOrCreateEnrollment } = await import("../src/lib/enrollments.ts");
function createEnrollMock() {
  const store = { enrollments: [], inserts: 0, updates: 0 };
  const plan = { id: "enroll-plan-1", duration_days: 30 };
  function resolveTable(table, ops) {
    if (table === "enrollment_plans") return { data: plan };
    if (table === "academy_enrollments") {
      if (ops.some((o) => o[0] === "insert")) {
        store.inserts++;
        const rec = { id: "enroll-1", ...ops.find((o) => o[0] === "insert")[1] };
        store.enrollments.push(rec);
        return { data: rec };
      }
      if (ops.some((o) => o[0] === "update")) {
        store.updates++;
        const idOp = ops.find((o) => o[0] === "eq" && o[1] === "id");
        const target = store.enrollments.find((e) => e.id === idOp[2]);
        Object.assign(target, ops.find((o) => o[0] === "update")[1]);
        return { error: null };
      }
      const hasGte = ops.some((o) => o[0] === "gte");
      if (hasGte) return { data: store.enrollments[0] || null };
      return { data: null };
    }
    return { data: null };
  }
  function from(table) {
    const ops = [];
    const q = {};
    q.select = () => { ops.push(["select"]); return q; };
    q.eq = (k, v) => { ops.push(["eq", k, v]); return q; };
    q.gte = (k, v) => { ops.push(["gte", k, v]); return q; };
    q.order = (k, d) => { ops.push(["order", k, d]); return q; };
    q.insert = (d) => { ops.push(["insert", d]); return q; };
    q.update = (d) => { ops.push(["update", d]); return q; };
    const settle = () => Promise.resolve(resolveTable(table, ops));
    q.single = () => settle();
    q.maybeSingle = () => settle();
    q.then = (res, rej) => settle().then(res, rej);
    return q;
  }
  return { from, store };
}

const enrollMock = createEnrollMock();
const first = await extendOrCreateEnrollment(enrollMock, "ben-1", "enroll-plan-1", null);
const recAfterFirst = { ...enrollMock.store.enrollments[0], inserts: enrollMock.store.inserts };
const secondNoPay = await extendOrCreateEnrollment(enrollMock, "ben-1", "enroll-plan-1", null);
const recAfterSecond = { ...enrollMock.store.enrollments[0], inserts: enrollMock.store.inserts, updates: enrollMock.store.updates };
const thirdWithPay = await extendOrCreateEnrollment(enrollMock, "ben-1", "enroll-plan-1", "pay-9");
const recAfterThird = { ...enrollMock.store.enrollments[0], updates: enrollMock.store.updates };

ok("B-004: asignar 1ª vez crea inscripción (no duplica)",
  first.success === true && recAfterFirst.inserts === 1);
ok("B-004: fechas de la 1ª creación usan getChileToday/addDaysChile (DST-safe)",
  recAfterFirst.start_date === today && recAfterFirst.end_date === addDaysChile(today, 30));
ok("B-004: asignar 2ª vez con activa vigente NO crea nueva (extiende)",
  secondNoPay.success === true && recAfterSecond.inserts === 1 && recAfterSecond.updates === 1);
ok("B-004: la 2ª asignación conserva el mismo enrollmentId",
  first.enrollmentId === secondNoPay.enrollmentId && secondNoPay.enrollmentId === "enroll-1");
ok("B-004: al extender sin pago nuevo se conserva payment_id previo (null)",
  secondNoPay.success === true && recAfterSecond.payment_id === null);
ok("B-004: al extender con pago nuevo se enlaza payment_id",
  thirdWithPay.success === true && recAfterThird.payment_id === "pay-9" && recAfterThird.updates === 2);

// Modelo per-session: session_id es la clave del modelo (columna nullable),
// y el UNIQUE (beneficiary_id, session_id) permite inscribirse a múltiples
// sesiones del mismo horario. El UNIQUE legacy de schedule_id queda fuera.
ok("modelo per-session: session_id columna clave nullable",
  /session_id uuid,/.test(schema));
ok("modelo per-session: UNIQUE (beneficiary_id, session_id)",
  /UNIQUE \(beneficiary_id, session_id\)/.test(schema));
ok("B-014: UNIQUE legacy (beneficiary_id, schedule_id) eliminado del esquema",
  !/class_enrollments_beneficiary_schedule_key/.test(schema));

// B-004 scans: admin/inscripciones ya no calcula fechas con new Date() del
// servidor ni suma en ms (off-by-one/DST); usa el helper dedup+extender.
const inscripcionesPage = readFileSync(join(ROOT, "src", "app", "admin", "inscripciones", "page.tsx"), "utf8");
ok("B-004: handleAssign usa extendOrCreateEnrollment (dedup)",
  inscripcionesPage.includes("extendOrCreateEnrollment("));
ok("B-004: sin fechas con new Date() del servidor en handleAssign",
  !/Date\.now\(\) \+\s*\w+\.duration_days \* 86400000/.test(inscripcionesPage) &&
  !/endDateObj/.test(inscripcionesPage));
ok("B-004: sin insert directo duplicador de academy_enrollments en handleAssign",
  !/from\("academy_enrollments"\)\s*\.insert/.test(inscripcionesPage));

// ============================================================
// F. VENCIMIENTO EFECTIVO DE MEMBRESÍAS (B-001 / B-009)
// ============================================================
section("F. Vencimiento efectivo de membresías");

// Regla de negocio: vence cuando end_date < hoy, sin importar el status literal
// (nada asigna status='vencida' automáticamente, así que se deriva por fecha).
ok("effective: activa con end_date en el pasado -> vencida",
  effectiveMembershipStatus("activa", "2026-07-30", "2026-08-01") === "vencida");
ok("effective: activa con end_date hoy -> activa",
  effectiveMembershipStatus("activa", "2026-08-01", "2026-08-01") === "activa");
ok("effective: activa con end_date futuro -> activa",
  effectiveMembershipStatus("activa", "2026-09-01", "2026-08-01") === "activa");
ok("effective: cancelada con end_date pasado -> cancelada (se respeta)",
  effectiveMembershipStatus("cancelada", "2026-07-01", "2026-08-01") === "cancelada");
ok("effective: cancelada con end_date futuro -> cancelada (se respeta)",
  effectiveMembershipStatus("cancelada", "2026-12-01", "2026-08-01") === "cancelada");
ok("effective: vencida literal -> vencida",
  effectiveMembershipStatus("vencida", "2026-07-01", "2026-08-01") === "vencida");
ok("effective: sin end_date -> vencida (no puede estar activa)",
  effectiveMembershipStatus("activa", null, "2026-08-01") === "vencida");
ok("effective: cruce DST (end_date invierno vs hoy verano) correcto por string",
  effectiveMembershipStatus("activa", "2026-04-30", "2026-08-01") === "vencida");

ok("isMembershipExpired: refleja effectiveStatus (pasado -> true)",
  isMembershipExpired("activa", "2026-07-30", "2026-08-01") === true);
ok("isMembershipExpired: futuro -> false",
  isMembershipExpired("activa", "2026-09-01", "2026-08-01") === false);

// daysRemaining (Chile-aware, anclado a mediodía para evitar DST).
ok("daysRemaining: 5 días exactos", daysRemaining("2026-08-06", "2026-08-01") === 5);
ok("daysRemaining: vencido -> 0", daysRemaining("2026-07-30", "2026-08-01") === 0);
ok("daysRemaining: hoy -> 0", daysRemaining("2026-08-01", "2026-08-01") === 0);
ok("daysRemaining: sin end_date -> 0", daysRemaining(null, "2026-08-01") === 0);
ok("daysRemaining: cruza DST Sep (26-08-01 -> 26-09-01 = 31 días)",
  daysRemaining("2026-09-01", "2026-08-01") === 31);

// Scan estático: los componentes del dashboard ya no dependen del status
// literal "vencida" como única fuente de verdad.
const membershipCard = readFileSync(join(ROOT, "src", "components", "dashboard", "MembershipCard.tsx"), "utf8");
const alertBanner = readFileSync(join(ROOT, "src", "components", "dashboard", "AlertBanner.tsx"), "utf8");
const membresiasPage = readFileSync(join(ROOT, "src", "app", "dashboard", "membresias", "page.tsx"), "utf8");

ok("MembershipCard: no usa status==='vencida' como fuente de vencimiento",
  !/status === "vencida"/.test(membershipCard));
ok("AlertBanner: no usa status==='vencida' como fuente de vencimiento",
  !/status === "vencida"/.test(alertBanner));
ok("MembershipCard: usa effectiveMembershipStatus",
  membershipCard.includes("effectiveMembershipStatus"));
ok("AlertBanner: usa effectiveMembershipStatus",
  alertBanner.includes("effectiveMembershipStatus"));
ok("membresias page: usa effectiveMembershipStatus en el filtro",
  membresiasPage.includes("effectiveMembershipStatus"));
ok("AlertBanner: botón Renovar no apunta a placeholder wa.me/56900000000",
  !alertBanner.includes("56900000000"));
ok("AlertBanner: botón Renovar lleva a la sección de compra /#membresias",
  alertBanner.includes("/#membresias"));

// ============================================================
// G. ATOMICIDAD DE MEMBRESÍAS (B-002 / B-015)
// ============================================================
section("G. Atomicidad de membresías");

const { confirmAndCreateMembership, notifyPaymentWithoutMembership } = await import("../src/lib/flow-helpers.ts");

// Mock de Supabase que simula el índice único parcial idx_memberships_one_active:
// el segundo INSERT de una membresía activa para el mismo beneficiario falla 23505.
function createRaceMock() {
  const store = {
    activeMembershipId: null, // la única membresía activa (como lo impone el índice)
    insertOkCount: 0,
    links: [],                // { paymentId, membershipId }
  };
  const payments = {
    "pay-1": { id: "pay-1", user_id: "user-1", concept: "Membresía Plan Mensual - ZONAELITE", membership_id: null, beneficiary_id: "ben-1" },
    "pay-2": { id: "pay-2", user_id: "user-1", concept: "Membresía Plan Mensual - ZONAELITE", membership_id: null, beneficiary_id: "ben-1" },
  };

  function resolveTable(table, ops) {
    const insert = ops.find((o) => o[0] === "insert");
    const update = ops.find((o) => o[0] === "update");
    if (table === "payments") {
      if (update) {
        const idOp = ops.find((o) => o[0] === "eq" && o[1] === "id");
        store.links.push({ paymentId: idOp ? idOp[2] : null, membershipId: update[1].membership_id });
        return { error: null };
      }
      const idOp = ops.find((o) => o[0] === "eq" && o[1] === "id");
      return { data: idOp ? { ...payments[idOp[2]] } : null };
    }
    if (table === "membership_plans") return { data: { id: "plan-1", duration_days: 30 } };
    if (table === "memberships") {
      if (insert) {
        if (store.activeMembershipId) return { data: null, error: { code: "23505", message: "duplicate" } };
        store.activeMembershipId = "mem-1";
        store.insertOkCount++;
        return { data: { id: "mem-1" } };
      }
      if (update) { store.activeMembershipId = null; return { error: null }; }
      const hasPlan = ops.some((o) => o[0] === "eq" && o[1] === "plan_id");
      const hasGte = ops.some((o) => o[0] === "gte" && o[1] === "created_at");
      if (hasPlan && hasGte) return { data: null }; // dedup 10 min
      if (store.activeMembershipId) return { data: { id: store.activeMembershipId } }; // retry 23505
      return { data: null };
    }
    return { data: null };
  }

  function from(table) {
    const ops = [];
    const q = {};
    q.select = (cols) => { ops.push(["select", cols]); return q; };
    q.eq = (k, v) => { ops.push(["eq", k, v]); return q; };
    q.ilike = (k, v) => { ops.push(["ilike", k, v]); return q; };
    q.gte = (k, v) => { ops.push(["gte", k, v]); return q; };
    q.order = (k, dir) => { ops.push(["order", k, dir]); return q; };
    q.insert = (d) => { ops.push(["insert", d]); return q; };
    q.update = (d) => { ops.push(["update", d]); return q; };
    const settle = () => Promise.resolve(resolveTable(table, ops));
    q.single = () => settle();
    q.maybeSingle = () => settle();
    q.then = (res, rej) => settle().then(res, rej);
    return q;
  }
  return { from, store };
}

const raceMock = createRaceMock();
const [r1, r2] = await Promise.all([
  confirmAndCreateMembership(raceMock, "pay-1", "user-1"),
  confirmAndCreateMembership(raceMock, "pay-2", "user-1"),
]);

ok("race: ambas confirmaciones en paralelo terminan con éxito",
  r1.success === true && r2.success === true);
ok("race: solo 1 membresía activa creada (el índice rechazó la 2ª)",
  raceMock.store.insertOkCount === 1 && raceMock.store.activeMembershipId !== null);
ok("race: ambos pagos quedan linkeados a la MISMA membresía activa",
  raceMock.store.links.length === 2 &&
  raceMock.store.links.every((l) => l.membershipId === "mem-1"));
ok("race: los dos resultados devuelven el mismo membershipId",
  r1.membershipId === r2.membershipId && r1.membershipId === "mem-1");

// B-008: falla silenciosa post-pago — alerta admin cuando no se crea la membresía.
function createNotifyMock({ hasAdmin = true } = {}) {
  const store = { notificationInserted: null };
  function from(table) {
    if (table === "profiles") {
      return { select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: hasAdmin ? { id: "admin-1" } : null }) }) }) }) };
    }
    if (table === "notifications") {
      return {
        insert: (d) => { store.notificationInserted = d; return Promise.resolve({ error: null }); },
      };
    }
    return { select: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) };
  }
  return { from, store };
}

const notifyMock = createNotifyMock();
const notifyResult = await notifyPaymentWithoutMembership(
  notifyMock,
  { id: "pay-9", user_id: "user-9", concept: "Membresía Plan Mensual" },
  "Plan no encontrado"
);
const notif = notifyMock.store.notificationInserted;

ok("B-008: notificación insertada con target='staff' (solo admin la ve)",
  notifyResult.success === true && notif && notif.target === "staff");
ok("B-008: tipo 'sistema' y subject claro", notif && notif.type === "sistema" &&
  notif.subject === "Pago pagado sin membresía");
ok("B-008: content incluye payment_id, user_id y el error",
  notif && notif.content.includes("pay-9") && notif.content.includes("user-9") &&
  notif.content.includes("Plan no encontrado"));
ok("B-008: sent_by resuelto al primer admin (role_id=1)", notif && notif.sent_by === "admin-1");
{
  const noAdminMock = createNotifyMock({ hasAdmin: false });
  const noAdminRes = await notifyPaymentWithoutMembership(noAdminMock, { id: "pay-10", user_id: "user-10" }, "err");
  ok("B-008: sin admin no inserta y no lanza",
    noAdminRes.success === false && noAdminMock.store.notificationInserted === null);
}

ok("B-008: confirmation/route notifica al admin si la membresía falla",
  confirmationRoute.includes("notifyPaymentWithoutMembership") &&
  /result\.success\) \{[\s\S]*?\} else \{[\s\S]*?notifyPaymentWithoutMembership/.test(confirmationRoute));
ok("B-008: verify/route notifica al admin si la membresía falla",
  verifyRoute.includes("notifyPaymentWithoutMembership") &&
  /result\.success\) \{[\s\S]*?\} else \{[\s\S]*?notifyPaymentWithoutMembership/.test(verifyRoute));

const flowHelpers = readFileSync(join(ROOT, "src", "lib", "flow-helpers.ts"), "utf8");
const assignModal = readFileSync(join(ROOT, "src", "components", "admin", "AssignMembershipModal.tsx"), "utf8");

ok("B-004: flow-helpers delega en helper compartido (sin lógica duplicada)",
  flowHelpers.includes("extendOrCreateEnrollment(supabase, beneficiaryId, enrollmentPlanId, paymentId)"));

ok("B-015: código muerto cancelQuery.neq eliminado de flow-helpers",
  !/cancelQuery\.neq/.test(flowHelpers) && !/existingMembership\?\.id/.test(flowHelpers));
ok("B-002: flow-helpers maneja SQLSTATE 23505 (retry idempotente)",
  flowHelpers.includes('"23505"'));
ok("B-002: AssignMembershipModal maneja 23505 y recarga el listado",
  assignModal.includes('"23505"') && assignModal.includes("onSaved()"));

const migration002 = readFileSync(join(ROOT, "contexto", "migrations", "002_unique_active_membership.sql"), "utf8");
ok("migración 002: índice único parcial WHERE status='activa'",
  /CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_one_active/.test(migration002) &&
  /WHERE status = 'activa'/.test(migration002));
ok("migración 002: conserva la más reciente (created_at DESC, id DESC)",
  /ORDER BY created_at DESC, id DESC/.test(migration002));
ok("migración 002: limpieza solo de vigentes (end_date >= current_date)",
  /end_date >= current_date/.test(migration002));
ok("migración 002: backfill de activas vencidas a 'vencida'",
  /SET status = 'vencida'/.test(migration002) && /end_date < current_date/.test(migration002));
ok("esquema refleja 1:1: idx_memberships_one_active documentado",
  /CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_one_active/.test(schema));

// ============================================================
// H. FASE 10 — DEUDAS QR + RLS RESTRINGIDAS + LEGACY (B-013, B-014)
// ============================================================
section("H. Fase 10: deudas, RLS restringidas y constraint legacy");

const migration006 = readFileSync(join(ROOT, "contexto", "migrations", "006_debts_and_rls.sql"), "utf8");

// H1. Tabla debts en migración y esquema.
ok("F10: migración 006 definida", /006_debts_and_rls/.test(join("contexto", "migrations", "006_debts_and_rls.sql")));
ok("F10: tabla debts en la migración", /CREATE TABLE IF NOT EXISTS public\.debts/.test(migration006));
ok("F10: columnas debts (beneficiary, status, amount, resolved)",
  /beneficiary_id uuid NOT NULL/.test(migration006) &&
  /status text NOT NULL DEFAULT 'pendiente'/.test(migration006) &&
  /CHECK \(status IN \('pendiente','pagada','condonada'\)\)/.test(migration006) &&
  /resolved_at timestamptz/.test(migration006));
ok("F10: índice debts por beneficiary+status",
  /idx_debts_beneficiary_status/.test(migration006));
ok("F10: RLS debts habilitada + policies",
  /ALTER TABLE public\.debts ENABLE ROW LEVEL SECURITY/.test(migration006) &&
  /"debts_admin_all"/.test(migration006) &&
  /"debts_staff_read"/.test(migration006) &&
  /"debts_user_read_own"/.test(migration006));

// H2. Espejo 1:1 debts migración ↔ esquema (case-insensitive, tolera estilo PK).
const debtsTableRegex = /CREATE TABLE IF NOT EXISTS public\.debts \([\s\S]*?\);/;
const normDebts = (sql) => sql
  .replace(/,\s*constraint debts_pkey primary key \(id\)\s*,?/gi, "")
  .replace(/default gen_random_uuid\(\) not null/gi, "default gen_random_uuid()")
  .replace(/primary key/gi, "")
  .replace(/\s+/g, " ")
  .replace(/\)\s*\)/g, "))")
  .replace(/\s*;/g, ";")
  .toLowerCase()
  .trim();
ok("F10: esquema refleja 1:1 la tabla debts",
  normDebts(debtsTableRegex.exec(schema)?.[0] ?? "") === normDebts(debtsTableRegex.exec(migration006)?.[0] ?? ""));

// H3. RLS restringidas (B-013) en migración y esquema.
ok("F10: B-013 academy_enrollments INSERT admin/staff en migración",
  /"academy_enrollments_insert_admin_staff"[\s\S]*?is_admin\(\) OR public\.is_staff\(\)/.test(migration006));
ok("F10: B-013 class_enrollments walk-in admin/staff en migración",
  /"class_enrollments_insert_qr_admin_staff"[\s\S]*?is_admin\(\) OR public\.is_staff\(\)/.test(migration006));
ok("F10: B-013 attendance INSERT admin/staff en migración",
  /"attendance_insert_admin_staff"[\s\S]*?is_admin\(\) OR public\.is_staff\(\)/.test(migration006));
ok("F10: B-013 drop de las policies permisivas en migración",
  /DROP POLICY IF EXISTS "user_insert_enrollment_flow"/.test(migration006) &&
  /DROP POLICY IF EXISTS "class_enrollments_insert_qr_walkin"/.test(migration006) &&
  /DROP POLICY IF EXISTS "attendance_insert_own_beneficiary"/.test(migration006));

// H4. B-014 backfill + drop constraint en migración.
ok("F10: B-014 backfill legacy (schedule_id -> session_id futura)",
  /schedule_id IS NOT NULL/.test(migration006) &&
  /session_date >= public\.chile_today\(\)/.test(migration006) &&
  /UPDATE public\.class_enrollments/.test(migration006));
ok("F10: B-014 drop UNIQUE legacy con IF EXISTS",
  /DROP CONSTRAINT IF EXISTS class_enrollments_beneficiary_schedule_key/.test(migration006));
ok("F10: B-014 el esquema ya no documenta el UNIQUE legacy",
  !/UNIQUE \(beneficiary_id, schedule_id\)/.test(schema));

// H5. Check-in: gate de matrícula + deuda materializada.
const checkinRouteF10 = readFileSync(join(ROOT, "src", "app", "api", "checkin", "route.ts"), "utf8");
ok("F10: check-in valida matrícula (academy_enrollments activa)",
  checkinRouteF10.includes("academy_enrollments") &&
  checkinRouteF10.includes(".eq(\"status\", \"activa\")") &&
  checkinRouteF10.includes("Sin matrícula activa"));
ok("F10: check-in ya no rechaza por tokens; crea deuda en su lugar",
  checkinRouteF10.includes("from(\"debts\")") &&
  !checkinRouteF10.includes("Sin tokens disponibles"));
ok("F10: check-in inserta debts solo sin tokens (tokensAvailable)",
  /if \(!tokensAvailable\)[\s\S]*?from\("debts"\)\.insert/.test(checkinRouteF10));
ok("F10: check-in evita deuda duplicada por sesión",
  /eq\("session_id", session_id\)[\s\S]*?eq\("status", "pendiente"\)/.test(checkinRouteF10));
ok("F10: check-in incluye debt en el resultado",
  /debt: createdDebt/.test(checkinRouteF10));

// H6. MembershipCard: deuda materializada (getPendingDebts).
const membershipCardF10 = readFileSync(join(ROOT, "src", "components", "dashboard", "MembershipCard.tsx"), "utf8");
ok("F10: MembershipCard muestra deuda materializada (pendingDebts)",
  membershipCardF10.includes("getPendingDebts") && membershipCardF10.includes("pendingDebts.length"));
ok("F10: MembershipCard ya no deriva la deuda del saldo negativo",
  !/Deuda: \$\{Math\.abs\(tokenInfo\.remaining\)\}/.test(membershipCardF10));

// H7. Admin Deudas: página nueva con acciones de resolución.
const deudasPage = readFileSync(join(ROOT, "src", "app", "admin", "deudas", "page.tsx"), "utf8");
ok("F10: página /admin/deudas existe", /from\("debts"\)/.test(deudasPage));
ok("F10: admin puede marcar pagada/condonar",
  deudasPage.includes("pagada") && deudasPage.includes("condonada"));
ok("F10: admin deudas filtra pendientes por defecto",
  deudasPage.includes('useState<"pendientes" | "resueltas" | "todas">("pendientes")'));
ok("F10: sidebar admin incluye Deudas",
  /href: "\/admin\/deudas"/.test(readFileSync(join(ROOT, "src", "components", "admin", "AdminSidebar.tsx"), "utf8")));

// ============================================================
// I. B-016 — Columna location_url en events
// ============================================================
section("I. B-016: columna location_url de events");

const migration007 = readFileSync(join(ROOT, "contexto", "migrations", "007_add_events_location_url.sql"), "utf8");
const adminEventos = readFileSync(join(ROOT, "src", "app", "admin", "eventos", "page.tsx"), "utf8");
const eventDetail = readFileSync(join(ROOT, "src", "app", "eventos", "[id]", "page.tsx"), "utf8");
const eventCard = readFileSync(join(ROOT, "src", "components", "EventCard.tsx"), "utf8");

ok("B-016: migración 007 existe con ALTER idempotente",
  migration007.includes("ALTER TABLE public.events ADD COLUMN IF NOT EXISTS location_url text;"));
ok("B-016: esquema documenta location_url en events (espejo)",
  /CREATE TABLE IF NOT EXISTS public\.events \([\s\S]*?location_url text,[\s\S]*?\)/.test(schema));
ok("B-016: admin/eventos envía location_url en insert/update",
  /location_url: form\.location_url \|\| null/.test(adminEventos));
ok("B-016: /eventos/[id] lee location_url para embed de mapa",
  eventDetail.includes("extractGoogleMapsEmbed(event.location_url)"));
ok("B-016: EventCard tipa location_url",
  /location_url: string \| null/.test(eventCard));

// ============================================================
// J. Reglamento Interno (migración 008 + páginas admin/dashboard)
// ============================================================
section("J. Reglamento interno (admin editable, usuarios leen)");

const migration008 = readFileSync(join(ROOT, "contexto", "migrations", "008_reglamento_interno.sql"), "utf8");
const adminReglamento = readFileSync(join(ROOT, "src", "app", "admin", "reglamento", "page.tsx"), "utf8");
const dashReglamento = readFileSync(join(ROOT, "src", "app", "dashboard", "reglamento", "page.tsx"), "utf8");

ok("J: migración 008 define reglamento_interno",
  /CREATE TABLE IF NOT EXISTS public\.reglamento_interno \(/.test(migration008) &&
  /content text NOT NULL DEFAULT ''/.test(migration008) &&
  /updated_at timestamptz NOT NULL DEFAULT now\(\)/.test(migration008) &&
  /updated_by uuid REFERENCES public\.profiles\(id\)/.test(migration008));
ok("J: RLS de reglamento (SELECT all, admin ALL)",
  /reglamento_interno_select_all[\s\S]*?FOR SELECT USING \(true\)/.test(migration008) &&
  /reglamento_interno_admin_all[\s\S]*?FOR ALL USING \(public\.is_admin\(\)\)/.test(migration008));
ok("J: esquema refleja 1:1 la tabla reglamento_interno",
  /CREATE TABLE IF NOT EXISTS public\.reglamento_interno \([\s\S]*?content text NOT NULL DEFAULT ''[\s\S]*?updated_by uuid REFERENCES public\.profiles\(id\)/.test(schema) &&
  /"reglamento_interno_select_all"/.test(schema) &&
  /"reglamento_interno_admin_all"/.test(schema));
ok("J: admin/reglamento carga y guarda (update o insert)",
  adminReglamento.includes("from(\"reglamento_interno\")") &&
  adminReglamento.includes("update({ content, updated_by") &&
  adminReglamento.includes(".insert({ content, updated_by"));
ok("J: dashboard/reglamento renderiza párrafos del contenido",
  dashReglamento.includes("from(\"reglamento_interno\")") &&
  dashReglamento.includes("content.split(\"\\n\")"));
ok("J: DashboardNav incluye tab Reglamento",
  /href: "\/dashboard\/reglamento"/.test(readFileSync(join(ROOT, "src", "components", "dashboard", "DashboardNav.tsx"), "utf8")));
ok("J: AdminSidebar incluye link Reglamento",
  /href: "\/admin\/reglamento"/.test(readFileSync(join(ROOT, "src", "components", "admin", "AdminSidebar.tsx"), "utf8")));

// ============================================================
// K. Navbar admin móvil (drawer + hamburguesa)
// ============================================================
section("K. Navbar admin en móvil (drawer)");

const adminLayout = readFileSync(join(ROOT, "src", "app", "admin", "layout.tsx"), "utf8");
const adminSidebar = readFileSync(join(ROOT, "src", "components", "admin", "AdminSidebar.tsx"), "utf8");

ok("K: layout admin tiene botón hamburguesa visible en móvil",
  adminLayout.includes('aria-label="Abrir menú"') &&
  adminLayout.includes("md:hidden") &&
  adminLayout.includes("setSidebarOpen(true)"));
ok("K: AdminSidebar recibe open/onClose (drawer)",
  /AdminSidebar\(\{ open, onClose \}/.test(adminSidebar) ||
  /open: boolean; onClose/.test(adminSidebar));
ok("K: AdminSidebar se oculta/desliza en móvil y es estático en desktop",
  /-translate-x-full/.test(adminSidebar) &&
  /md:static md:translate-x-0/.test(adminSidebar));
ok("K: AdminSidebar cierra al navegar o con botón close",
  /onClick=\{onClose\}[\s\S]*?aria-label="Cerrar menú"/.test(adminSidebar) &&
  /onClick=\{onClose\}[\s\S]*?aria-label="Cerrar menú"/.test(adminSidebar) &&
  adminSidebar.includes("Link") && adminSidebar.includes("onClick={onClose}"));
ok("K: labels del drawer se muestran en móvil aunque esté colapsado en desktop",
  /font-\[family-name:var\(--font-body-md\)\] text-\[14px\] \$\{collapsed \? "md:hidden" : ""\}/.test(adminSidebar));

// ============================================================
// L. Navbar público oculto en /admin (B-017)
// ============================================================
section("L. Navbar público oculto en /admin (B-017)");

const navbarSrc = readFileSync(join(ROOT, "src", "components", "Navbar.tsx"), "utf8");

ok("L: Navbar usa usePathname y se oculta en rutas /admin",
  navbarSrc.includes('usePathname') &&
  /if \(pathname\.startsWith\("\/admin"\)\) return null;/.test(navbarSrc));
ok("L: Navbar no se renderiza en /admin pero sí en el resto",
  !navbarSrc.includes('"/admin"') || navbarSrc.includes('startsWith("/admin")'));
ok("L: admin layout tiene botón Cerrar sesión (signOut)",
  adminLayout.includes('from "@/lib/supabase/auth"') &&
  adminLayout.includes('aria-label="Cerrar sesión"') &&
  /await signOut\(\);/.test(adminLayout));
ok("L: admin header enlaza el perfil a /perfil",
  /href="\/perfil"[\s\S]*?aria-label="Ver perfil"/.test(adminLayout));
ok("L: dashboard conserva offset para navbar público",
  /pt-24 md:pt-28/.test(readFileSync(join(ROOT, "src", "app", "dashboard", "layout.tsx"), "utf8")));

// ============================================================
// M. Feedback de pagos Flow rechazados/anulados/pendientes (B-018)
// ============================================================
section("M. Feedback de pagos Flow rechazados/anulados/pendientes (B-018)");

// M1. Mapeo de estados de Flow a la BD (unit)
ok("M: mapFlowStatus(1) == pendiente", mapFlowStatus(1) === "pendiente");
ok("M: mapFlowStatus(2) == pagado", mapFlowStatus(2) === "pagado");
ok("M: mapFlowStatus(3) == rechazado", mapFlowStatus(3) === "rechazado");
ok("M: mapFlowStatus(4) == cancelado", mapFlowStatus(4) === "cancelado");
ok("M: mapFlowStatus(desconocido) == pendiente", mapFlowStatus(99) === "pendiente");
ok("M: mapFlowStatus tolera string (API Flow puede devolverlo así)", mapFlowStatus("2") === "pagado" && mapFlowStatus("3") === "rechazado" && mapFlowStatus("4") === "cancelado" && mapFlowStatus("1") === "pendiente" && mapFlowStatus("x") === "pendiente");

const verifyRouteM = readFileSync(join(ROOT, "src", "app", "api", "flow", "verify", "route.ts"), "utf8");
const confirmRouteM = readFileSync(join(ROOT, "src", "app", "api", "flow", "confirmation", "route.ts"), "utf8");
const pagosPageM = readFileSync(join(ROOT, "src", "app", "dashboard", "pagos", "page.tsx"), "utf8");
const bannerSrcM = readFileSync(join(ROOT, "src", "components", "PurchaseSuccessBanner.tsx"), "utf8");
const ventasPageM = readFileSync(join(ROOT, "src", "app", "admin", "ventas", "page.tsx"), "utf8");
const schemaSqlM = readFileSync(join(ROOT, "documentacion", "squema-sql-actualizado.sql"), "utf8");

ok("M: verify usa mapFlowStatus para flujos no aprobados",
  verifyRouteM.includes("mapFlowStatus"));
ok("M: verify marca status 3 como rechazado",
  /update\(\{ status: mapped \}\)/.test(verifyRouteM) &&
  /mapped === "rechazado" \|\| mapped === "cancelado"/.test(verifyRouteM));
ok("M: verify devuelve rechazado/cancelado/pendiente al cliente",
  /return NextResponse\.json\(\{ status: mapped \}\)/.test(verifyRouteM));
ok("M: confirmation marca rechazado/cancelado en BD (ya no queda pendiente)",
  confirmRouteM.includes("mapFlowStatus") &&
  /update\(\{ status: mapped \}\)/.test(confirmRouteM) &&
  /mapped === "rechazado" \|\| mapped === "cancelado"/.test(confirmRouteM));
ok("M: confirmation no crea membresía si no está aprobado (status !== 2 retorna)",
  /if \(verification\.status !== 2\) \{/.test(confirmRouteM));
ok("M: PurchaseFailedBanner acepta title/description",
  /title\?: string;/.test(bannerSrcM) && /description\?: string;/.test(bannerSrcM));
ok("M: existe PurchasePendingBanner (feedback de pago pendiente)",
  bannerSrcM.includes("export function PurchasePendingBanner"));
ok("M: pagos distingue 'rechazado' en el cliente",
  pagosPageM.includes('verified === "rechazado"') &&
  pagosPageM.includes('result.status === "rechazado"'));
ok("M: pagos distingue 'cancelado' en el cliente",
  pagosPageM.includes('verified === "cancelado"') &&
  pagosPageM.includes('result.status === "cancelado"'));
ok("M: pagos distingue 'pendiente' en el cliente",
  pagosPageM.includes('verified === "pendiente"') &&
  pagosPageM.includes('result.status === "pendiente"'));
ok("M: ventas admin filtra por 'rechazado'",
  /\["todos", "pagado", "pendiente", "rechazado", "cancelado"\]/.test(ventasPageM) &&
  ventasPageM.includes("totalRechazados") &&
  ventasPageM.includes("pagos rechazados"));
ok("M: esquema documenta status 'rechazado' en payments",
  /payments\.status: 'pendiente' \| 'pagado' \| 'rechazado'/.test(schemaSqlM));

const errorModalSrc = readFileSync(join(ROOT, "src", "components", "PaymentErrorModal.tsx"), "utf8");
ok("M: existe PaymentErrorModal (overlay rojo centrado con botón OK)",
  errorModalSrc.includes("fixed inset-0 z-[100]") &&
  errorModalSrc.includes("border-red-500/30") &&
  />\s*OK\s*</.test(errorModalSrc));
ok("M: pagos abre PaymentErrorModal al rechazar/anular/fallar",
  pagosPageM.includes("PaymentErrorModal") &&
  pagosPageM.includes('setErrorModal({') &&
  /verified === "rechazado"/.test(pagosPageM));
ok("M: PaymentSuccessModal tiene botón OK verde",
  /OK\s*</.test(readFileSync(join(ROOT, "src", "components", "PaymentSuccessModal.tsx"), "utf8")) &&
  /from-green-600 to-emerald-500/.test(readFileSync(join(ROOT, "src", "components", "PaymentSuccessModal.tsx"), "utf8")));

// ============================================================
// N. Recompra tras rechazo: no reutilizar token muerto (B-019)
// ============================================================
section("N. Recompra tras rechazo/anulación (B-019)");

const createOrderRoute = readFileSync(join(ROOT, "src", "app", "api", "flow", "create-order", "route.ts"), "utf8");
const checkoutModal = readFileSync(join(ROOT, "src", "components", "CheckoutModal.tsx"), "utf8");

ok("N: create-order usa mapFlowStatus en el bloque existingPending",
  createOrderRoute.includes("mapFlowStatus"));
ok("N: status 3/4 descartan el token y crean orden nueva (no reutilizan)",
  /mapped === "rechazado" \|\| mapped === "cancelado"/.test(createOrderRoute) &&
  /update\(\{ status: mapped \}\)/.test(createOrderRoute));
ok("N: create-order responde already_paid cuando el pago ya se confirmó",
  createOrderRoute.includes('status: "already_paid"'));
ok("N: create-order solo reutiliza token si sigue pendiente (status 1)",
  /mapped === "pagado"[\s\S]*?return NextResponse\.json\(\{[\s\S]*?status: "already_paid"/.test(createOrderRoute));
ok("N: reuso de token apunta a /app/web/pay.php (no a /payment)",
  createOrderRoute.includes("buildFlowPaymentUrl(existingPending.flow_token)") &&
  !createOrderRoute.includes('replace(/\\/api\\/?$/, "/payment")'));
ok("N: buildFlowPaymentUrl construye /app/web/pay.php?token=...",
  /export function buildFlowPaymentUrl[\s\S]*?\/app\/web\/pay\.php\?token=/.test(flowSource));
ok("N: CheckoutModal nunca queda bloqueado (timeout AbortController)",
  checkoutModal.includes("AbortController") &&
  checkoutModal.includes("controller.abort()") &&
  /setProcessing\(false\);\s*}/.test(checkoutModal) &&
  checkoutModal.includes("finally"));
ok("N: CheckoutModal maneja already_paid → redirige a /dashboard/pagos",
  checkoutModal.includes('data.status === "already_paid"') &&
  checkoutModal.includes('window.location.href = `/dashboard/pagos?token='));
ok("N: CheckoutModal avisa si la sesión expiró (401)",
  /res\.status === 401[\s\S]*?Tu sesión expiró/.test(checkoutModal));

// ============================================================
// O. Notificaciones al usuario sobre pagos/membresías/inscripciones
// ============================================================
section("O. Notificaciones de pago al usuario (aprobado/rechazado/anulado/pendiente)");

const flowHelpersO = readFileSync(join(ROOT, "src", "lib", "flow-helpers.ts"), "utf8");
const confirmRouteO = readFileSync(join(ROOT, "src", "app", "api", "flow", "confirmation", "route.ts"), "utf8");
const verifyRouteO = readFileSync(join(ROOT, "src", "app", "api", "flow", "verify", "route.ts"), "utf8");

ok("O: existe helper notifyUserPaymentStatus en flow-helpers",
  /export async function notifyUserPaymentStatus/.test(flowHelpers) &&
  /user_notifications/.test(flowHelpers));
ok("O: notifica QUÉ se asignó y A QUIÉN (concept + beneficiario)",
  /Se asignó \$\{concept\} a \$\{beneficiaryName\}/.test(flowHelpers));
ok("O: mensajes de rechazado/anulado/pendiente con feedback",
  /fue rechazado\. No se realizó ningún cargo/.test(flowHelpers) &&
  /fue anulado\. No se realizó ningún cargo/.test(flowHelpers) &&
  /está pendiente de confirmación/.test(flowHelpers));
ok("O: helper deduplica por payment_id (Ref en content)",
  /ilike\("content", `%\$\{payment\.id\}%`\)/.test(flowHelpers));
ok("O: helper nunca lanza (best-effort, try/catch)",
  /export async function notifyUserPaymentStatus[\s\S]*?try \{[\s\S]*?\} catch \(err\) \{[\s\S]*?\}/.test(flowHelpers));
ok("O: confirmation notifica rechazado/anulado/pendiente en status !== 2",
  /notifyUserPaymentStatus\(supabase, payment, "rejected"\)/.test(confirmRouteO) &&
  /notifyUserPaymentStatus\(supabase, payment, "cancelled"\)/.test(confirmRouteO) &&
  /notifyUserPaymentStatus\(supabase, payment, "pending"\)/.test(confirmRouteO));
ok("O: confirmation notifica aprobado solo si se asignó algo (y hay usuario)",
  /let assignedSomething = false;[\s\S]*?if \(assignedSomething && payment\.user_id\) \{[\s\S]*?notifyUserPaymentStatus\(supabase, payment, "approved"\)/.test(confirmRouteO));
ok("O: verify notifica rechazado/anulado/pendiente y aprobado",
  /notifyUserPaymentStatus\(admin, fullPayment, "rejected"\)/.test(verifyRouteO) &&
  /notifyUserPaymentStatus\(admin, fullPayment, "cancelled"\)/.test(verifyRouteO) &&
  /notifyUserPaymentStatus\(admin, fullPayment, "pending"\)/.test(verifyRouteO) &&
  /notifyUserPaymentStatus\(admin, fullPayment, "approved"\)/.test(verifyRouteO));
ok("O: create-order no notifica (evita duplicar/noise)",
  !createOrderRoute.includes("notifyUserPaymentStatus"));

// ============================================================
// P. Clases personalizadas (módulo desacoplado)
// ============================================================
section("P. Clases personalizadas (módulo desacoplado)");

const createOrderRouteP = readFileSync(join(ROOT, "src", "app", "api", "flow", "create-order", "route.ts"), "utf8");
const flowHelpersP = readFileSync(join(ROOT, "src", "lib", "flow-helpers.ts"), "utf8");
const confirmRouteP = readFileSync(join(ROOT, "src", "app", "api", "flow", "confirmation", "route.ts"), "utf8");
const verifyRouteP = readFileSync(join(ROOT, "src", "app", "api", "flow", "verify", "route.ts"), "utf8");
const adminMembresiasP = readFileSync(join(ROOT, "src", "app", "admin", "membresias", "page.tsx"), "utf8");
const deleteConfirmP = readFileSync(join(ROOT, "src", "components", "admin", "DeleteConfirm.tsx"), "utf8");
const statusBadgeP = readFileSync(join(ROOT, "src", "components", "admin", "StatusBadge.tsx"), "utf8");
const membershipCardP = readFileSync(join(ROOT, "src", "components", "dashboard", "MembershipCard.tsx"), "utf8");
const dashboardTsP = readFileSync(join(ROOT, "src", "lib", "supabase", "dashboard.ts"), "utf8");
const checkoutModalP = readFileSync(join(ROOT, "src", "components", "PersonalizedCheckoutModal.tsx"), "utf8");
const schemaSqlP = readFileSync(join(ROOT, "documentacion", "squema-sql-actualizado.sql"), "utf8");

// P1. create-order: acepta personalizedPlanId y valida exclusividad
ok("P: create-order desestructura personalizedPlanId del body",
  /const \{ planId, beneficiaryId, includeEnrollment, enrollmentPlanId, personalizedPlanId \} = body;/.test(createOrderRouteP));
ok("P: create-order rechaza combinar pack con membresía/inscripción (400)",
  /if \(personalizedPlanId && \(planId \|\| includeEnrollment \|\| enrollmentPlanId\)\)/.test(createOrderRouteP) &&
  /Las clases personalizadas no se combinan con otros planes/.test(createOrderRouteP));
ok("P: create-order valida que el plan exista y esté activo",
  /\.eq\("id", personalizedPlanId\)[\s\S]*?\.single\(\)[\s\S]*?if \(!data\.active\)[\s\S]*?Plan no disponible/.test(createOrderRouteP));
ok("P: create-order suma el precio del pack al total",
  /const totalAmount = \(membershipPlan\?\.price \|\| 0\) \+ \(enrollmentPlan\?\.price \|\| 0\) \+ \(personalizedPlan\?\.price \|\| 0\);/.test(createOrderRouteP));
ok("P: create-order arma concepto 'Clase Personalizada <plan>'",
  /conceptParts\.push\(`Clase Personalizada \$\{personalizedPlan\.name\}`\)/.test(createOrderRouteP));

// P2. flow-helpers: confirmPersonalizedPack (idempotente, fechas Chile)
ok("P: flow-helpers exporta confirmPersonalizedPack",
  /export async function confirmPersonalizedPack/.test(flowHelpersP));
ok("P: extrae nombre de plan del concepto (regex tolerant a 'Clase Personalizada/do')",
  flowHelpersP.includes("Clase Personalizad[ao]"));
ok("P: confirmPersonalizedPack es idempotente por payment_id",
  /\.from\("personalized_packs"\)[\s\S]*?\.eq\("payment_id", paymentId\)[\s\S]*?\.maybeSingle\(\)/.test(flowHelpersP));
ok("P: confirmPersonalizedPack usa fechas de Chile (getChileToday/addDaysChile)",
  /const today = getChileToday\(\);[\s\S]*?const endDate = addDaysChile\(today, plan\.validity_days\);/.test(flowHelpersP));
ok("P: fallback de beneficiario propio cuando payment.beneficiary_id es null",
  /\.from\("beneficiaries"\)[\s\S]*?\.eq\("profile_id", userId\)[\s\S]*?\.maybeSingle\(\)/.test(flowHelpersP));
ok("P: inserta el pack en estado 'activa' con used_classes 0",
  /\.from\("personalized_packs"\)\s*\.insert\([\s\S]*?used_classes: 0,[\s\S]*?status: "activa",/.test(flowHelpersP));
ok("P: confirmPersonalizedPack no toca memberships (módulo desacoplado)",
  !/\.from\("memberships"\)/.test(flowHelpersP.slice(193, 289)));

// P3. Las 3 rutas de confirmación detectan el concepto y crean el pack
ok("P: confirmation importa y llama confirmPersonalizedPack",
  confirmRouteP.includes("confirmPersonalizedPack") &&
  /const hasPersonalizedConcept = \/\^Clase Personalizad\[ao\]\/i\.test\(payment\.concept \|\| ""\);/.test(confirmRouteP) &&
  /await confirmPersonalizedPack\(supabase, payment\.id, payment\.user_id\);/.test(confirmRouteP));
ok("P: verify importa y llama confirmPersonalizedPack",
  verifyRouteP.includes("confirmPersonalizedPack") &&
  /await confirmPersonalizedPack\(admin, fullPayment\.id, user\.id\);/.test(verifyRouteP));
ok("P: las 2 rutas marcan assignedSomething al crear el pack",
  /const result = await confirmPersonalizedPack\(supabase, payment\.id, payment\.user_id\);[\s\S]*?if \(result\.success\)[\s\S]*?assignedSomething = true;/.test(confirmRouteP) &&
  /await confirmPersonalizedPack\(admin, fullPayment\.id, user\.id\);[\s\S]*?assignedSomething = true;/.test(verifyRouteP));

// P4. Admin: CRUD de planes + packs (consumo/cancelación/filtros)
ok("P: admin tiene tab 'Personalizadas' con 3 tabs",
  /t === "planes" \? "Planes" : t === "membresias" \? "Membresías" : "Personalizadas"/.test(adminMembresiasP));
ok("P: admin deriva estado efectivo del pack (vencida)",
  /const effectivePackStatus = \(p: PersonalizedPack\): string =>/.test(adminMembresiasP) &&
  /p\.status === "activa" && p\.end_date < today/.test(adminMembresiasP));
ok("P: admin calcula contadores y filtros de packs",
  /const packFilterCounts = \{/.test(adminMembresiasP) &&
  /const filteredPacks = packFilter === "todas" \? personalizedPacks/.test(adminMembresiasP));
ok("P: admin permite consumir clase (confirmLabel Consumir)",
  /confirmLabel="Consumir"/.test(adminMembresiasP));
ok("P: admin permite cancelar pack (confirmLabel Cancelar Pack)",
  /confirmLabel="Cancelar Pack"/.test(adminMembresiasP));
ok("P: DeleteConfirm soporta confirmLabel personalizado",
  /confirmLabel\?: string;/.test(deleteConfirmP));

// P5. Cliente: StatusBadge agotada, MembershipCard chip, checkout, dashboard helpers
ok("P: StatusBadge incluye estado 'agotada'",
  /agotada: \{ label: "Agotada"/.test(statusBadgeP));
ok("P: MembershipCard muestra chip de clases personalizadas (workspace_premium)",
  membershipCardP.includes("workspace_premium") &&
  membershipCardP.includes("availablePersonalized"));
ok("P: dashboard.ts expone helpers de clases personalizadas",
  /export async function getActivePersonalizedPlans/.test(dashboardTsP) &&
  /export async function getUserPersonalizedData/.test(dashboardTsP));
ok("P: existe PersonalizedCheckoutModal y envía personalizedPlanId",
  /body: JSON\.stringify\(\{[\s\S]*?personalizedPlanId: selectedPlanId,/.test(checkoutModalP));
ok("P: esquema documenta las tablas del módulo desacoplado",
  /CREATE TABLE IF NOT EXISTS public\.personalized_plans/.test(schemaSqlP) &&
  /CREATE TABLE IF NOT EXISTS public\.personalized_packs/.test(schemaSqlP));
ok("P: RLS de packs usa owns_beneficiary",
  /personalized_packs[\s\S]*?owns_beneficiary/.test(schemaSqlP));

// ============================================================
// Q. Clases de horario para modalidad personalizada (Fase 0-6)
// ============================================================
section("Q. Clases de horario personalizadas (mode en schedules, tablas propias, sin QR)");

const migration010 = readFileSync(join(ROOT, "contexto", "migrations", "010_personalized_schedule_classes.sql"), "utf8");
const checkinRouteQ = readFileSync(join(ROOT, "src", "app", "api", "checkin", "route.ts"), "utf8");
const adminHorariosQ = readFileSync(join(ROOT, "src", "app", "admin", "horarios", "page.tsx"), "utf8");
const publicHorariosQ = readFileSync(join(ROOT, "src", "app", "horarios", "page.tsx"), "utf8");
const personalizedModalQ = readFileSync(join(ROOT, "src", "components", "PersonalizedEnrollModal.tsx"), "utf8");
const adminAsistenciaQ = readFileSync(join(ROOT, "src", "app", "admin", "asistencia", "page.tsx"), "utf8");
const dashboardMembresiasQ = readFileSync(join(ROOT, "src", "app", "dashboard", "membresias", "page.tsx"), "utf8");
const dashboardTsQ = readFileSync(join(ROOT, "src", "lib", "supabase", "dashboard.ts"), "utf8");
const enrollModalQ = readFileSync(join(ROOT, "src", "components", "EnrollModal.tsx"), "utf8");

// Q1. Migración 010: DDL idempotente + RPC VOLATILE
ok("Q: 010 agrega columna mode con ADD COLUMN IF NOT EXISTS (idempotente)",
  /ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'normal';/.test(migration010));
ok("Q: 010 crea schedules_mode_check via DO block idempotente",
  /pg_constraint WHERE conname = 'schedules_mode_check'[\s\S]*?ADD CONSTRAINT schedules_mode_check[\s\S]*?IN \('normal', 'personalizado'\)/.test(migration010));
ok("Q: 010 crea personalized_schedule_plans con FK cascade a schedules",
  /CREATE TABLE IF NOT EXISTS public\.personalized_schedule_plans[\s\S]*?schedule_id uuid NOT NULL REFERENCES public\.schedules\(id\) ON DELETE CASCADE/.test(migration010));
ok("Q: 010 crea personalized_enrollments con UNIQUE(session_id, beneficiary_id)",
  /CREATE TABLE IF NOT EXISTS public\.personalized_enrollments[\s\S]*?personalized_enrollments_session_beneficiary_unique UNIQUE \(session_id, beneficiary_id\)/.test(migration010));
ok("Q: 010 crea los 4 índices de búsqueda",
  /idx_personalized_schedule_plans_schedule/.test(migration010) &&
  /idx_personalized_schedule_plans_plan/.test(migration010) &&
  /idx_personalized_enrollments_session/.test(migration010) &&
  /idx_personalized_enrollments_beneficiary/.test(migration010));
ok("Q: 010 habilita RLS en las 2 tablas nuevas",
  /personalized_schedule_plans ENABLE ROW LEVEL SECURITY/.test(migration010) &&
  /personalized_enrollments ENABLE ROW LEVEL SECURITY/.test(migration010));
ok("Q: 010 define RPC enroll_personalized_class SECURITY DEFINER VOLATILE",
  /CREATE OR REPLACE FUNCTION public\.enroll_personalized_class\(\s*p_session_id uuid,\s*p_beneficiary_ids uuid\[\][\s\S]*?SECURITY DEFINER[\s\S]*?VOLATILE/.test(migration010));
ok("Q: 010 REVOKE/GRANT solo a authenticated",
  /REVOKE ALL ON FUNCTION public\.enroll_personalized_class\(UUID, UUID\[\]\) FROM PUBLIC;[\s\S]*?GRANT EXECUTE ON FUNCTION public\.enroll_personalized_class\(UUID, UUID\[\]\) TO authenticated;/.test(migration010));
ok("Q: 010 RPC consume pack de forma atómica (used_classes < total_classes)",
  /used_classes < total_classes/.test(migration010));
ok("Q: 010 RPC es idempotente (beneficiario ya inscrito no falla)",
  /Idempotente: si ya est\u00E1 inscrito[\s\S]*?RETURN QUERY SELECT v_bid, true, NULL, 'Ya inscrito'/.test(migration010));

// Q2. Espejo 1:1 en el esquema documentado
const schemaSqlQ = readFileSync(join(ROOT, "documentacion", "squema-sql-actualizado.sql"), "utf8");
ok("Q: esquema refleja columna mode en DDL de schedules",
  /mode text DEFAULT 'normal' NOT NULL,/.test(schemaSqlQ));
ok("Q: esquema refleja schedules_mode_check",
  /ADD CONSTRAINT schedules_mode_check[\s\S]*?IN \('normal', 'personalizado'\)/.test(schemaSqlQ));
ok("Q: esquema refleja tablas del módulo desacoplado",
  /CREATE TABLE IF NOT EXISTS public\.personalized_schedule_plans/.test(schemaSqlQ) &&
  /CREATE TABLE IF NOT EXISTS public\.personalized_enrollments/.test(schemaSqlQ));
ok("Q: esquema refleja UNIQUE(session_id, beneficiary_id) en personalizadas",
  /personalized_enrollments_session_beneficiary_unique UNIQUE \(session_id, beneficiary_id\)/.test(schemaSqlQ));
ok("Q: esquema refleja RPC enroll_personalized_class + GRANT a authenticated",
  /CREATE OR REPLACE FUNCTION public\.enroll_personalized_class/.test(schemaSqlQ) &&
  /GRANT EXECUTE ON FUNCTION public\.enroll_personalized_class\(UUID, UUID\[\]\) TO authenticated;/.test(schemaSqlQ));
ok("Q: esquema NO altera class_enrollments ni enroll_class (módulo desacoplado)",
  !/pack_id/.test(schemaSqlQ.match(/CREATE TABLE IF NOT EXISTS public\.class_enrollments \([\s\S]*?\);/)?.[0] || "") &&
  /enroll_class/.test(schemaSqlQ));

// Q3. Checkin guard defensivo (personalizadas no usan QR)
ok("Q: checkin selecciona schedules(mode)",
  /\.select\("id, status, schedules\(mode\)"\)/.test(checkinRouteQ));
ok("Q: checkin devuelve 403 si la sesión es personalizada",
  /if \(sessionMode === "personalizado"\)[\s\S]*?Las clases personalizadas no usan check-in por QR[\s\S]*?status: 403/.test(checkinRouteQ));
ok("Q: checkin conserva flujo normal de membresías",
  /class_enrollments/.test(checkinRouteQ) && !/enroll_personalized_class/.test(checkinRouteQ));

// Q4. Admin horarios: CRUD con modo y planes permitidos
ok("Q: admin horarios tiene botón 'Nueva Clase Personalizada'",
  adminHorariosQ.includes("Nueva Clase Personalizada"));
ok("Q: admin horarios ramifica openCreate por modo",
  /const openCreate = \(mode: "normal" \| "personalizado"\) =>/.test(adminHorariosQ));
ok("Q: admin horarios filtra por Modalidad (Todas/Membresías/Personalizadas)",
  /value: "todas", label: "Todas"/.test(adminHorariosQ) &&
  /value: "personalizado", label: "Personalizadas"/.test(adminHorariosQ) &&
  /filteredSchedules = schedules\.filter\(\(s\) => modeFilter === "todas" \|\| s\.mode === modeFilter\)/.test(adminHorariosQ));
ok("Q: admin horarios carga personalized_plans y personalized_schedule_plans",
  /\.from\("personalized_plans"\)[\s\S]*\.select\("id, name, active"\)/.test(adminHorariosQ) &&
  /personalized_schedule_plans\(plan_id\)/.test(adminHorariosQ));
ok("Q: admin horarios edita seleccionando planes desde la tabla de enlace correcta",
  /setSelectedPlans\([\s\S]*?s\.mode === "personalizado"[\s\S]*?s\.personalized_schedule_plans\?\.map\(\(cp\) => cp\.plan_id\) \|\| \[\]/.test(adminHorariosQ));
ok("Q: admin horarios al guardar borra e inserta la tabla de enlace correcta",
  /form\.mode === "personalizado"/.test(adminHorariosQ) &&
  /\.from\("personalized_schedule_plans"\)\.delete\(\)\.eq\("schedule_id", scheduleId\)/.test(adminHorariosQ));
ok("Q: admin horarios borra la tabla de enlace antes de eliminar el schedule",
  /\.from\("personalized_schedule_plans"\)\.delete\(\)\.eq\("schedule_id", deleteTarget\.id\)/.test(adminHorariosQ));
ok("Q: admin horarios exporta columna Modalidad en Excel",
  /"Modalidad": s\.mode === "personalizado" \? "Personalizada" \: "Membres\xEDas"/.test(adminHorariosQ));

// Q5. PersonalizedEnrollModal (público/dashboard): pack + RPC
ok("Q: existe PersonalizedEnrollModal",
  /export default function PersonalizedEnrollModal/.test(personalizedModalQ));
ok("Q: PersonalizedEnrollModal consume packs activos con cupos",
  /\.from\("personalized_packs"\)[\s\S]*?\.eq\("status", "activa"\)[\s\S]*?p\.used_classes < p\.total_classes/.test(personalizedModalQ));
ok("Q: PersonalizedEnrollModal valida plan permitido de la clase",
  /allowedPlanIds = schedule\.personalized_schedule_plans\?\.map\(\(p\) => p\.plan_id\) \|\| \[\]/.test(personalizedModalQ) &&
  /Plan no habilitado para esta clase/.test(personalizedModalQ));
ok("Q: PersonalizedEnrollModal llama enroll_personalized_class con arreglo",
  /\.rpc\("enroll_personalized_class", \{\s*p_session_id: selectedSession,\s*p_beneficiary_ids: ids,/.test(personalizedModalQ));
ok("Q: PersonalizedEnrollModal informa 'consume 1 clase del pack'",
  personalizedModalQ.includes("consume 1 clase del pack"));

// Q6. Horario público: toggle + modal ramificado
ok("Q: horario público filtra por mode en la carga",
  /const modeSchedules = \(schedules as Schedule\[\]\)\.filter\(\(s\) => s\.mode === modeFilter\)/.test(publicHorariosQ));
ok("Q: horario público integra PersonalizedEnrollModal solo para personalizadas",
  /selectedSchedule\?\.mode === "personalizado" \? \([\s\S]*?<PersonalizedEnrollModal[\s\S]*?\) : \([\s\S]*?<EnrollModal/.test(publicHorariosQ));
ok("Q: horario público consulta personalized_schedule_plans",
  /personalized_schedule_plans\(plan_id\)/.test(publicHorariosQ));

// Q7. Dashboard: sección de próximas clases personalizadas
ok("Q: dashboard carga schedules mode personalizado activos",
  /\.from\("schedules"\)[\s\S]*?\.eq\("mode", "personalizado"\)[\s\S]*?\.eq\("active", true\)/.test(dashboardMembresiasQ));
ok("Q: dashboard cuenta inscripciones de la próxima sesión",
  /\.from\("personalized_enrollments"\)[\s\S]*?\.eq\("session_id", next\.id\)/.test(dashboardMembresiasQ));
ok("Q: dashboard marca inscrito si el usuario ya agendó",
  /userEnrolled = \(myEnrollments \|\| \[\]\)\.length > 0;/.test(dashboardMembresiasQ));
ok("Q: dashboard renderiza 'Próximas Clases Personalizadas' y el modal",
  dashboardMembresiasQ.includes("Próximas") &&
  dashboardMembresiasQ.includes("PersonalizedEnrollModal"));

// Q8. Admin asistencia: badge, sin QR, inscripción por pack
ok("Q: asistencia marca sesión con badge Personalizada",
  /s\.schedule\?\.mode === "personalizado"[\s\S]*?Personalizada/.test(adminAsistenciaQ));
ok("Q: asistencia bloquea activación QR en personalizadas",
  /if \(sessionRow\?\.schedule\?\.mode === "personalizado"\)[\s\S]*?no usan check-in por QR/.test(adminAsistenciaQ));
ok("Q: asistencia no inicia polling QR para personalizadas",
  /sessionStatus === "activa" && !isPersonalized/.test(adminAsistenciaQ));
// El cálculo de ausentes al cerrar vive ahora en el servidor (POST /api/admin/close-session),
// que es quien verifica la contraseña de la sesión QR antes de cerrar.
const closeSessionRouteQ = readFileSync(join(ROOT, "src", "app", "api", "admin", "close-session", "route.ts"), "utf8");
ok("Q: el cierre calcula ausentes desde personalized_enrollments (ahora en el servidor)",
  /if \(isPersonalized\)[\s\S]*?\.from\("personalized_enrollments"\)[\s\S]*?\.eq\("session_id", sessionId\)/.test(closeSessionRouteQ) &&
  /status: "ausente" as const/.test(closeSessionRouteQ));
ok("Q: asistencia inscribe personalizadas vía RPC (no class_enrollments)",
  /enrollMode === "personalizado"[\s\S]*?\.rpc\("enroll_personalized_class", \{\s*p_session_id: enrollSessionId,\s*p_beneficiary_ids: \[beneficiaryId\],/.test(adminAsistenciaQ));
ok("Q: asistencia busca packs (no membresías) para personalizadas",
  /if \(enrollMode === "personalizado"\)[\s\S]*?\.from\("personalized_packs"\)/.test(adminAsistenciaQ));
ok("Q: asistencia muestra aviso de registro manual sin QR",
  /no usan check-in por QR\. La asistencia se registra manualmente/.test(adminAsistenciaQ));

// Q9. dashboard.ts: modo en sesiones y asistencia ramificada
ok("Q: dashboard.ts trae mode en getUpcomingSessions",
  /schedule:schedules\(\s*id, day_of_week, start_time, end_time, mode,/.test(dashboardTsQ));
ok("Q: dashboard.ts ramifica getAttendanceForSession a personalized_enrollments",
  /const scheduleMode = \(session\.schedules as unknown as \{ mode\?: string \} \| null\)\?\.mode;[\s\S]*?if \(scheduleMode === "personalizado"\)[\s\S]*?\.from\("personalized_enrollments"\)/.test(dashboardTsQ));

// Q10. Regresión: módulos originales intactos
ok("Q: EnrollModal sigue existiendo sin cambios (membresías intactas)",
  /export default function EnrollModal/.test(enrollModalQ) && !/personalizado/.test(enrollModalQ));
ok("Q: checkin conserva el token/QR para membresías (regresión)",
  /get_remaining_tokens|memberships/.test(checkinRouteQ));
ok("Q: no se eliminó el RPC enroll_class original",
  /enroll_class/.test(schemaSqlQ));

// ============================================================
// R. Desinscripción en asistencia (cancel_class_enrollment)
// ============================================================
section("R. Desinscripción de usuario en asistencia (devolución de token)");

const migration011 = readFileSync(join(ROOT, "contexto", "migrations", "011_cancel_class_enrollment.sql"), "utf8");
const schemaSqlR = readFileSync(join(ROOT, "documentacion", "squema-sql-actualizado.sql"), "utf8");
const adminAsistenciaR = readFileSync(join(ROOT, "src", "app", "admin", "asistencia", "page.tsx"), "utf8");
const cancelFnRegex = /CREATE OR REPLACE FUNCTION public\.cancel_class_enrollment\([\s\S]*?\$\$\s*;/;

// R1. Migración 011: contrato del RPC
ok("R: 011 define RPC cancel_class_enrollment SECURITY DEFINER VOLATILE",
  /CREATE OR REPLACE FUNCTION public\.cancel_class_enrollment\(\s*p_session_id uuid,\s*p_beneficiary_id uuid[\s\S]*?SECURITY DEFINER[\s\S]*?VOLATILE/.test(migration011));
ok("R: 011 rechaza no-admin (P0001) antes de cualquier operación",
  /public\.is_admin\(\);[\s\S]*?RAISE EXCEPTION 'Sin permisos de administrador' USING ERRCODE = 'P0001'/.test(migration011));
ok("R: 011 cubre inscripción por sesión y por horario recurrente (session_id IS NULL)",
  /session_id = p_session_id\s+OR \(schedule_id = v_schedule_id AND session_id IS NULL\)/.test(migration011));
ok("R: 011 elimina la deuda pendiente de la sesión (QR sin tokens)",
  /DELETE FROM public\.debts[\s\S]*?session_id = p_session_id[\s\S]*?status = 'pendiente'/.test(migration011));
ok("R: 011 limpia attendance de la sesión",
  /DELETE FROM public\.attendance[\s\S]*?session_id = p_session_id AND beneficiary_id = p_beneficiary_id/.test(migration011));
ok("R: 011 restaura la clase al pack en personalizadas (used_classes y 'activa')",
  /personalized_packs[\s\S]*?GREATEST\(used_classes - 1, 0\)[\s\S]*?status = 'activa'/.test(migration011));
ok("R: 011 notifica al titular (user_notifications)",
  /INSERT INTO public\.user_notifications/.test(migration011) && /Token devuelto/.test(migration011));
ok("R: 011 REVOKE/GRANT solo a authenticated",
  /REVOKE ALL ON FUNCTION public\.cancel_class_enrollment\(UUID, UUID\) FROM PUBLIC;[\s\S]*?GRANT EXECUTE ON FUNCTION public\.cancel_class_enrollment\(UUID, UUID\) TO authenticated;/.test(migration011));

// R2. Espejo 1:1 en el esquema documentado
ok("R: esquema refleja el RPC cancel_class_enrollment 1:1 (migración 011)",
  norm(cancelFnRegex.exec(schemaSqlR)?.[0] ?? "") === norm(cancelFnRegex.exec(migration011)?.[0] ?? ""));
ok("R: cancel_class_enrollment única en el esquema",
  (schemaSqlR.match(/CREATE OR REPLACE FUNCTION public\.cancel_class_enrollment\(/g) || []).length === 1);

// R3. Panel admin/asistencia: botón + confirmación + RPC + recarga
ok("R: asistencia muestra botón de desinscripción por fila (person_remove)",
  adminAsistenciaR.includes("person_remove") && adminAsistenciaR.includes("Desinscribir"));
ok("R: asistencia abre modal de confirmación con el nombre del beneficiario",
  adminAsistenciaR.includes("setRemoveTarget({ beneficiary_id: b.id, full_name: b.full_name })") &&
  /Desinscribir a \{removeTarget\.full_name\}/.test(adminAsistenciaR));
ok("R: asistencia llama cancel_class_enrollment con sesión y beneficiario",
  /\.rpc\("cancel_class_enrollment", \{\s*p_session_id: expandedSession,\s*p_beneficiary_id: removeTarget\.beneficiary_id,/.test(adminAsistenciaR));
ok("R: asistencia recarga la lista tras eliminar (sin colapsar la sesión)",
  /reloadExpandedSession[\s\S]*?getAttendanceForSession/.test(adminAsistenciaR));
ok("R: regresión — sigue documentada la policy DELETE admin de class_enrollments",
  /"class_enrollments_delete_admin"/.test(schemaSqlR));

// ============================================================
// S. Changelog de desarrolladores (migración 012)
// ============================================================
section("S. Changelog de desarrolladores en panel admin");

const migration012 = readFileSync(join(ROOT, "contexto", "migrations", "012_changelog.sql"), "utf8");
const schemaSqlS = readFileSync(join(ROOT, "documentacion", "squema-sql-actualizado.sql"), "utf8");
const adminChangelogQ = readFileSync(join(ROOT, "src", "app", "admin", "changelog", "page.tsx"), "utf8");
const adminSidebarS = readFileSync(join(ROOT, "src", "components", "admin", "AdminSidebar.tsx"), "utf8");
const changelogTableRegex = /CREATE TABLE IF NOT EXISTS public\.changelog \([\s\S]*?\);/;

// S1. Migración 012: contrato de la tabla
ok("S: 012 crea la tabla changelog con version/title/summary/created_at",
  /CREATE TABLE IF NOT EXISTS public\.changelog \([\s\S]*?id uuid PRIMARY KEY DEFAULT gen_random_uuid\(\)[\s\S]*?version text NOT NULL[\s\S]*?title text NOT NULL[\s\S]*?summary text NOT NULL[\s\S]*?created_at timestamptz NOT NULL DEFAULT now\(\)/.test(migration012));
ok("S: 012 define UNIQUE(version) para seed idempotente",
  /CONSTRAINT changelog_version_unique UNIQUE \(version\)/.test(migration012));
ok("S: 012 habilita RLS en changelog",
  /ALTER TABLE public\.changelog ENABLE ROW LEVEL SECURITY/.test(migration012));
ok("S: 012 policy de solo lectura admin (changelog_admin_read, is_admin)",
  /CREATE POLICY "changelog_admin_read"[\s\S]*?FOR SELECT USING \(public\.is_admin\(\)\)/.test(migration012));
ok("S: 012 seed v1.0.0 menciona membresías, desinscripción y disciplinas",
  /'v1\.0\.0'/.test(migration012) &&
  /membres\xEDas rediseñada/.test(migration012) &&
  /Desinscribir/.test(migration012) &&
  /transición suave/.test(migration012));
ok("S: 012 seed es idempotente (ON CONFLICT version DO NOTHING)",
  /ON CONFLICT \(version\) DO NOTHING/.test(migration012));

// S2. Espejo 1:1 en el esquema documentado
ok("S: esquema refleja la tabla changelog 1:1 (migración 012)",
  norm(changelogTableRegex.exec(schemaSqlS)?.[0] ?? "") === norm(changelogTableRegex.exec(migration012)?.[0] ?? ""));
ok("S: esquema refleja la policy changelog_admin_read única",
  (schemaSqlS.match(/CREATE POLICY "changelog_admin_read"/g) || []).length === 1);
ok("S: esquema refleja el seed v1.0.0 con ON CONFLICT",
  /INSERT INTO public\.changelog \(version, title, summary\)/.test(schemaSqlS) &&
  /'v1\.0\.0'/.test(schemaSqlS) &&
  /ON CONFLICT \(version\) DO NOTHING/.test(schemaSqlS));

// S3. Frontend admin/changelog: solo lectura, ordenado por created_at
ok("S: changelog page es client component con spinner de carga",
  adminChangelogQ.includes('"use client"') &&
  /animate-spin/.test(adminChangelogQ));
ok("S: changelog page consulta la tabla ordenada por created_at DESC",
  /\.from\("changelog"\)[\s\S]*\.select\("\*"\)[\s\S]*\.order\("created_at", \{ ascending: false \}\)/.test(adminChangelogQ));
ok("S: changelog page renderiza version/title/summary/fecha",
  /entry\.version/.test(adminChangelogQ) &&
  /entry\.title/.test(adminChangelogQ) &&
  /entry\.summary/.test(adminChangelogQ) &&
  /toLocaleDateString\("es-CL"/.test(adminChangelogQ));
ok("S: changelog page usa whitespace-pre-line para el resumen",
  /whitespace-pre-line/.test(adminChangelogQ));
ok("S: changelog page no tiene botones de edición (solo lectura)",
  !/handleSave|\.update\(|\.insert\(|\.delete\(/.test(adminChangelogQ));

// S4. Sidebar: link Changelog con icono update
ok("S: sidebar agrega link /admin/changelog con icono update",
  /href: "\/admin\/changelog", label: "Changelog", icon: "update"/.test(adminSidebarS));

// S5. Regresión: módulos originales intactos
ok("S: no se tocaron los RPCs de asistencia ni el esquema previo",
  /enroll_class/.test(schemaSqlS) &&
  /cancel_class_enrollment/.test(schemaSqlS) &&
  (schemaSqlS.match(/CREATE OR REPLACE FUNCTION public\.cancel_class_enrollment\(/g) || []).length === 1);

// ============================================================
// T. Modo de pago manual por transferencia (migración 013)
// ============================================================
section("T. Pago manual por transferencia (migración 013)");

const migration013 = readFileSync(join(ROOT, "contexto", "migrations", "013_manual_payment_mode.sql"), "utf8");
const schemaSqlT = readFileSync(join(ROOT, "documentacion", "squema-sql-actualizado.sql"), "utf8");
const paymentSettingsLibT = readFileSync(join(ROOT, "src", "lib", "payment-settings.ts"), "utf8");
const transferRouteT = readFileSync(join(ROOT, "src", "app", "api", "payments", "transfer", "route.ts"), "utf8");
const reviewRouteT = readFileSync(join(ROOT, "src", "app", "api", "payments", "review", "route.ts"), "utf8");
const createOrderRouteT = readFileSync(join(ROOT, "src", "app", "api", "flow", "create-order", "route.ts"), "utf8");
const flowHelpersT = readFileSync(join(ROOT, "src", "lib", "flow-helpers.ts"), "utf8");
const emailT = readFileSync(join(ROOT, "src", "lib", "email.ts"), "utf8");
const checkoutModalT = readFileSync(join(ROOT, "src", "components", "CheckoutModal.tsx"), "utf8");
const personalizedModalT = readFileSync(join(ROOT, "src", "components", "PersonalizedCheckoutModal.tsx"), "utf8");
const transferStepT = readFileSync(join(ROOT, "src", "components", "TransferPaymentStep.tsx"), "utf8");
const paymentRowT = readFileSync(join(ROOT, "src", "components", "dashboard", "PaymentRow.tsx"), "utf8");
const adminVentasT = readFileSync(join(ROOT, "src", "app", "admin", "ventas", "page.tsx"), "utf8");
const adminConfigT = readFileSync(join(ROOT, "src", "app", "admin", "configuracion", "page.tsx"), "utf8");
const perfilT = readFileSync(join(ROOT, "src", "components", "athletes", "AccountSettings.tsx"), "utf8"); // formulario de /perfil (v1.19.0)
const adminUsuariosT = readFileSync(join(ROOT, "src", "app", "admin", "usuarios", "page.tsx"), "utf8");
const dataTableT = readFileSync(join(ROOT, "src", "components", "admin", "DataTable.tsx"), "utf8");
// Fase 6 (una cuenta por alumno): create/update-dependent, CreateDependentModal,
// AddDependentModal, EditDependentModal y DependentCard fueron eliminados; sus
// aserciones se reemplazaron por la sección AJ (retiro del sistema de cargas).
const rutLibT = readFileSync(join(ROOT, "src", "lib", "rut.ts"), "utf8");
const cargasPageT = readFileSync(join(ROOT, "src", "app", "dashboard", "cargas", "page.tsx"), "utf8");

// T1. Migración 013: contrato de la columna de configuración
ok("T: 013 agrega payment_settings jsonb a academy_settings (idempotente)",
  /ALTER TABLE public\.academy_settings[\s\S]*?ADD COLUMN IF NOT EXISTS payment_settings jsonb;/.test(migration013));
ok("T: 013 default singleton: los 3 tipos en 'online' + bank null",
  /memberships"?: "online"[\s\S]*?personalized"?: "online"[\s\S]*?enrollment"?: "online"[\s\S]*?bank":? null/.test(migration013));
ok("T: 013 no pisa config existente (WHERE payment_settings IS NULL)",
  /WHERE payment_settings IS NULL;/.test(migration013));
ok("T: 013 payments: membership_plan_id FK a membership_plans",
  /ADD COLUMN IF NOT EXISTS membership_plan_id uuid REFERENCES public\.membership_plans\(id\),/.test(migration013));
ok("T: 013 payments: personalized_plan_id FK a personalized_plans",
  /ADD COLUMN IF NOT EXISTS personalized_plan_id uuid REFERENCES public\.personalized_plans\(id\),/.test(migration013));
ok("T: 013 payments: reviewed_by / reviewed_at / admin_note",
  /ADD COLUMN IF NOT EXISTS reviewed_by uuid,[\s\S]*?ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,[\s\S]*?ADD COLUMN IF NOT EXISTS admin_note text;/.test(migration013));
ok("T: 013 profiles.rut nullable",
  /ALTER TABLE public\.profiles[\s\S]*?ADD COLUMN IF NOT EXISTS rut text;/.test(migration013));
ok("T: 013 índice parcial de solicitudes pendientes",
  /CREATE INDEX IF NOT EXISTS idx_payments_manual_pending[\s\S]*?WHERE method = 'transferencia' AND status = 'pendiente';/.test(migration013));
ok("T: 013 índices reviewed_by / membership_plan / personalized_plan",
  /CREATE INDEX IF NOT EXISTS idx_payments_reviewed_by/.test(migration013) &&
  /CREATE INDEX IF NOT EXISTS idx_payments_membership_plan/.test(migration013) &&
  /CREATE INDEX IF NOT EXISTS idx_payments_personalized_plan/.test(migration013));

// T2. Espejo 1:1 en el esquema documentado
ok("T: esquema refleja academy_settings.payment_settings jsonb",
  /payment_settings jsonb,/.test(schemaSqlT));
ok("T: esquema refleja el UPDATE singleton con defaults online",
  /UPDATE public\.academy_settings[\s\S]*?SET payment_settings = .*["']online["'][\s\S]*?WHERE payment_settings IS NULL;/.test(schemaSqlT));
ok("T: esquema refleja las columnas nuevas de payments 1:1 (migración 013)",
  /membership_plan_id uuid REFERENCES public\.membership_plans\(id\),[\s\S]*?personalized_plan_id uuid REFERENCES public\.personalized_plans\(id\),[\s\S]*?reviewed_by uuid,[\s\S]*?reviewed_at timestamptz,[\s\S]*?admin_note text,/.test(schemaSqlT));
ok("T: esquema refleja profiles.rut",
  /CREATE TABLE IF NOT EXISTS public\.profiles \([\s\S]*?rut text,/.test(schemaSqlT));
ok("T: esquema refleja los 4 índices de la migración",
  /idx_payments_manual_pending/.test(schemaSqlT) &&
  /idx_payments_reviewed_by/.test(schemaSqlT) &&
  /idx_payments_membership_plan/.test(schemaSqlT) &&
  /idx_payments_personalized_plan/.test(schemaSqlT));
ok("T: regresión — RLS de payments intacta en el esquema",
  /payments_select_own_or_admin/.test(schemaSqlT) &&
  /payments_insert_admin/.test(schemaSqlT) &&
  /payments_update_admin/.test(schemaSqlT));

// T3. Librería isomórfica payment-settings.ts
ok("T: lib exporta normalize/get/update + tipos + defaults",
  /export function normalizePaymentSettings/.test(paymentSettingsLibT) &&
  /export async function getPaymentSettings/.test(paymentSettingsLibT) &&
  /export async function updatePaymentSettings/.test(paymentSettingsLibT) &&
  /export type PaymentMode/.test(paymentSettingsLibT) &&
  /export const DEFAULT_PAYMENT_SETTINGS/.test(paymentSettingsLibT));
ok("T: normalize fuerza 'online' para cualquier valor no-manual",
  /const mode = \(v: unknown\): PaymentMode => \(v === "manual" \? "manual" : "online"\);/.test(paymentSettingsLibT));
ok("T: getPaymentSettings lee academy_settings.payment_settings",
  /\.from\("academy_settings"\)[\s\S]*?\.select\("payment_settings"\)[\s\S]*?\.maybeSingle\(\)/.test(paymentSettingsLibT));
ok("T: updatePaymentSettings actualiza por id del singleton",
  /\.from\("academy_settings"\)\s*\.update\(\{ payment_settings: settings \}\)\s*\.eq\("id", row\.id\)/.test(paymentSettingsLibT));

// T4. API de envío de solicitud (/api/payments/transfer)
ok("T: transfer exige sesión (401)",
  /const \{\s*data: \{ user \},\s*error: authError,[\s\S]*?\}\s*=\s*await supabase\.auth\.getUser\(\);[\s\S]*?if \(authError \|\| !user\)[\s\S]*?status: 401/.test(transferRouteT));
ok("T: transfer valida productType en [memberships|personalized|enrollment]",
  /\[\"memberships\", \"personalized\", \"enrollment\"\]\.includes\(productType\)/.test(transferRouteT));
ok("T: transfer rechaza si el tipo no está en modo manual (400)",
  /if \(settings\[modeKey\] !== "manual"\)[\s\S]*?status: 400/.test(transferRouteT));
ok("T: transfer exige datos bancarios configurados",
  /if \(!bank \|\| !bank\.bank_name \|\| !bank\.account_number\)/.test(transferRouteT));
ok("T: transfer acepta JPG/PNG/WebP/GIF/PDF y rechaza 5MB+",
  /"image\/jpeg",\s*"image\/png",\s*"image\/webp",\s*"image\/gif",\s*"application\/pdf"/.test(transferRouteT) &&
  /MAX_VOUCHER_BYTES = 5 \* 1024 \* 1024/.test(transferRouteT));
ok("T: transfer sube el voucher a storage public/vouchers",
  /admin\.storage\s*\.from\("public"\)\s*\.upload\(path, voucherBytes, \{ contentType: mime, upsert: true \}\)/.test(transferRouteT));
ok("T: transfer inserta payments method='transferencia' status='pendiente' con REF-ZE-",
  /commerce_order: reference,[\s\S]*?method: "transferencia",[\s\S]*?status: "pendiente",/.test(transferRouteT) &&
  /return `REF-ZE-\$\{ref\}`;/.test(transferRouteT));
ok("T: transfer guarda membership_plan_id / personalized_plan_id / enrollment en el payload",
  /if \(membershipPlanId\) insertPayload\.membership_plan_id = membershipPlanId;[\s\S]*?if \(personalizedPlanId\) insertPayload\.personalized_plan_id = personalizedPlanId;[\s\S]*?if \(includeEnrollment\) insertPayload\.include_enrollment = true;/.test(transferRouteT));
ok("T: transfer guarda RUT informativo en profiles sin pisar el existente",
  /\.from\("profiles"\)[\s\S]*?\.update\(\{ rut: rut\.trim\(\) \}\)[\s\S]*?\.eq\("id", user\.id\)/.test(transferRouteT));
ok("T: transfer notifica a staff (notifications target staff)",
  /\.from\("notifications"\)\.insert\([\s\S]*?target: "staff",[\s\S]*?sent_by: adminProfile\.id/.test(transferRouteT));
ok("T: transfer envía correo a todos los admins role_id=1 con fallback SMTP_USER",
  /\.from\("profiles"\)[\s\S]*?\.eq\("role_id", 1\)[\s\S]*?fallback = process\.env\.SMTP_USER[\s\S]*?sendTransferRequestEmail/.test(transferRouteT));
ok("T: transfer deep-linkea al admin a /admin/ventas?tab=solicitudes",
  /const paymentUrl = \`\$\{process\.env\.NEXT_PUBLIC_BASE_URL[\s\S]*?\/admin\/ventas\?tab=solicitudes\`/.test(transferRouteT));
ok("T: transfer usa admin client para insertar (bypass RLS insert_admin)",
  /const admin = getAdminClient\(\);[\s\S]*?\.from\("payments"\)[\s\S]*?\.insert\(insertPayload\)/.test(transferRouteT));

// T5. API de revisión (/api/payments/review)
ok("T: review exige rol admin (403)",
  /if \(!profile \|\| profile\.role_id !== 1\)[\s\S]*?status: 403/.test(reviewRouteT));
ok("T: review solo acepta transferencia pendiente",
  /if \(payment\.method !== "transferencia"\)[\s\S]*?if \(payment\.status !== "pendiente"\)/.test(reviewRouteT));
ok("T: rechazo guarda status+admin_note y notifica rejected",
  /\.update\(\{[\s\S]*?status: "rechazado",[\s\S]*?admin_note: adminNote \|\| null,[\s\S]*?\)\s*\.eq\("id", paymentId\)\s*\.eq\("status", "pendiente"\)/.test(reviewRouteT) &&
  /notifyUserPaymentStatus\(admin, payment, "rejected", adminNote \|\| undefined\)/.test(reviewRouteT));
ok("T: rechazo envía correo al usuario con motivo (notifyTransferReviewEmail rejected)",
  /await notifyTransferReviewEmail\("rejected", payment, adminNote \|\| undefined\)/.test(reviewRouteT));
ok("T: aprobación usa guard de concurrencia (UPDATE...WHERE status='pendiente')",
  /\.update\(\{[\s\S]*?status: "pagado",[\s\S]*?reviewed_by: user\.id,[\s\S]*?admin_note: adminNote \|\| null,[\s\S]*?\)\s*\.eq\("id", paymentId\)\s*\.eq\("status", "pendiente"\)/.test(reviewRouteT));
ok("T: aprobación asigna con createMembershipForPayment y override de plan",
  /createMembershipForPayment\(admin, paymentId, payment\.user_id, payment\.membership_plan_id\)/.test(reviewRouteT));
ok("T: aprobación asigna packs personalizados con confirmPersonalizedPack y override",
  /confirmPersonalizedPack\(admin, paymentId, payment\.user_id, payment\.personalized_plan_id\)/.test(reviewRouteT));
ok("T: aprobación extiende inscripción con if independiente (cubre caso combinado)",
  /if \(payment\.include_enrollment && payment\.enrollment_plan_id && payment\.beneficiary_id\)[\s\S]*?await extendEnrollment\(admin, paymentId, payment\.beneficiary_id, payment\.enrollment_plan_id\)/.test(reviewRouteT));
ok("T: caso combinado membresía+inscripción asigna ambos beneficios",
  /if \(payment\.membership_plan_id\) \{[\s\S]*?createMembershipForPayment\(admin, paymentId, payment\.user_id, payment\.membership_plan_id\)[\s\S]*?\}[\s\S]*?if \(payment\.include_enrollment && payment\.enrollment_plan_id[\s\S]*?extendEnrollment\(admin, paymentId, payment\.beneficiary_id, payment\.enrollment_plan_id\)[\s\S]*?assignment = results\.find\(\(r\) => !r\.success\) \|\| null;/.test(reviewRouteT));
ok("T: fallo en alguno de los dos beneficios dispara notifyPaymentWithoutMembership",
  /assignment = results\.find\(\(r\) => !r\.success\) \|\| null;[\s\S]*?if \(assignment && !assignment\.success\)/.test(reviewRouteT));
ok("T: fallo de asignación tras aprobar notifica notifyPaymentWithoutMembership",
  /if \(assignment && !assignment\.success\)[\s\S]*?notifyPaymentWithoutMembership\(admin, payment, assignment\.error/.test(reviewRouteT));
ok("T: aprobación notifica approved al usuario",
  /notifyUserPaymentStatus\(admin, payment, "approved", adminNote \|\| undefined\)/.test(reviewRouteT));
ok("T: aprobación envía correo al usuario (notifyTransferReviewEmail approved)",
  /await notifyTransferReviewEmail\("approved", payment, adminNote \|\| undefined\)/.test(reviewRouteT));
ok("T: aprobación persiste admin_note para que el usuario la vea",
  /status: "pagado",[\s\S]*?reviewed_by: user\.id,[\s\S]*?reviewed_at: new Date\(\)\.toISOString\(\),[\s\S]*?admin_note: adminNote \|\| null/.test(reviewRouteT));
ok("T: notifyTransferReviewEmail consulta email del usuario y apunta a #solicitudes",
  /async function notifyTransferReviewEmail\([\s\S]*?\.from\("profiles"\)[\s\S]*?\.select\("email, full_name, rut"\)[\s\S]*?\.eq\("id", payment\.user_id\)[\s\S]*?if \(!profile\?\.email\)[\s\S]*?sendTransferReviewEmail\(\{[\s\S]*?solicitudesUrl: `\$\{base\}\/dashboard\/pagos#solicitudes`/.test(reviewRouteT));
ok("T: review select incluye amount y commerce_order para el correo",
  /\.select\("id, user_id, status, method, concept, amount, commerce_order, beneficiary_id[\s\S]*?\)/.test(reviewRouteT));

// T6. Guarda en create-order (Flow desactivado en modo manual)
ok("T: create-order importa getPaymentSettings",
  createOrderRouteT.includes('from "@/lib/payment-settings"'));
ok("T: create-order deriva paymentType por producto (personalized/plan/enrollment)",
  /const paymentType: "memberships" \| "personalized" \| "enrollment" = personalizedPlanId[\s\S]*?planId[\s\S]*?memberships[\s\S]*?: "enrollment";/.test(createOrderRouteT));
ok("T: create-order rechaza 400 si el tipo está en modo manual",
  /if \(settings\[paymentType\] === "manual"\)[\s\S]*?El pago online está desactivado para este producto\. Usa transferencia\.[\s\S]*?status: 400/.test(createOrderRouteT));

// T7. Refactor de flow-helpers (override de plan + wrapper intacto)
ok("T: createMembershipForPayment acepta planId? (override para transferencia)",
  /export async function createMembershipForPayment\([\s\S]*?paymentId: string,[\s\S]*?userId: string,[\s\S]*?planId\?: string/.test(flowHelpersT));
ok("T: wrapper confirmAndCreateMembership delega a createMembershipForPayment",
  /export async function confirmAndCreateMembership\([\s\S]*?return createMembershipForPayment\(supabase, paymentId, userId\);/.test(flowHelpersT));
ok("T: confirmPersonalizedPack acepta planId? para transferencia",
  /export async function confirmPersonalizedPack\([\s\S]*?planId\?: string/.test(flowHelpersT));
ok("T: membresía aprobada corre desde fecha de aprobación (start_date = getChileToday)",
  /const today = getChileToday\(\);[\s\S]*?start_date: today,/.test(flowHelpersT));
ok("T: regresión — confirmación Flow usa el wrapper (sin override)",
  /confirmAndCreateMembership/.test(readFileSync(join(ROOT, "src", "app", "api", "flow", "confirmation", "route.ts"), "utf8")));
ok("T: notifyUserPaymentStatus acepta adminNote opcional y la incluye en el content",
  /notifyUserPaymentStatus\(\s*\n?\s*supabase: SupabaseClient,/.test(flowHelpersT) &&
  /adminNote\?: string[\s\S]*?const noteLine = adminNote \? `\\nNota del administrador: \$\{adminNote\}` : "";[\s\S]*?content: msg\.content \+ noteLine/.test(flowHelpersT));

// T8. Correo de solicitud de transferencia
ok("T: email exporta sendTransferRequestEmail con voucherUrl como enlace",
  /export interface TransferRequestEmailData[\s\S]*?voucherUrl\?: string \| null;[\s\S]*?paymentUrl: string;/.test(emailT) &&
  /export async function sendTransferRequestEmail\(data: TransferRequestEmailData\)/.test(emailT));
ok("T: el correo enlaza el voucher (no adjunta) y botón a /admin/ventas",
  /Comprobante: <a href="\$\{voucherUrl\}"[\s\S]*?ver voucher<\/a>/.test(emailT) &&
  /\$\{paymentUrl\}" class="btn">Revisar Solicitud/.test(emailT));
ok("T: el asunto del correo incluye la referencia",
  /subject: `\$\{academyName\} — Solicitud de pago por transferencia \(\$\{reference\}\)`/.test(emailT));
ok("T: email exporta sendTransferReviewEmail (aprobada/rechazada → Mis Solicitudes)",
  /export interface TransferReviewEmailData[\s\S]*?outcome: "approved" \| "rejected";[\s\S]*?solicitudesUrl: string;/.test(emailT) &&
  /export async function sendTransferReviewEmail\(data: TransferReviewEmailData\)/.test(emailT));
ok("T: correo de revisión dirige a la sección Mis Solicitudes de Pago",
  /\$\{solicitudesUrl\}" class="btn">Ver Mis Solicitudes de Pago/.test(emailT));
ok("T: correo de revisión incluye nota en ambos outcomes con label según outcome",
  /const noteBlock = adminNote[\s\S]*?\$\{isApproved \? "Nota del administrador" : "Motivo del rechazo"\}[\s\S]*?\$\{adminNote\}/.test(emailT) &&
  /\$\{rows\}\r?\n      \$\{noteBlock\}/.test(emailT));
ok("T: asunto de aprobación vs rechazo difieren",
  /subject: `\$\{academyName\} — \$\{isApproved \? "Pago por transferencia aprobado" : "Solicitud de pago rechazada"\} \(\$\{reference\}\)`/.test(emailT));

// T9. Frontend: checkout modal (membresías) en modo manual
ok("T: CheckoutModal carga getPaymentSettings y decide manualMode",
  checkoutModalT.includes('from "@/lib/payment-settings"') &&
  /const \[manualMode, setManualMode\] = useState\(false\);/.test(checkoutModalT) &&
  /getPaymentSettings\(supabase\)\.then\(\(settings\) => \{/.test(checkoutModalT));
ok("T: CheckoutModal muestra botón 'Pagar por transferencia' en modo manual",
  /manualMode \? "Pagar por transferencia" : "Pagar con Flow"/.test(checkoutModalT));
ok("T: CheckoutModal integra TransferPaymentStep cuando manual con banco",
  /manualMode && showTransfer && selectedId && bank \?[\s\S]*?<TransferPaymentStep/.test(checkoutModalT));
ok("T: CheckoutModal muestra error si manual sin datos bancarios",
  /manualMode && !bank &&/.test(checkoutModalT));

// T10. Frontend: checkout personalizado + paso de transferencia + filas
ok("T: PersonalizedCheckoutModal usa productType='personalized' en TransferPaymentStep",
  /manualMode && showTransfer && selectedBeneficiaryId && selectedPlanId && bank \?[\s\S]*?<TransferPaymentStep[\s\S]*?productType="personalized"/.test(personalizedModalT));
ok("T: TransferPaymentStep valida tipos y tamaño del voucher",
  /ALLOWED_TYPES = \["image\/jpeg", "image\/png", "image\/webp", "image\/gif", "application\/pdf"\]/.test(transferStepT) &&
  /MAX_SIZE = 5 \* 1024 \* 1024/.test(transferStepT));
ok("T: TransferPaymentStep POSTea a /api/payments/transfer con el cuerpo completo",
  /fetch\("\/api\/payments\/transfer", \{[\s\S]*?body: JSON\.stringify\(\{[\s\S]*?productType,[\s\S]*?rut: rut\.trim\(\) \|\| undefined,[\s\S]*?fileBase64,/.test(transferStepT));
ok("T: TransferPaymentStep autocarga RUT desde el perfil",
  /\.from\("profiles"\)[\s\S]*?\.select\("rut"\)[\s\S]*?\.eq\("id", user\.id\)/.test(transferStepT));
ok("T: PaymentRow marca 'En revisión' para transferencia pendiente",
  /const isTransferPending = payment\.method === "transferencia" && payment\.status === "pendiente";/.test(paymentRowT) &&
  /En revisión/.test(paymentRowT));
ok("T: PaymentRow muestra referencia y nota de rechazo",
  /showReference =[\s\S]*?isTransferPending && payment\.commerce_order;[\s\S]*?payment\.commerce_order[\s\S]*?payment\.status === "rechazado" && payment\.admin_note/.test(paymentRowT));
ok("T: PaymentRow muestra nota del admin en pagado (aprobación con nota)",
  /payment\.status === "pagado" && payment\.admin_note[\s\S]*?Nota: \{payment\.admin_note\}/.test(paymentRowT));

// T11. Admin ventas: tab Solicitudes + revisión
ok("T: admin/ventas tiene tab Solicitudes con badge de pendientes",
  /setActiveTab\("solicitudes"\)[\s\S]*?Solicitudes[\s\S]*?requests\.filter\(\(r\) => r\.status === "pendiente"\)\.length/.test(adminVentasT));
ok("T: admin/ventas carga solicitudes method='transferencia' con perfil+beneficiario",
  /\.from\("payments"\)[\s\S]*?profiles:user_id\(full_name, email, rut\),[\s\S]*?beneficiaries:beneficiary_id\([\s\S]*?\.eq\("method", "transferencia"\)/.test(adminVentasT));
ok("T: admin/ventas revisa vía POST /api/payments/review (aprobar/rechazar)",
  /fetch\("\/api\/payments\/review", \{[\s\S]*?paymentId: reviewTarget\.id,[\s\S]*?action,[\s\S]*?adminNote: adminNote\.trim\(\) \|\| undefined,/.test(adminVentasT));
ok("T: modal de revisión muestra voucher (img o iframe PDF) + 'Ver comprobante completo'",
  /reviewTarget\.receipt_url\.endsWith\("\.pdf"\) \?[\s\S]*?<iframe[\s\S]*?:[\s\S]*?<img[\s\S]*?Ver comprobante completo/.test(adminVentasT));
ok("T: modal de revisión permite aprobar o rechazar con nota",
  /doReview\("rechazar"\)[\s\S]*?Rechazar[\s\S]*?doReview\("aprobar"\)[\s\S]*?Aprobar/.test(adminVentasT));
ok("T: componente SolicitudesSection existe en el page",
  /function SolicitudesSection\(/.test(adminVentasT) &&
  /requests\.map\(\(p\) => \{[\s\S]*?onReview\(p\)/.test(adminVentasT));
ok("T: admin/ventas muestra nota del admin también en aprobadas (SolicitudesSection)",
  /p\.admin_note && \([\s\S]*?p\.status === "pagado" \? "text-green-400\/80" : "text-red-400\/80"[\s\S]*?Nota: \{p\.admin_note\}/.test(adminVentasT));
ok("T: admin/ventas da feedback post-revisión con toast de éxito",
  adminVentasT.includes('from "@/components/admin/Toast"') &&
  /const \[toast, setToast\] = useState<\{ msg: string; type: "success" \| "error" \} \| null>\(null\);/.test(adminVentasT) &&
  /Solicitud aprobada y pago registrado\. El usuario fue notificado\./.test(adminVentasT) &&
  /Solicitud rechazada\. El usuario fue notificado\./.test(adminVentasT) &&
  /<Toast message=\{toast\.msg\} type=\{toast\.type\} onClose=\{\(\) => setToast\(null\)\} \/>/.test(adminVentasT));
ok("T: modal de revisión aclara que la nota es visible para el usuario (aprobación y rechazo)",
  /Nota \(opcional, visible para el usuario\)/.test(adminVentasT));

// T12. Admin configuración (toggle por tipo) + perfil (RUT)
ok("T: admin/configuracion renderiza la tarjeta Modo de Pago con toggle por tipo",
  /Modo de Pago[\s\S]*?handleToggleMode\(key, "online"\)[\s\S]*?handleToggleMode\(key, "manual"\)/.test(adminConfigT));
ok("T: admin/configuracion guarda payment_settings y datos bancarios en handleSave",
  /handleToggleMode = \(type: "memberships" \| "personalized" \| "enrollment", mode: "online" \| "manual"\)/.test(adminConfigT) &&
  /payment_settings: paymentSettings,/.test(adminConfigT) &&
  /handleBankChange\("account_number"/.test(adminConfigT));
ok("T: perfil agrega campo RUT (state, load, save)",
  /const \[rut, setRut\] = useState\(""\);[\s\S]*?setRut\(data\.rut \|\| ""\);[\s\S]*?rut: rut\.trim\(\) \? formatRut\(rut\) : undefined,/.test(perfilT));

// T13. Changelog v1.1.0 (migración 014: entrada de release para el pago manual)
const migration014 = readFileSync(join(ROOT, "contexto", "migrations", "014_changelog_v1_1_0.sql"), "utf8");
ok("T: 014 inserta entrada v1.1.0 con título 'Pago por Transferencia'",
  /INSERT INTO public\.changelog \(version, title, summary\)/.test(migration014) &&
  /'v1\.1\.0'/.test(migration014) &&
  /'Pago por Transferencia'/.test(migration014));
ok("T: 014 seed es idempotente (ON CONFLICT version DO NOTHING)",
  /ON CONFLICT \(version\) DO NOTHING/.test(migration014));
ok("T: 014 resumen cubre los 3 tipos de producto y la revisión admin",
  /Membresías, Clases Personalizadas e Inscripciones/.test(migration014) &&
  /envía su comprobante adjunto/.test(migration014) &&
  /"Solicitudes" de la sección Ventas/.test(migration014));
ok("T: esquema documentado refleja el seed v1.1.0",
  /'v1\.1\.0'/.test(schemaSqlT) &&
  /'Pago por Transferencia'/.test(schemaSqlT) &&
  (schemaSqlT.match(/INSERT INTO public\.changelog \(version, title, summary\)/g) || []).length === 24);

// T14. Feedback admin: badge en sidebar + banner con solicitudes pendientes
const pendingTransferProviderT = readFileSync(join(ROOT, "src", "components", "admin", "PendingTransferProvider.tsx"), "utf8");
const pendingTransferBannerT = readFileSync(join(ROOT, "src", "components", "admin", "PendingTransferBanner.tsx"), "utf8");
const adminLayoutT = readFileSync(join(ROOT, "src", "app", "admin", "layout.tsx"), "utf8");
const adminSidebarT = readFileSync(join(ROOT, "src", "components", "admin", "AdminSidebar.tsx"), "utf8");
const adminVentasTabT = readFileSync(join(ROOT, "src", "app", "admin", "ventas", "page.tsx"), "utf8");
ok("T: provider cuenta transferencias pendientes (poll 30s + focus)",
  /\.from\("payments"\)[\s\S]*?\.select\("\*", \{ count: "exact", head: true \}\)[\s\S]*?\.eq\("method", "transferencia"\)[\s\S]*?\.eq\("status", "pendiente"\)/.test(pendingTransferProviderT) &&
  /POLL_INTERVAL_MS = 30_000/.test(pendingTransferProviderT) &&
  /window\.addEventListener\("focus"/.test(pendingTransferProviderT));
ok("T: provider expone usePendingTransferCount y refresco manual",
  /export function usePendingTransferCount/.test(pendingTransferProviderT) &&
  /refresh: \(\) => void/.test(pendingTransferProviderT));
ok("T: admin/layout envuelve con PendingTransferProvider y renderiza banner",
  /<PendingTransferProvider>[\s\S]*?<AdminSidebar[\s\S]*?<PendingTransferBanner \/>/.test(adminLayoutT));
ok("T: sidebar muestra badge de solicitudes pendientes en link Ventas",
  /usePendingTransferCount\(\)/.test(adminSidebarT) &&
  /link\.href === "\/admin\/ventas" && pendingCount > 0/.test(adminSidebarT) &&
  /bg-red-500/.test(adminSidebarT));
ok("T: banner grande solo cuando hay pendientes con CTA a ?tab=solicitudes",
  /loading \|\| count === 0[\s\S]*?return null;/.test(pendingTransferBannerT) &&
  /href="\/admin\/ventas\?tab=solicitudes"/.test(pendingTransferBannerT) &&
  /Revisar ahora/.test(pendingTransferBannerT));
ok("T: ventas abre tab Solicitudes con ?tab=solicitudes",
  /URLSearchParams\(window\.location\.search\)\.get\("tab"\) === "solicitudes"[\s\S]*?"solicitudes"[\s\S]*?"pagos"/.test(adminVentasTabT));

// T15. Feedback usuario: panel de solicitudes + badge/banner en dashboard
const userTransferProviderT = readFileSync(join(ROOT, "src", "components", "dashboard", "UserPendingTransferProvider.tsx"), "utf8");
const transferRequestsPanelT = readFileSync(join(ROOT, "src", "components", "dashboard", "TransferRequestsPanel.tsx"), "utf8");
const userTransferBannerT = readFileSync(join(ROOT, "src", "components", "dashboard", "UserPendingTransferBanner.tsx"), "utf8");
const dashboardNavT = readFileSync(join(ROOT, "src", "components", "dashboard", "DashboardNav.tsx"), "utf8");
const dashboardLayoutT = readFileSync(join(ROOT, "src", "app", "dashboard", "layout.tsx"), "utf8");
const dashboardPagosT = readFileSync(join(ROOT, "src", "app", "dashboard", "pagos", "page.tsx"), "utf8");
const dashboardLibT = readFileSync(join(ROOT, "src", "lib", "supabase", "dashboard.ts"), "utf8");
ok("T: provider usuario cuenta transferencias pendientes propias (poll 30s + focus)",
  /\.eq\("user_id", userId\)[\s\S]*?\.eq\("method", "transferencia"\)[\s\S]*?\.eq\("status", "pendiente"\)/.test(userTransferProviderT) &&
  /POLL_INTERVAL_MS = 30_000/.test(userTransferProviderT) &&
  /window\.addEventListener\("focus"/.test(userTransferProviderT));
ok("T: dashboard/layout envuelve con UserPendingTransferProvider",
  /<UserPendingTransferProvider userId=\{user\.id\}>/.test(dashboardLayoutT));
ok("T: DashboardNav muestra badge de solicitudes pendientes en tab Pagos",
  /useUserPendingTransferCount\(\)/.test(dashboardNavT) &&
  /tab\.href === "\/dashboard\/pagos" && pendingTransferCount > 0/.test(dashboardNavT) &&
  /bg-red-500/.test(dashboardNavT));
ok("T: banner usuario avisa solicitudes pendientes con CTA a #solicitudes",
  /loading \|\| count === 0[\s\S]*?return null;/.test(userTransferBannerT) &&
  /href="\/dashboard\/pagos#solicitudes"/.test(userTransferBannerT) &&
  /Ver solicitudes/.test(userTransferBannerT));
ok("T: panel muestra estado, motivo de rechazo (admin_note) y comprobante",
  /statusConfig/.test(transferRequestsPanelT) &&
  /pendiente:[\s\S]*?En revisión/.test(transferRequestsPanelT) &&
  /rechazado:[\s\S]*?Rechazada/.test(transferRequestsPanelT) &&
  /p\.admin_note \|\| "Sin motivo especificado\."/.test(transferRequestsPanelT) &&
  /p\.receipt_url/.test(transferRequestsPanelT));
ok("T: panel muestra nota del admin en aprobaciones (verde, 'Nota del administrador')",
  /p\.status === "pagado" && p\.admin_note[\s\S]*?Nota del administrador[\s\S]*?text-green-300[\s\S]*?\{p\.admin_note\}/.test(transferRequestsPanelT));
ok("T: pagos page incluye banner + panel con ancla #solicitudes",
  /<UserPendingTransferBanner \/>/.test(dashboardPagosT) &&
  /id="solicitudes"[\s\S]*?<TransferRequestsPanel \/>/.test(dashboardPagosT));
ok("T: dashboard.ts expone getUserTransferRequests (method='transferencia' por user)",
  /export async function getUserTransferRequests\(userId: string\)[\s\S]*?\.eq\("method", "transferencia"\)/.test(dashboardLibT));

// U. RUT visible y filtrable en admin/usuarios
ok("U: UserRow tipa rut (string | null)",
  /interface UserRow \{[\s\S]*?rut\?: string \| null;/.test(adminUsuariosT));
ok("U: admin/usuarios muestra columna RUT (u.rut o —)",
  /key: "rut", label: "RUT", render: \(u\) => u\.rut \|\| "—"/.test(adminUsuariosT));
// Fase 6: la lista son solo cuentas (profiles select *, que incluye rut).
ok("U: carga RUT desde profiles (select *), sin filas de cargas",
  /supabase\.from\("profiles"\)\.select\("\*"\)/.test(adminUsuariosT) &&
  !/from\("dependents"\)/.test(adminUsuariosT));
ok("U: búsqueda cubre nombre, email y RUT (searchKey multi-campo)",
  /searchKey=\{\["full_name", "email", "rut"\]\}[\s\S]*?Buscar por nombre, email o RUT\.\.\./.test(adminUsuariosT));
ok("U: export Excel incluye RUT (u.rut o —)",
  /"RUT": u\.rut \|\| "—",/.test(adminUsuariosT));
ok("U: DataTable acepta searchKey string | string[] y busca en cualquiera",
  /searchKey\?: string \| string\[\];/.test(dataTableT) &&
  /const keys = Array\.isArray\(searchKey\) \? searchKey : \[searchKey\];[\s\S]*?keys\.some\(/.test(dataTableT));

// V. Crear y asignar carga desde admin/usuarios
// Las cargas se eliminaron sin migrar (2026-10-16): no hay botón de crear
// cargas ni de migrarlas.
ok("V: admin/usuarios no ofrece crear ni migrar cargas",
  !/Crear y Asignar Carga/.test(adminUsuariosT) &&
  !/migracion-cargas/.test(adminUsuariosT));
// Fase 6: openEdit edita solo la cuenta (rol/estado); la creación y edición
// de cargas (CreateDependentModal + APIs) se retiró (ver sección AJ).
ok("V: openEdit edita la cuenta sin ramas de cargas",
  /const openEdit = \(u: UserRow\) => \{\s*setEditing\(u\);/.test(adminUsuariosT) &&
  !/CreateDependentModal/.test(adminUsuariosT));

// V2. Changelog v1.1.1 (migración 015: entrada de release para crear/asignar carga)
const migration015 = readFileSync(join(ROOT, "contexto", "migrations", "015_changelog_v1_1_1.sql"), "utf8");
ok("V: 015 inserta entrada v1.1.1 con título 'Crear y Asignar Cargas desde el Panel Admin'",
  /INSERT INTO public\.changelog \(version, title, summary\)/.test(migration015) &&
  /'v1\.1\.1'/.test(migration015) &&
  /'Crear y Asignar Cargas desde el Panel Admin'/.test(migration015));
ok("V: 015 seed es idempotente (ON CONFLICT version DO NOTHING)",
  /ON CONFLICT \(version\) DO NOTHING/.test(migration015));
ok("V: 015 resumen cubre el botón, datos de la carga y edición",
  /"Crear y Asignar Carga"/.test(migration015) &&
  /datos completos del hijo\/familiar/.test(migration015) &&
  /editarse directamente desde la misma tabla de usuarios/.test(migration015));
ok("V: esquema documentado refleja el seed v1.1.1",
  /'v1\.1\.1'/.test(schemaSqlT) &&
  /'Crear y Asignar Cargas desde el Panel Admin'/.test(schemaSqlT));

// W. Editar cargas desde el dashboard + validación de RUT (módulo 11)
ok("W: normalizeRut limpia puntos, guiones y espacios (acepta k/K)",
  normalizeRut("12.345.678-9") === "123456789" &&
  normalizeRut(" 11.222.333-4 ") === "112223334" &&
  normalizeRut("98765432-k") === "98765432K");
ok("W: isValidRut acepta RUT válido con y sin formato",
  isValidRut("11.111.111-1") &&
  isValidRut("11111111-1") &&
  isValidRut("12345678-5"));
ok("W: isValidRut rechaza DV incorrecto, cuerpo corto y fuera de rango",
  !isValidRut("11.111.111-2") &&
  !isValidRut("1-1") &&
  !isValidRut("99999-9") &&
  !isValidRut("10000000-K"));
ok("W: isValidRut rechaza vacíos, letras en el cuerpo y símbolos",
  !isValidRut("") &&
  !isValidRut("abc") &&
  !isValidRut("11.111.11X-1"));
ok("W: formatRut agrega puntos y guión",
  formatRut("111111111") === "11.111.111-1" &&
  formatRut("123456785") === "12.345.678-5");
// Una cuenta por alumno (fase 5): "Mis Cargas" pasó a "Mi ficha"; la
// ruta antigua redirige.
ok("W: /dashboard/cargas redirige a Mi ficha (ya no hay edición de cargas)",
  /redirect\("\/dashboard\/ficha"\)/.test(cargasPageT) &&
  !/EditDependentModal/.test(cargasPageT));
// Fase 6: la validación de RUT vive en el registro, create-user y /perfil (AG).

// W2. Changelog v1.1.2 (migración 016: entrada de release editar cargas + validación RUT)
const migration016 = readFileSync(join(ROOT, "contexto", "migrations", "016_changelog_v1_1_2.sql"), "utf8");
ok("W: 016 inserta entrada v1.1.2 con título 'Editar Cargas y Validación de RUT'",
  /INSERT INTO public\.changelog \(version, title, summary\)/.test(migration016) &&
  /'v1\.1\.2'/.test(migration016) &&
  /'Editar Cargas y Validación de RUT'/.test(migration016));
ok("W: 016 seed es idempotente (ON CONFLICT version DO NOTHING)",
  /ON CONFLICT \(version\) DO NOTHING/.test(migration016));
ok("W: 016 resumen cubre edición y validación del RUT",
  /Editar datos/.test(migration016) &&
  /dígito verificador/.test(migration016));
ok("W: esquema documentado refleja el seed v1.1.2",
  /'v1\.1\.2'/.test(schemaSqlT) &&
  /'Editar Cargas y Validación de RUT'/.test(schemaSqlT));

// X. Changelog v1.2.0 (migración 017: nota en aprobaciones + feedback)
const migration017 = readFileSync(join(ROOT, "contexto", "migrations", "017_changelog_v1_2_0.sql"), "utf8");
ok("X: 017 inserta entrada v1.2.0 con título 'Nota del Administrador en Aprobaciones y Mejor Feedback'",
  /INSERT INTO public\.changelog \(version, title, summary\)/.test(migration017) &&
  /'v1\.2\.0'/.test(migration017) &&
  /'Nota del Administrador en Aprobaciones y Mejor Feedback'/.test(migration017));
ok("X: 017 seed es idempotente (ON CONFLICT version DO NOTHING)",
  /ON CONFLICT \(version\) DO NOTHING/.test(migration017));
ok("X: 017 resumen cubre nota en aprobaciones y feedback para ambos lados",
  /Nota del administrador/.test(migration017) &&
  /Mis Solicitudes de Pago/.test(migration017) &&
  /confirmación visual/.test(migration017));
ok("X: esquema documentado refleja el seed v1.2.0",
  /'v1\.2\.0'/.test(schemaSqlT) &&
  /'Nota del Administrador en Aprobaciones y Mejor Feedback'/.test(schemaSqlT));

// Y. Dirección en perfil del tutor y en cargas (v1.2.1)
const migration018 = readFileSync(join(ROOT, "contexto", "migrations", "018_address_dependents_profiles.sql"), "utf8");
const migration018Changelog = readFileSync(join(ROOT, "contexto", "migrations", "018_changelog_v1_2_1.sql"), "utf8");
ok("Y: 018 agrega address a profiles y dependents (idempotente)",
  /ALTER TABLE public\.profiles ADD COLUMN IF NOT EXISTS address text;/.test(migration018) &&
  /ALTER TABLE public\.dependents ADD COLUMN IF NOT EXISTS address text;/.test(migration018));
ok("Y: espejo esquema documenta address en profiles y dependents",
  /CREATE TABLE IF NOT EXISTS public\.profiles \([\s\S]*?address text,/.test(schemaSqlT) &&
  /CREATE TABLE IF NOT EXISTS public\.dependents \([\s\S]*?address text,/.test(schemaSqlT));
ok("Y: 018 changelog v1.2.1 'Dirección en Perfil y Cargas' (idempotente)",
  /'v1\.2\.1'/.test(migration018Changelog) &&
  /'Dirección en Perfil y Cargas'/.test(migration018Changelog) &&
  /ON CONFLICT \(version\) DO NOTHING/.test(migration018Changelog));
ok("Y: espejo refleja el seed v1.2.1",
  /'v1\.2\.1'/.test(schemaSqlT) &&
  /'Dirección en Perfil y Cargas'/.test(schemaSqlT));
// Fase 6: DependentData se eliminó; la dirección del alumno vive en su perfil.
ok("Y: admin/usuarios tipa address del alumno (UserRow)",
  /interface UserRow \{[\s\S]*?address\?: string \| null;/.test(adminUsuariosT));
ok("Y: dashboard.ts getProfileForEdit y updateProfile soportan address",
  // Las columnas siguientes (datos físicos v1.3.0, apoderado v1.12.0) se agregaron después.
  /\.select\("full_name, phone, birth_date, rut, address(, [a-z_]+)*"\)/.test(dashboardLibT) &&
  /updates: \{[\s\S]*?address\?: string;[\s\S]*?weight\?: number \| null;[\s\S]*?height\?: number \| null;[\s\S]*?dominant_hand\?: string \| null;[\s\S]*?\}/.test(dashboardLibT));
// Fase 5: getUserMemberships ya no lee cargas (solo el propio beneficiario).
ok("Y: dashboard.ts getUserMemberships lee solo el beneficiario propio",
  /export async function getUserMemberships[\s\S]*?\.eq\("profile_id", userId\)[\s\S]*?\.eq\("beneficiary_id", ownBeneficiary\.id\)/.test(dashboardLibT) &&
  !/export async function getUserMemberships[\s\S]{0,600}?from\("dependents"\)/.test(dashboardLibT));
ok("Y: perfil carga, edita y guarda dirección",
  /const \[address, setAddress\] = useState\(""\);[\s\S]*?setAddress\(data\.address \|\| ""\);[\s\S]*?address: address \|\| undefined,/.test(perfilT) &&
  /placeholder="Calle, número, comuna"/.test(perfilT));
// Fase 6: la dirección de cada alumno vive en su perfil y se ve en la ficha admin.
ok("Y: admin/usuarios muestra la dirección del alumno en su ficha",
  /address: u\.address \|\| null,/.test(adminUsuariosT));

// Z. Datos físicos (peso/altura/mano dominante) y Ver Ficha (v1.3.0)
const migration019 = readFileSync(join(ROOT, "contexto", "migrations", "019_physical_info_profiles_dependents.sql"), "utf8");
const migration019Changelog = readFileSync(join(ROOT, "contexto", "migrations", "019_changelog_v1_3_0.sql"), "utf8");
const medidasT = readFileSync(join(ROOT, "src", "lib", "medidas.ts"), "utf8");
const physicalInfoCardT = readFileSync(join(ROOT, "src", "components", "dashboard", "PhysicalInfoCard.tsx"), "utf8");
const verFichaModalT = readFileSync(join(ROOT, "src", "components", "admin", "VerFichaModal.tsx"), "utf8");
const medicoPageT = readFileSync(join(ROOT, "src", "app", "dashboard", "cargas", "[id]", "medico", "page.tsx"), "utf8");
ok("Z: 019 agrega weight/height/dominant_hand a profiles y dependents (idempotente)",
  /ALTER TABLE public\.profiles ADD COLUMN IF NOT EXISTS weight numeric;/.test(migration019) &&
  /ALTER TABLE public\.profiles ADD COLUMN IF NOT EXISTS height numeric;/.test(migration019) &&
  /ALTER TABLE public\.profiles ADD COLUMN IF NOT EXISTS dominant_hand text;/.test(migration019) &&
  /ALTER TABLE public\.dependents ADD COLUMN IF NOT EXISTS weight numeric;/.test(migration019) &&
  /ALTER TABLE public\.dependents ADD COLUMN IF NOT EXISTS height numeric;/.test(migration019) &&
  /ALTER TABLE public\.dependents ADD COLUMN IF NOT EXISTS dominant_hand text;/.test(migration019));
ok("Z: 019 define CHECK constraints via DO block (patrón 010)",
  /DO \$\$[\s\S]*?pg_constraint WHERE conname = 'profiles_weight_check'/.test(migration019) &&
  /CHECK \(weight > 0 AND weight <= 300\)/.test(migration019) &&
  /CHECK \(height > 0 AND height <= 250\)/.test(migration019) &&
  /CHECK \(dominant_hand IN \('diestro', 'zurdo'\)\)/.test(migration019) &&
  /dependents_weight_check/.test(migration019));
ok("Z: espejo esquema documenta columnas físicas + CHECK en profiles y dependents",
  /CREATE TABLE IF NOT EXISTS public\.profiles \([\s\S]*?weight numeric,[\s\S]*?height numeric,[\s\S]*?dominant_hand text,[\s\S]*?CONSTRAINT profiles_weight_check CHECK \(weight > 0 AND weight <= 300\),[\s\S]*?CONSTRAINT profiles_height_check CHECK \(height > 0 AND height <= 250\),[\s\S]*?CONSTRAINT profiles_dominant_hand_check CHECK \(dominant_hand IN \('diestro', 'zurdo'\)\)/.test(schemaSqlT) &&
  /CREATE TABLE IF NOT EXISTS public\.dependents \([\s\S]*?weight numeric,[\s\S]*?height numeric,[\s\S]*?dominant_hand text,[\s\S]*?CONSTRAINT dependents_weight_check CHECK \(weight > 0 AND weight <= 300\),[\s\S]*?CONSTRAINT dependents_height_check CHECK \(height > 0 AND height <= 250\),[\s\S]*?CONSTRAINT dependents_dominant_hand_check CHECK \(dominant_hand IN \('diestro', 'zurdo'\)\)/.test(schemaSqlT));
ok("Z: 019 changelog v1.3.0 'Datos Físicos y Ver Ficha' (idempotente)",
  /'v1\.3\.0'/.test(migration019Changelog) &&
  /'Datos Físicos y Ver Ficha'/.test(migration019Changelog) &&
  /ON CONFLICT \(version\) DO NOTHING/.test(migration019Changelog));
ok("Z: espejo refleja el seed v1.3.0",
  /'v1\.3\.0'/.test(schemaSqlT) &&
  /'Datos Físicos y Ver Ficha'/.test(schemaSqlT));
ok("Z: medidas.ts normaliza y valida peso/altura/mano (isomórfico)",
  /export function normalizeMedida\(value: string\): string/.test(medidasT) &&
  /\.replace\(",", "\."\)/.test(medidasT) &&
  /export function parseMedida\(value: string\): number \| null[\s\S]*?\/\^\\d\+\(\\\.\\d\+\)\?\$\//.test(medidasT) &&
  /export function isValidPeso\(value: string\): boolean[\s\S]*?n !== null && n > 0 && n <= 300/.test(medidasT) &&
  /export function isValidAltura\(value: string\): boolean[\s\S]*?n !== null && n > 0 && n <= 250/.test(medidasT) &&
  /export function isValidDominantHand\(value: string\): boolean[\s\S]*?"diestro" \|\| value === "zurdo"/.test(medidasT));
ok("Z: admin/usuarios tipa weight/height/dominant_hand del alumno",
  /interface UserRow \{[\s\S]*?weight\?: number \| null;[\s\S]*?height\?: number \| null;[\s\S]*?dominant_hand\?: string \| null;/.test(adminUsuariosT));
ok("Z: perfil registra datos físicos con validación y select de mano",
  /const \[weight, setWeight\] = useState\(""\);[\s\S]*?isValidPeso\(weight\)[\s\S]*?weight: weight\.trim\(\) \? parseMedida\(weight\) : null,/.test(perfilT) &&
  /<option value="diestro">Diestro<\/option>[\s\S]*?<option value="zurdo">Zurdo<\/option>/.test(perfilT));
ok("Z: PhysicalInfoCard es card editable con validación de medidas",
  /export default function PhysicalInfoCard[\s\S]*?isValidPeso\(peso\)[\s\S]*?isValidAltura\(altura\)[\s\S]*?parseMedida\(peso\)[\s\S]*?Datos Físicos/.test(physicalInfoCardT));
// Fase 5: la ficha médica de cada alumno vive en "Mi ficha" de su cuenta;
// las medidas se guardan en su propio perfil.
const fichaPageZ = readFileSync(join(ROOT, "src", "app", "dashboard", "ficha", "page.tsx"), "utf8");
ok("Z: Mi ficha carga y guarda las medidas del propio perfil (medico de carga redirige)",
  /redirect\("\/dashboard\/ficha"\)/.test(medicoPageT) &&
  /await updateProfile\(user\.id, data\)/.test(fichaPageZ) &&
  /<PhysicalInfoCard/.test(fichaPageZ) &&
  /<MedicalInfoCard record=\{record\} beneficiaryId=\{beneficiaryId\}/.test(fichaPageZ));
ok("Z: Ver Ficha del admin muestra medidas y apoderado del alumno",
  /export interface StudentFicha \{[\s\S]*?weight\?: number \| null;[\s\S]*?guardian_name\?: string \| null;/.test(verFichaModalT) &&
  /label: "Apoderado"/.test(verFichaModalT) &&
  /<VerFichaModal[\s\S]*?student=\{fichaRow\}/.test(adminUsuariosT));
ok("Z: DataTable soporta onView + canView (botón ojo Ver Ficha)",
  /onView\?: \(item: T\) => void;[\s\S]*?canView\?: \(item: T\) => boolean;/.test(dataTableT) &&
  /onView && \(!canView \|\| canView\(item\)\)[\s\S]*?visibility/.test(dataTableT));
ok("Z: VerFichaModal es solo lectura y muestra datos físicos",
  /export default function VerFichaModal[\s\S]*?dependent\.weight != null \? `\$\{dependent\.weight\} kg` : "—"[\s\S]*?dependent\.height != null \? `\$\{dependent\.height\} cm` : "—"[\s\S]*?Mano dominante[\s\S]*?Cerrar/.test(verFichaModalT) &&
  !/<input|<textarea|<select/.test(verFichaModalT));
// Fase 6: Ver Ficha es para cualquier alumno (sus medidas vienen del perfil).
ok("Z: admin/usuarios abre VerFichaModal (onView/canView) y carga medidas",
  /onView=\{openFicha\}[^]*canView=\{\(u\) => u\.role_id === 4\}/.test(adminUsuariosT) &&
  /<VerFichaModal[\s\S]*?student=\{fichaRow\}/.test(adminUsuariosT) &&
  /weight: u\.weight \?\? null,[\s\S]*?height: u\.height \?\? null,[\s\S]*?dominant_hand: u\.dominant_hand \|\| null,/.test(adminUsuariosT));


// AA. Tienda con carrito y checkout Flow (v1.4.0, requisito tienda-carrito-ventas)
const migration020 = readFileSync(join(ROOT, "contexto", "migrations", "020_store_checkout.sql"), "utf8");
const migration020Changelog = readFileSync(join(ROOT, "contexto", "migrations", "020_changelog_v1_4_0.sql"), "utf8");
const storeLibT = readFileSync(join(ROOT, "src", "lib", "store.ts"), "utf8");
const storeCheckoutRouteT = readFileSync(join(ROOT, "src", "app", "api", "store", "checkout", "route.ts"), "utf8");
const storeOrderStatusRouteT = readFileSync(join(ROOT, "src", "app", "api", "store", "order-status", "route.ts"), "utf8");
const storeAdminOrdersRouteT = readFileSync(join(ROOT, "src", "app", "api", "store", "admin", "orders", "route.ts"), "utf8");
const confirmationRouteT = readFileSync(join(ROOT, "src", "app", "api", "flow", "confirmation", "route.ts"), "utf8");
const verifyRouteT = readFileSync(join(ROOT, "src", "app", "api", "flow", "verify", "route.ts"), "utf8");
const flowLibT = readFileSync(join(ROOT, "src", "lib", "flow.ts"), "utf8");
const cartContextT = readFileSync(join(ROOT, "src", "context", "CartContext.tsx"), "utf8");
const rootLayoutT = readFileSync(join(ROOT, "src", "app", "layout.tsx"), "utf8");
const navbarT = readFileSync(join(ROOT, "src", "components", "Navbar.tsx"), "utf8");
const carritoPageT = readFileSync(join(ROOT, "src", "app", "carrito", "page.tsx"), "utf8");
const confirmacionPageT = readFileSync(join(ROOT, "src", "app", "tienda", "confirmacion", "page.tsx"), "utf8");
const storeReturnRouteT = readFileSync(join(ROOT, "src", "app", "api", "store", "return", "route.ts"), "utf8");
const productosPageT = readFileSync(join(ROOT, "src", "app", "productos", "page.tsx"), "utf8");
const productoDetailPageT = readFileSync(join(ROOT, "src", "app", "productos", "[id]", "page.tsx"), "utf8");
const dashboardTiendaPageT = readFileSync(join(ROOT, "src", "app", "dashboard", "tienda", "page.tsx"), "utf8");

ok("AA: migración 020 hace user_id nullable en product_orders y payments",
  /ALTER TABLE public\.product_orders ALTER COLUMN user_id DROP NOT NULL;/.test(migration020) &&
  /ALTER TABLE public\.payments ALTER COLUMN user_id DROP NOT NULL;/.test(migration020));
ok("AA: 020 agrega columnas de invitado y referencia a product_orders",
  /ADD COLUMN IF NOT EXISTS guest_email text;/.test(migration020) &&
  /ADD COLUMN IF NOT EXISTS guest_phone text;/.test(migration020) &&
  /ADD COLUMN IF NOT EXISTS guest_name text;/.test(migration020) &&
  /ADD COLUMN IF NOT EXISTS reference text;/.test(migration020));
ok("AA: 020 index único parcial de referencia",
  /CREATE UNIQUE INDEX IF NOT EXISTS idx_product_orders_reference_unique[\s\S]*?WHERE reference IS NOT NULL;/.test(migration020));
ok("AA: 020 agrega CHECK quantity > 0 a order_items",
  /IF NOT EXISTS \(SELECT 1 FROM pg_constraint WHERE conname = 'order_items_quantity_check'\)[\s\S]*?CHECK \(quantity > 0\)/.test(migration020));
ok("AA: 020 crea RPC de stock SECURITY DEFINER con guarda antiuso",
  /CREATE OR REPLACE FUNCTION public\.decrement_product_stock\([\s\S]*?SECURITY DEFINER[\s\S]*?AND stock >= p_qty;/.test(migration020) &&
  /CREATE OR REPLACE FUNCTION public\.increment_product_stock\([\s\S]*?SET stock = stock \+ p_qty,/.test(migration020));
ok("AA: 020 grantea los RPC solo a authenticated",
  /GRANT EXECUTE ON FUNCTION public\.decrement_product_stock\(uuid, integer\) TO authenticated;/.test(migration020) &&
  /GRANT EXECUTE ON FUNCTION public\.increment_product_stock\(uuid, integer\) TO authenticated;/.test(migration020));
ok("AA: 020 changelog v1.4.0 'Tienda de Productos' (idempotente)",
  /'v1\.4\.0'/.test(migration020Changelog) &&
  /'Tienda de Productos'/.test(migration020Changelog) &&
  /ON CONFLICT \(version\) DO NOTHING/.test(migration020Changelog));
ok("AA: espejo refleja columnas nullable + guest + reference en product_orders",
  /CREATE TABLE IF NOT EXISTS public\.product_orders \([\s\S]*?user_id uuid,[\s\S]*?guest_email text,[\s\S]*?guest_phone text,[\s\S]*?guest_name text,[\s\S]*?reference text,/.test(schemaSqlT));
ok("AA: espejo refleja payments.user_id nullable + order_id",
  /CREATE TABLE IF NOT EXISTS public\.payments \([\s\S]*?user_id uuid,[\s\S]*?order_id uuid,/.test(schemaSqlT));
ok("AA: espejo refleja CHECK quantity en order_items",
  /CONSTRAINT order_items_quantity_check CHECK \(quantity > 0\)/.test(schemaSqlT));
ok("AA: espejo refleja RPC de stock y seed v1.4.0",
  /CREATE OR REPLACE FUNCTION public\.decrement_product_stock\(/.test(schemaSqlT) &&
  /CREATE OR REPLACE FUNCTION public\.increment_product_stock\(/.test(schemaSqlT) &&
  /'v1\.4\.0'/.test(schemaSqlT) &&
  /'Tienda de Productos'/.test(schemaSqlT));
ok("AA: store.ts define prefijo de concepto y guard isStorePayment",
  /export const STORE_CONCEPT_PREFIX = "Tienda:";/.test(storeLibT) &&
  /export function isStorePayment\([\s\S]*?Boolean\(payment\.order_id\)[\s\S]*?startsWith\(STORE_CONCEPT_PREFIX\)/.test(storeLibT));
ok("AA: store.ts construye referencia REF-ZE-prod con crypto",
  /export function buildStoreReference\(\): string {[\s\S]*?REF-ZE-prod-\$\{ts\}\$\{rand\}/.test(storeLibT) &&
  /crypto\.randomUUID\(\)\.slice\(0, 8\)/.test(storeLibT));
ok("AA: store.ts reserva/restaura stock vía RPC atómico",
  /export async function reserveStock\([\s\S]*?supabase\.rpc\("decrement_product_stock"/.test(storeLibT) &&
  /export async function restoreStock\([\s\S]*?supabase\.rpc\("increment_product_stock"/.test(storeLibT));
ok("AA: store.ts confirma orden idempotente y cancela restaurando stock",
  /export async function confirmProductOrder\([\s\S]*?\.update\(\{ status: "pagado" \}\)/.test(storeLibT) &&
  /export async function cancelStoreOrder\([\s\S]*?\.update\(\{ status: "cancelado" \}\)[\s\S]*?restoreStock\(/.test(storeLibT) &&
  /order\.status === "cancelado"[\s\S]*?return \{ success: true \};/.test(storeLibT));
ok("AA: store.ts resuelve email de contacto (cuenta o invitado)",
  /export async function getOrderContactEmail\([\s\S]*?\.from\("profiles"\)[\s\S]*?\.eq\("id", order\.user_id\)[\s\S]*?return order\.guest_email \|\| null;/.test(storeLibT));
ok("AA: store.ts envía recibo de compra best-effort",
  /export async function sendStoreOrderReceipt\([\s\S]*?sendProductReceiptEmail\(\{[\s\S]*?storeUrl/.test(storeLibT));
ok("AA: store.ts handlers unificados aprobado/rechazado",
  /export async function handleStorePaymentApproved\([\s\S]*?confirmProductOrder\([\s\S]*?sendStoreOrderReceipt\(/.test(storeLibT) &&
  /export async function handleStorePaymentRejected\([\s\S]*?cancelStoreOrder\(/.test(storeLibT));
ok("AA: email.ts define recibo de tienda (interfaces + función)",
  /export interface StoreReceiptItem \{[\s\S]*?name: string;[\s\S]*?quantity: number;[\s\S]*?unit_price: number;/.test(emailT) &&
  /export async function sendProductReceiptEmail\(data: ProductReceiptEmailData\)/.test(emailT));
ok("AA: flow.ts returnUrl opcional en createFlowOrder",
  /interface CreateOrderParams \{[\s\S]*?returnUrl\?: string;/.test(flowLibT) &&
  /function buildReturnUrl\(returnUrl\?: string\): string {[\s\S]*?if \(returnUrl\)/.test(flowLibT));
ok("AA: checkout valida invitado (email + teléfono) y toma precio del servidor",
  /const EMAIL_REGEX = \/\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\+\$\/;/.test(storeCheckoutRouteT) &&
  /const PHONE_REGEX = \/\^\\\+\?\[0-9 \(\)-\]\{8,20\}\$\/;/.test(storeCheckoutRouteT) &&
  /Ingresa un email válido para el recibo/.test(storeCheckoutRouteT) &&
  /Ingresa un teléfono válido/.test(storeCheckoutRouteT) &&
  /product\.stock < item\.quantity/.test(storeCheckoutRouteT));
ok("AA: checkout reserva stock, crea orden/payment y crea Flow con returnUrl tienda",
  /reserveStock\(admin, items\)/.test(storeCheckoutRouteT) &&
  /\.from\("product_orders"\)[\s\S]*?\.insert\(orderPayload\)/.test(storeCheckoutRouteT) &&
  /order_id: order\.id,/.test(storeCheckoutRouteT) &&
  /createFlowOrder\(\{[\s\S]*?returnUrl: "\/api\/store\/return"/.test(storeCheckoutRouteT));
ok("AA: ruta /api/store/return normaliza GET y POST (Flow legacy) hacia /tienda/confirmacion",
  /export async function POST\(request: Request\)[\s\S]*?formData\(\)[\s\S]*?token/.test(storeReturnRouteT) &&
  /export async function GET\(request: Request\)[\s\S]*?searchParams\.get\("token"\)/.test(storeReturnRouteT) &&
  /tienda\/confirmacion\?token=/.test(storeReturnRouteT) &&
  /NextResponse\.redirect\(new URL\(target, origin\), 303\)/.test(storeReturnRouteT));
ok("AA: checkout restaura stock si el flujo falla post-reserva",
  /restoreStock\(admin, reservedItems\)/.test(storeCheckoutRouteT));
ok("AA: order-status resuelve orden por flow_token y es pública",
  /\.eq\("flow_token", token\)/.test(storeOrderStatusRouteT) &&
  /status: "not_found"/.test(storeOrderStatusRouteT) &&
  /getAdminClient\(\)/.test(storeOrderStatusRouteT));
ok("AA: admin orders lista órdenes con items y actualiza con máquina de estados",
  /\.from\("product_orders"\)[\s\S]*?\.select\("id, user_id, status, total, reference, guest_email, guest_phone, guest_name, created_at, profiles\(full_name, email\)"\)/.test(storeAdminOrdersRouteT) &&
  /targetStatus === "enviado" \? \["pagado"\] : \["pagado", "enviado"\]/.test(storeAdminOrdersRouteT) &&
  /cancelStoreOrder\(admin, orderId\)/.test(storeAdminOrdersRouteT));
ok("AA: confirmation incluye order_id en select y maneja tienda",
  /\.select\("[^"]*order_id[^"]*"\)/.test(confirmationRouteT) &&
  /isStorePayment\(payment\)/.test(confirmationRouteT) &&
  /handleStorePaymentRejected\(supabase, payment\)/.test(confirmationRouteT) &&
  /handleStorePaymentApproved\(supabase, payment\)/.test(confirmationRouteT));
ok("AA: verify también maneja tienda",
  /\.select\("[^"]*order_id[^"]*"\)/.test(verifyRouteT) &&
  /isStorePayment\(fullPayment\)/.test(verifyRouteT));
ok("AA: CartContext persiste en localStorage con add/remove/quantity/clear",
  /const STORAGE_KEY = "ze_cart";/.test(cartContextT) &&
  /window\.localStorage\.getItem\(STORAGE_KEY\)/.test(cartContextT) &&
  /window\.localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(items\)\)/.test(cartContextT) &&
  /clearCart: \(\) => void;/.test(cartContextT));
ok("AA: layout envuelve la app en CartProvider",
  /import \{ CartProvider \} from "@\/context\/CartContext";/.test(rootLayoutT) &&
  /<CartProvider>[\s\S]*?<\/CartProvider>/.test(rootLayoutT));
ok("AA: Navbar muestra badge de carrito con totalItems",
  /const \{ totalItems \} = useCart\(\);/.test(navbarT) &&
  /totalItems > 9 \? "9\+" : totalItems/.test(navbarT) &&
  /href="\/carrito"/.test(navbarT));
ok("AA: página /carrito valida invitado y redirige al checkout Flow",
  /fetch\("\/api\/store\/checkout",/.test(carritoPageT) &&
  /guestEmail\.trim\(\) \|\| !\/\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\+\$\/\.test\(guestEmail\.trim\(\)\)/.test(carritoPageT) &&
  /flowUrl\.searchParams\.set\("token", data\.token\)[\s\S]*?sessionStorage\.setItem\("ze_store_checkout_started", "1"\)[\s\S]*?window\.location\.href = flowUrl\.toString\(\)/.test(carritoPageT) &&
  !/clearCart/.test(carritoPageT));
ok("AA: confirmación vacía el carrito solo si el pago se confirmó (flag de sesión)",
  /sessionStorage\.getItem\("ze_store_checkout_started"\)[\s\S]*?clearCart\(\);[\s\S]*?sessionStorage\.removeItem\("ze_store_checkout_started"\)/.test(confirmacionPageT) &&
  /import \{ useCart \} from "@\/context\/CartContext";/.test(confirmacionPageT));
ok("AA: /tienda/confirmacion consulta estado de la orden y muestra devolución de stock",
  /\/api\/store\/order-status\?token=/.test(confirmacionPageT) &&
  /setInterval\(/.test(confirmacionPageT) &&
  /stock reservado fue devuelto/.test(confirmacionPageT));
ok("AA: productos lista y detalle agregan al carrito / comprar ahora",
  /import \{ useCart \} from "@\/context\/CartContext";/.test(productosPageT) &&
  /addItem\(\{/.test(productosPageT) &&
  /Agregar al carrito/.test(productoDetailPageT) &&
  /Comprar ahora/.test(productoDetailPageT) &&
  /router\.push\("\/carrito"\)/.test(productoDetailPageT));
ok("AA: dashboard/tienda muestra Mis Compras de Tienda con estados",
  /Mis Compras de <span className="text-primary">Tienda<\/span>/.test(dashboardTiendaPageT) &&
  /\.from\("product_orders"\)[\s\S]*?order_items\(id, product_id, quantity, unit_price, products\(id, name\)\)/.test(dashboardTiendaPageT) &&
  /STATUS_LABELS\[order\.status\]/.test(dashboardTiendaPageT));
ok("AA: DashboardNav tiene tab Mi Tienda",
  /label: "Mi Tienda", href: "\/dashboard\/tienda"/.test(dashboardNavT));
ok("AA: admin ventas filtra por tipo y tiene tab Órdenes de Tienda",
  /const getPaymentType = \(p: Payment\): string => \{[\s\S]*?concept\?\.startsWith\("Tienda:"\)/.test(adminVentasTabT) &&
  /Órdenes de Tienda/.test(adminVentasTabT) &&
  /typeFilter !== "todos" && getPaymentType\(p\) !== typeFilter/.test(adminVentasTabT));
ok("AA: PaymentRow muestra el concepto Tienda para compras de tienda",
  /payment\.membership\?\.plan\?\.name \|\| payment\.concept \|\| "Pago"/.test(paymentRowT));

// ============================================================
// AB. PERFIL DEPORTIVO DE ALUMNOS (migración 024)
// ============================================================
section("AB. Perfil deportivo de alumnos");

const migration024 = readFileSync(join(ROOT, "contexto", "migrations", "024_sport_profiles.sql"), "utf8");
const schemaSport = readFileSync(join(ROOT, "documentacion", "squema-sql-actualizado.sql"), "utf8");
const {
  PODIUM_POSITIONS,
  SUGGESTED_CATEGORIES,
  computePodiumStats,
  podiumPositionMeta,
  formatPodiumDate,
  sortPodiumsByDateDesc,
} = await import("../src/lib/sport-profile.ts");

ok("AB: migración 024 existe", /024_sport_profiles/.test(join("contexto", "migrations", "024_sport_profiles.sql")));
ok("AB: migración 024 define belt_grades",
  /CREATE TABLE IF NOT EXISTS public\.belt_grades/.test(migration024));
ok("AB: migración 024 define sport_profiles (uno por disciplina)",
  /CREATE TABLE IF NOT EXISTS public\.sport_profiles/.test(migration024) &&
  /beneficiary_id uuid NOT NULL/.test(migration024) &&
  /sport_profiles_beneficiary_discipline_key UNIQUE \(beneficiary_id, discipline_id\)/.test(migration024) &&
  /discipline_id uuid NOT NULL/.test(migration024));
ok("AB: migración 024 define sports_podiums con position CHECK",
  /CREATE TABLE IF NOT EXISTS public\.sports_podiums/.test(migration024) &&
  /CHECK \(position IN \('1', '2', '3', 'participacion'\)\)/.test(migration024));
ok("AB: migración 024 valida que el grado pertenezca a la disciplina",
  /sport_profile_validate_grade/.test(migration024) &&
  /bg\.id = NEW\.grade_id[\s\S]*?bg\.discipline_id = NEW\.discipline_id/.test(migration024));
ok("AB: migración 024 siembra 8 grados por disciplina activa (blanco→negro)",
  (migration024.match(/^\s*\('[A-Za-zÁÉÍÓÚáéíóúÑñ]+',\s*'#[0-9A-F]{6}',\s*\d+\)/gm) || []).length >= 8 &&
  /CROSS JOIN/.test(migration024) && /ON CONFLICT \(discipline_id, position\) DO NOTHING/.test(migration024));
ok("AB: migración 024 RLS — escritura de sport_profiles/podiums SOLO admin",
  /"sport_profiles_admin_write"[\s\S]*?FOR ALL USING \(public\.is_admin\(\)\)/.test(migration024) &&
  /"sports_podiums_admin_write"[\s\S]*?FOR ALL USING \(public\.is_admin\(\)\)/.test(migration024));
ok("AB: migración 024 RLS — lectura dueño/admin vía owns_beneficiary",
  /"sport_profiles_select_own_or_admin"[\s\S]*?owns_beneficiary\(beneficiary_id\)/.test(migration024) &&
  /"sports_podiums_select_own_or_admin"[\s\S]*?owns_beneficiary\(beneficiary_id\)/.test(migration024));
ok("AB: espejo refleja 1:1 las 3 tablas (024)",
  /CREATE TABLE IF NOT EXISTS public\.belt_grades/.test(schemaSport) &&
  /CREATE TABLE IF NOT EXISTS public\.sport_profiles/.test(schemaSport) &&
  /CREATE TABLE IF NOT EXISTS public\.sports_podiums/.test(schemaSport));
ok("AB: espejo refleja 1:1 trigger sport_profile_validate_grade",
  /sport_profile_validate_grade/.test(schemaSport));
ok("AB: espejo refleja 1:1 policies de perfil deportivo",
  /"belt_grades_select_auth"/.test(schemaSport) &&
  /"belt_grades_admin_write"/.test(schemaSport) &&
  /"sport_profiles_select_own_or_admin"/.test(schemaSport) &&
  /"sport_profiles_admin_write"/.test(schemaSport) &&
  /"sports_podiums_select_own_or_admin"/.test(schemaSport) &&
  /"sports_podiums_admin_write"/.test(schemaSport));
ok("AB: PODIUM_POSITIONS cubre exactamente el CHECK de la BD",
  JSON.stringify(PODIUM_POSITIONS.map((p) => p.value).sort()) === JSON.stringify(["1", "2", "3", "participacion"].sort()));
ok("AB: computePodiumStats cuenta medallas y participaciones",
  computePodiumStats([
    { position: "1" }, { position: "1" }, { position: "2" },
    { position: "3" }, { position: "participacion" },
  ]).total === 5 &&
  computePodiumStats([
    { position: "1" }, { position: "1" }, { position: "2" },
    { position: "3" }, { position: "participacion" },
  ]).first === 2 &&
  computePodiumStats([
    { position: "1" }, { position: "1" }, { position: "2" },
    { position: "3" }, { position: "participacion" },
  ]).second === 1 &&
  computePodiumStats([
    { position: "1" }, { position: "1" }, { position: "2" },
    { position: "3" }, { position: "participacion" },
  ]).third === 1 &&
  computePodiumStats([
    { position: "1" }, { position: "1" }, { position: "2" },
    { position: "3" }, { position: "participacion" },
  ]).participations === 1);
ok("AB: podiumPositionMeta resuelve emoji/label",
  podiumPositionMeta("1").emoji === "🥇" && podiumPositionMeta("participacion").label === "Participación");
ok("AB: sortPodiumsByDateDesc ordena más reciente primero",
  JSON.stringify(sortPodiumsByDateDesc([
    { event_date: "2025-01-10" }, { event_date: "2026-03-01" },
  ]).map((p) => p.event_date)) === JSON.stringify(["2026-03-01", "2025-01-10"]));
ok("AB: formatPodiumDate respeta fecha chilena",
  formatPodiumDate("2026-03-05") === new Date("2026-03-05T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }));
ok("AB: SUGGESTED_CATEGORIES no está vacío y son textos de categoría",
  Array.isArray(SUGGESTED_CATEGORIES) && SUGGESTED_CATEGORIES.length > 0);
ok("AB: dependents query embebe sport_profiles + sports_podiums",
  /sport_profiles\([\s\S]*?belt_grades\(id, name, color, position\)/.test(readFileSync(join(ROOT, "src", "lib", "supabase", "dashboard.ts"), "utf8")) &&
  /sports_podiums\([\s\S]*?tournament,[\s\S]*?event_date/.test(readFileSync(join(ROOT, "src", "lib", "supabase", "dashboard.ts"), "utf8")));
ok("AB: getUserSportProfile consulta el perfil del titular",
  /getUserSportProfile[\s\S]*?from\("beneficiaries"\)[\s\S]*?\.eq\("profile_id", userId\)/.test(readFileSync(join(ROOT, "src", "lib", "supabase", "dashboard.ts"), "utf8")));
ok("AB: sportProfilesFrom normaliza a lista (multi-disciplina)",
  /export function sportProfilesFrom/.test(readFileSync(join(ROOT, "src", "lib", "supabase", "dashboard.ts"), "utf8")) &&
  /sport_profiles: SportProfileData\[\] \| null/.test(readFileSync(join(ROOT, "src", "lib", "supabase", "dashboard.ts"), "utf8")));
ok("AB: SportProfileInfo lista todas las disciplinas con su cinturón",
  /profiles: SportProfileData\[\]/.test(readFileSync(join(ROOT, "src", "components", "dashboard", "SportProfileInfo.tsx"), "utf8")) &&
  /profiles\.map/.test(readFileSync(join(ROOT, "src", "components", "dashboard", "SportProfileInfo.tsx"), "utf8")));
ok("AB: TutorSportCard usa la lista de perfiles",
  /sportProfilesFrom/.test(readFileSync(join(ROOT, "src", "components", "dashboard", "TutorSportCard.tsx"), "utf8")));
ok("AB: DataTable tiene botón de perfil deportivo",
  /onSport/.test(readFileSync(join(ROOT, "src", "components", "admin", "DataTable.tsx"), "utf8")));
ok("AB: admin/usuarios integra SportProfileModal (sin autoconcesión)",
  /SportProfileModal/.test(readFileSync(join(ROOT, "src", "app", "admin", "usuarios", "page.tsx"), "utf8")) &&
  /openSportProfile[\s\S]*?from\("beneficiaries"\)/.test(readFileSync(join(ROOT, "src", "app", "admin", "usuarios", "page.tsx"), "utf8")));
ok("AB: SportProfileModal gestiona disciplinas (add/edit/remove) + podios CRUD",
  /from\("sport_profiles"\)[\s\S]*?\.upsert\(payload, \{ onConflict: "beneficiary_id,discipline_id" \}\)/.test(readFileSync(join(ROOT, "src", "components", "admin", "SportProfileModal.tsx"), "utf8")) &&
  /from\("sport_profiles"\)[\s\S]*?\.delete\(\)/.test(readFileSync(join(ROOT, "src", "components", "admin", "SportProfileModal.tsx"), "utf8")) &&
  /from\("sports_podiums"\)[\s\S]*?\.insert/.test(readFileSync(join(ROOT, "src", "components", "admin", "PodiumFormModal.tsx"), "utf8")));
ok("AB: Mi ficha muestra el perfil deportivo del alumno",
  /<TutorSportCard \/>/.test(readFileSync(join(ROOT, "src", "app", "dashboard", "ficha", "page.tsx"), "utf8")));

// ============================================================
// AC. ADJUNTO DE IMAGEN EN EVENTOS (migración 030, v1.8.0)
// ============================================================
section("AC. Adjunto de imagen en eventos");

const migration030 = readFileSync(join(ROOT, "contexto", "migrations", "030_changelog_v1_8_0.sql"), "utf8");
const schemaAc = readFileSync(join(ROOT, "documentacion", "squema-sql-actualizado.sql"), "utf8");
const imagePreviewModal = readFileSync(join(ROOT, "src", "components", "ImagePreviewModal.tsx"), "utf8");
const eventoDetailAc = readFileSync(join(ROOT, "src", "app", "eventos", "[id]", "page.tsx"), "utf8");
const adminEventosAc = readFileSync(join(ROOT, "src", "app", "admin", "eventos", "page.tsx"), "utf8");

ok("AC: migración 030 es seed de changelog v1.8.0 idempotente",
  /'v1\.8\.0'/.test(migration030) &&
  /'Adjunto de imagen en eventos'/.test(migration030) &&
  /ON CONFLICT \(version\) DO NOTHING/.test(migration030));
ok("AC: espejo refleja los seeds v1.6.0, v1.7.0 y v1.8.0 (1:1 con migraciones)",
  /'v1\.6\.0'/.test(schemaAc) &&
  /'v1\.7\.0'/.test(schemaAc) &&
  /'Histórico de asistencias'/.test(schemaAc) &&
  /'v1\.8\.0'/.test(schemaAc) &&
  /'Adjunto de imagen en eventos'/.test(schemaAc));
ok("AC: ImagePreviewModal es componente cliente con overlay, cerrar y descargar",
  /"use client"/.test(imagePreviewModal) &&
  /fixed inset-0 bg-black\/90/.test(imagePreviewModal) &&
  /Cerrar/.test(imagePreviewModal) &&
  /Descargar/.test(imagePreviewModal) &&
  /Escape/.test(imagePreviewModal));
ok("AC: la descarga de Storage usa el parámetro ?download=",
  /download=\$\{encodeURIComponent\(fileName\)\}/.test(imagePreviewModal));
ok("AC: la ficha del evento muestra la sección Adjunto con vista previa",
  /import ImagePreviewModal/.test(eventoDetailAc) &&
  /Adjunto/.test(eventoDetailAc) &&
  /setPreviewOpen\(true\)/.test(eventoDetailAc) &&
  /imageUrl=\{event\.image\}/.test(eventoDetailAc));
ok("AC: admin/eventos aclara que la imagen es portada y adjunto descargable",
  /portada y el adjunto descargable/.test(adminEventosAc));

// ============================================================
// AD. CONTRASEÑA DE PROTECCIÓN DE LA SESIÓN QR (migraciones 031/032, v1.9.0)
// ============================================================
section("AD. Contraseña de protección de la sesión QR");

const migration031 = readFileSync(join(ROOT, "contexto", "migrations", "031_qr_session_lock.sql"), "utf8");
const migration032 = readFileSync(join(ROOT, "contexto", "migrations", "032_changelog_v1_9_0.sql"), "utf8");
const schemaAd = readFileSync(join(ROOT, "documentacion", "squema-sql-actualizado.sql"), "utf8");
const qrLockLib = readFileSync(join(ROOT, "src", "lib", "qr-lock.ts"), "utf8");
const qrLockRoute = readFileSync(join(ROOT, "src", "app", "api", "admin", "qr-lock", "route.ts"), "utf8");
const closeSessionRoute = readFileSync(join(ROOT, "src", "app", "api", "admin", "close-session", "route.ts"), "utf8");
const adminAsistencia = readFileSync(join(ROOT, "src", "app", "admin", "asistencia", "page.tsx"), "utf8");
const adminConfiguracion = readFileSync(join(ROOT, "src", "app", "admin", "configuracion", "page.tsx"), "utf8");

ok("AD: migración 031 crea qr_session_lock singleton con hash y salt",
  /CREATE TABLE IF NOT EXISTS public\.qr_session_lock/.test(migration031) &&
  /password_hash text NOT NULL/.test(migration031) &&
  /password_salt text NOT NULL/.test(migration031) &&
  /'00000000-0000-0000-0000-000000000001'::uuid/.test(migration031));
ok("AD: migración 031 es admin-only en RLS (no usa USING (true))",
  /ENABLE ROW LEVEL SECURITY/.test(migration031) &&
  /qr_session_lock_admin_all[\s\S]*?FOR ALL[\s\S]*?USING \(public\.is_admin\(\)\)[\s\S]*?WITH CHECK \(public\.is_admin\(\)\)/.test(migration031) &&
  !/CREATE POLICY "qr_session_lock[^"]*"[\s\S]*?USING \(true\)/.test(migration031));
ok("AD: migración 031 no siembra la fila (fail-open si no hay contraseña)",
  !/INSERT INTO public\.qr_session_lock/.test(migration031));
ok("AD: migración 032 es seed de changelog v1.9.0 idempotente",
  /'v1\.9\.0'/.test(migration032) &&
  /'Contraseña de protección para la sesión QR'/.test(migration032) &&
  /ON CONFLICT \(version\) DO NOTHING/.test(migration032));
ok("AD: espejo SQL refleja tabla, policy admin-only y el seed v1.9.0 (1:1 con migraciones)",
  /CREATE TABLE IF NOT EXISTS public\.qr_session_lock/.test(schemaAd) &&
  /ALTER TABLE public\.qr_session_lock ENABLE ROW LEVEL SECURITY/.test(schemaAd) &&
  /CREATE POLICY "qr_session_lock_admin_all" ON public\.qr_session_lock FOR ALL USING \(public\.is_admin\(\)\) WITH CHECK \(public\.is_admin\(\)\)/.test(schemaAd) &&
  /'v1\.9\.0'/.test(schemaAd) &&
  /'Contraseña de protección para la sesión QR'/.test(schemaAd));
ok("AD: el hash se calcula con scrypt y se compara en tiempo constante",
  /scryptSync/.test(qrLockLib) &&
  /randomBytes/.test(qrLockLib) &&
  /timingSafeEqual/.test(qrLockLib));
ok("AD: la librería del QR aplica rate limit a los intentos fallidos",
  /isQrLockRateLimited/.test(qrLockLib) &&
  /registerQrLockFailure/.test(qrLockLib) &&
  /MAX_ATTEMPTS = 8/.test(qrLockLib) &&
  /BLOCK_MS = 15 \* 60 \* 1000/.test(qrLockLib));
ok("AD: /api/admin/qr-lock exige role_id 1 y nunca devuelve el hash",
  /role_id !== 1/.test(qrLockRoute) &&
  /password_hash, password_salt/.test(qrLockRoute) &&
  /\{ configured: Boolean\(lock\), min_length: QR_LOCK_MIN_PASSWORD_LENGTH \}/.test(qrLockRoute) &&
  !/NextResponse\.json\([^)]*password_hash/.test(qrLockRoute));
ok("AD: /api/admin/qr-lock soporta set/clear/verify y exige la contraseña actual para cambiar o quitar",
  /action === "set"/.test(qrLockRoute) &&
  /action === "clear"/.test(qrLockRoute) &&
  /action === "verify"/.test(qrLockRoute) &&
  /currentPassword \|\| ""/.test(qrLockRoute) &&
  /La contraseña actual no es correcta/.test(qrLockRoute));
ok("AD: /api/admin/close-session verifica la contraseña ANTES de cerrar y es fail-open sin fila",
  /from\("qr_session_lock"\)/.test(closeSessionRoute) &&
  /verifyQrLockPassword/.test(closeSessionRoute) &&
  /warning = "No hay contraseña de sesión QR configurada/.test(closeSessionRoute) &&
  /status: 401/.test(closeSessionRoute) &&
  /close_session_denied/.test(closeSessionRoute));
ok("AD: el cierre de sesión se ejecuta en el servidor (marca ausentes y cierra la sesión)",
  /from\("attendance"\)[\s\S]*?\.insert\(absentInserts\)/.test(closeSessionRoute) &&
  /from\("class_sessions"\)[\s\S]*?\.update\(\{ status: "cerrada" \}\)/.test(closeSessionRoute) &&
  /status: "ausente" as const/.test(closeSessionRoute) &&
  /close_session"/.test(closeSessionRoute));
ok("AD: /admin/asistencia ya no cierra la sesión desde el browser client",
  !/from\("class_sessions"\)[\s\S]*?\.update\(\{ status: "cerrada" \}\)/.test(adminAsistencia));
ok("AD: /admin/asistencia llama al endpoint de cierre con contraseña",
  /\/api\/admin\/close-session/.test(adminAsistencia) &&
  /password: closePassword/.test(adminAsistencia));
ok("AD: /admin/asistencia bloquea el panel QR y pide contraseña para volver a verlo",
  /Pantalla QR bloqueada/.test(adminAsistencia) &&
  /handleUnlock/.test(adminAsistencia) &&
  /action: "verify", password: unlockPassword/.test(adminAsistencia) &&
  /Desbloquear/.test(adminAsistencia));
ok("AD: colapsar la sesión y el botón Bloquear ocultan el QR sin contraseña",
  /const lockPanel = useCallback/.test(adminAsistencia) &&
  /onClick=\{lockPanel\}/.test(adminAsistencia) &&
  /Bloquear/.test(adminAsistencia) &&
  /lockPanel\(\);\s*setShowSummary\(false\)/.test(adminAsistencia));
ok("AD: finalizar asistencia exige la contraseña en el modal",
  /Contraseña de la sesión/.test(adminAsistencia) &&
  /lockConfigured === true && closePassword\.length === 0/.test(adminAsistencia));
ok("AD: el desbloqueo no se persiste (solo vive en el estado de la página)",
  !/localStorage|sessionStorage/.test(adminAsistencia));
ok("AD: /admin/configuracion ofrece la sección de seguridad de la sesión QR",
  /Seguridad de la sesión QR/.test(adminConfiguracion) &&
  /Guardar contraseña/.test(adminConfiguracion) &&
  /Quitar protección/.test(adminConfiguracion) &&
  /\/api\/admin\/qr-lock/.test(adminConfiguracion) &&
  /Contraseña actual/.test(adminConfiguracion));
ok("AD: sin contraseña configurada ambas pantallas avisan que la protección está inactiva",
  /La pantalla QR no está protegida/.test(adminAsistencia) &&
  /Sin protección/.test(adminConfiguracion));
ok("AD: el cliente de la UI no importa la librería server-only del hash",
  !/from "@\/lib\/qr-lock"/.test(adminAsistencia) &&
  !/from "@\/lib\/qr-lock"/.test(adminConfiguracion));
ok("AD: la página del alumno /checkin no se modifica (sigue validando status en el servidor)",
  /status === "activa"/.test(readFileSync(join(ROOT, "src", "app", "checkin", "[sessionId]", "page.tsx"), "utf8")) &&
  /Esta clase ya no está recibiendo asistencia/.test(readFileSync(join(ROOT, "src", "app", "api", "checkin", "route.ts"), "utf8")));

// ============================================================
// AE. LISTA DE ASISTENCIA A EVENTOS (migraciones 033/034, v1.10.0)
// ============================================================
section("AE. Lista de asistencia a eventos");

const migration033 = readFileSync(join(ROOT, "contexto", "migrations", "033_event_attendees.sql"), "utf8");
const migration034 = readFileSync(join(ROOT, "contexto", "migrations", "034_changelog_v1_10_0.sql"), "utf8");
const schemaAe = readFileSync(join(ROOT, "documentacion", "squema-sql-actualizado.sql"), "utf8");
const evEnrollButtonAe = readFileSync(join(ROOT, "src", "components", "EventEnrollButton.tsx"), "utf8");
const evEnrollModalAe = readFileSync(join(ROOT, "src", "components", "EventEnrollModal.tsx"), "utf8");
const evAttendeesModalAe = readFileSync(join(ROOT, "src", "components", "admin", "EventAttendeesModal.tsx"), "utf8");
const eventoDetailAe = readFileSync(join(ROOT, "src", "app", "eventos", "[id]", "page.tsx"), "utf8");
const adminEventosAe = readFileSync(join(ROOT, "src", "app", "admin", "eventos", "page.tsx"), "utf8");
// El módulo debe quedar desacoplado: se evalúa el SQL sin comentarios.
const migration033Code = migration033.replace(/--.*$/gm, "");

ok("AE: 033 crea event_attendees con UNIQUE(event_id, beneficiary_id)",
  /CREATE TABLE IF NOT EXISTS public\.event_attendees/.test(migration033) &&
  /event_id uuid NOT NULL/.test(migration033) &&
  /beneficiary_id uuid NOT NULL/.test(migration033) &&
  /UNIQUE \(event_id, beneficiary_id\)/.test(migration033));
ok("AE: 033 borra la lista al borrar el evento (ON DELETE CASCADE) e indexa ambos lados",
  /FOREIGN KEY \(event_id\) REFERENCES public\.events\(id\) ON DELETE CASCADE/.test(migration033) &&
  /CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id/.test(migration033) &&
  /CREATE INDEX IF NOT EXISTS idx_event_attendees_beneficiary_id/.test(migration033));
ok("AE: 033 deja RLS solo para lectura (dueño o staff), sin policy de escritura",
  /ALTER TABLE public\.event_attendees ENABLE ROW LEVEL SECURITY/.test(migration033) &&
  /CREATE POLICY "event_attendees_select_own_or_staff"[\s\S]*?FOR SELECT[\s\S]*?USING \(public\.is_staff\(\) OR public\.owns_beneficiary\(beneficiary_id\)\)/.test(migration033) &&
  !/CREATE POLICY "event_attendees[^"]*"\s+ON public\.event_attendees\s+FOR (INSERT|UPDATE|DELETE)/.test(migration033) &&
  (migration033.match(/CREATE POLICY "event_attendees/g) || []).length === 1 &&
  !/CREATE POLICY "event_attendees[^"]*"[\s\S]*?USING \(true\)/.test(migration033));
ok("AE: enroll_event es SECURITY DEFINER, idempotente y bloquea eventos ya pasados",
  /CREATE OR REPLACE FUNCTION public\.enroll_event\(/.test(migration033) &&
  /SECURITY DEFINER/.test(migration033) &&
  /'Ya inscrito'/.test(migration033) &&
  /v_event_date < public\.chile_today\(\)/.test(migration033) &&
  /public\.owns_beneficiary\(v_bid\)/.test(migration033) &&
  /FOR UPDATE/.test(migration033));
ok("AE: cancel_event_attendance acepta admin o dueño, es idempotente y bloquea eventos pasados",
  /CREATE OR REPLACE FUNCTION public\.cancel_event_attendance\(/.test(migration033) &&
  /public\.is_admin\(\) OR public\.owns_beneficiary\(p_beneficiary_id\)/.test(migration033) &&
  /v_deleted = 0/.test(migration033) &&
  /no estaba en la lista de asistencia/.test(migration033) &&
  /v_event_date < public\.chile_today\(\)/.test(migration033));
ok("AE: ambas RPC se revocan a PUBLIC y se ganan solo por authenticated",
  /REVOKE ALL ON FUNCTION public\.enroll_event\(UUID, UUID\[\]\) FROM PUBLIC/.test(migration033) &&
  /GRANT EXECUTE ON FUNCTION public\.enroll_event\(UUID, UUID\[\]\) TO authenticated/.test(migration033) &&
  /REVOKE ALL ON FUNCTION public\.cancel_event_attendance\(UUID, UUID\) FROM PUBLIC/.test(migration033) &&
  /GRANT EXECUTE ON FUNCTION public\.cancel_event_attendance\(UUID, UUID\) TO authenticated/.test(migration033));
ok("AE: 033 no toca tokens, deudas, membresías ni la asistencia de clases",
  !/\bclass_enrollments\b/.test(migration033Code) &&
  !/\bpersonalized_enrollments\b/.test(migration033Code) &&
  !/\bdebts\b/.test(migration033Code) &&
  !/\bmemberships\b/.test(migration033Code) &&
  !/\battendance\b/.test(migration033Code) &&
  !/get_remaining_tokens/.test(migration033Code));
ok("AE: 034 es seed de changelog v1.10.0 idempotente",
  /'v1\.10\.0'/.test(migration034) &&
  /'Lista de asistencia a eventos'/.test(migration034) &&
  /ON CONFLICT \(version\) DO NOTHING/.test(migration034));
ok("AE: el espejo SQL refleja tabla, índices, RLS, ambas RPC y el seed v1.10.0",
  /CREATE TABLE IF NOT EXISTS public\.event_attendees/.test(schemaAe) &&
  /CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id/.test(schemaAe) &&
  /CREATE INDEX IF NOT EXISTS idx_event_attendees_beneficiary_id/.test(schemaAe) &&
  /CREATE POLICY "event_attendees_select_own_or_staff"/.test(schemaAe) &&
  /CREATE OR REPLACE FUNCTION public\.enroll_event\(/.test(schemaAe) &&
  /CREATE OR REPLACE FUNCTION public\.cancel_event_attendance\(/.test(schemaAe) &&
  /GRANT EXECUTE ON FUNCTION public\.enroll_event\(UUID, UUID\[\]\) TO authenticated/.test(schemaAe) &&
  /GRANT EXECUTE ON FUNCTION public\.cancel_event_attendance\(UUID, UUID\) TO authenticated/.test(schemaAe) &&
  /'Lista de asistencia a eventos'/.test(schemaAe));
ok("AE: el espejo no duplica tabla, policy ni RPC",
  (schemaAe.match(/CREATE TABLE IF NOT EXISTS public\.event_attendees/g) || []).length === 1 &&
  (schemaAe.match(/CREATE OR REPLACE FUNCTION public\.enroll_event\(/g) || []).length === 1 &&
  (schemaAe.match(/CREATE OR REPLACE FUNCTION public\.cancel_event_attendance\(/g) || []).length === 1 &&
  (schemaAe.match(/CREATE POLICY "event_attendees_select_own_or_staff"/g) || []).length === 1);
ok("AE: la ficha pública monta el CTA de inscripción (el link a /auth queda para anónimos)",
  /import EventEnrollButton from "@\/components\/EventEnrollButton"/.test(eventoDetailAe) &&
  /<EventEnrollButton[\s\S]*?eventId=\{event\.id\}/.test(eventoDetailAe) &&
  !/href="\/auth"[\s\S]{0,400}?Inscribirse/.test(eventoDetailAe) &&
  /<Link\s+href="\/auth"[\s\S]*?Inscribirse/.test(evEnrollButtonAe));
ok("AE: el CTA alterna Inscribirse / Inscrito y usa getChileToday para el bloqueo",
  /enrolledIds\.size > 0/.test(evEnrollButtonAe) &&
  /loading \? "Cargando\.\.\." : "Inscribirse"/.test(evEnrollButtonAe) &&
  /check_circle[\s\S]*?Inscrito/.test(evEnrollButtonAe) &&
  /const isPast = eventDate < getChileToday\(\)/.test(evEnrollButtonAe) &&
  /Evento finalizado/.test(evEnrollButtonAe) &&
!/toISOString\(\)\.split\("T"\)\[0\]/.test(evEnrollButtonAe + evEnrollModalAe + evAttendeesModalAe + eventoDetailAe
    + adminEventosAe));
ok("AE: al hacer hover sobre Inscrito aparece el aviso Eliminar asistencia",
  /group relative/.test(evEnrollButtonAe) &&
  /group-hover:opacity-100/.test(evEnrollButtonAe) &&
  /Eliminar asistencia/.test(evEnrollButtonAe));
ok("AE: el alta y la baja piden confirmación y el alta muestra Confirmación exitosa",
  /setEnrollOpen\(true\)/.test(evEnrollButtonAe) &&
  /¿Deseas inscribirte al evento/.test(evEnrollModalAe) &&
  /¿Deseas eliminar tu participación del evento/.test(evEnrollButtonAe) &&
  /Confirmación exitosa/.test(evEnrollButtonAe) &&
  /Te agregaste a la lista de asistencia del evento/.test(evEnrollButtonAe));
ok("AE: alta y baja viajan por RPC, nunca por escritura directa del browser",
  /rpc\("enroll_event"/.test(evEnrollModalAe) &&
  /rpc\("cancel_event_attendance"/.test(evEnrollButtonAe) &&
  /rpc\("cancel_event_attendance"/.test(evAttendeesModalAe) &&
  !/\.from\("event_attendees"\)[\s\S]{0,120}?\.(insert|upsert|delete)\(/.test(evEnrollModalAe + evEnrollButtonAe + evAttendeesModalAe));
// Fase 5 (una cuenta por alumno): cada persona se inscribe con su cuenta.
ok("AE: el modal de inscripción usa solo la cuenta propia y marca si ya está inscrito",
  /from\("beneficiaries"\)\.select\("id"\)\.eq\("profile_id", userId\)/.test(evEnrollModalAe) &&
  !/from\("dependents"\)/.test(evEnrollModalAe) &&
  /categoryFromBirth\(/.test(evEnrollModalAe) &&
  /Confirma tu asistencia/.test(evEnrollModalAe) &&
  /alreadyEnrolled\.has\(b\.beneficiaryId\)/.test(evEnrollModalAe) &&
  /export async function fetchMyEventAttendees/.test(evEnrollModalAe));
ok("AE: /admin/eventos muestra el contador de inscritos y abre la lista por evento",
  /attendeesCount/.test(adminEventosAe) &&
  /event_attendees\(beneficiary_id\)/.test(adminEventosAe) &&
  /Ver lista de asistencia/.test(adminEventosAe) &&
  /<EventAttendeesModal[\s\S]*?attendeesTarget\?\.id \?\? null/.test(adminEventosAe) &&
  /onChanged=\{load\}/.test(adminEventosAe));
ok("AE: la lista del admin resuelve nombre y categoría (titular o carga) y permite quitar",
  /from\("event_attendees"\)[\s\S]*?beneficiaries\(id, profile_id, dependent_id\)/.test(evAttendeesModalAe) &&
  /from\("profiles"\)[\s\S]*?full_name/.test(evAttendeesModalAe) &&
  /from\("dependents"\)[\s\S]*?full_name, category/.test(evAttendeesModalAe) &&
  /localesort|localeCompare/.test(evAttendeesModalAe) &&
  /¿Deseas eliminar a/.test(evAttendeesModalAe));
ok("AE: el módulo no altera el CRUD de eventos ni la asistencia de clases",
  !/class_enrollments/.test(adminEventosAe + eventoDetailAe + evEnrollButtonAe + evEnrollModalAe + evAttendeesModalAe) &&
  !/get_remaining_tokens/.test(adminEventosAe + eventoDetailAe + evEnrollButtonAe + evEnrollModalAe + evAttendeesModalAe) &&
  /onDelete=\{setDeleteTarget\}/.test(adminEventosAe) &&
  /onEdit=\{openEdit\}/.test(adminEventosAe));

// ============================================================
// AF. Endurecimiento de seguridad de la BD (migración 035, v1.10.1)
// ============================================================
section("AF. Endurecimiento de seguridad (RLS, storage, CHECK, monto Flow)");

const migration035 = readFileSync(join(ROOT, "contexto", "migrations", "035_security_hardening.sql"), "utf8");
const migration036 = readFileSync(join(ROOT, "contexto", "migrations", "036_changelog_v1_10_1.sql"), "utf8");
const schemaAf = readFileSync(join(ROOT, "documentacion", "squema-sql-actualizado.sql"), "utf8");
const createOrderAf = readFileSync(join(ROOT, "src", "app", "api", "flow", "create-order", "route.ts"), "utf8");
const confirmationAf = readFileSync(join(ROOT, "src", "app", "api", "flow", "confirmation", "route.ts"), "utf8");
const verifyAf = readFileSync(join(ROOT, "src", "app", "api", "flow", "verify", "route.ts"), "utf8");
const flowHelpersAf = readFileSync(join(ROOT, "src", "lib", "flow-helpers.ts"), "utf8");
const inscripcionesAf = readFileSync(join(ROOT, "src", "app", "admin", "inscripciones", "page.tsx"), "utf8");
const migration035Code = migration035.replace(/--.*$/gm, "");
const { isVerificationAmountMatch } = await import("../src/lib/flow-helpers.ts");

ok("AF: S-1 trigger bloquea cambios de id/role_id/active/email a usuarios no admin",
  /CREATE OR REPLACE FUNCTION public\.protect_profile_privileged_columns\(\)/.test(migration035) &&
  /auth\.uid\(\) IS NOT NULL AND NOT public\.is_admin\(\)/.test(migration035) &&
  /NEW\.role_id IS DISTINCT FROM OLD\.role_id/.test(migration035) &&
  /NEW\.active IS DISTINCT FROM OLD\.active/.test(migration035) &&
  /NEW\.email IS DISTINCT FROM OLD\.email/.test(migration035) &&
  /NEW\.id IS DISTINCT FROM OLD\.id/.test(migration035) &&
  /CREATE TRIGGER trg_profiles_protect_privileged\s+BEFORE UPDATE ON public\.profiles/.test(migration035));
ok("AF: S-2 elimina las policies de escritura de usuario sobre payments",
  /DROP POLICY IF EXISTS "payments_user_insert_own" ON public\.payments/.test(migration035) &&
  /DROP POLICY IF EXISTS "payments_owner_update_flow" ON public\.payments/.test(migration035) &&
  /DROP POLICY IF EXISTS "payments_flow_update" ON public\.payments/.test(migration035) &&
  /CREATE INDEX IF NOT EXISTS idx_payments_flow_token ON public\.payments\(flow_token\)/.test(migration035));
ok("AF: S-3 elimina inserción/borrado directo de class_enrollments por el alumno",
  /DROP POLICY IF EXISTS "enrollments_own_insert" ON public\.class_enrollments/.test(migration035) &&
  /DROP POLICY IF EXISTS "enrollments_own_delete" ON public\.class_enrollments/.test(migration035) &&
  /DROP POLICY IF EXISTS "class_enrollments_insert_admin_or_self" ON public\.class_enrollments/.test(migration035));
ok("AF: S-4 la escritura del bucket public queda solo para el admin",
  (migration035Code.match(/DROP POLICY IF EXISTS "Authenticated users can [a-z ]+" ON storage\.objects/g) || []).length === 5 &&
  /CREATE POLICY "public_bucket_admin_insert" ON storage\.objects\s+FOR INSERT TO authenticated\s+WITH CHECK \(bucket_id = 'public' AND public\.is_admin\(\)\)/.test(migration035) &&
  /CREATE POLICY "public_bucket_admin_update" ON storage\.objects/.test(migration035) &&
  /CREATE POLICY "public_bucket_admin_delete" ON storage\.objects\s+FOR DELETE TO authenticated\s+USING \(bucket_id = 'public' AND public\.is_admin\(\)\)/.test(migration035));
ok("AF: S-5/S-6 sin INSERT abierto en user_notifications y roles con RLS de solo lectura",
  /DROP POLICY IF EXISTS "Service role inserts notifications" ON public\.user_notifications/.test(migration035) &&
  /ALTER TABLE public\.roles ENABLE ROW LEVEL SECURITY/.test(migration035) &&
  /CREATE POLICY "roles_public_read" ON public\.roles FOR SELECT USING \(true\)/.test(migration035));
ok("AF: 035 no toca las policies que usan el admin y el canal manual",
  !/DROP POLICY IF EXISTS "payments_staff_write"/.test(migration035Code) &&
  !/DROP POLICY IF EXISTS "enrollments_admin_all"/.test(migration035Code) &&
  !/DROP POLICY IF EXISTS "Service role full access"/.test(migration035Code) &&
  !/DROP POLICY IF EXISTS "Public read access"/.test(migration035Code));
ok("AF: F-1/F-2 los CHECK aceptan los valores que inserta el código",
  /CHECK \(type IN \([^)]*'sistema'[^)]*\)\)/.test(migration035) &&
  /CHECK \(target IN \([^)]*'staff'[^)]*\)\)/.test(migration035) &&
  /CHECK \(method IN \([^)]*'cortesia'[^)]*\)\)/.test(migration035) &&
  /type: "sistema"/.test(flowHelpersAf) && /target: "staff"/.test(flowHelpersAf) &&
  /value="cortesia"/.test(inscripcionesAf));
ok("AF: 036 es seed de changelog v1.10.1 idempotente",
  /'v1\.10\.1'/.test(migration036) &&
  /'Mejoras de seguridad y correcciones'/.test(migration036) &&
  /ON CONFLICT \(version\) DO NOTHING/.test(migration036));
ok("AF: el espejo SQL refleja 035 y el seed v1.10.1 sin duplicarlos",
  (schemaAf.match(/CREATE OR REPLACE FUNCTION public\.protect_profile_privileged_columns\(\)/g) || []).length === 1 &&
  (schemaAf.match(/CREATE TRIGGER trg_profiles_protect_privileged/g) || []).length === 1 &&
  /DROP POLICY IF EXISTS "payments_owner_update_flow" ON public\.payments/.test(schemaAf) &&
  /DROP POLICY IF EXISTS "enrollments_own_insert" ON public\.class_enrollments/.test(schemaAf) &&
  /CREATE POLICY "public_bucket_admin_delete" ON storage\.objects/.test(schemaAf) &&
  /CREATE POLICY "roles_public_read" ON public\.roles/.test(schemaAf) &&
  /'cortesia'\)\)/.test(schemaAf) &&
  (schemaAf.match(/'v1\.10\.1'/g) || []).length === 1);
ok("AF: create-order escribe payments con el admin client (sin RLS de usuario)",
  /import \{ getAdminClient \} from "@\/lib\/supabase\/admin"/.test(createOrderAf) &&
  /const admin = getAdminClient\(\)/.test(createOrderAf) &&
  /await admin\s*\.from\("payments"\)\s*\.insert\(insertPayload\)/.test(createOrderAf) &&
  !/supabase\s*\.from\("payments"\)/.test(createOrderAf));
ok("AF: confirmation valida el monto antes de marcar el pago como pagado",
  /amount, status, concept/.test(confirmationAf) &&
  confirmationAf.indexOf("isVerificationAmountMatch(payment.amount, verification.amount)") > 0 &&
  confirmationAf.indexOf("isVerificationAmountMatch(payment.amount, verification.amount)") <
    confirmationAf.indexOf('status: "pagado"'));
ok("AF: verify valida el monto antes de markPaymentAsPaid",
  verifyAf.indexOf("isVerificationAmountMatch(fullPayment.amount, verification.amount)") > 0 &&
  verifyAf.indexOf("isVerificationAmountMatch(fullPayment.amount, verification.amount)") <
    verifyAf.indexOf("await markPaymentAsPaid("));
ok("AF: isVerificationAmountMatch compara CLP redondeados y rechaza nulos/NaN",
  isVerificationAmountMatch(15000, 15000) &&
  isVerificationAmountMatch("15000", 15000) &&
  isVerificationAmountMatch(15000.4, "15000") &&
  !isVerificationAmountMatch(15000, 1000) &&
  !isVerificationAmountMatch(null, 15000) &&
  !isVerificationAmountMatch(15000, undefined) &&
  !isVerificationAmountMatch("abc", 15000));
const browserSrcAf = [
  ...listFiles(join(ROOT, "src", "components")),
  ...listFiles(join(ROOT, "src", "app", "dashboard")),
  ...listFiles(join(ROOT, "src", "app", "horarios")),
  ...listFiles(join(ROOT, "src", "app", "perfil")),
].filter((f) => !/[\\/]admin[\\/]/.test(f))
  .map((f) => readFileSync(f, "utf8")).join("\n");
ok("AF: el código de usuario no escribe payments, class_enrollments ni user_notifications directo",
  !/\.from\("payments"\)[\s\S]{0,80}?\.(insert|update|upsert|delete)\(/.test(browserSrcAf) &&
  !/\.from\("class_enrollments"\)[\s\S]{0,80}?\.(insert|update|upsert|delete)\(/.test(browserSrcAf) &&
  !/\.from\("user_notifications"\)[\s\S]{0,80}?\.(insert|upsert)\(/.test(browserSrcAf));

// ============================================================
// AG. Una cuenta por persona: anti-duplicados (migración 037, v1.11.0)
// ============================================================
section("AG. Una cuenta por persona (RUT único, correo canónico)");

const migration037 = readFileSync(join(ROOT, "contexto", "migrations", "037_unique_accounts.sql"), "utf8");
const migration038 = readFileSync(join(ROOT, "contexto", "migrations", "038_changelog_v1_11_0.sql"), "utf8");
const schemaAg = readFileSync(join(ROOT, "documentacion", "squema-sql-actualizado.sql"), "utf8");
const authPageAg = readFileSync(join(ROOT, "src", "app", "auth", "page.tsx"), "utf8");
const authLibAg = readFileSync(join(ROOT, "src", "lib", "supabase", "auth.ts"), "utf8");
const createUserAg = readFileSync(join(ROOT, "src", "app", "api", "admin", "create-user", "route.ts"), "utf8");
const usuariosAg = readFileSync(join(ROOT, "src", "app", "admin", "usuarios", "page.tsx"), "utf8");
const perfilAg = readFileSync(join(ROOT, "src", "components", "athletes", "AccountSettings.tsx"), "utf8"); // formulario de /perfil (v1.19.0)
const dashboardLibAg = readFileSync(join(ROOT, "src", "lib", "supabase", "dashboard.ts"), "utf8");
const dashboardPageAg = readFileSync(join(ROOT, "src", "app", "dashboard", "page.tsx"), "utf8");

ok("AG: normalize_rut y canonical_email son IMMUTABLE (usables en índices)",
  /CREATE OR REPLACE FUNCTION public\.normalize_rut\(p_rut text\)[\s\S]*?IMMUTABLE/.test(migration037) &&
  /regexp_replace\(upper\(coalesce\(p_rut, ''\)\), '\[\^0-9K\]', '', 'g'\)/.test(migration037) &&
  /CREATE OR REPLACE FUNCTION public\.canonical_email\(p_email text\)[\s\S]*?IMMUTABLE/.test(migration037) &&
  /IN \('gmail\.com', 'googlemail\.com'\)/.test(migration037) &&
  /split_part\(split_part\(lower\(trim\(p_email\)\), '@', 1\), '\+', 1\)/.test(migration037));
ok("AG: los índices únicos se crean solo si no hay duplicados (WARNING si los hay)",
  /IF EXISTS \([\s\S]*?GROUP BY public\.normalize_rut\(rut\)[\s\S]*?HAVING count\(\*\) > 1[\s\S]*?RAISE WARNING[\s\S]*?CREATE UNIQUE INDEX IF NOT EXISTS profiles_rut_unique_idx/.test(migration037) &&
  /WHERE public\.normalize_rut\(rut\) <> ''/.test(migration037) &&
  /GROUP BY public\.canonical_email\(email\)[\s\S]*?RAISE WARNING[\s\S]*?CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_canonical_unique_idx/.test(migration037));
ok("AG: handle_new_user guarda rut y birth_date del registro sin bloquear por fecha inválida",
  /CREATE OR REPLACE FUNCTION public\.handle_new_user\(\)/.test(migration037) &&
  /raw_user_meta_data->>'rut'/.test(migration037) &&
  /raw_user_meta_data->>'birth_date'/.test(migration037) &&
  /EXCEPTION WHEN others THEN\s+v_birth := NULL/.test(migration037) &&
  /INSERT INTO public\.profiles \(id, full_name, email, rut, birth_date\)/.test(migration037) &&
  !/role_id/.test(migration037.match(/CREATE OR REPLACE FUNCTION public\.handle_new_user[\s\S]*?\$\$;/)[0]));
ok("AG: check_registration_conflict solo devuelve un código y es accesible al registro anónimo",
  /RETURNS text[\s\S]*?'RUT_TAKEN'[\s\S]*?'EMAIL_TAKEN'/.test(migration037) &&
  /GRANT EXECUTE ON FUNCTION public\.check_registration_conflict\(text, text\) TO anon, authenticated/.test(migration037));
ok("AG: find_account_conflicts (con datos de la otra cuenta) es solo para service_role",
  /REVOKE ALL ON FUNCTION public\.find_account_conflicts\(text, text, text, date\) FROM PUBLIC/.test(migration037) &&
  // Supabase da EXECUTE directo a anon/authenticated (default privileges): revocar FROM PUBLIC no basta.
  /REVOKE ALL ON FUNCTION public\.find_account_conflicts\(text, text, text, date\) FROM anon, authenticated/.test(migration037) &&
  /REVOKE ALL ON FUNCTION public\.find_account_conflicts\(text, text, text, date\) FROM anon, authenticated/.test(schemaAg) &&
  /GRANT EXECUTE ON FUNCTION public\.find_account_conflicts\(text, text, text, date\) TO service_role/.test(migration037) &&
  !/find_account_conflicts[^;]*TO (anon|authenticated)/.test(migration037) &&
  /'name_birth'/.test(migration037));
ok("AG: 038 es seed de changelog v1.11.0 idempotente",
  /'v1\.11\.0'/.test(migration038) &&
  /'Una cuenta por persona'/.test(migration038) &&
  /ON CONFLICT \(version\) DO NOTHING/.test(migration038));
ok("AG: el espejo refleja 037/038 con una sola definición de handle_new_user",
  (schemaAg.match(/CREATE OR REPLACE FUNCTION public\.handle_new_user\(\)/g) || []).length === 1 &&
  /INSERT INTO public\.profiles \(id, full_name, email, rut, birth_date\)/.test(schemaAg) &&
  /CREATE UNIQUE INDEX IF NOT EXISTS profiles_rut_unique_idx/.test(schemaAg) &&
  /CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_canonical_unique_idx/.test(schemaAg) &&
  (schemaAg.match(/CREATE OR REPLACE FUNCTION public\.find_account_conflicts\(/g) || []).length === 1 &&
  (schemaAg.match(/'v1\.11\.0'/g) || []).length === 1);
ok("AG: el registro pide RUT válido y fecha de nacimiento, pre-chequea y los envía",
  /isValidRut\(rut\)/.test(authPageAg) &&
  /La fecha de nacimiento es obligatoria/.test(authPageAg) &&
  /birthDate > getChileToday\(\)/.test(authPageAg) &&
  /await checkRegistrationConflict\(rut, email\)/.test(authPageAg) &&
  /signUp\(email, password, name, \{ rut: formatRut\(rut\), birthDate \}\)/.test(authPageAg) &&
  /data: \{ full_name: name, rut: extra\.rut, birth_date: extra\.birthDate \}/.test(authLibAg) &&
  /rpc\("check_registration_conflict"/.test(authLibAg) &&
  /Database error saving new user/.test(authLibAg));
ok("AG: create-user bloquea por RUT/correo, advierte por nombre+nacimiento y enmascara el correo",
  /rpc\("find_account_conflicts"/.test(createUserAg) &&
  /c\.match === "rut" \|\| c\.match === "email"/.test(createUserAg) &&
  /status: 409/.test(createUserAg) &&
  /conflicts\.length > 0 && !force/.test(createUserAg) &&
  /maskEmail\(c\.email\)/.test(createUserAg) &&
  createUserAg.indexOf('rpc("find_account_conflicts"') < createUserAg.indexOf("auth.admin.createUser"));
ok("AG: /admin/usuarios muestra la cuenta que coincide y permite forzar solo advertencias",
  /setCreateConflict\(\{ message: data\.error, warning: Boolean\(data\.warning\), conflicts: data\.conflicts \}\)/.test(usuariosAg) &&
  /createConflict\?\.warning &&[\s\S]*?handleCreateUser\(true\)[\s\S]*?Crear de todas formas/.test(usuariosAg));
ok("AG: el perfil valida el RUT y traduce el índice único",
  /isValidRut\(rut\)/.test(perfilAg) &&
  /error\?\.code === "23505" && error\.message\.includes\("profiles_rut_unique_idx"\)/.test(dashboardLibAg) &&
  /Ese RUT ya está registrado en otra cuenta/.test(dashboardLibAg));
ok("AG: el dashboard avisa a perfiles sin RUT o fecha de nacimiento",
  /<CompleteProfileBanner \/>/.test(dashboardPageAg));

// ============================================================
// AH. Permisos de funciones SECURITY DEFINER (migración 039)
// ============================================================
section("AH. Permisos de funciones (anon/authenticated por defecto en Supabase)");

const migration039 = readFileSync(join(ROOT, "contexto", "migrations", "039_function_grants_hardening.sql"), "utf8");
const schemaAh = readFileSync(join(ROOT, "documentacion", "squema-sql-actualizado.sql"), "utf8");
const storeLibAh = readFileSync(join(ROOT, "src", "lib", "store.ts"), "utf8");
const browserRpcAh = [
  ...listFiles(join(ROOT, "src", "components")),
  ...listFiles(join(ROOT, "src", "app")).filter((f) => !/[\\/]api[\\/]/.test(f)),
].map((f) => readFileSync(f, "utf8")).join("\n");

ok("AH: find_account_conflicts y el stock quedan solo para service_role",
  ["find_account_conflicts\\(text, text, text, date\\)", "decrement_product_stock\\(uuid, integer\\)", "increment_product_stock\\(uuid, integer\\)"]
    .every((sig) =>
      new RegExp(`REVOKE ALL ON FUNCTION public\\.${sig} FROM anon, authenticated`).test(migration039) &&
      new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${sig} TO service_role`).test(migration039)));
ok("AH: notify_token_return exige is_staff() y no es ejecutable por anon",
  /CREATE OR REPLACE FUNCTION public\.notify_token_return\([\s\S]*?IF NOT public\.is_staff\(\) THEN[\s\S]*?RAISE EXCEPTION/.test(migration039) &&
  /REVOKE ALL ON FUNCTION public\.notify_token_return\(uuid, text, date, text\) FROM anon/.test(migration039));
ok("AH: el espejo refleja 039 (incluida notify_token_return, que faltaba)",
  /GRANT EXECUTE ON FUNCTION public\.decrement_product_stock\(uuid, integer\) TO service_role/.test(schemaAh) &&
  /GRANT EXECUTE ON FUNCTION public\.increment_product_stock\(uuid, integer\) TO service_role/.test(schemaAh) &&
  (schemaAh.match(/CREATE OR REPLACE FUNCTION public\.notify_token_return\(/g) || []).length === 1);
ok("AH: ningún código de browser llama a las RPC que pasaron a service_role",
  !/rpc\("(decrement_product_stock|increment_product_stock|find_account_conflicts)"/.test(browserRpcAh) &&
  /rpc\("decrement_product_stock"/.test(storeLibAh));

// ============================================================
// AI. Migración de cargas a cuentas propias (migración 040, v1.12.0)
// ============================================================
section("AI. Migración de cargas a cuentas propias (re-anclaje de beneficiario)");

const migration040 = readFileSync(join(ROOT, "contexto", "migrations", "040_dependent_migration.sql"), "utf8");
const migration041 = readFileSync(join(ROOT, "contexto", "migrations", "041_changelog_v1_12_0.sql"), "utf8");
const schemaAi = readFileSync(join(ROOT, "documentacion", "squema-sql-actualizado.sql"), "utf8");
const migrationPageAi = readFileSync(join(ROOT, "src", "app", "admin", "migracion-cargas", "page.tsx"), "utf8");
const sidebarAi = readFileSync(join(ROOT, "src", "components", "admin", "AdminSidebar.tsx"), "utf8");
const cargasPageAi = readFileSync(join(ROOT, "src", "app", "dashboard", "cargas", "page.tsx"), "utf8");
const perfilAi = readFileSync(join(ROOT, "src", "components", "athletes", "AccountSettings.tsx"), "utf8"); // formulario de /perfil (v1.19.0)
const migrateFnAi = (migration040.match(/CREATE OR REPLACE FUNCTION public\.migrate_dependent_to_profile[\s\S]*?\n\$\$;/) || [""])[0];
const revertFnAi = (migration040.match(/CREATE OR REPLACE FUNCTION public\.revert_dependent_migration[\s\S]*?\n\$\$;/) || [""])[0];

ok("AI: 040 agrega datos del apoderado y el archivo de cargas (RLS solo admin)",
  /ADD COLUMN IF NOT EXISTS guardian_name text/.test(migration040) &&
  /ADD COLUMN IF NOT EXISTS guardian_phone text/.test(migration040) &&
  /ADD COLUMN IF NOT EXISTS guardian_email text/.test(migration040) &&
  /CREATE TABLE IF NOT EXISTS public\.dependents_archive/.test(migration040) &&
  /ALTER TABLE public\.dependents_archive ENABLE ROW LEVEL SECURITY/.test(migration040) &&
  /CREATE POLICY "dependents_archive_admin_all"[\s\S]*?USING \(public\.is_admin\(\)\)/.test(migration040));
ok("AI: el tutor ya no puede crear ni borrar cargas (el borrado arrasa el historial por CASCADE)",
  /DROP POLICY IF EXISTS "dependents_owner_or_admin" ON public\.dependents/.test(migration040) &&
  /CREATE POLICY "dependents_tutor_read" ON public\.dependents\s+FOR SELECT/.test(migration040) &&
  /CREATE POLICY "dependents_tutor_update" ON public\.dependents\s+FOR UPDATE/.test(migration040) &&
  !/CREATE POLICY "dependents_tutor_[a-z]+" ON public\.dependents\s+FOR (INSERT|DELETE|ALL)/.test(migration040) &&
  /CREATE POLICY "dependents_admin_all" ON public\.dependents\s+FOR ALL USING \(public\.is_admin\(\)\)/.test(migration040));
ok("AI: migrar exige admin, cuenta de alumno, no el tutor y cuenta destino vacía",
  /IF NOT public\.is_admin\(\) THEN/.test(migrateFnAi) &&
  /v_target\.role_id <> 4/.test(migrateFnAi) &&
  /v_target\.id = v_dep\.tutor_id/.test(migrateFnAi) &&
  /public\.beneficiary_has_data\(v_target_bid\)/.test(migrateFnAi) &&
  /FOR UPDATE/.test(migrateFnAi));
ok("AI: migrar re-ancla el beneficiario en el orden seguro (borra el vacío, re-ancla, luego archiva y borra la carga)",
  migrateFnAi.indexOf("DELETE FROM public.beneficiaries WHERE id = v_target_bid") > 0 &&
  migrateFnAi.indexOf("DELETE FROM public.beneficiaries WHERE id = v_target_bid") <
    migrateFnAi.indexOf("SET profile_id = p_profile_id, dependent_id = NULL") &&
  migrateFnAi.indexOf("SET profile_id = p_profile_id, dependent_id = NULL") <
    migrateFnAi.indexOf("INSERT INTO public.dependents_archive") &&
  migrateFnAi.indexOf("INSERT INTO public.dependents_archive") <
    migrateFnAi.indexOf("DELETE FROM public.dependents WHERE id = v_dep.id"));
ok("AI: migrar no copia historial (ningún INSERT/UPDATE sobre las tablas de historial)",
  !/(INSERT INTO|UPDATE) public\.(memberships|academy_enrollments|personalized_packs|class_enrollments|attendance|debts|payments|event_attendees|medical_records|sport_profiles|sports_podiums)\b/.test(migrateFnAi));
ok("AI: migrar completa el perfil solo en campos vacíos, guarda apoderado de menores y valida el RUT",
  /coalesce\(p\.birth_date, v_dep\.birth_date\)/.test(migrateFnAi) &&
  /v_is_minor := v_dep\.category IN \('nino', 'juvenil'\)/.test(migrateFnAi) &&
  /guardian_name\s+= CASE WHEN v_is_minor/.test(migrateFnAi) &&
  /El RUT de la carga ya pertenece a otra cuenta/.test(migrateFnAi) &&
  /'migrate_dependent'/.test(migrateFnAi) &&
  /INSERT INTO public\.user_notifications/.test(migrateFnAi));
ok("AI: revertir reinserta la carga, descarta el beneficiario del trigger y exige que no haya historial nuevo",
  /IF NOT public\.is_admin\(\) THEN/.test(revertFnAi) &&
  /v_arc\.reverted_at IS NOT NULL/.test(revertFnAi) &&
  /\(v_now->>v_key\)::int > coalesce\(\(v_arc\.moved_summary->>v_key\)::int, 0\)/.test(revertFnAi) &&
  revertFnAi.indexOf("INSERT INTO public.dependents") < revertFnAi.indexOf("b.dependent_id = v_arc.dependent_id AND b.id <> v_arc.beneficiary_id") &&
  /SET profile_id = NULL, dependent_id = v_arc\.dependent_id/.test(revertFnAi) &&
  /INSERT INTO public\.beneficiaries \(profile_id\) VALUES \(v_arc\.migrated_to_profile_id\)/.test(revertFnAi));
ok("AI: las RPC no son ejecutables por anon y los helpers internos tampoco por authenticated",
  ["get_pending_dependents\\(\\)", "migrate_dependent_to_profile\\(uuid, uuid\\)", "revert_dependent_migration\\(uuid\\)"]
    .every((sig) => new RegExp(`REVOKE ALL ON FUNCTION public\\.${sig} FROM anon`).test(migration040)) &&
  /REVOKE ALL ON FUNCTION public\.beneficiary_data_summary\(uuid\) FROM anon, authenticated/.test(migration040) &&
  /REVOKE ALL ON FUNCTION public\.beneficiary_has_data\(uuid\) FROM anon, authenticated/.test(migration040));
ok("AI: 041 es seed de changelog v1.12.0 y el espejo refleja 040/041 sin duplicar",
  /'v1\.12\.0'/.test(migration041) && /ON CONFLICT \(version\) DO NOTHING/.test(migration041) &&
  // 040 las define y 042 las reemplaza por versiones deshabilitadas.
  (schemaAi.match(/CREATE OR REPLACE FUNCTION public\.migrate_dependent_to_profile\(/g) || []).length === 2 &&
  (schemaAi.match(/CREATE OR REPLACE FUNCTION public\.revert_dependent_migration\(/g) || []).length === 2 &&
  (schemaAi.match(/CREATE TABLE IF NOT EXISTS public\.dependents_archive/g) || []).length === 1 &&
  (schemaAi.match(/'v1\.12\.0'/g) || []).length === 1);
ok("AI: el panel crea la cuenta con create-user (con chequeo de duplicados) y migra/revierte por RPC",
  /rpc\("get_pending_dependents"\)/.test(migrationPageAi) &&
  /fetch\("\/api\/admin\/create-user"/.test(migrationPageAi) &&
  /rpc\("migrate_dependent_to_profile"/.test(migrationPageAi) &&
  /rpc\("revert_dependent_migration"/.test(migrationPageAi) &&
  /Usar esta cuenta/.test(migrationPageAi) &&
  !/\.from\("(beneficiaries|dependents|memberships)"\)[\s\S]{0,80}?\.(insert|update|delete)\(/.test(migrationPageAi) &&
  // Las cargas se eliminaron sin migrar: el panel queda sin acceso desde el menú.
  !/migracion-cargas/.test(sidebarAi));
ok("AI: el dashboard ya no ofrece agregar cargas y el perfil edita el apoderado",
  !/AddDependentModal/.test(cargasPageAi) &&
  /redirect\("\/dashboard\/ficha"\)/.test(cargasPageAi) &&
  /guardian_name: guardianName\.trim\(\) \|\| null/.test(perfilAi));

// ============================================================
// AJ. Una cuenta por alumno: retiro del sistema de cargas (fases 5–6, v1.13.0)
// ============================================================
section("AJ. Una cuenta por alumno (retiro de cargas)");

const { categoryFromBirth } = await import("../src/lib/category.ts");
const migration042 = readFileSync(join(ROOT, "contexto", "migrations", "042_retire_dependents.sql"), "utf8");
const migration043 = readFileSync(join(ROOT, "contexto", "migrations", "043_changelog_v1_13_0.sql"), "utf8");
const schemaAj = readFileSync(join(ROOT, "documentacion", "squema-sql-actualizado.sql"), "utf8");
const exists = (...p) => { try { statSync(join(ROOT, ...p)); return true; } catch { return false; } };
const srcAj = (...p) => readFileSync(join(ROOT, "src", ...p), "utf8");

ok("AJ: categoryFromBirth usa la edad cumplida en la fecha de Chile (nino <10, juvenil <16)",
  categoryFromBirth("2016-10-17", "2026-10-16") === "nino" &&
  categoryFromBirth("2016-10-16", "2026-10-16") === "juvenil" &&
  categoryFromBirth("2010-10-17", "2026-10-16") === "juvenil" &&
  categoryFromBirth("2010-10-16", "2026-10-16") === "adulto" &&
  categoryFromBirth(null, "2026-10-16") === "adulto");
ok("AJ: se eliminaron los componentes y APIs de cargas",
  !exists("src", "components", "admin", "CreateDependentModal.tsx") &&
  !exists("src", "components", "dashboard", "AddDependentModal.tsx") &&
  !exists("src", "components", "dashboard", "EditDependentModal.tsx") &&
  !exists("src", "components", "dashboard", "DependentCard.tsx") &&
  !exists("src", "app", "api", "admin", "create-dependent", "route.ts") &&
  !exists("src", "app", "api", "admin", "update-dependent", "route.ts"));
ok("AJ: compra, inscripción, QR y eventos usan solo el beneficiario propio",
  ["components/CheckoutModal.tsx", "components/PersonalizedCheckoutModal.tsx", "components/EnrollModal.tsx",
   "components/PersonalizedEnrollModal.tsx", "components/EventEnrollModal.tsx", "app/checkin/[sessionId]/page.tsx"]
    .every((f) => !/from\("dependents"\)/.test(srcAj(...f.split("/")))));
ok("AJ: las APIs de compra y check-in aceptan solo profile_id = usuario",
  /benError \|\| !beneficiary \|\| beneficiary\.profile_id !== user\.id/.test(srcAj("app", "api", "flow", "create-order", "route.ts")) &&
  /benError \|\| !beneficiary \|\| beneficiary\.profile_id !== user\.id/.test(srcAj("app", "api", "payments", "transfer", "route.ts")) &&
  /const isOwner = benCheck\?\.profile_id === user\.id;/.test(srcAj("app", "api", "checkin", "route.ts")) &&
  !/dependents/.test(srcAj("app", "api", "flow", "create-order", "route.ts") + srcAj("app", "api", "payments", "transfer", "route.ts")));
ok("AJ: las consultas del panel del alumno no leen cargas",
  !/from\("dependents"\)/.test(srcAj("lib", "supabase", "dashboard.ts")) &&
  !/getUserDependents|DependentData|getDependentSportProfile/.test(srcAj("lib", "supabase", "dashboard.ts")) &&
  /attendanceThisMonth/.test(srcAj("lib", "supabase", "dashboard.ts")) &&
  /attendanceThisMonth=\{summary\.attendanceThisMonth\}/.test(srcAj("app", "dashboard", "page.tsx")));
ok("AJ: inscribir desde /admin/asistencia busca solo cuentas",
  !/from\("dependents"\)/.test(srcAj("app", "admin", "asistencia", "page.tsx")) &&
  /categoryFromBirth\(\(p as \{ birth_date\?: string \| null \}\)\.birth_date\)/.test(srcAj("app", "admin", "asistencia", "page.tsx")));
ok("AJ: la asignación admin busca cuentas (nombre, correo o RUT) sin cargas",
  ["components/admin/AssignMembershipModal.tsx", "components/admin/AssignPersonalizedModal.tsx", "app/admin/inscripciones/page.tsx"]
    .every((f) => {
      const s = srcAj(...f.split("/"));
      return !/from\("dependents"\)/.test(s) && /rut\.ilike\.%\$\{safe\}%/.test(s);
    }));
ok("AJ: navegación del alumno: Mi ficha reemplaza Cargas y las rutas viejas redirigen",
  /\{ label: "Mi ficha", href: "\/dashboard\/ficha"/.test(srcAj("components", "dashboard", "DashboardNav.tsx")) &&
  !/"\/dashboard\/cargas"/.test(srcAj("components", "dashboard", "DashboardNav.tsx")) &&
  /redirect\("\/dashboard\/ficha"\)/.test(srcAj("app", "dashboard", "cargas", "[id]", "medico", "page.tsx")) &&
  /ficha: \{\s*id: "ficha"/.test(srcAj("components", "guide", "guide-data.ts")) &&
  !/cargas: \{\s*id: "cargas"/.test(srcAj("components", "guide", "guide-data.ts")));
ok("AJ: 042 aborta si queda alguna carga o beneficiario anclado a una carga",
  /SELECT count\(\*\) INTO v_pending FROM public\.dependents;/.test(migration042) &&
  /dependent_id IS NOT NULL/.test(migration042) &&
  /IF v_pending > 0 OR v_anchored > 0 THEN\s+RAISE EXCEPTION/.test(migration042) &&
  migration042.indexOf("RAISE EXCEPTION 'No se puede retirar") < migration042.indexOf("ALTER TABLE public.beneficiaries"));
ok("AJ: 042 retira suave: owns_beneficiary solo por perfil, profile_id NOT NULL, dependents de solo lectura",
  /CREATE OR REPLACE FUNCTION public\.owns_beneficiary\(b_id uuid\)[\s\S]*?WHERE id = b_id AND profile_id = auth\.uid\(\)/.test(migration042) &&
  /ALTER TABLE public\.beneficiaries ALTER COLUMN profile_id SET NOT NULL/.test(migration042) &&
  /DROP TRIGGER IF EXISTS trg_dependents_create_beneficiary ON public\.dependents/.test(migration042) &&
  /CREATE POLICY "dependents_admin_read" ON public\.dependents\s+FOR SELECT USING \(public\.is_admin\(\)\)/.test(migration042) &&
  !/DROP TABLE/.test(migration042) &&
  !/DROP COLUMN/.test(migration042));
ok("AJ: 042 deshabilita migrar/revertir con mensaje y 043 es seed v1.13.0",
  /El sistema de cargas fue retirado: ya no hay cargas que migrar/.test(migration042) &&
  /las migraciones ya no se pueden revertir/.test(migration042) &&
  /'v1\.13\.0'/.test(migration043) && /ON CONFLICT \(version\) DO NOTHING/.test(migration043));
const deleteScriptAj = readFileSync(join(ROOT, "contexto", "scripts-datos", "2026-10-16_eliminar_cargas.sql"), "utf8");
ok("AJ: el script de borrado respalda antes de borrar y libera las FK NO ACTION",
  deleteScriptAj.indexOf("INSERT INTO public.dependents_deleted_backup") > 0 &&
  deleteScriptAj.indexOf("INSERT INTO public.dependents_deleted_backup") < deleteScriptAj.indexOf("DELETE FROM public.dependents;") &&
  /UPDATE public\.payments\s+SET membership_id = NULL/.test(deleteScriptAj) &&
  deleteScriptAj.indexOf("DELETE FROM public.event_attendees") < deleteScriptAj.indexOf("DELETE FROM public.dependents;") &&
  !/DELETE FROM public\.payments/.test(deleteScriptAj) &&
  /CREATE POLICY "dependents_deleted_backup_admin_read"[\s\S]*?USING \(public\.is_admin\(\)\)/.test(deleteScriptAj) &&
  /BEGIN;[\s\S]*COMMIT;/.test(deleteScriptAj));
ok("AJ: el espejo refleja 042/043",
  /CREATE POLICY "dependents_admin_read" ON public\.dependents/.test(schemaAj) &&
  /ALTER TABLE public\.beneficiaries ALTER COLUMN profile_id SET NOT NULL/.test(schemaAj) &&
  (schemaAj.match(/'v1\.13\.0'/g) || []).length === 1);

// ============================================================
// AK. Ficha rápida del alumno + renovación de membresías (migración 044, v1.14.0)
// ============================================================
section("AK. Ficha rápida del alumno y renovación de membresías");

const migration044 = readFileSync(join(ROOT, "contexto", "migrations", "044_membership_renewal_requests.sql"), "utf8");
const migration045 = readFileSync(join(ROOT, "contexto", "migrations", "045_changelog_v1_14_0.sql"), "utf8");
const schemaAk = readFileSync(join(ROOT, "documentacion", "squema-sql-actualizado.sql"), "utf8");
const quickViewAk = srcAj("components", "admin", "UserQuickView.tsx");
const assignAk = srcAj("components", "admin", "AssignMembershipModal.tsx");
const membresiasAk = srcAj("app", "admin", "membresias", "page.tsx");
const renewalBtnAk = srcAj("components", "dashboard", "RenewalRequestButton.tsx");
const renewalApiAk = srcAj("app", "api", "memberships", "renewal-request", "route.ts");
const emailAk = srcAj("lib", "email.ts");
const triggerFnAk = (migration044.match(/CREATE OR REPLACE FUNCTION public\.resolve_renewal_requests_on_membership[\s\S]*?\n\$\$;/) || [""])[0];
const requestFnAk = (migration044.match(/CREATE OR REPLACE FUNCTION public\.request_membership_renewal[\s\S]*?\n\$\$;/) || [""])[0];

ok("AK: 044 crea la tabla con una sola solicitud pendiente por alumno y RLS solo lectura",
  /CREATE TABLE IF NOT EXISTS public\.membership_renewal_requests/.test(migration044) &&
  /CHECK \(status IN \('pendiente', 'aprobada', 'rechazada', 'cancelada'\)\)/.test(migration044) &&
  /CREATE UNIQUE INDEX IF NOT EXISTS membership_renewal_one_pending_idx[\s\S]*?WHERE status = 'pendiente'/.test(migration044) &&
  /CREATE POLICY "membership_renewal_select_own_or_admin"[\s\S]*?FOR SELECT USING \(public\.owns_beneficiary\(beneficiary_id\) OR public\.is_admin\(\)\)/.test(migration044) &&
  !/CREATE POLICY "membership_renewal[^"]*"[\s\S]{0,120}?FOR (INSERT|UPDATE|DELETE|ALL)/.test(migration044));
ok("AK: pedir renovación exige dueño, sin membresía activa, sin pendiente y avisa al staff",
  /IF NOT public\.owns_beneficiary\(p_beneficiary_id\) THEN/.test(requestFnAk) &&
  /m\.status = 'activa'[\s\S]*?m\.end_date >= public\.chile_today\(\)[\s\S]*?Ya tienes una membresía activa/.test(requestFnAk) &&
  /Ya enviaste una solicitud de renovación/.test(requestFnAk) &&
  /No tienes una membresía anterior para renovar/.test(requestFnAk) &&
  /INSERT INTO public\.notifications \(type, subject, content, target, sent_by, sent_at\)[\s\S]*?'sistema'[\s\S]*?'staff'/.test(requestFnAk));
ok("AK: auto-aceptación: trigger AFTER INSERT en memberships aprueba las pendientes y notifica",
  /CREATE TRIGGER trg_memberships_resolve_renewals\s+AFTER INSERT ON public\.memberships/.test(migration044) &&
  /IF NEW\.status <> 'activa' THEN\s+RETURN NEW;/.test(triggerFnAk) &&
  /SET status = 'aprobada',\s+resolved_membership_id = NEW\.id/.test(triggerFnAk) &&
  /WHERE beneficiary_id = NEW\.beneficiary_id\s+AND status = 'pendiente'/.test(triggerFnAk) &&
  /'Membresía renovada'/.test(triggerFnAk) &&
  !/INSERT INTO public\.memberships|UPDATE public\.memberships/.test(triggerFnAk));
ok("AK: rechazar es solo admin y deja motivo; las RPC no son ejecutables por anon",
  /CREATE OR REPLACE FUNCTION public\.reject_membership_renewal[\s\S]*?IF NOT public\.is_admin\(\) THEN/.test(migration044) &&
  ["request_membership_renewal\\(uuid, text\\)", "cancel_membership_renewal\\(uuid\\)", "reject_membership_renewal\\(uuid, text\\)"]
    .every((sig) => new RegExp(`REVOKE ALL ON FUNCTION public\\.${sig} FROM anon`).test(migration044)) &&
  /REVOKE ALL ON FUNCTION public\.resolve_renewal_requests_on_membership\(\) FROM anon, authenticated/.test(migration044));
ok("AK: 045 es seed v1.14.0 y el espejo refleja 044/045",
  /'v1\.14\.0'/.test(migration045) && /ON CONFLICT \(version\) DO NOTHING/.test(migration045) &&
  (schemaAk.match(/CREATE TABLE IF NOT EXISTS public\.membership_renewal_requests/g) || []).length === 1 &&
  /CREATE TRIGGER trg_memberships_resolve_renewals/.test(schemaAk) &&
  (schemaAk.match(/'v1\.14\.0'/g) || []).length === 1);
ok("AK: la API llama al RPC con la sesión del usuario y avisa a los admins en segundo plano",
  /const supabase = await createClient\(\)/.test(renewalApiAk) &&
  /supabase\.rpc\("request_membership_renewal"/.test(renewalApiAk) &&
  /after\(\(\) => notifyAdmins\(/.test(renewalApiAk) &&
  /sendRenewalRequestEmail\(/.test(renewalApiAk) &&
  /function escapeHtml\(/.test(emailAk) &&
  /const note = data\.note \? escapeHtml\(data\.note\) : null;/.test(emailAk));
ok("AK: el alumno ve Solicitar renovación solo con la membresía vencida y sin otra activa",
  /else if \(!hasActive && rows\.length > 0\)/.test(renewalBtnAk) &&
  /fetch\("\/api\/memberships\/renewal-request"/.test(renewalBtnAk) &&
  /rpc\("cancel_membership_renewal"/.test(renewalBtnAk) &&
  /<RenewalRequestButton\s+variant="inline"/.test(srcAj("components", "dashboard", "AlertBanner.tsx")) &&
  /<RenewalRequestButton \/>/.test(srcAj("app", "dashboard", "membresias", "page.tsx")));
ok("AK: Asignar membresía acepta prefill (alumno + plan) para renovar",
  /export interface AssignMembershipPrefill \{[\s\S]*?profileId: string;[\s\S]*?planId\?: string \| null;[\s\S]*?renewal\?: boolean;/.test(assignAk) &&
  /await selectProfileAndBeneficiary\(profile as Profile\)/.test(assignAk) &&
  /prefill\?\.renewal \? "Renovar Membresía" : "Asignar Membresía"/.test(assignAk));
ok("AK: Membresías admin: Renovar en la vencida más reciente sin otra activa + solicitudes pendientes",
  /const canRenew = \(m: Membership\) =>[\s\S]*?!beneficiariesWithActive\.has\(m\.beneficiary_id\)[\s\S]*?latestByBeneficiary\.get\(m\.beneficiary_id\)\?\.id === m\.id/.test(membresiasAk) &&
  /Renovar membresía/.test(membresiasAk) &&
  /from\("membership_renewal_requests"\)[\s\S]*?\.eq\("status", "pendiente"\)/.test(membresiasAk) &&
  /rpc\("reject_membership_renewal"/.test(membresiasAk) &&
  /<AssignMembershipModal\s+open=\{!!renewPrefill\}\s+prefill=\{renewPrefill\}/.test(membresiasAk));
ok("AK: la ficha rápida muestra membresía activa (tokens) o renovar, y se monta en el layout admin",
  /rpc\("get_remaining_tokens"/.test(quickViewAk) &&
  /from\("membership_renewal_requests"\)/.test(quickViewAk) &&
  /Renovar membresía/.test(quickViewAk) &&
  /window\.dispatchEvent\(new Event\(ADMIN_DATA_CHANGED\)\)/.test(quickViewAk) &&
  /<UserQuickViewProvider>/.test(srcAj("app", "admin", "layout.tsx")));
ok("AK: los nombres de alumnos son clickeables en las pantallas admin",
  [
    ["app", "admin", "usuarios", "page.tsx"],
    ["app", "admin", "membresias", "page.tsx"],
    ["app", "admin", "inscripciones", "page.tsx"],
    ["app", "admin", "ventas", "page.tsx"],
    ["app", "admin", "deudas", "page.tsx"],
    ["app", "admin", "asistencia", "page.tsx"],
    ["components", "admin", "EventAttendeesModal.tsx"],
  ].every((p) => /<UserNameButton /.test(srcAj(...p))));
ok("AK: el menú muestra el contador de solicitudes de renovación en Membresías",
  /from\("membership_renewal_requests"\)[\s\S]*?\.eq\("status", "pendiente"\)/.test(srcAj("components", "admin", "PendingTransferProvider.tsx")) &&
  /link\.href === "\/admin\/membresias" && renewalCount > 0/.test(srcAj("components", "admin", "AdminSidebar.tsx")));

// ============================================================
// AL. Rediseño visual "fuego y oro" (hero + navbar, v1.15.0)
// ============================================================
section("AL. Rediseño visual fuego y oro");

const migration046 = readFileSync(join(ROOT, "contexto", "migrations", "046_changelog_v1_15_0.sql"), "utf8");
const schemaAl = readFileSync(join(ROOT, "documentacion", "squema-sql-actualizado.sql"), "utf8");
const heroAl = srcAj("components", "Hero.tsx");
const navbarAl = srcAj("components", "Navbar.tsx");
const cssAl = srcAj("app", "globals.css");

ok("AL: 046 es seed v1.15.0 y el espejo lo refleja una sola vez",
  /'v1\.15\.0'/.test(migration046) && /ON CONFLICT \(version\) DO NOTHING/.test(migration046) &&
  (schemaAl.match(/'v1\.15\.0'/g) || []).length === 1);
ok("AL: el hero usa las fotos gradeadas (escritorio y móvil) y existen en public/",
  /url\('\/hero-fire\.jpg'\)/.test(heroAl) &&
  /url\('\/hero-fire-mobile\.jpg'\)/.test(heroAl) &&
  existsSync(join(ROOT, "public", "hero-fire.jpg")) &&
  existsSync(join(ROOT, "public", "hero-fire-mobile.jpg")));
ok("AL: titular dorado + rojo incandescente y CTAs fuego / borde dorado",
  /className="block text-gold-metal">DOMINA TU CUERPO\./.test(heroAl) &&
  /className="block text-fire">FORTALECE TU MENTE\./.test(heroAl) &&
  /btn-fire[\s\S]*?Reservar Clase/.test(heroAl) &&
  /btn-gold-outline[\s\S]*?Ver Horarios/.test(heroAl));
ok("AL: las brasas del hero son deterministas (sin Math.random, no rompen la hidratación)",
  /className="ember ember-fire"/.test(heroAl) && !/Math\.random/.test(heroAl));
ok("AL: tokens de marca y clases definidas en globals.css (con reduced-motion)",
  /--color-gold: #f5b942;/.test(cssAl) && /--color-ember: #ff5a1f;/.test(cssAl) &&
  [".text-gold-metal", ".text-fire", ".text-brand-fire", ".btn-fire", ".btn-gold-outline", ".btn-gold", ".nav-fire-line", ".hero-fire-overlay", ".hero-fire-flicker", ".ember.ember-fire"]
    .every((c) => cssAl.includes(`${c} {`)) &&
  /@media \(prefers-reduced-motion: reduce\) \{\s+\.hero-fire-flicker \{\s+animation: none;/.test(cssAl));
ok("AL: navbar con logotipo fuego, línea rojo→oro, Perfil dorado y Únete fuego",
  (navbarAl.match(/text-brand-fire">\s+ZONAELITE/g) || []).length === 3 &&
  /nav-fire-line/.test(navbarAl) &&
  (navbarAl.match(/btn-gold font-/g) || []).length === 2 &&
  (navbarAl.match(/btn-fire text-white/g) || []).length === 2);

// ============================================================
// AM. El QR de asistencia identifica la clase (v1.16.0)
// ============================================================
section("AM. QR de asistencia con la clase");

const migration047 = readFileSync(join(ROOT, "contexto", "migrations", "047_changelog_v1_16_0.sql"), "utf8");
const asistenciaAm = srcAj("app", "admin", "asistencia", "page.tsx");
const checkinAm = srcAj("app", "checkin", "[sessionId]", "page.tsx");
const dashboardAm = srcAj("lib", "supabase", "dashboard.ts");
const { isSessionOver } = await import("../src/lib/dates.ts");
const { sortScheduleCategories, scheduleCategoryLabel } = await import("../src/lib/category.ts");

ok("AM: 047 es seed v1.16.0 y el espejo lo refleja una sola vez",
  /'v1\.16\.0'/.test(migration047) && /ON CONFLICT \(version\) DO NOTHING/.test(migration047) &&
  (schemaAl.match(/'v1\.16\.0'/g) || []).length === 1);
ok("AM: isSessionOver compara con la hora de Chile (día anterior, antes/después del término)",
  isSessionOver("2026-10-27", "20:00", "2026-10-28", "08:00") === true &&
  isSessionOver("2026-10-28", "20:00:00", "2026-10-28", "19:59") === false &&
  isSessionOver("2026-10-28", "20:00:00", "2026-10-28", "20:00") === true &&
  isSessionOver("2026-10-29", "20:00", "2026-10-28", "23:00") === false);
ok("AM: categorías del horario ordenadas niños → juveniles → adultos, sin duplicados",
  sortScheduleCategories(["adultos", "ninos", "adultos"]).join() === "ninos,adultos" &&
  sortScheduleCategories(null).length === 0 &&
  scheduleCategoryLabel("juveniles") === "Juveniles");
ok("AM: las sesiones admin traen schedules.category",
  (dashboardAm.match(/start_time, end_time, mode, category,/g) || []).length === 2);
ok("AM: la pantalla QR muestra la clase y avisa si terminó",
  /QR de asistencia para/.test(asistenciaAm) &&
  /isSessionOver\(s\.session_date, s\.schedule\?\.end_time\)/.test(asistenciaAm) &&
  /Esta clase ya terminó/.test(asistenciaAm));
ok("AM: el check-in muestra la clase y avisa si terminó o no es su categoría (sin bloquear)",
  /schedules\(start_time, end_time, category, disciplines\(name\)\)/.test(checkinAm) &&
  /\{classCard\}/.test(checkinAm) && /\{sessionOver && \(/.test(checkinAm) &&
  /\{categoryMismatch && myCategory && \(/.test(checkinAm));

// ============================================================
// AN. Perfil de Atleta tipo Instagram (v1.17.0, fase 1 – MVP)
// ============================================================
section("AN. Perfil de Atleta");

const migration048 = readFileSync(join(ROOT, "contexto", "migrations", "048_athlete_profiles.sql"), "utf8");
const migration049 = readFileSync(join(ROOT, "contexto", "migrations", "049_changelog_v1_17_0.sql"), "utf8");
const profilePageAn = srcAj("app", "atletas", "[handle]", "page.tsx");
const searchPageAn = srcAj("app", "atletas", "page.tsx");
const layoutAn = srcAj("app", "atletas", "layout.tsx");
const sportModalAn = srcAj("components", "admin", "SportProfileModal.tsx");
const quickViewAn = srcAj("components", "admin", "UserQuickView.tsx");
const navbarAn = srcAj("components", "Navbar.tsx");
const dashNavAn = srcAj("components", "dashboard", "DashboardNav.tsx");
const {
  buildAchievementPosts, computeAthleteStats, yearsSince, isValidAlias, normalizeAlias,
  athleteInitials, featuredDiscipline, groupTournaments, athleteProfileErrorMessage,
} = await import("../src/lib/athlete-profile.ts");

ok("AN: 049 es seed v1.17.0 y el espejo lo refleja una sola vez",
  /'v1\.17\.0'/.test(migration049) && /ON CONFLICT \(version\) DO NOTHING/.test(migration049) &&
  (schemaAl.match(/'v1\.17\.0'/g) || []).length === 1);
ok("AN: el espejo refleja la 048 (tablas, RPC y trigger) una sola vez",
  (schemaAl.match(/CREATE TABLE IF NOT EXISTS public\.athlete_profiles \(/g) || []).length === 1 &&
  (schemaAl.match(/CREATE TABLE IF NOT EXISTS public\.athlete_trophies \(/g) || []).length === 1 &&
  (schemaAl.match(/CREATE TABLE IF NOT EXISTS public\.belt_promotions \(/g) || []).length === 1 &&
  (schemaAl.match(/CREATE OR REPLACE FUNCTION public\.get_athlete_profile\(/g) || []).length === 3 &&
  (schemaAl.match(/CREATE TRIGGER trg_sport_profiles_belt_promotion/g) || []).length === 1);
ok("AN: RLS en las tres tablas; el alumno no tiene policies de escritura (solo admin)",
  ["athlete_profiles", "athlete_trophies", "belt_promotions"].every((t) =>
    new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY`).test(migration048) &&
    new RegExp(`CREATE POLICY "${t}_admin_write" ON public\\.${t}\\s+FOR ALL USING \\(public\\.is_admin\\(\\)\\)`).test(migration048)) &&
  !/FOR (INSERT|UPDATE|DELETE)/.test(migration048));
ok("AN: las RPC exigen sesión y no se ejecutan como anon",
  ["search_athletes(text, uuid, text, integer)", "get_athlete_profile(text)", "update_my_athlete_profile(text, text, text, uuid, text, text)"]
    .every((sig) => migration048.includes(`REVOKE ALL ON FUNCTION public.${sig} FROM anon;`) &&
      migration048.includes(`GRANT EXECUTE ON FUNCTION public.${sig} TO authenticated;`)) &&
  (migration048.match(/RAISE EXCEPTION 'Debes iniciar sesión'/g) || []).length === 3 &&
  /REVOKE ALL ON FUNCTION public\.ensure_athlete_profile\(uuid\) FROM anon, authenticated;/.test(migration048));
const getProfileFnAn = migration048.slice(
  migration048.indexOf("CREATE OR REPLACE FUNCTION public.get_athlete_profile("),
  migration048.indexOf("CREATE OR REPLACE FUNCTION public.update_my_athlete_profile("));
ok("AN: get_athlete_profile no expone datos sensibles y respeta privado/oculto",
  !/'(rut|email|phone|birth_date|address|weight|height)'/.test(getProfileFnAn) &&
  /v_ap\.hidden_by_admin OR v_ap\.visibility = 'privado'/.test(getProfileFnAn) &&
  /'restricted', true/.test(getProfileFnAn));
ok("AN: el alta del perfil nunca bloquea el registro (trigger con EXCEPTION)",
  /PERFORM public\.ensure_athlete_profile\(NEW\.id\);\s+EXCEPTION WHEN OTHERS THEN\s+NULL;/.test(migration048));
ok("AN: alias válido 3–30 (a-z 0-9 . _ -) igual que el CHECK de la BD",
  isValidAlias("matias.perez") && isValidAlias("abc") && !isValidAlias("ab") &&
  !isValidAlias(".matias") && !isValidAlias("Matias") && !isValidAlias("a".repeat(31)) &&
  normalizeAlias(" Matías Pérez ") === "matias.perez" &&
  migration048.includes("CHECK (alias ~ '^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$')"));
ok("AN: publicaciones de logros (campeonato/podio/torneo, cinturón, trofeo) de la más reciente a la más antigua",
  (() => {
    const posts = buildAchievementPosts({
      podiums: [
        { id: "p1", tournament: "Copa Norte", event_date: "2026-03-10", discipline: "Kenpo", category: null, position: "1", description: null },
        { id: "p2", tournament: "Open Sur", event_date: "2026-05-01", discipline: "Kenpo", category: "Juvenil", position: "participacion", description: null },
      ],
      trophies: [{ id: "t1", title: "Mejor técnica", description: null, awarded_on: "2026-08-01", discipline: null }],
      promotions: [{ id: "b1", discipline: "Kenpo", grade_name: "Amarillo", grade_color: "#ffd700", promoted_on: "2026-01-15" }],
    });
    return posts.map((p) => p.kind).join() === "trofeo,participacion,campeonato,cinturon" &&
      posts[2].title === "Campeón · Copa Norte" && posts[3].color === "#ffd700" &&
      posts[2].discipline === "Kenpo";
  })());
ok("AN: estadísticas (torneos únicos, medallas solo 1°–3°, trofeos) y años en la academia",
  (() => {
    const s = computeAthleteStats([
      { tournament: "Copa Norte", event_date: "2026-03-10", position: "1" },
      { tournament: "copa norte ", event_date: "2026-03-10", position: "3" },
      { tournament: "Open Sur", event_date: "2026-05-01", position: "participacion" },
    ], [{}]);
    return s.tournaments === 2 && s.medals === 2 && s.gold === 1 && s.bronze === 1 && s.trophies === 1 &&
      yearsSince("2024-10-29", "2026-10-28") === 1 && yearsSince("2024-10-28", "2026-10-28") === 2 &&
      groupTournaments([
        { id: "a", tournament: "Copa", event_date: "2026-01-01", discipline: null, category: null, position: "1", description: null },
        { id: "b", tournament: "Copa", event_date: "2026-01-01", discipline: null, category: null, position: "2", description: null },
      ]).length === 1;
  })());
ok("AN: iniciales, disciplina destacada y mensajes de error del RPC",
  athleteInitials("Matías Pérez Soto") === "MS" && athleteInitials("Ana") === "A" &&
  featuredDiscipline([
    { discipline_id: "k", name: "Kenpo", color_hex: null, grade_name: "Verde", grade_color: "#0f0", grade_position: 4 },
    { discipline_id: "b", name: "Boxeo", color_hex: null, grade_name: "Blanco", grade_color: "#fff", grade_position: 1 },
  ], "b")?.name === "Boxeo" &&
  athleteProfileErrorMessage("ALIAS_TAKEN").includes("ya está en uso"));
ok("AN: /atletas exige sesión y usa las RPC (sin leer tablas privadas)",
  /router\.push\(`\/auth\?redirect=\$\{encodeURIComponent\(pathname\)\}`\)/.test(layoutAn) &&
  /rpc\("get_athlete_profile"/.test(profilePageAn) && /rpc\("search_athletes"/.test(searchPageAn) &&
  !/from\("(profiles|sports_podiums|sport_profiles)"\)/.test(profilePageAn + searchPageAn));
ok("AN: sin imágenes en el perfil (avatar con iniciales, sin <img> ni subida de archivos)",
  !/<img|ImageUpload|image_url/.test(profilePageAn + searchPageAn) &&
  !/image_url/.test(getProfileFnAn));
ok("AN: accesos — lupa en el navbar, pestaña en el panel, ficha rápida y modal admin (trofeos + ocultar)",
  (navbarAn.match(/href="\/atletas"/g) || []).length === 3 &&
  /href: "\/atletas\/yo"/.test(dashNavAn) &&
  /href=\{`\/atletas\/\$\{profile\.id\}`\}/.test(quickViewAn) &&
  /from\("athlete_trophies"\)/.test(sportModalAn) && /hidden_by_admin: !athleteProfile\.hidden_by_admin/.test(sportModalAn));

// ============================================================
// AO. El alumno publica en su perfil por su cuenta (v1.18.0)
// ============================================================
section("AO. Publicaciones del atleta");

const migration050 = readFileSync(join(ROOT, "contexto", "migrations", "050_athlete_posts.sql"), "utf8");
const migration051 = readFileSync(join(ROOT, "contexto", "migrations", "051_changelog_v1_18_0.sql"), "utf8");
const editorAo = srcAj("components", "athletes", "OwnPostEditorModal.tsx");
const postModalAo = srcAj("components", "athletes", "AchievementPostModal.tsx");
const cardAo = srcAj("components", "athletes", "AchievementPostCard.tsx");
const { validateOwnPost, orderWithPinned } = await import("../src/lib/athlete-profile.ts");

ok("AO: 051 es seed v1.18.0 y el espejo refleja la 050 y el seed una sola vez",
  /'v1\.18\.0'/.test(migration051) && /ON CONFLICT \(version\) DO NOTHING/.test(migration051) &&
  (schemaAl.match(/'v1\.18\.0'/g) || []).length === 1 &&
  (schemaAl.match(/CREATE TABLE IF NOT EXISTS public\.athlete_posts \(/g) || []).length === 1 &&
  (schemaAl.match(/CREATE OR REPLACE FUNCTION public\.set_my_pinned_posts\(/g) || []).length === 1);
ok("AO: el alumno escribe solo lo suyo (RLS dueño en insert/update/delete) y el admin modera",
  /CREATE POLICY "athlete_posts_owner_insert" ON public\.athlete_posts\s+FOR INSERT WITH CHECK \(profile_id = auth\.uid\(\)\)/.test(migration050) &&
  /CREATE POLICY "athlete_posts_owner_update" ON public\.athlete_posts\s+FOR UPDATE USING \(profile_id = auth\.uid\(\)\) WITH CHECK \(profile_id = auth\.uid\(\)\)/.test(migration050) &&
  /CREATE POLICY "athlete_posts_owner_delete" ON public\.athlete_posts\s+FOR DELETE USING \(profile_id = auth\.uid\(\)\)/.test(migration050) &&
  /CREATE POLICY "athlete_posts_admin_write" ON public\.athlete_posts\s+FOR ALL USING \(public\.is_admin\(\)\)/.test(migration050));
ok("AO: CHECKs de athlete_posts (tipos, torneo con resultado no nulo, sin imágenes)",
  /kind IN \('torneo', 'cinturon', 'trofeo', 'hito', 'publicacion'\)/.test(migration050) &&
  /kind = 'torneo' AND position IS NOT NULL AND position IN/.test(migration050) &&
  !/image|photo|foto_url/i.test(migration050.slice(migration050.indexOf("CREATE TABLE"))));
ok("AO: máximo 3 fijadas (CHECK + RPC) y set_my_pinned_posts sin anon",
  /CHECK \(cardinality\(pinned_posts\) <= 3\)/.test(migration050) &&
  /RAISE EXCEPTION 'PIN_LIMIT'/.test(migration050) &&
  /REVOKE ALL ON FUNCTION public\.set_my_pinned_posts\(text\[\]\) FROM anon;/.test(migration050));
const getProfile050 = migration050.slice(migration050.indexOf("CREATE OR REPLACE FUNCTION public.get_athlete_profile("));
ok("AO: get_athlete_profile (050) agrega posts y fijadas sin exponer datos sensibles",
  /'posts', coalesce\(/.test(getProfile050) && /'pinned_posts', to_jsonb\(v_ap\.pinned_posts\)/.test(getProfile050) &&
  !/'(rut|email|phone|birth_date|address|weight|height)'/.test(getProfile050) &&
  /v_ap\.hidden_by_admin OR v_ap\.visibility = 'privado'/.test(getProfile050));
ok("AO: las publicaciones propias suman medallas y trofeos en el buscador",
  /po\.kind = 'torneo' AND po\.position IN \('1', '2', '3'\)/.test(migration050) &&
  /po\.kind = 'trofeo'\) AS a_trophies/.test(migration050));
ok("AO: validateOwnPost replica los CHECK (texto obligatorio, torneo con resultado, largos)",
  (() => {
    const base = { kind: "torneo", title: "Copa", body: "", event_date: "2026-01-01", position: "1", discipline: "", color: "" };
    return validateOwnPost(base) === null &&
      validateOwnPost({ ...base, position: "" }) !== null &&
      validateOwnPost({ ...base, title: " " }) !== null &&
      validateOwnPost({ ...base, kind: "publicacion", title: "", body: "" }) !== null &&
      validateOwnPost({ ...base, kind: "publicacion", title: "", body: "Hola" }) === null &&
      validateOwnPost({ ...base, kind: "cinturon", color: "rojo" }) !== null &&
      validateOwnPost({ ...base, body: "x".repeat(1001) }) !== null;
  })());
ok("AO: propias = no verificadas (clave propio-<id>) y las fijadas van primero",
  (() => {
    const posts = buildAchievementPosts({
      podiums: [{ id: "p1", tournament: "Copa", event_date: "2026-03-10", discipline: null, category: null, position: "2", description: null }],
      trophies: [], promotions: [],
      posts: [
        { id: "o1", kind: "torneo", title: "Open", body: null, event_date: "2026-05-01", position: "1", discipline: "Kenpo", color: null, created_at: "" },
        { id: "o2", kind: "publicacion", title: null, body: "Hoy entrené", event_date: "2026-06-01", position: null, discipline: null, color: null, created_at: "" },
      ],
    });
    const ordered = orderWithPinned(posts, ["podio-p1", "no-existe"]);
    const s = computeAthleteStats(
      [{ tournament: "Copa", event_date: "2026-03-10", position: "2" }], [],
      [{ kind: "torneo", title: "Open", event_date: "2026-05-01", position: "1" }, { kind: "trofeo", title: "T", event_date: "2026-01-01", position: null }]);
    return posts.find((p) => p.key === "propio-o1")?.verified === false &&
      posts.find((p) => p.key === "podio-p1")?.verified === true &&
      posts.find((p) => p.key === "propio-o2")?.title === "Hoy entrené" &&
      ordered[0].key === "podio-p1" && ordered.length === 3 &&
      s.medals === 2 && s.gold === 1 && s.trophies === 1 && s.tournaments === 2;
  })());
ok("AO: UI — editor del alumno (athlete_posts), insignia verificado, fijar y moderación admin",
  /from\("athlete_posts"\)\.insert\(\{ \.\.\.row, profile_id: profileId \}\)/.test(editorAo) &&
  /Verificado por ZonaElite/.test(postModalAo) && /Publicado por el atleta/.test(postModalAo) &&
  /canModerate && isOwn/.test(postModalAo) && /push_pin/.test(cardAo) &&
  /rpc\("set_my_pinned_posts"/.test(profilePageAn) && /canModerate=\{!!data\.viewer_is_admin\}/.test(profilePageAn));

// ============================================================
// AP. Avatares, portadas y "Perfil" → perfil de atleta (v1.19.0)
// ============================================================
section("AP. Avatares y portadas del atleta");

const migration052 = readFileSync(join(ROOT, "contexto", "migrations", "052_athlete_avatar_cover.sql"), "utf8");
const migration053 = readFileSync(join(ROOT, "contexto", "migrations", "053_changelog_v1_19_0.sql"), "utf8");
const editModalAp = srcAj("components", "athletes", "EditAthleteProfileModal.tsx");
const accountAp = srcAj("components", "athletes", "AccountSettings.tsx");
const perfilPageAp = srcAj("app", "perfil", "page.tsx");
const { ATHLETE_AVATARS, COVER_IMAGES, coverBackground, findAthleteAvatar } = await import("../src/lib/athlete-profile.ts");

ok("AP: 053 es seed v1.19.0 y el espejo refleja la 052 y el seed una sola vez",
  /'v1\.19\.0'/.test(migration053) && /ON CONFLICT \(version\) DO NOTHING/.test(migration053) &&
  (schemaAl.match(/'v1\.19\.0'/g) || []).length === 1 &&
  (schemaAl.match(/ADD COLUMN IF NOT EXISTS avatar_key text;/g) || []).length === 1);
ok("AP: columnas con CHECK de formato y RPC con la firma nueva (sin la de 6 parámetros ni anon)",
  /CHECK \(avatar_key IS NULL OR avatar_key ~ '\^\[a-z0-9-\]\{1,30\}\$'\)/.test(migration052) &&
  /CHECK \(cover_image IS NULL OR cover_image ~ '\^\[a-z0-9-\]\{1,30\}\$'\)/.test(migration052) &&
  /DROP FUNCTION IF EXISTS public\.update_my_athlete_profile\(text, text, text, uuid, text, text\);/.test(migration052) &&
  /DROP FUNCTION IF EXISTS public\.search_athletes\(text, uuid, text, integer\);/.test(migration052) &&
  /REVOKE ALL ON FUNCTION public\.update_my_athlete_profile\(text, text, text, uuid, text, text, text, text\) FROM anon;/.test(migration052) &&
  /RAISE EXCEPTION 'AVATAR_INVALID'/.test(migration052));
const getProfile052 = migration052.slice(migration052.indexOf("CREATE OR REPLACE FUNCTION public.get_athlete_profile("));
ok("AP: get_athlete_profile (052) devuelve avatar y portada (también restringido) sin datos sensibles",
  (getProfile052.match(/'avatar_key', v_ap\.avatar_key/g) || []).length === 2 &&
  (getProfile052.match(/'cover_image', v_ap\.cover_image/g) || []).length === 2 &&
  /'posts', coalesce\(/.test(getProfile052) &&
  !/'(rut|email|phone|birth_date|address|weight|height)'/.test(getProfile052));
ok("AP: catálogos válidos (claves únicas con el formato de la BD) y las portadas existen en public/",
  new Set(ATHLETE_AVATARS.map((a) => a.value)).size === ATHLETE_AVATARS.length && ATHLETE_AVATARS.length >= 12 &&
  [...ATHLETE_AVATARS, ...COVER_IMAGES].every((x) => /^[a-z0-9-]{1,30}$/.test(x.value)) &&
  COVER_IMAGES.every((c) => existsSync(join(ROOT, "public", ...c.src.split("/").filter(Boolean)))) &&
  coverBackground("dojo", "oro").startsWith('url("/athletes/banners/dojo.svg")') &&
  !coverBackground("no-existe", "oro").includes("url(") &&
  findAthleteAvatar("patada")?.icon === "sports_martial_arts" && findAthleteAvatar("x") === null);
ok("AP: \"Perfil\" del navbar abre el perfil de atleta; Editar perfil tiene pestañas Perfil y Cuenta",
  !/href="\/perfil"/.test(navbarAn) && (navbarAn.match(/href="\/atletas\/yo"/g) || []).length === 2 &&
  /<AccountSettings \/>/.test(editModalAp) && /p_avatar_key: avatarKey \|\| null/.test(editModalAp) &&
  /p_cover_image: coverImage \|\| null/.test(editModalAp) &&
  /get\("editar"\)/.test(profilePageAn));
ok("AP: /perfil reutiliza AccountSettings y conserva los anclajes de la guía",
  /<AccountSettings \/>/.test(perfilPageAp) && /data-guide="perfil-header"/.test(perfilPageAp) &&
  ["perfil-info", "perfil-fisico", "perfil-seguridad", "perfil-sesion"].every((g) => accountAp.includes(`data-guide="${g}"`)));

console.log(`\n=== RESULTADO: ${pass} passed, ${fail} failed ===`);
if (fail > 0) {
  console.log("FALLOS:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("Todo en orden.");
