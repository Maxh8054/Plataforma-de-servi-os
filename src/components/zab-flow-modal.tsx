"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch, Plus, Filter, Search, User, Bell, Clock,
  AlertCircle, CheckCircle2, Loader2, ChevronDown,
  Trash2, Edit, Send, X, Award, Star, Flame, Crown,
  MessageSquare, ArrowRight, Tag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────
interface ZabDemanda {
  id: number;
  funcionarioId: number;
  nomeFuncionario: string;
  emailFuncionario: string;
  categoria: string;
  prioridade: string;
  complexidade: string;
  descricao: string;
  local: string;
  dataCriacao: string;
  dataLimite: string;
  status: string;
  isRotina: number;
  diasSemana: string | null;
  tag: string | null;
  comentarios: string | null;
  comentarioGestor: string | null;
  dataConclusao: string | null;
  atribuidos: string;
  createdAt: string;
  updatedAt: string;
}

interface ZabUsuario {
  id: number;
  nome: string;
  email: string;
  senha: string;
  nivel: string;
  pontos: number;
  conquistas: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface ZabNotification {
  id: number;
  usuarioId: number;
  titulo: string;
  mensagem: string;
  tipo: string;
  lida: number;
  demandaId: number | null;
  criadoEm: string;
  createdAt: string;
}

// ─── Component ────────────────────────────────────────────────
export default function ZabFlowModal({
  userEmail,
  isAdmin,
  onClose,
}: {
  userEmail: string;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("demandas");

  // Demandas state
  const [demandas, setDemandas] = useState<ZabDemanda[]>([]);
  const [demandasLoading, setDemandasLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [prioridadeFilter, setPrioridadeFilter] = useState("all");
  const [searchDemanda, setSearchDemanda] = useState("");
  const [showNewDemanda, setShowNewDemanda] = useState(false);
  const [selectedDemanda, setSelectedDemanda] = useState<ZabDemanda | null>(null);

  // Users state
  const [usuarios, setUsuarios] = useState<ZabUsuario[]>([]);
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [showNewUser, setShowNewUser] = useState(false);

  // Notifications state
  const [notifications, setNotifications] = useState<ZabNotification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  // New demanda form
  const [newDemanda, setNewDemanda] = useState({
    categoria: "",
    prioridade: "Média",
    complexidade: "Médio",
    descricao: "",
    local: "Lundin",
    dataLimite: "",
    isRotina: 0,
  });

  // New user form
  const [newUser, setNewUser] = useState({
    nome: "",
    email: "",
    senha: "2026",
    nivel: "Junior",
    role: "funcionario",
  });

  // ─── Fetch Functions ──────────────────────────────────────
  const fetchDemandas = useCallback(async () => {
    setDemandasLoading(true);
    try {
      const res = await fetch("/api/zab-flow/demandas");
      const data = await res.json();
      setDemandas(Array.isArray(data) ? data : data.demandas || []);
    } catch {
      setDemandas([]);
    } finally {
      setDemandasLoading(false);
    }
  }, []);

  const fetchUsuarios = useCallback(async () => {
    setUsuariosLoading(true);
    try {
      const res = await fetch("/api/zab-flow/usuarios");
      const data = await res.json();
      setUsuarios(Array.isArray(data) ? data : data.usuarios || []);
    } catch {
      setUsuarios([]);
    } finally {
      setUsuariosLoading(false);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const res = await fetch("/api/zab-flow/notifications");
      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : data.notifications || []);
    } catch {
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDemandas();
  }, [fetchDemandas]);

  useEffect(() => {
    if (activeTab === "usuarios") fetchUsuarios();
    if (activeTab === "notificacoes") fetchNotifications();
  }, [activeTab, fetchUsuarios, fetchNotifications]);

  // ─── Handlers ─────────────────────────────────────────────
  const handleCreateDemanda = async () => {
    try {
      const res = await fetch("/api/zab-flow/demandas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newDemanda,
          funcionarioId: 1,
          nomeFuncionario: userEmail.split("@")[0],
          emailFuncionario: userEmail,
        }),
      });
      if (!res.ok) throw new Error("Erro ao criar demanda");
      toast({ title: "Demanda criada!", description: "A demanda foi registrada com sucesso." });
      setShowNewDemanda(false);
      fetchDemandas();
    } catch {
      toast({ title: "Erro", description: "Não foi possível criar a demanda.", variant: "destructive" });
    }
  };

  const handleUpdateDemandaStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/zab-flow/demandas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar");
      toast({ title: "Status atualizado!", description: `Demanda movida para ${status}.` });
      fetchDemandas();
    } catch {
      toast({ title: "Erro", description: "Não foi possível atualizar.", variant: "destructive" });
    }
  };

  const handleCreateUser = async () => {
    try {
      const res = await fetch("/api/zab-flow/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      if (!res.ok) throw new Error("Erro ao criar usuário");
      toast({ title: "Usuário criado!", description: `${newUser.nome} foi adicionado.` });
      setShowNewUser(false);
      fetchUsuarios();
    } catch {
      toast({ title: "Erro", description: "Não foi possível criar o usuário.", variant: "destructive" });
    }
  };

  const handleMarkNotificationRead = async (id: number) => {
    try {
      await fetch(`/api/zab-flow/notifications/${id}`, { method: "PUT" });
      fetchNotifications();
    } catch {}
  };

  // ─── Filtered Demandas ────────────────────────────────────
  const filteredDemandas = demandas.filter((d) => {
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    const matchPrioridade = prioridadeFilter === "all" || d.prioridade === prioridadeFilter;
    const matchSearch =
      searchDemanda === "" ||
      d.descricao.toLowerCase().includes(searchDemanda.toLowerCase()) ||
      (d.tag || "").toLowerCase().includes(searchDemanda.toLowerCase());
    return matchStatus && matchPrioridade && matchSearch;
  });

  // ─── Helpers ──────────────────────────────────────────────
  const getPrioridadeBadge = (p: string) => {
    switch (p) {
      case "Importante": return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Importante</Badge>;
      case "Média": return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Média</Badge>;
      case "Relevante": return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Relevante</Badge>;
      default: return <Badge variant="secondary">{p}</Badge>;
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "pendente": return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case "em andamento": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Em andamento</Badge>;
      case "concluída": return <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle2 className="h-3 w-3 mr-1" />Concluída</Badge>;
      default: return <Badge variant="secondary">{s}</Badge>;
    }
  };

  const getNivelBadge = (n: string) => {
    const colors: Record<string, string> = {
      Junior: "bg-green-100 text-green-700",
      Pleno: "bg-blue-100 text-blue-700",
      Senior: "bg-purple-100 text-purple-700",
      Administrador: "bg-red-100 text-red-700",
      Coordenador: "bg-orange-100 text-orange-700",
      Gerente: "bg-amber-100 text-amber-700",
    };
    return <Badge className={colors[n] || "bg-slate-100 text-slate-700"}>{n}</Badge>;
  };

  const getConquistaIcon = (c: string) => {
    switch (c) {
      case "star": return <Star className="h-4 w-4 text-amber-500" />;
      case "fire": return <Flame className="h-4 w-4 text-red-500" />;
      case "gold": return <Crown className="h-4 w-4 text-yellow-500" />;
      case "silver": return <Award className="h-4 w-4 text-slate-400" />;
      case "crown": return <Crown className="h-4 w-4 text-purple-500" />;
      default: return <Award className="h-4 w-4 text-slate-400" />;
    }
  };

  const getNotifIcon = (tipo: string) => {
    switch (tipo) {
      case "success": case "aprovacao": return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "danger": case "reprovacao": return <AlertCircle className="h-5 w-5 text-red-500" />;
      case "warning": case "cobranca": return <AlertCircle className="h-5 w-5 text-amber-500" />;
      case "atribuicao": return <User className="h-5 w-5 text-blue-500" />;
      default: return <Bell className="h-5 w-5 text-slate-400" />;
    }
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <DialogHeader className="p-4 border-b bg-slate-50">
        <DialogTitle className="flex items-center gap-2 text-lg">
          <GitBranch className="h-5 w-5 text-orange-500" />
          ZAB-Flow — Sistema de Gestão
        </DialogTitle>
      </DialogHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-3 border-b bg-white">
          <TabsList>
            <TabsTrigger value="demandas" className="gap-1.5">
              <GitBranch className="h-4 w-4" /> Demandas
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="usuarios" className="gap-1.5">
                <User className="h-4 w-4" /> Usuários
              </TabsTrigger>
            )}
            <TabsTrigger value="notificacoes" className="gap-1.5">
              <Bell className="h-4 w-4" /> Notificações
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ─── Demandas Tab ─────────────────────────────────── */}
        <TabsContent value="demandas" className="flex-1 overflow-auto p-4 m-0">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar demanda..."
                value={searchDemanda}
                onChange={(e) => setSearchDemanda(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em andamento">Em andamento</SelectItem>
                <SelectItem value="concluída">Concluída</SelectItem>
              </SelectContent>
            </Select>
            <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="Importante">Importante</SelectItem>
                <SelectItem value="Média">Média</SelectItem>
                <SelectItem value="Relevante">Relevante</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setShowNewDemanda(true)} className="bg-orange-500 hover:bg-orange-600 gap-2">
              <Plus className="h-4 w-4" /> Nova Demanda
            </Button>
          </div>

          {demandasLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDemandas.map((d) => (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedDemanda(d)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {d.tag && (
                              <Badge variant="outline" className="text-xs font-mono">
                                <Tag className="h-3 w-3 mr-1" />{d.tag}
                              </Badge>
                            )}
                            {getPrioridadeBadge(d.prioridade)}
                            {getStatusBadge(d.status)}
                            {d.isRotina === 1 && (
                              <Badge variant="secondary" className="text-xs">Rotina</Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-700 line-clamp-2 mb-2">{d.descricao}</p>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1"><User className="h-3 w-3" />{d.nomeFuncionario}</span>
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{d.local}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{d.dataLimite}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          {d.status === "pendente" && (
                            <Button size="sm" variant="outline" className="text-xs h-7"
                              onClick={(e) => { e.stopPropagation(); handleUpdateDemandaStatus(d.id, "em andamento"); }}>
                              <ArrowRight className="h-3 w-3 mr-1" /> Iniciar
                            </Button>
                          )}
                          {d.status === "em andamento" && (
                            <Button size="sm" variant="outline" className="text-xs h-7"
                              onClick={(e) => { e.stopPropagation(); handleUpdateDemandaStatus(d.id, "concluída"); }}>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Concluir
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
              {filteredDemandas.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma demanda encontrada</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ─── Usuários Tab ─────────────────────────────────── */}
        <TabsContent value="usuarios" className="flex-1 overflow-auto p-4 m-0">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-700">{usuarios.length} usuários</h3>
            <Button onClick={() => setShowNewUser(true)} className="bg-orange-500 hover:bg-orange-600 gap-2">
              <Plus className="h-4 w-4" /> Novo Usuário
            </Button>
          </div>

          {usuariosLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {usuarios.map((u) => (
                <Card key={u.id}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white font-bold text-lg">
                      {u.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{u.nome}</p>
                      <p className="text-xs text-slate-500 truncate">{u.email}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {getNivelBadge(u.nivel)}
                        <Badge variant="outline" className="text-xs">{u.role}</Badge>
                        <span className="text-xs text-slate-400">{u.pontos} pts</span>
                      </div>
                      <div className="flex gap-1 mt-1">
                        {(() => {
                          try {
                            const conquistas: string[] = JSON.parse(u.conquistas || "[]");
                            return conquistas.map((c, i) => <span key={i}>{getConquistaIcon(c)}</span>);
                          } catch { return null; }
                        })()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Notificações Tab ─────────────────────────────── */}
        <TabsContent value="notificacoes" className="flex-1 overflow-auto p-4 m-0">
          {notifLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <Card
                  key={n.id}
                  className={`transition-colors ${n.lida === 0 ? "bg-orange-50/50 border-orange-200" : ""}`}
                >
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="mt-0.5">{getNotifIcon(n.tipo)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-800">{n.titulo}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{n.mensagem}</p>
                      <p className="text-xs text-slate-400 mt-1">{n.criadoEm}</p>
                    </div>
                    {n.lida === 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs shrink-0"
                        onClick={() => handleMarkNotificationRead(n.id)}
                      >
                        Marcar lida
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
              {notifications.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma notificação</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── New Demanda Dialog ──────────────────────────────── */}
      <Dialog open={showNewDemanda} onOpenChange={setShowNewDemanda}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Demanda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Input
                value={newDemanda.categoria}
                onChange={(e) => setNewDemanda({ ...newDemanda, categoria: e.target.value })}
                placeholder="Ex: Manutenção, Segurança..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={newDemanda.prioridade} onValueChange={(v) => setNewDemanda({ ...newDemanda, prioridade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Importante">Importante</SelectItem>
                    <SelectItem value="Média">Média</SelectItem>
                    <SelectItem value="Relevante">Relevante</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Complexidade</Label>
                <Select value={newDemanda.complexidade} onValueChange={(v) => setNewDemanda({ ...newDemanda, complexidade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fácil">Fácil</SelectItem>
                    <SelectItem value="Médio">Médio</SelectItem>
                    <SelectItem value="Difícil">Difícil</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Local</Label>
                <Select value={newDemanda.local} onValueChange={(v) => setNewDemanda({ ...newDemanda, local: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Lundin">Lundin</SelectItem>
                    <SelectItem value="R&D">R&D</SelectItem>
                    <SelectItem value="U&M">U&M</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data Limite</Label>
                <Input
                  type="date"
                  value={newDemanda.dataLimite}
                  onChange={(e) => setNewDemanda({ ...newDemanda, dataLimite: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={newDemanda.descricao}
                onChange={(e) => setNewDemanda({ ...newDemanda, descricao: e.target.value })}
                placeholder="Descreva a demanda..."
                rows={3}
              />
            </div>
            <Button onClick={handleCreateDemanda} className="w-full bg-orange-500 hover:bg-orange-600">
              <Plus className="h-4 w-4 mr-2" /> Criar Demanda
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Demanda Detail Dialog ───────────────────────────── */}
      <Dialog open={!!selectedDemanda} onOpenChange={(open) => !open && setSelectedDemanda(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedDemanda?.tag && (
                <Badge variant="outline" className="font-mono">{selectedDemanda.tag}</Badge>
              )}
              Detalhes da Demanda
            </DialogTitle>
          </DialogHeader>
          {selectedDemanda && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {getPrioridadeBadge(selectedDemanda.prioridade)}
                {getStatusBadge(selectedDemanda.status)}
                <Badge variant="secondary">{selectedDemanda.complexidade}</Badge>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Descrição</Label>
                <p className="text-sm text-slate-800 mt-1">{selectedDemanda.descricao}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Label className="text-xs text-slate-500">Responsável</Label>
                  <p className="text-slate-800">{selectedDemanda.nomeFuncionario}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Local</Label>
                  <p className="text-slate-800">{selectedDemanda.local}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Data Limite</Label>
                  <p className="text-slate-800">{selectedDemanda.dataLimite}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Categoria</Label>
                  <p className="text-slate-800">{selectedDemanda.categoria}</p>
                </div>
              </div>
              {selectedDemanda.comentarios && (
                <div>
                  <Label className="text-xs text-slate-500">Comentários</Label>
                  <p className="text-sm text-slate-700 mt-1">{selectedDemanda.comentarios}</p>
                </div>
              )}
              <Separator />
              <div className="flex gap-2">
                {selectedDemanda.status === "pendente" && (
                  <Button onClick={() => { handleUpdateDemandaStatus(selectedDemanda.id, "em andamento"); setSelectedDemanda(null); }}
                    className="bg-blue-500 hover:bg-blue-600 flex-1">
                    <ArrowRight className="h-4 w-4 mr-2" /> Iniciar
                  </Button>
                )}
                {selectedDemanda.status === "em andamento" && (
                  <Button onClick={() => { handleUpdateDemandaStatus(selectedDemanda.id, "concluída"); setSelectedDemanda(null); }}
                    className="bg-green-500 hover:bg-green-600 flex-1">
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Concluir
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── New User Dialog ─────────────────────────────────── */}
      <Dialog open={showNewUser} onOpenChange={setShowNewUser}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={newUser.nome} onChange={(e) => setNewUser({ ...newUser, nome: e.target.value })} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="email@zaminebrasil.com" />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input value={newUser.senha} onChange={(e) => setNewUser({ ...newUser, senha: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nível</Label>
                <Select value={newUser.nivel} onValueChange={(v) => setNewUser({ ...newUser, nivel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Junior">Junior</SelectItem>
                    <SelectItem value="Pleno">Pleno</SelectItem>
                    <SelectItem value="Senior">Senior</SelectItem>
                    <SelectItem value="Administrador">Administrador</SelectItem>
                    <SelectItem value="Coordenador">Coordenador</SelectItem>
                    <SelectItem value="Gerente">Gerente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="funcionario">Funcionário</SelectItem>
                    <SelectItem value="gestor">Gestor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleCreateUser} className="w-full bg-orange-500 hover:bg-orange-600">
              <Plus className="h-4 w-4 mr-2" /> Criar Usuário
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Need MapPin import
function MapPinIcon(props: React.SVGProps<SVGSVGElement>) {
  return <MapPin {...props} />;
}

import { MapPin } from "lucide-react";
