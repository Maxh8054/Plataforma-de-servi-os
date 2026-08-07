"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Lock,
  Eye,
  EyeOff,
  Key,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  LogOut,
} from "lucide-react";

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
        /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/\`~]/.test(pw),
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
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/\`~]/.test(pw),
];

export default function ForceChangePassword() {
  const user = useAuthStore((s) => s.user);
  const changePassword = useAuthStore((s) => s.changePassword);
  const logout = useAuthStore((s) => s.logout);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const pwdScore = newPassword ? validatePasswordClient(newPassword) : null;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("As senhas nao conferem");
      return;
    }

    if (!pwdScore?.valid) {
      setError("A senha nao atende aos requisitos de seguranca");
      return;
    }

    setLoading(true);
    const result = await changePassword(currentPassword, newPassword);
    setLoading(false);

    if (!result.success) {
      setError(result.error || "Erro ao alterar senha");
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      // Clear the flag so page.tsx shows the main content
      useAuthStore.getState().clearMustChange();
    }, 2000);
  };

  const handleLogout = async () => {
    await logout();
  };

  if (success) {
    return (
      <div className="min-h-screen w-full relative overflow-hidden bg-black/95 flex items-center justify-center">
        <div className="text-center space-y-4 animate-in fade-in duration-500">
          <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Senha alterada!</h2>
          <p className="text-white/60 text-sm">Redirecionando...</p>
        </div>
      </div>
    );
  }

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
      <div className="absolute inset-0 bg-black/60" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-[420px]">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-orange-500/15 flex items-center justify-center border border-orange-500/20">
              <ShieldCheck className="w-8 h-8 text-orange-500" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight drop-shadow-lg">
              Trocar Senha Obrigatoria
            </h1>
            <p className="text-white/60 text-xs sm:text-sm mt-2 drop-shadow max-w-xs mx-auto leading-relaxed">
              Bem-vindo, <span className="text-orange-400 font-medium">{user?.name}</span>! Por seguranca, voce precisa criar uma senha pessoal antes de acessar o sistema.
            </p>
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
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error message */}
              {error && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl text-sm bg-amber-500/15 border border-amber-500/25 text-amber-300">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              {/* Current password */}
              <div className="space-y-1.5">
                <Label htmlFor="current-pw" className="text-white/60 text-xs font-medium">
                  Senha Atual (padrao)
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
                  <Input
                    id="current-pw"
                    type={showCurrent ? "text" : "password"}
                    placeholder="Digite a senha padrao"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    autoFocus
                    autoComplete="current-password"
                    className="pl-9 pr-10 h-11 bg-white/10 border-white/10 text-white text-sm placeholder:text-white/30 focus:border-orange-500/60 focus:ring-orange-500/20 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div className="space-y-1.5">
                <Label htmlFor="new-pw" className="text-white/60 text-xs font-medium">
                  Nova Senha Pessoal
                </Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
                  <Input
                    id="new-pw"
                    type={showNew ? "text" : "password"}
                    placeholder="Crie sua nova senha"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="pl-9 pr-10 h-11 bg-white/10 border-white/10 text-white text-sm placeholder:text-white/30 focus:border-orange-500/60 focus:ring-orange-500/20 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password strength indicator */}
              {newPassword.length > 0 && (
                <div className="space-y-2">
                  <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${strengthColor}`}
                      style={{ width: `${strengthPercent}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {RULE_LABELS.map((label, i) => {
                      const passed = RULE_TESTS[i](newPassword);
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
              )}

              {/* Confirm password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirm-pw" className="text-white/60 text-xs font-medium">
                  Confirmar Nova Senha
                </Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
                  <Input
                    id="confirm-pw"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repita a nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className={`pl-9 pr-10 h-11 bg-white/10 border text-white text-sm placeholder:text-white/30 focus:ring-orange-500/20 rounded-xl ${
                      confirmPassword && confirmPassword !== newPassword
                        ? "border-red-500/50 focus:border-red-500/60"
                        : "border-white/10 focus:border-orange-500/60"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-red-400 text-[11px] mt-1">As senhas nao conferem</p>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={
                  loading ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword ||
                  !pwdScore?.valid ||
                  newPassword !== confirmPassword
                }
                className="w-full bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-semibold h-11 transition-all rounded-xl shadow-lg shadow-orange-600/30"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Alterando...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    Definir Senha Pessoal
                  </div>
                )}
              </Button>
            </form>

            {/* Logout link */}
            <div className="flex items-center justify-center pt-4">
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-red-400 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sair da conta
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-4">
            <p className="text-white/25 text-[10px] sm:text-xs">
              © 2026 Zamine Brasil
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
