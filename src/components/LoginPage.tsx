"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  Key,
  Send,
  ArrowLeft,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  Info,
  X,
  UserPlus,
  ArrowRight,
} from "lucide-react";

function WhatsAppIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function validatePasswordClient(password: string): {
  valid: boolean;
  errors: string[];
  score: number;
} {
  const rules = [
    { test: (pw: string) => pw.length >= 8, error: "Pelo menos 8 caracteres" },
    { test: (pw: string) => /[A-Z]/.test(pw), error: "Pelo menos 1 maiuscula" },
    { test: (pw: string) => /[a-z]/.test(pw), error: "Pelo menos 1 minuscula" },
    { test: (pw: string) => /[0-9]/.test(pw), error: "Pelo menos 1 numero" },
    {
      test: (pw: string) =>
        /[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/`~]/.test(pw),
      error: "Pelo menos 1 especial",
    },
  ];
  const errors: string[] = [];
  let score = 0;
  for (const rule of rules) {
    if (!rule.test(password)) errors.push(rule.error);
    else score++;
  }
  return { valid: errors.length === 0, errors, score };
}

const RULE_LABELS = [
  "Pelo menos 8 caracteres",
  "Pelo menos 1 maiuscula",
  "Pelo menos 1 minuscula",
  "Pelo menos 1 numero",
  "Pelo menos 1 especial",
];

const RULE_TESTS = [
  (pw: string) => pw.length >= 8,
  (pw: string) => /[A-Z]/.test(pw),
  (pw: string) => /[a-z]/.test(pw),
  (pw: string) => /[0-9]/.test(pw),
  (pw: string) =>
    /[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/`~]/.test(pw),
];

// Login step types
interface EmailCheckResult {
  exists: boolean;
  isFirstAccess?: boolean;
  name?: string;
  disabled?: boolean;
  locked?: boolean;
}

type LoginStep =
  | { phase: 'email' }
  | { phase: 'password'; isFirstAccess: false; userName: string }
  | { phase: 'first-access'; userName: string };

type ForgotMode = 'none' | 'forgot' | 'forgot-success' | 'forgot-pending';

export default function LoginPage() {
  const [step, setStep] = useState<LoginStep>({ phase: 'email' });
  const [forgotMode, setForgotMode] = useState<ForgotMode>('none');
  const [showAbout, setShowAbout] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [forgotMessage, setForgotMessage] = useState<{
    type: "success" | "pending" | "error";
    text: string;
  } | null>(null);

  // First access fields
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [firstAccessSuccess, setFirstAccessSuccess] = useState(false);

  // Forgot password fields
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const login = useAuthStore((s) => s.login);
  const forgotPassword = useAuthStore((s) => s.forgotPassword);

  const pwdScore = newPassword ? validatePasswordClient(newPassword) : null;
  const forgotPwdScore = forgotNewPassword ? validatePasswordClient(forgotNewPassword) : null;

  const version = typeof window !== 'undefined' ? (window as any).__APP_VERSION : '';

  // Step 1: Check email
  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setEmailError("");
    setLoginError("");

    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data: EmailCheckResult = await res.json();

      if (data.disabled) {
        setEmailError("Conta desativada. Contate o administrador.");
      } else if (data.locked) {
        setEmailError("Conta temporariamente bloqueada.");
      } else if (!data.exists) {
        setEmailError("Email nao cadastrado no sistema.");
      } else if (data.isFirstAccess) {
        setStep({ phase: 'first-access', userName: data.name || '' });
      } else {
        setStep({ phase: 'password', isFirstAccess: false, userName: data.name || '' });
      }
    } catch {
      setEmailError("Erro ao verificar email.");
    }
    setLoading(false);
  };

  // Step 2a: Normal login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError("");
    const result = await login(email, password);
    setLoading(false);
    if (!result.success) {
      if (result.isFirstAccess) {
        // Server says it's first access - switch to first access step
        setStep({ phase: 'first-access', userName: '' });
      } else {
        setLoginError(result.error || "Erro ao fazer login");
      }
    }
  };

  // Step 2b: First access - set password
  const handleFirstAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdScore?.valid) return;
    if (newPassword !== confirmPassword) {
      setLoginError("As senhas nao conferem.");
      return;
    }
    setLoading(true);
    setLoginError("");

    try {
      const res = await fetch('/api/auth/first-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: newPassword }),
      });
      const json = await res.json();

      if (!res.ok) {
        setLoginError(json.error || "Erro ao definir senha.");
        setLoading(false);
        return;
      }

      setFirstAccessSuccess(true);
      // After 2s, switch to password login
      setTimeout(() => {
        setStep({ phase: 'password', isFirstAccess: false, userName: '' });
        setFirstAccessSuccess(false);
        setNewPassword("");
        setConfirmPassword("");
        setPassword("");
        setLoginError("");
      }, 2000);
    } catch {
      setLoginError("Erro ao definir senha.");
    }
    setLoading(false);
  };

  // Forgot password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPwdScore?.valid) return;
    setLoading(true);
    setForgotMessage(null);
    const result = await forgotPassword(email, forgotNewPassword);
    setLoading(false);
    if (!result.success) {
      setForgotMessage({ type: "error", text: result.error || "Erro ao solicitar" });
      return;
    }
    if (result.alreadyRequested) {
      setForgotMessage({ type: "pending", text: "Ja existe uma solicitacao pendente. Aguarde a aprovacao do administrador." });
      setForgotMode("forgot-pending");
    } else {
      setForgotMessage({ type: "success", text: "Solicitacao enviada! Aguarde aprovacao do administrador." });
      setForgotMode("forgot-success");
    }
    setForgotNewPassword("");
  };

  const goBackToEmail = () => {
    setStep({ phase: 'email' });
    setPassword("");
    setLoginError("");
    setEmailError("");
    setNewPassword("");
    setConfirmPassword("");
    setFirstAccessSuccess(false);
    setForgotMessage(null);
    setForgotMode('none');
    setForgotNewPassword("");
  };

  const goToForgot = () => {
    setForgotMode('forgot');
    setForgotMessage(null);
    setForgotNewPassword("");
  };

  const strengthColor = pwdScore
    ? pwdScore.score <= 2
      ? "bg-red-500"
      : pwdScore.score <= 3
        ? "bg-orange-500"
        : pwdScore.score <= 4
          ? "bg-amber-400"
          : "bg-green-500"
    : "";
  const strengthPercent = pwdScore ? (pwdScore.score / 5) * 100 : 0;

  const forgotStrengthColor = forgotPwdScore
    ? forgotPwdScore.score <= 2
      ? "bg-red-500"
      : forgotPwdScore.score <= 3
        ? "bg-orange-500"
        : forgotPwdScore.score <= 4
          ? "bg-amber-400"
          : "bg-green-500"
    : "";
  const forgotStrengthPercent = forgotPwdScore ? (forgotPwdScore.score / 5) * 100 : 0;

  const renderPasswordRules = (pw: string, score: ReturnType<typeof validatePasswordClient> | null) => {
    if (!pw || !score) return null;
    return (
      <div className="space-y-2.5">
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className={"h-full rounded-full transition-all duration-500 " + (step.phase === 'first-access' ? strengthColor : forgotStrengthColor)}
            style={{ width: `${step.phase === 'first-access' ? strengthPercent : forgotStrengthPercent}%` }}
          />
        </div>
        <div className="grid grid-cols-1 gap-1">
          {RULE_LABELS.map((label, i) => {
            const passed = RULE_TESTS[i](pw);
            return (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                {passed ? (
                  <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                ) : (
                  <XCircle className="w-3 h-3 text-white/20 shrink-0" />
                )}
                <span className={passed ? "text-green-400" : "text-white/40"}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Mobile bg */}
      <div
        className="absolute inset-0 sm:hidden bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(/login-mobile.png)" }}
      />
      {/* Desktop bg */}
      <div
        className="hidden sm:block absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(/login-desktop.png)" }}
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* About Modal */}
      {showAbout && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-md p-3 sm:p-0"
          onClick={() => setShowAbout(false)}
        >
          <div
            className="rounded-2xl p-5 sm:p-6 max-w-md w-full mx-2 sm:mx-4 max-h-[90vh] overflow-y-auto shadow-2xl"
            style={{
              background: "rgba(15, 15, 20, 0.95)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg sm:text-xl font-bold text-orange-500">Sobre o Desenvolvedor</h3>
              <button
                onClick={() => setShowAbout(false)}
                className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                <img
                  src="/images/Desenvolvedor.jpeg"
                  alt="Foto do Desenvolvedor"
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-orange-500 shrink-0"
                />
                <div className="text-center sm:text-left">
                  <p className="text-white/80 text-sm sm:text-base">
                    Desenvolvido por <span className="text-orange-500 font-semibold">Max Henrique</span>, Assistente de Serviços da{" "}
                    <img src="/images/zamine-logo.png" alt="Zamine" className="inline-block h-5 w-auto align-middle mx-1" />
                  </p>
                  <p className="text-white/50 text-xs sm:text-sm mt-1.5 hidden sm:block">
                    Next.js, TypeScript, Prisma, SQLite e Tailwind CSS
                  </p>
                </div>
              </div>
              <p className="text-white/70 text-sm leading-relaxed">
                Plataforma unificada de gestão operacional da Zamine Brasil, cobrindo Minas Gerais, Goiás, Pará, Bahia e Maranhão.
              </p>
              <div
                className="p-4 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <h4 className="text-orange-500 font-semibold mb-3 text-sm">Contato para melhorias ou bugs</h4>
                <a
                  href="mailto:Max-r@zaminebrasil.com"
                  className="flex items-center gap-3 group py-1.5 px-2 -mx-2 rounded-lg transition-colors hover:bg-white/5"
                >
                  <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-orange-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white/40 text-[10px]">Email</p>
                    <p className="text-orange-400 text-sm font-medium group-hover:text-orange-300 underline underline-offset-2 decoration-orange-500/30 group-hover:decoration-orange-400 transition-colors">
                      Max-r@zaminebrasil.com
                    </p>
                  </div>
                </a>
                <a
                  href="https://wa.me/5562982093453"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 group py-1.5 px-2 -mx-2 rounded-lg transition-colors hover:bg-white/5"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center shrink-0">
                    <WhatsAppIcon className="w-4 h-4 text-green-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white/40 text-[10px]">WhatsApp</p>
                    <p className="text-green-400 text-sm font-medium group-hover:text-green-300 underline underline-offset-2 decoration-green-500/30 group-hover:decoration-green-400 transition-colors">
                      (62) 98209-3453
                    </p>
                  </div>
                </a>
              </div>
              <button
                onClick={() => {
                  window.location.href = "mailto:Max-r@zaminebrasil.com?subject=Feedback%20sobre%20o%20sistema&body=Enquanto%20navegava,%20vi%20algo%20que%20gostaria%20de%20reportar";
                  setShowAbout(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-medium text-sm transition-all active:scale-[0.98]"
              >
                <Mail className="w-4 h-4" />
                Enviar Feedback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-[400px]">
          {/* Title */}
          <div className="text-center mb-5 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight drop-shadow-lg">
              Bem-vindo
            </h1>
            <p className="text-white/70 text-xs sm:text-sm mt-1.5 drop-shadow">
              {step.phase === 'email' && 'Insira seu email para continuar'}
              {step.phase === 'password' && `Ola, ${step.userName || ''}`}
              {step.phase === 'first-access' && 'Primeiro acesso - Defina sua senha'}
              {forgotMode !== 'none' && 'Recuperacao de senha'}
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/15 border border-orange-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"/>
              <span className="text-orange-400 text-xs font-bold font-mono tracking-wider">
                v{version}
              </span>
            </div>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl p-5 sm:p-6 shadow-2xl shadow-black/30"
            style={{
              background: "rgba(0, 0, 0, 0.65)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            {/* ============ STEP 1: EMAIL ============ */}
            {step.phase === 'email' && forgotMode === 'none' && (
              <form onSubmit={handleCheckEmail} className="space-y-4">
                {emailError && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl text-sm bg-red-500/15 border border-red-500/25 text-red-300">
                    <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="leading-snug">{emailError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="login-email" className="text-white/60 text-xs font-medium">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      autoFocus
                      className="pl-9 pr-3 h-11 bg-white/10 border-white/10 text-white text-sm placeholder:text-white/30 focus:border-orange-500/60 focus:ring-orange-500/20 rounded-xl"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-semibold h-11 transition-all rounded-xl shadow-lg shadow-orange-600/30"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Verificando...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      Continuar
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </Button>
              </form>
            )}

            {/* ============ STEP 2a: PASSWORD LOGIN ============ */}
            {step.phase === 'password' && forgotMode === 'none' && (
              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <div
                    className={`flex items-start gap-2.5 p-3 rounded-xl text-sm ${
                      loginError.includes("bloqueada")
                        ? "bg-red-500/15 border border-red-500/25 text-red-300"
                        : "bg-amber-500/15 border border-amber-500/25 text-amber-300"
                    }`}
                  >
                    {loginError.includes("bloqueada") ? (
                      <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    )}
                    <span className="leading-snug">{loginError}</span>
                  </div>
                )}

                {/* Show email read-only */}
                <div className="space-y-1.5">
                  <Label className="text-white/40 text-xs font-medium">Email</Label>
                  <div className="flex items-center gap-2 px-3 h-9 rounded-xl bg-white/5 border border-white/5">
                    <Mail className="w-3.5 h-3.5 text-white/30" />
                    <span className="text-white/60 text-sm truncate">{email}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="login-password" className="text-white/60 text-xs font-medium">
                    Senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      autoFocus
                      className="pl-9 pr-10 h-11 bg-white/10 border-white/10 text-white text-sm placeholder:text-white/30 focus:border-orange-500/60 focus:ring-orange-500/20 rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-semibold h-11 transition-all rounded-xl shadow-lg shadow-orange-600/30"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Entrando...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <LogIn className="w-4 h-4" />
                      Entrar
                    </div>
                  )}
                </Button>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={goBackToEmail}
                    className="flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={goToForgot}
                    className="text-xs text-orange-400/80 hover:text-orange-300 transition-colors"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
              </form>
            )}

            {/* ============ STEP 2b: FIRST ACCESS ============ */}
            {step.phase === 'first-access' && forgotMode === 'none' && (
              <>
                {firstAccessSuccess ? (
                  <div className="py-6 text-center space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-green-400" />
                    </div>
                    <p className="text-green-400 font-semibold text-lg">Senha definida!</p>
                    <p className="text-white/50 text-sm">Redirecionando para o login...</p>
                  </div>
                ) : (
                  <form onSubmit={handleFirstAccess} className="space-y-4">
                    {loginError && (
                      <div className="flex items-start gap-2.5 p-3 rounded-xl text-sm bg-red-500/15 border border-red-500/25 text-red-300">
                        <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span className="leading-snug">{loginError}</span>
                      </div>
                    )}

                    {/* Info banner */}
                    <div className="flex items-start gap-2.5 p-3 rounded-xl text-sm bg-blue-500/10 border border-blue-500/20 text-blue-300">
                      <UserPlus className="w-4 h-4 mt-0.5 shrink-0" />
                      <span className="leading-snug">Primeiro acesso! Defina sua senha para entrar no sistema. Nao precisa de aprovacao.</span>
                    </div>

                    {/* Email read-only */}
                    <div className="space-y-1.5">
                      <Label className="text-white/40 text-xs font-medium">Email</Label>
                      <div className="flex items-center gap-2 px-3 h-9 rounded-xl bg-white/5 border border-white/5">
                        <Mail className="w-3.5 h-3.5 text-white/30" />
                        <span className="text-white/60 text-sm truncate">{email}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="new-password" className="text-white/60 text-xs font-medium">
                        Nova Senha
                      </Label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
                        <Input
                          id="new-password"
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Crie sua senha"
                          value={newPassword}
                          onChange={(e) => { setNewPassword(e.target.value); setLoginError(""); }}
                          required
                          autoComplete="new-password"
                          autoFocus
                          className="pl-9 pr-10 h-11 bg-white/10 border-white/10 text-white text-sm placeholder:text-white/30 focus:border-orange-500/60 focus:ring-orange-500/20 rounded-xl"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="confirm-password" className="text-white/60 text-xs font-medium">
                        Confirmar Senha
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
                        <Input
                          id="confirm-password"
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Repita sua senha"
                          value={confirmPassword}
                          onChange={(e) => { setConfirmPassword(e.target.value); setLoginError(""); }}
                          required
                          autoComplete="new-password"
                          className="pl-9 pr-3 h-11 bg-white/10 border-white/10 text-white text-sm placeholder:text-white/30 focus:border-orange-500/60 focus:ring-orange-500/20 rounded-xl"
                        />
                      </div>
                      {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                        <p className="text-red-400 text-[11px] flex items-center gap-1 mt-1">
                          <XCircle className="w-3 h-3" /> As senhas nao conferem
                        </p>
                      )}
                    </div>

                    {renderPasswordRules(newPassword, pwdScore)}

                    <Button
                      type="submit"
                      disabled={loading || !pwdScore?.valid || newPassword !== confirmPassword}
                      className="w-full bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-semibold h-11 transition-all rounded-xl shadow-lg shadow-orange-600/30"
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Definindo...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <UserPlus className="w-4 h-4" />
                          Definir Senha e Entrar
                        </div>
                      )}
                    </Button>

                    <div className="flex items-center justify-center pt-1">
                      <button
                        type="button"
                        onClick={goBackToEmail}
                        className="flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Voltar
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            {/* ============ FORGOT PASSWORD ============ */}
            {forgotMode !== 'none' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                {forgotMessage && (
                  <div
                    className={`flex items-start gap-2.5 p-3 rounded-xl text-sm ${
                      forgotMessage.type === "pending"
                        ? "bg-amber-500/15 border border-amber-500/25 text-amber-300"
                        : forgotMessage.type === "success"
                          ? "bg-green-500/15 border border-green-500/25 text-green-300"
                          : "bg-red-500/15 border border-red-500/25 text-red-300"
                    }`}
                  >
                    {forgotMessage.type === "pending" ? (
                      <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                    ) : forgotMessage.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    )}
                    <span className="leading-snug">{forgotMessage.text}</span>
                  </div>
                )}

                {/* Email read-only */}
                <div className="space-y-1.5">
                  <Label className="text-white/40 text-xs font-medium">Email</Label>
                  <div className="flex items-center gap-2 px-3 h-9 rounded-xl bg-white/5 border border-white/5">
                    <Mail className="w-3.5 h-3.5 text-white/30" />
                    <span className="text-white/60 text-sm truncate">{email}</span>
                  </div>
                </div>

                {(forgotMode === 'forgot') && (
                  <>
                    <div className="flex items-start gap-2.5 p-3 rounded-xl text-sm bg-amber-500/10 border border-amber-500/20 text-amber-300">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span className="leading-snug">A recuperacao de senha precisa de aprovacao do administrador.</span>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="forgot-new-password" className="text-white/60 text-xs font-medium">
                        Nova Senha Desejada
                      </Label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
                        <Input
                          id="forgot-new-password"
                          type={showForgotPassword ? "text" : "password"}
                          placeholder="Nova senha desejada"
                          value={forgotNewPassword}
                          onChange={(e) => setForgotNewPassword(e.target.value)}
                          required
                          autoComplete="new-password"
                          autoFocus
                          className="pl-9 pr-10 h-11 bg-white/10 border-white/10 text-white text-sm placeholder:text-white/30 focus:border-orange-500/60 focus:ring-orange-500/20 rounded-xl"
                        />
                        <button
                          type="button"
                          onClick={() => setShowForgotPassword(!showForgotPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                        >
                          {showForgotPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {renderPasswordRules(forgotNewPassword, forgotPwdScore)}

                    <Button
                      type="submit"
                      disabled={loading || !email || !forgotPwdScore?.valid}
                      className="w-full bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-semibold h-11 transition-all rounded-xl shadow-lg shadow-orange-600/30"
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Enviando...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Send className="w-4 h-4" />
                          Solicitar Troca de Senha
                        </div>
                      )}
                    </Button>
                  </>
                )}

                <div className="flex items-center justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode('none');
                      setForgotMessage(null);
                      setForgotNewPassword("");
                    }}
                    className="flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Voltar ao login
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Footer with Sobre button */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-white/25 text-[10px] sm:text-xs flex items-center gap-1.5">
              &copy; 2026 Zamine Brasil
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 font-mono text-[10px] sm:text-xs border border-orange-500/30 font-semibold">
                v{version}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setShowAbout(true)}
              className="flex items-center gap-1.5 text-white/40 hover:text-orange-400 transition-colors"
            >
              <Info className="w-3.5 h-3.5" />
              <span className="text-[10px] sm:text-xs font-medium">Sobre</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
