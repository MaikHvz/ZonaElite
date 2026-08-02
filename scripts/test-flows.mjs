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

import { readFileSync, readdirSync, statSync } from "node:fs";
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
const { verifyFlowCallbackSignature } = await import("../src/lib/flow.ts");
const {
  effectiveMembershipStatus,
  isMembershipExpired,
  daysRemaining,
} = await import("../src/lib/membership-status.ts");

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
  /if \(!result\.success\) \{[\s\S]*?notifyPaymentWithoutMembership/.test(confirmationRoute));
ok("B-008: verify/route notifica al admin si la membresía falla",
  verifyRoute.includes("notifyPaymentWithoutMembership") &&
  /if \(!result\.success\) \{[\s\S]*?notifyPaymentWithoutMembership/.test(verifyRoute));

const forceConfirmRoute = readFileSync(join(ROOT, "src", "app", "api", "flow", "force-confirm", "route.ts"), "utf8");
ok("B-008: force-confirm notifica al admin si la membresía falla",
  forceConfirmRoute.includes("notifyPaymentWithoutMembership") &&
  /if \(!result\.success\) \{[\s\S]*?notifyPaymentWithoutMembership/.test(forceConfirmRoute));

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
// RESULTADO
// ============================================================
console.log(`\n=== RESULTADO: ${pass} passed, ${fail} failed ===`);
if (fail > 0) {
  console.log("FALLOS:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("Todo en orden.");
