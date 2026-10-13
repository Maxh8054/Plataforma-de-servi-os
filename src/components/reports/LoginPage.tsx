'use client';

import React, { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { 
  LogIn, 
  Loader2, 
  KeyRound, 
  Mail, 
  User,
  Lock,
  ArrowLeft,
  Send,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { PREDEFINED_USERS, ADMIN_EMAIL } from '@/lib/reports-auth';

interface LoginPageProps {
  onSuccess: () => void;
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  
  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Get user name by email
  const getUserName = (email: string) => {
    const user = PREDEFINED_USERS.find(u => u.email === email);
    return user?.name || '';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Email ou senha incorretos');
      } else {
        onSuccess();
      }
    } catch (err) {
      setError('Erro ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPassword = async () => {
    if (!forgotEmail || !currentPassword) {
      setVerifyError('Preencha todos os campos');
      return;
    }

    setIsVerifying(true);
    setVerifyError(null);

    try {
      const response = await fetch('/api/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail,
          currentPassword,
        }),
      });

      const data = await response.json();

      if (data.valid) {
        setPasswordVerified(true);
        setVerifyError(null);
      } else {
        setVerifyError('Senha atual incorreta');
      }
    } catch (err) {
      setVerifyError('Erro ao verificar senha');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSendResetEmail = () => {
    if (!newPassword || !confirmNewPassword) {
      setVerifyError('Preencha todos os campos');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setVerifyError('As senhas não coincidem');
      return;
    }

    if (newPassword.length < 4) {
      setVerifyError('A senha deve ter pelo menos 4 caracteres');
      return;
    }

    const userName = getUserName(forgotEmail);
    const subject = encodeURIComponent(`Solicitação de Redefinição de Senha - ${userName}`);
    const body = encodeURIComponent(
`Olá Max Henrique,

Solicito a redefinição da minha senha de acesso ao sistema Z-Services AI.

DADOS DO USUÁRIO:
Nome: ${userName}
Email: ${forgotEmail}

DADOS DA SOLICITAÇÃO:
Senha Atual: ${currentPassword}
Nova Senha Desejada: ${newPassword}

Aguardo a atualização da senha.

Obrigado(a),
${userName}`
    );

    // Open email client
    window.location.href = `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`;
    
    // Close dialog and reset
    setShowForgotPassword(false);
    setForgotEmail('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordVerified(false);
    setVerifyError(null);
  };

  const resetForgotPassword = () => {
    setShowForgotPassword(false);
    setForgotEmail('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordVerified(false);
    setVerifyError(null);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Cyberpunk background effects */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(to right, #ff6600 1px, transparent 1px),
              linear-gradient(to bottom, #ff6600 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
        {/* Glow effects */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl" />
        {/* Scanline effect */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 2px)',
          }}
        />
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        {/* Glow border effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 via-orange-600 to-orange-500 rounded-lg blur opacity-30" />
        
        <div className="relative bg-gray-900/95 backdrop-blur-sm border border-orange-500/50 rounded-lg p-8 shadow-2xl">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 mb-4 shadow-lg shadow-orange-500/30">
              <Lock className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-wider">
              Z-<span className="text-orange-500">Services</span> AI
            </h1>
            <p className="text-gray-400 mt-2 text-sm">
              Sistema de Relatórios Técnicos
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300 flex items-center gap-2">
                <User className="h-4 w-4 text-orange-500" />
                Usuário
              </Label>
              <select
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-4 bg-gray-800 border border-gray-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-md text-white appearance-none cursor-pointer"
                required
              >
                <option value="">Selecione seu usuário...</option>
                {PREDEFINED_USERS.map((user) => (
                  <option key={user.id} value={user.email}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300 flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-orange-500" />
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 bg-gray-800 border-gray-700 focus:border-orange-500 focus:ring-orange-500 text-white placeholder-gray-500"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-500 text-sm bg-red-500/10 p-3 rounded-md border border-red-500/30">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold tracking-wide shadow-lg shadow-orange-500/30 transition-all"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <LogIn className="h-5 w-5 mr-2" />
                  ENTRAR
                </>
              )}
            </Button>

            {/* Forgot password link */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(true);
                  setForgotEmail(email);
                }}
                className="text-sm text-orange-500 hover:text-orange-400 transition-colors"
              >
                Esqueceu a senha?
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-gray-800 text-center">
            <p className="text-xs text-gray-500">
              © 2024 Zamine Brasil - Departamento de Manutenção
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPassword} onOpenChange={resetForgotPassword}>
        <DialogContent className="max-w-md bg-gray-900 border-orange-500/50">
          <DialogHeader>
            <DialogTitle className="text-xl text-white flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-orange-500" />
              Redefinir Senha
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Solicite a redefinição da sua senha
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* User email */}
            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center gap-2">
                <User className="h-4 w-4 text-orange-500" />
                Usuário
              </Label>
              <select
                value={forgotEmail}
                onChange={(e) => {
                  setForgotEmail(e.target.value);
                  setPasswordVerified(false);
                  setVerifyError(null);
                }}
                className="w-full h-11 px-4 bg-gray-800 border border-gray-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-md text-white appearance-none cursor-pointer"
              >
                <option value="">Selecione seu usuário...</option>
                {PREDEFINED_USERS.map((user) => (
                  <option key={user.id} value={user.email}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Current password */}
            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center gap-2">
                <Lock className="h-4 w-4 text-orange-500" />
                Senha Atual
              </Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="Digite sua senha atual"
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    setPasswordVerified(false);
                    setVerifyError(null);
                  }}
                  className="h-11 bg-gray-800 border-gray-700 focus:border-orange-500 focus:ring-orange-500 text-white"
                />
                <Button
                  onClick={handleVerifyPassword}
                  disabled={isVerifying || !forgotEmail || !currentPassword}
                  className={`h-11 px-4 ${passwordVerified ? 'bg-green-600 hover:bg-green-600' : 'bg-orange-500 hover:bg-orange-600'}`}
                >
                  {isVerifying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : passwordVerified ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    'Verificar'
                  )}
                </Button>
              </div>
            </div>

            {/* New password fields - only show after verification */}
            {passwordVerified && (
              <>
                <div className="space-y-2">
                  <Label className="text-gray-300 flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-orange-500" />
                    Nova Senha
                  </Label>
                  <Input
                    type="password"
                    placeholder="Digite a nova senha"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-11 bg-gray-800 border-gray-700 focus:border-orange-500 focus:ring-orange-500 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300 flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-orange-500" />
                    Confirmar Nova Senha
                  </Label>
                  <Input
                    type="password"
                    placeholder="Confirme a nova senha"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="h-11 bg-gray-800 border-gray-700 focus:border-orange-500 focus:ring-orange-500 text-white"
                  />
                </div>

                {/* Info about email */}
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-md p-3">
                  <p className="text-sm text-gray-300">
                    <Mail className="h-4 w-4 inline mr-2 text-orange-500" />
                    Ao clicar em &quot;Enviar Solicitação&quot;, será aberto seu cliente de email com uma mensagem formatada para <span className="text-orange-500 font-medium">Max Henrique</span> ({ADMIN_EMAIL}).
                  </p>
                </div>
              </>
            )}

            {verifyError && (
              <div className="flex items-center gap-2 text-red-500 text-sm bg-red-500/10 p-3 rounded-md border border-red-500/30">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {verifyError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={resetForgotPassword}
                className="flex-1 h-11 border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              {passwordVerified && (
                <Button
                  onClick={handleSendResetEmail}
                  className="flex-1 h-11 bg-orange-500 hover:bg-orange-600"
                  disabled={!newPassword || !confirmNewPassword}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Solicitação
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
