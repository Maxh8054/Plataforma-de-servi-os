"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Shield, Store, Truck, FolderOpen, TrendingUp,
  BookOpen, FileEdit, GitBranch, BarChart3, Activity,
  Calendar, LogOut, Bell, Search, Filter, ChevronRight,
  ChevronLeft, Loader2, AlertCircle, CheckCircle2, Clock,
  X, Menu, User, Eye, EyeOff, Factory, Wrench, HardHat
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import ZabFlowModal from "@/components/zab-flow-modal";
import EscalaModal from "@/components/escala-modal";
import EpiAuditModal from "@/components/epi-audit-modal";

// ─── Types ────────────────────────────────────────────────────
type ViewType = "login" | "states" | "services";
type StateType = "mg" | "go" | "pa" | "ba" | "sc" | "ma" | null;
type LocationType = string | null;
type ModalType = "zabflow" | "escala" | "epi" | null;

interface Equipment {
  id: string;
  equipamento: string;
  modelo: string;
  cliente: string;
  size: string;
  local: string;
  empresa: string;
  ano: string;
  statusOperacao: string | null;
  motivoStandby: string | null;
  falhasCriticas: string | null;
}

// ─── Constants ────────────────────────────────────────────────
const AUTHORIZED_USERS = [
  "julio-s@zaminebrasil.com", "wallysson-s@zaminebrasil.com",
  "emerson-a@zaminebrasil.com", "jose-s@zaminebrasil.com",
  "charles-a@zaminebrasil.com", "rafaela-m@zaminebrasil.com",
  "jadson-r@zaminebrasil.com", "weslley-f@zaminebrasil.com",
  "higor-a@zaminebrasil.com", "marcos-b@zaminebrasil.com",
  "marcos-a@zaminebrasil.com", "marcelo-p@zaminebrasil.com",
  "warlen-s@zaminebrasil.com", "cicero-c@zaminebrasil.com",
  "tiago-c@zaminebrasil.com", "robson-m@zaminebrasil.com",
  "rodrigo-v@zaminebrasil.com", "marlon-m@zaminebrasil.com",
  "ranielly-s@zaminebrasil.com", "girlene-n@zaminebrasil.com",
  "hamilton-j@zaminebrasil.com", "guilherme-s@zaminebrasil.com",
  "fabricio-s@zaminebrasil.com", "fabricio-c@zaminebrasil.com",
  "guilherme-r@zaminebrasil.com", "max-r@zaminebrasil.com",
];
const DEFAULT_PASSWORD = "2026";
const ADMIN_EMAIL = "max-r@zaminebrasil.com";

const EXTERNAL_URLS: Record<string, string> = {
  comercial: "https://zaminebrasil.sharepoint.com/_layouts/15/sharepoint.aspx",
  oportunidades: "https://planilha-de-oportunidade-git-main-maxh8054s-projects.vercel.app/",
  literaturas: "https://zaminebrasil.sharepoint.com/sites/SERVIOS-LUNDIN/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2FSERVIOS%2DLUNDIN%2FShared%20Documents%2FSERVI%C3%87OS%2FLiteraturas%20t%C3%A9cnicas&viewid=c13d8cad%2Da802%2D45ff%2D9ca9%2De5760b0f6790",
  sharepoint: "https://zaminebrasil.sharepoint.com/sites/SERVIOS-LUNDIN/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2FSERVIOS%2DLUNDIN%2FShared%20Documents%2FSERVI%C3%87OS&viewid=c13d8cad%2Da802%2D45ff%2D9ca9%2De5760b0f6790",
  relatorios: "https://z-services-ai.onrender.com/",
  powerbi_rd: "https://app.powerbi.com/links/2XMhgQQ8OX?ctid=8394d100-2f96-4738-9e1c-00b5e663cb6f&pbi_source=linkShare",
  powerbi_go: "https://app.powerbi.com/links/sZd7OFBV_z?ctid=8394d100-2f96-4738-9e1c-00b5e663cb6f&pbi_source=linkShare",
  kpi_rd: "https://app.powerbi.com/links/pb7oNGBtl2?ctid=8394d100-2f96-4738-9e1c-00b5e663cb6f&pbi_source=linkShare",
  kpi_go: "https://app.powerbi.com/links/aIKzcce3Nx?ctid=8394d100-2f96-4738-9e1c-00b5e663cb6f&pbi_source=linkShare",
};

interface ServiceItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  action: "epi" | "zabflow" | "escala" | "external";
  url?: string;
}

interface StateInfo {
  abbr: string;
  name: string;
  color: string;
}

const STATES_INFO: Record<string, StateInfo> = {
  mg: { abbr: "MG", name: "Minas Gerais", color: "from-orange-500 to-amber-600" },
  go: { abbr: "GO", name: "Goiás", color: "from-emerald-500 to-green-600" },
  pa: { abbr: "PA", name: "Pará", color: "from-sky-500 to-cyan-600" },
  ba: { abbr: "BA", name: "Bahia", color: "from-rose-500 to-pink-600" },
  sc: { abbr: "SC", name: "Santa Catarina", color: "from-violet-500 to-purple-600" },
  ma: { abbr: "MA", name: "Maranhão", color: "from-yellow-500 to-orange-500" },
};

const SUB_LOCATIONS: Record<string, string[]> = {
  mg: ["R&D", "Araxá", "Usiminas"],
};

function getServices(location: string): ServiceItem[] {
  const common: ServiceItem[] = [
    { title: "Segurança", description: "Auditoria de EPI e segurança do trabalho", icon: <Shield className="h-6 w-6" />, action: "epi" },
    { title: "Comercial", description: "Sistema comercial da Zamine", icon: <Store className="h-6 w-6" />, action: "external", url: EXTERNAL_URLS.comercial },
    { title: "Frota Hitachi Brasil", description: "Escavadeiras e caminhões em operação", icon: <Truck className="h-6 w-6" />, action: "external", url: "/html/FrotaHitachi.html" },
    { title: "SharePoint Serviços", description: "Documentos e arquivos de serviços", icon: <FolderOpen className="h-6 w-6" />, action: "external", url: EXTERNAL_URLS.sharepoint },
    { title: "Oportunidades de Venda", description: "Explore oportunidades comerciais", icon: <TrendingUp className="h-6 w-6" />, action: "external", url: EXTERNAL_URLS.oportunidades },
    { title: "Literaturas Técnicas", description: "Documentos e literaturas técnicas", icon: <BookOpen className="h-6 w-6" />, action: "external", url: EXTERNAL_URLS.literaturas },
    { title: "Criar Relatórios", description: "Ferramenta para criação de relatórios com IA", icon: <FileEdit className="h-6 w-6" />, action: "external", url: EXTERNAL_URLS.relatorios },
    { title: "ZAB-Flow", description: "Sistema de gestão de demandas e fluxos", icon: <GitBranch className="h-6 w-6" />, action: "zabflow" },
  ];

  const locationServices: Record<string, ServiceItem[]> = {
    "mg-rd": [
      ...common,
      { title: "Relatórios Técnicos", description: "Indicadores de relatórios técnicos", icon: <BarChart3 className="h-6 w-6" />, action: "external", url: EXTERNAL_URLS.powerbi_rd },
      { title: "KPI Performance", description: "Indicadores de performance", icon: <Activity className="h-6 w-6" />, action: "external", url: EXTERNAL_URLS.kpi_rd },
    ],
    "mg-araxa": [...common],
    "mg-usiminas": [...common],
    go: [
      ...common,
      { title: "Relatórios Técnicos", description: "Indicadores de relatórios técnicos", icon: <BarChart3 className="h-6 w-6" />, action: "external", url: EXTERNAL_URLS.powerbi_go },
      { title: "KPI Performance", description: "Indicadores de performance", icon: <Activity className="h-6 w-6" />, action: "external", url: EXTERNAL_URLS.kpi_go },
      { title: "Escala de Turno", description: "Gerenciamento de escalas de turno", icon: <Calendar className="h-6 w-6" />, action: "escala" },
    ],
    pa: [...common],
    ba: [...common],
    sc: [...common],
    ma: [...common],
  };

  return locationServices[location] || common;
}

// ─── Login View ───────────────────────────────────────────────
function LoginView({ onLogin }: { onLogin: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    await new Promise((r) => setTimeout(r, 600));

    if (!AUTHORIZED_USERS.includes(email)) {
      setError("Usuário não autorizado. Contate o administrador.");
      setLoading(false);
      return;
    }
    if (password !== DEFAULT_PASSWORD) {
      setError("Senha incorreta.");
      setLoading(false);
      return;
    }

    toast({ title: "Bem-vindo!", description: `Logado como ${email}` });
    onLogin(email);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="border-slate-700 bg-slate-800/80 backdrop-blur-xl shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 w-20 h-20 rounded-xl overflow-hidden bg-white/10 p-2">
              <img src="/zamine-logo.png" alt="Zamine Brasil" className="w-full h-full object-contain" />
            </div>
            <CardTitle className="text-2xl font-bold text-white">Plataforma de Serviços</CardTitle>
            <CardDescription className="text-slate-400">Zamine Brasil — Acesse sua conta</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">E-mail corporativo</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu-nome@zaminebrasil.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full text-slate-400 hover:text-white"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </motion.div>
              )}

              <Button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-11"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-slate-500 text-xs mt-4">
          Zamine Brasil © {new Date().getFullYear()} — Plataforma de Serviços
        </p>
      </motion.div>
    </div>
  );
}

// ─── State Selection View ─────────────────────────────────────
function StateSelectionView({
  userEmail,
  onStateSelect,
  onLogout,
  equipmentCount,
}: {
  userEmail: string;
  onStateSelect: (state: StateType) => void;
  onLogout: () => void;
  equipmentCount: Record<string, number>;
}) {
  const { toast } = useToast();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/10 p-1">
              <img src="/zamine-logo.png" alt="Zamine" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Plataforma de Serviços</h1>
              <p className="text-xs text-slate-400">Zamine Brasil</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-300 hidden sm:block">{userEmail}</span>
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white hover:bg-slate-700"
              onClick={onLogout}
              title="Sair"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-800">Selecione a Unidade</h2>
            <p className="text-slate-500 mt-1">Escolha o estado para acessar os serviços</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 md:gap-6">
            {Object.entries(STATES_INFO).map(([key, info], index) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
              >
                <Card
                  className="cursor-pointer group hover:shadow-xl transition-all duration-300 border-0 overflow-hidden"
                  onClick={() => onStateSelect(key as StateType)}
                >
                  <div className={`h-2 bg-gradient-to-r ${info.color}`} />
                  <CardContent className="p-6 text-center">
                    <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${info.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                      <MapPin className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-3xl font-extrabold text-slate-800 mb-1">{info.abbr}</h3>
                    <p className="text-sm text-slate-500 mb-3">{info.name}</p>
                    <Badge variant="secondary" className="text-xs">
                      <Factory className="h-3 w-3 mr-1" />
                      {equipmentCount[key] || 0} equipamentos
                    </Badge>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-center py-4 text-sm">
        Zamine Brasil © {new Date().getFullYear()} — Plataforma de Serviços
      </footer>
    </div>
  );
}

// ─── Equipment Section ────────────────────────────────────────
function EquipmentSection() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [localFilter, setLocalFilter] = useState<string>("all");

  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ["equipment"],
    queryFn: async () => {
      const r = await fetch("/api/equipment");
      const data = await r.json();
      return (Array.isArray(data) ? data : data.equipment || []) as Equipment[];
    },
  });

  const locais = useMemo(() => [...new Set(equipment.map((e) => e.local))], [equipment]);

  const filtered = useMemo(() => {
    return equipment.filter((e) => {
      const matchSearch =
        search === "" ||
        Object.values(e).some((v) => String(v ?? "").toLowerCase().includes(search.toLowerCase()));
      const matchStatus = statusFilter === "all" || e.statusOperacao === statusFilter;
      const matchLocal = localFilter === "all" || e.local === localFilter;
      return matchSearch && matchStatus && matchLocal;
    });
  }, [equipment, search, statusFilter, localFilter]);

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "Operando": return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="h-3 w-3 mr-1" />Operando</Badge>;
      case "Standby": return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100"><Clock className="h-3 w-3 mr-1" />Standby</Badge>;
      case "Manutenção": return <Badge className="bg-red-100 text-red-700 hover:bg-red-100"><Wrench className="h-3 w-3 mr-1" />Manutenção</Badge>;
      default: return <Badge variant="secondary">{status || "N/A"}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar equipamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <Filter className="h-4 w-4 mr-2 text-slate-400" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            <SelectItem value="Operando">Operando</SelectItem>
            <SelectItem value="Standby">Standby</SelectItem>
            <SelectItem value="Manutenção">Manutenção</SelectItem>
          </SelectContent>
        </Select>
        <Select value={localFilter} onValueChange={setLocalFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Local" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Locais</SelectItem>
            {locais.map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="text-sm text-slate-500">
        {filtered.length} de {equipment.length} equipamentos
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="text-left p-3 font-semibold text-slate-600">Equipamento</th>
                <th className="text-left p-3 font-semibold text-slate-600">Modelo</th>
                <th className="text-left p-3 font-semibold text-slate-600 hidden md:table-cell">Cliente</th>
                <th className="text-left p-3 font-semibold text-slate-600 hidden lg:table-cell">Size</th>
                <th className="text-left p-3 font-semibold text-slate-600">Local</th>
                <th className="text-left p-3 font-semibold text-slate-600 hidden md:table-cell">Empresa</th>
                <th className="text-left p-3 font-semibold text-slate-600 hidden lg:table-cell">Ano</th>
                <th className="text-left p-3 font-semibold text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((eq) => (
                <tr key={eq.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-medium text-slate-800">{eq.equipamento}</td>
                  <td className="p-3 text-slate-600">{eq.modelo}</td>
                  <td className="p-3 text-slate-600 hidden md:table-cell">{eq.cliente}</td>
                  <td className="p-3 text-slate-600 hidden lg:table-cell">{eq.size}</td>
                  <td className="p-3 text-slate-600">{eq.local}</td>
                  <td className="p-3 text-slate-600 hidden md:table-cell">{eq.empresa}</td>
                  <td className="p-3 text-slate-600 hidden lg:table-cell">{eq.ano}</td>
                  <td className="p-3">{getStatusBadge(eq.statusOperacao)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Nenhum equipamento encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Services View ────────────────────────────────────────────
function ServicesView({
  state,
  location,
  userEmail,
  onBack,
  onLogout,
  onOpenModal,
}: {
  state: StateType;
  location: LocationType;
  userEmail: string;
  onBack: () => void;
  onLogout: () => void;
  onOpenModal: (modal: ModalType) => void;
}) {
  const [activeTab, setActiveTab] = useState<"services" | "equipment">("services");
  const [selectedSubLocation, setSelectedSubLocation] = useState<string | null>(null);

  const stateInfo = state ? STATES_INFO[state] : null;

  const currentLocation = selectedSubLocation
    ? `${state}-${selectedSubLocation === "R&D" ? "rd" : selectedSubLocation.toLowerCase()}`
    : state;

  const services = currentLocation ? getServices(currentLocation) : [];
  const subLocations = state ? SUB_LOCATIONS[state] : null;

  const handleServiceClick = (service: ServiceItem) => {
    switch (service.action) {
      case "epi":
        onOpenModal("epi");
        break;
      case "zabflow":
        onOpenModal("zabflow");
        break;
      case "escala":
        onOpenModal("escala");
        break;
      case "external":
        if (service.url) {
          window.open(service.url, "_blank", "noopener,noreferrer");
        }
        break;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white hover:bg-slate-700"
              onClick={onBack}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/10 p-1">
              <img src="/zamine-logo.png" alt="Zamine" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">
                {stateInfo?.name}
                {selectedSubLocation ? ` — ${selectedSubLocation}` : ""}
              </h1>
              <p className="text-xs text-slate-400">Zamine Brasil</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white hover:bg-slate-700 relative"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full" />
            </Button>
            <span className="text-sm text-slate-300 hidden sm:block">{userEmail}</span>
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white hover:bg-slate-700"
              onClick={onLogout}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-2 text-sm text-slate-500">
          <button onClick={onBack} className="hover:text-orange-500 transition-colors">Início</button>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-800 font-medium">{stateInfo?.name}</span>
          {selectedSubLocation && (
            <>
              <ChevronRight className="h-3 w-3" />
              <span className="text-slate-800 font-medium">{selectedSubLocation}</span>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "services" | "equipment")}>
          <TabsList className="mb-6">
            <TabsTrigger value="services" className="gap-2">
              <HardHat className="h-4 w-4" /> Serviços
            </TabsTrigger>
            <TabsTrigger value="equipment" className="gap-2">
              <Factory className="h-4 w-4" /> Equipamentos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="services">
            {/* Sub-locations for MG */}
            {subLocations && !selectedSubLocation && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-700 mb-3">Selecione a unidade</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {subLocations.map((sub) => (
                    <motion.div key={sub} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Card
                        className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-orange-500"
                        onClick={() => setSelectedSubLocation(sub)}
                      >
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                            <MapPin className="h-5 w-5 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{sub}</p>
                            <p className="text-xs text-slate-500">Minas Gerais</p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-slate-300 ml-auto" />
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Back from sub-location */}
            {selectedSubLocation && (
              <Button
                variant="ghost"
                className="mb-4 text-slate-500 hover:text-slate-700"
                onClick={() => setSelectedSubLocation(null)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Voltar às unidades
              </Button>
            )}

            {/* Service Cards */}
            {(selectedSubLocation || !subLocations) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {services.map((service, idx) => (
                  <motion.div
                    key={service.title}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.05 }}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Card
                      className="cursor-pointer hover:shadow-lg transition-all duration-200 group h-full"
                      onClick={() => handleServiceClick(service)}
                    >
                      <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-orange-50 group-hover:bg-orange-100 flex items-center justify-center text-orange-500 transition-colors">
                          {service.icon}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{service.title}</p>
                          <p className="text-xs text-slate-500 mt-1">{service.description}</p>
                        </div>
                        {service.action === "external" && (
                          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-orange-400 transition-colors" />
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="equipment">
            <EquipmentSection />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-center py-4 text-sm mt-auto">
        Zamine Brasil © {new Date().getFullYear()} — Plataforma de Serviços
      </footer>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────
export default function PlataformaServicos() {
  const [view, setView] = useState<ViewType>("login");
  const [userEmail, setUserEmail] = useState("");
  const [selectedState, setSelectedState] = useState<StateType>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const isAdmin = userEmail === ADMIN_EMAIL;

  // Use TanStack Query to fetch equipment counts
  const { data: equipmentCount = {} } = useQuery({
    queryKey: ["equipment-counts"],
    queryFn: async () => {
      const r = await fetch("/api/equipment");
      const data = await r.json();
      const items: Equipment[] = Array.isArray(data) ? data : data.equipment || [];
      const stateMap: Record<string, string> = {
        lundin: "mg", "r&d": "mg", araxa: "mg", usiminas: "mg",
        "belo horizonte": "mg", contagem: "mg",
        catalao: "go", goiania: "go",
        parauapebas: "pa", carajas: "pa",
        salvador: "ba", "lauro de freitas": "ba",
        florianopolis: "sc", joinville: "sc",
        "sao luis": "ma",
      };
      const stateCounts: Record<string, number> = {};
      items.forEach((eq) => {
        const loc = eq.local?.toLowerCase() || "";
        for (const [key, abbr] of Object.entries(stateMap)) {
          if (loc.includes(key)) {
            stateCounts[abbr] = (stateCounts[abbr] || 0) + 1;
            break;
          }
        }
      });
      return stateCounts;
    },
  });

  const handleLogin = (email: string) => {
    setUserEmail(email);
    setView("states");
  };

  const handleStateSelect = (state: StateType) => {
    setSelectedState(state);
    setView("services");
  };

  const handleBack = () => {
    if (view === "services") {
      setSelectedState(null);
      setView("states");
    }
  };

  const handleLogout = () => {
    setUserEmail("");
    setSelectedState(null);
    setView("login");
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {view === "login" && (
          <motion.div key="login" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <LoginView onLogin={handleLogin} />
          </motion.div>
        )}
        {view === "states" && (
          <motion.div key="states" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <StateSelectionView
              userEmail={userEmail}
              onStateSelect={handleStateSelect}
              onLogout={handleLogout}
              equipmentCount={equipmentCount}
            />
          </motion.div>
        )}
        {view === "services" && selectedState && (
          <motion.div key="services" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <ServicesView
              state={selectedState}
              location={null}
              userEmail={userEmail}
              onBack={handleBack}
              onLogout={handleLogout}
              onOpenModal={setActiveModal}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <Dialog open={activeModal === "zabflow"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-5xl h-[90vh] p-0 overflow-hidden">
          <ZabFlowModal
            userEmail={userEmail}
            isAdmin={isAdmin}
            onClose={() => setActiveModal(null)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={activeModal === "escala"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-auto">
          <EscalaModal isAdmin={isAdmin} />
        </DialogContent>
      </Dialog>

      <Dialog open={activeModal === "epi"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
          <EpiAuditModal userEmail={userEmail} />
        </DialogContent>
      </Dialog>
    </>
  );
}
