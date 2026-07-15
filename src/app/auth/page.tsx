"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp, signIn } from "@/lib/supabase/auth";

type Mode = "login" | "register";
type View = "form" | "register-success" | "forgot-password" | "forgot-success";

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

function validateEmail(email: string): string | undefined {
  if (!email) return "El correo es obligatorio";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Ingresa un correo válido";
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (!password) return "La contraseña es obligatoria";
  if (password.length < 6) return "Mínimo 6 caracteres";
  return undefined;
}

function Spinner() {
  return (
    <svg className="animate-spin inline-block w-5 h-5 mr-2 align-middle" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-[0.25rem] px-4 py-3">
      <span className="material-symbols-outlined text-red-400 text-xl">error</span>
      <p className="font-[family-name:var(--font-body-md)] text-[14px] leading-[20px] text-red-400">
        {message}
      </p>
    </div>
  );
}

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [view, setView] = useState<View>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setErrors({});
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setServerError("");
  };

  const handleLogin = async () => {
    setServerError("");
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    if (emailErr || passErr) {
      setErrors({ email: emailErr, password: passErr });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await signIn(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      console.error("Login error:", err);
      setServerError(err instanceof Error ? err.message : "Ha ocurrido un error.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    console.log("handleRegister called", { email, name, password: password.length });
    setServerError("");
    const newErrors: FormErrors = {};
    if (!name.trim()) newErrors.name = "El nombre es obligatorio";
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    if (emailErr) newErrors.email = emailErr;
    if (passErr) newErrors.password = passErr;
    if (!confirmPassword) newErrors.confirmPassword = "Confirma tu contraseña";
    else if (password !== confirmPassword) newErrors.confirmPassword = "Las contraseñas no coinciden";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      console.log("Validation errors:", newErrors);
      return;
    }

    setLoading(true);
    console.log("Calling signUp...");
    try {
      const result = await signUp(email, password, name);
      console.log("signUp success, result:", result);
      setView("register-success");
    } catch (err: unknown) {
      console.error("Register error:", err);
      setServerError(err instanceof Error ? err.message : "Ha ocurrido un error.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setServerError("");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ email: "Ingresa un correo válido" });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const { resetPassword } = await import("@/lib/supabase/auth");
      await resetPassword(email);
      setView("forgot-success");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Ha ocurrido un error.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field: keyof FormErrors) =>
    `w-full bg-surface-container-low border rounded-[0.25rem] px-4 py-3 text-on-surface font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] placeholder:text-on-surface-variant/50 focus:outline-none transition-all duration-200 ${
      errors[field]
        ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/30"
        : "border-on-surface/10 focus:border-primary focus:ring-2 focus:ring-primary/30"
    }`;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5 py-24">
      <div className="w-full max-w-md">
        {/* Back */}
        <Link href="/" className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors mb-8">
          <span className="material-symbols-outlined text-xl">arrow_back</span>
          <span className="font-[family-name:var(--font-label-sm)] text-[12px] leading-[16px] uppercase tracking-wider">
            Volver al inicio
          </span>
        </Link>

        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-3 mb-10">
          <img src="/logo.png" alt="ZonaElite" className="h-12 w-12 object-contain" />
          <span className="font-[family-name:var(--font-headline-md)] text-[28px] uppercase tracking-tighter text-primary">
            ZONAELITE
          </span>
        </Link>

        {/* Register Success */}
        {view === "register-success" && (
          <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-8 text-center">
            <span className="material-symbols-outlined text-primary text-5xl mb-4">mark_email_read</span>
            <h2 className="font-[family-name:var(--font-headline-md)] text-[24px] text-on-surface uppercase mb-4">
              Registro exitoso
            </h2>
            <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant mb-2">
              Tus datos fueron registrados correctamente.
            </p>
            <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant mb-8">
              Hemos enviado un correo de confirmación a:{" "}
              <span className="text-primary font-semibold">{email}</span>
              <br />
              Revisa tu bandeja de entrada y confirma tu correo para activar tu cuenta.
            </p>
            <button
              type="button"
              onClick={() => { switchMode("login"); setView("form"); }}
              className="w-full btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[16px] py-4 rounded-[0.25rem] uppercase tracking-wider hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-[0_0_20px_rgba(229,57,53,0.3)]"
            >
              Volver al inicio de sesión
            </button>
          </div>
        )}

        {/* Forgot Password Form */}
        {view === "forgot-password" && (
          <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-8">
            <h2 className="font-[family-name:var(--font-headline-md)] text-[24px] text-on-surface uppercase mb-2 text-center">
              Recuperar contraseña
            </h2>
            <p className="font-[family-name:var(--font-body-md)] text-[14px] leading-[20px] text-on-surface-variant text-center mb-6">
              Ingresa tu correo y te enviaremos las instrucciones.
            </p>
            <div className="space-y-5">
              <div>
                <label className="block font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-wider text-[12px] leading-[16px] mb-2">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface-container-low border border-on-surface/10 rounded-[0.25rem] px-4 py-3 text-on-surface font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all duration-200"
                />
              </div>
              {serverError && <ErrorBanner message={serverError} />}
              {errors.email && <ErrorBanner message={errors.email} />}
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                className="w-full btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[16px] py-4 rounded-[0.25rem] uppercase tracking-wider hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-[0_0_20px_rgba(229,57,53,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? <><Spinner />Enviando...</> : "Enviar instrucciones"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => { setView("form"); setServerError(""); }}
              className="w-full mt-4 text-on-surface-variant hover:text-primary font-[family-name:var(--font-label-sm)] text-[12px] uppercase tracking-wider text-center py-2 transition-colors cursor-pointer hover:underline"
            >
              Volver al inicio de sesión
            </button>
          </div>
        )}

        {/* Forgot Password Success */}
        {view === "forgot-success" && (
          <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-8 text-center">
            <span className="material-symbols-outlined text-primary text-5xl mb-4">mark_email_read</span>
            <h2 className="font-[family-name:var(--font-headline-md)] text-[24px] text-on-surface uppercase mb-4">
              Correo enviado
            </h2>
            <p className="font-[family-name:var(--font-body-md)] text-[16px] leading-[24px] text-on-surface-variant mb-8">
              Revisa tu bandeja de entrada en{" "}
              <span className="text-primary font-semibold">{email}</span>{" "}
              para restablecer tu contraseña.
            </p>
            <button
              type="button"
              onClick={() => { switchMode("login"); setView("form"); }}
              className="w-full btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[16px] py-4 rounded-[0.25rem] uppercase tracking-wider hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-[0_0_20px_rgba(229,57,53,0.3)]"
            >
              Volver al inicio de sesión
            </button>
          </div>
        )}

        {/* Toggle */}
        {view === "form" && (
          <>
            <div className="flex bg-surface-container rounded-[0.25rem] p-1 mb-8">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`flex-1 py-3 font-[family-name:var(--font-headline-md)] text-[14px] uppercase tracking-wider rounded-[0.25rem] transition-all duration-200 cursor-pointer ${
                  mode === "login"
                    ? "btn-primary-gradient text-white shadow-[0_0_20px_rgba(229,57,53,0.3)]"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => switchMode("register")}
                className={`flex-1 py-3 font-[family-name:var(--font-headline-md)] text-[14px] uppercase tracking-wider rounded-[0.25rem] transition-all duration-200 cursor-pointer ${
                  mode === "register"
                    ? "btn-primary-gradient text-white shadow-[0_0_20px_rgba(229,57,53,0.3)]"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
                }`}
              >
                Registrarse
              </button>
            </div>

            {/* Form Card */}
            <div className="bg-surface-container border border-on-surface/5 rounded-2xl p-8">
              {mode === "login" ? (
                <div className="space-y-5">
                  <div>
                    <label className="block font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-wider text-[12px] leading-[16px] mb-2">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass("email")}
                    />
                    {errors.email && (
                      <p className="mt-1.5 text-red-400 font-[family-name:var(--font-body-md)] text-[13px] leading-[18px] flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">info</span>
                        {errors.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-wider text-[12px] leading-[16px] mb-2">
                      Contraseña
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputClass("password")}
                    />
                    {errors.password && (
                      <p className="mt-1.5 text-red-400 font-[family-name:var(--font-body-md)] text-[13px] leading-[18px] flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">info</span>
                        {errors.password}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => { setView("forgot-password"); setServerError(""); setEmail(""); }}
                      className="text-primary hover:underline font-[family-name:var(--font-body-md)] text-[14px] cursor-pointer transition-colors"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>

                  {serverError && <ErrorBanner message={serverError} />}

                  <button
                    type="button"
                    onClick={handleLogin}
                    disabled={loading}
                    className="w-full btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[16px] py-4 rounded-[0.25rem] uppercase tracking-wider hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-[0_0_20px_rgba(229,57,53,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {loading ? <><Spinner />Ingresando...</> : "Iniciar Sesión"}
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <label className="block font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-wider text-[12px] leading-[16px] mb-2">
                      Nombre Completo
                    </label>
                    <input
                      type="text"
                      placeholder="Juan Pérez"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputClass("name")}
                    />
                    {errors.name && (
                      <p className="mt-1.5 text-red-400 font-[family-name:var(--font-body-md)] text-[13px] leading-[18px] flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">info</span>
                        {errors.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-wider text-[12px] leading-[16px] mb-2">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass("email")}
                    />
                    {errors.email && (
                      <p className="mt-1.5 text-red-400 font-[family-name:var(--font-body-md)] text-[13px] leading-[18px] flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">info</span>
                        {errors.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-wider text-[12px] leading-[16px] mb-2">
                      Contraseña
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputClass("password")}
                    />
                    {errors.password && (
                      <p className="mt-1.5 text-red-400 font-[family-name:var(--font-body-md)] text-[13px] leading-[18px] flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">info</span>
                        {errors.password}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-[family-name:var(--font-label-sm)] text-on-surface-variant uppercase tracking-wider text-[12px] leading-[16px] mb-2">
                      Confirmar Contraseña
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputClass("confirmPassword")}
                    />
                    {errors.confirmPassword && (
                      <p className="mt-1.5 text-red-400 font-[family-name:var(--font-body-md)] text-[13px] leading-[18px] flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">info</span>
                        {errors.confirmPassword}
                      </p>
                    )}
                  </div>

                  {serverError && <ErrorBanner message={serverError} />}

                  <button
                    type="button"
                    onClick={handleRegister}
                    disabled={loading}
                    className="w-full btn-primary-gradient text-white font-[family-name:var(--font-headline-md)] text-[16px] py-4 rounded-[0.25rem] uppercase tracking-wider hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-[0_0_20px_rgba(229,57,53,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {loading ? <><Spinner />Creando cuenta...</> : "Crear Cuenta"}
                  </button>
                </div>
              )}
            </div>

            {/* Footer text */}
            <p className="text-center mt-6 font-[family-name:var(--font-body-md)] text-[14px] leading-[20px] text-on-surface-variant">
              {mode === "login" ? (
                <>
                  ¿No tienes cuenta?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("register")}
                    className="text-primary hover:underline cursor-pointer transition-colors"
                  >
                    Regístrate aquí
                  </button>
                </>
              ) : (
                <>
                  ¿Ya tienes cuenta?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="text-primary hover:underline cursor-pointer transition-colors"
                  >
                    Inicia sesión
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
