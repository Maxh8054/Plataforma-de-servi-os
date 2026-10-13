'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { 
  LayoutDashboard, 
  Trophy, 
  FileText, 
  Trash2, 
  TrendingUp,
  Calendar,
  Users,
  AlertCircle,
  Lock,
  Download,
  Upload,
  Search,
  Filter,
  X,
} from 'lucide-react';
import { useTranslation } from '@/store/translationStore';

interface ReportData {
  id: string;
  userId: string;
  userName: string;
  reportType: string;
  tag: string;
  cliente: string | null;
  descricao: string | null;
  conclusao: string | null;
  executantes: string | null;
  machineDown: boolean;
  finalizedAt: string;
}

interface Stats {
  reports: ReportData[];
  monthlyStats: Record<string, number>;
  userStats: Record<string, { name: string; count: number }>;
  totalReports: number;
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const COLORS = ['#f97316', '#22c55e', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#eab308', '#84cc16', '#f43f5e', '#6366f1', '#14b8a6'];

// Senha para excluir relatórios
const DELETE_PASSWORD = '20041982Mh@';

export function HistoryContent() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTag, setFilterTag] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterReportType, setFilterReportType] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/history?action=stats', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        console.error('Error fetching stats:', response.status, await response.text());
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setReportToDelete(id);
    setDeletePassword('');
    setDeleteError('');
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (deletePassword !== DELETE_PASSWORD) {
      setDeleteError('Senha incorreta!');
      return;
    }
    
    try {
      const response = await fetch(`/api/history?id=${reportToDelete}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.ok) {
        setShowDeleteDialog(false);
        fetchStats();
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      setDeleteError('Erro ao excluir relatório');
    }
  };

  // Exportar histórico para JSON
  const handleExportHistory = () => {
    if (!stats) return;
    
    const exportData = {
      exportDate: new Date().toISOString(),
      totalReports: stats.totalReports,
      reports: stats.reports.map(report => ({
        ...report,
        data: undefined, // Remove o campo data que pode ser muito grande
      })),
      monthlyStats: stats.monthlyStats,
      userStats: stats.userStats,
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historico_relatorios_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Importar histórico de JSON
  const handleImportHistory = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        
        if (!data.reports || !Array.isArray(data.reports)) {
          alert('Arquivo inválido. O JSON deve conter um array "reports".');
          return;
        }
        
        // Confirmar importação com opção de substituir duplicados
        const replaceDuplicates = confirm(
          `Deseja importar ${data.reports.length} relatórios?\n\n` +
          `OK = Substituir duplicados\n` +
          `Cancelar = Pular duplicados`
        );
        
        // Enviar para a API
        const response = await fetch('/api/history/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ 
            reports: data.reports,
            replaceDuplicates 
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          alert(
            `Importação concluída!\n\n` +
            `✅ Novos: ${result.imported}\n` +
            `🔄 Atualizados: ${result.updated || 0}\n` +
            `⏭️ Ignorados: ${result.skipped}\n` +
            `📝 Total no arquivo: ${result.total}`
          );
          fetchStats();
        } else {
          const error = await response.json();
          alert(`Erro ao importar: ${error.error || 'Erro desconhecido'}`);
        }
      } catch (err) {
        console.error('Error importing history:', err);
        alert('Erro ao importar arquivo. Verifique se o JSON é válido.');
      }
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Get unique tags and users for filter dropdowns
  const uniqueTags = useMemo(() => {
    if (!stats?.reports) return [];
    return [...new Set(stats.reports.map(r => r.tag))].sort();
  }, [stats?.reports]);

  const uniqueUsers = useMemo(() => {
    if (!stats?.reports) return [];
    return [...new Set(stats.reports.map(r => r.userName))].sort();
  }, [stats?.reports]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    if (!stats?.reports) return [];
    
    return stats.reports.filter(report => {
      // Search term (search in descricao, tag, userName)
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          (report.descricao?.toLowerCase().includes(search)) ||
          (report.tag?.toLowerCase().includes(search)) ||
          (report.userName?.toLowerCase().includes(search)) ||
          (report.conclusao?.toLowerCase().includes(search)) ||
          (report.executantes?.toLowerCase().includes(search));
        if (!matchesSearch) return false;
      }
      
      // Filter by tag
      if (filterTag !== 'all' && report.tag !== filterTag) return false;
      
      // Filter by user
      if (filterUser !== 'all' && report.userName !== filterUser) return false;
      
      // Filter by report type
      if (filterReportType !== 'all' && report.reportType !== filterReportType) return false;
      
      // Filter by date range
      if (filterDateStart) {
        const reportDate = new Date(report.finalizedAt);
        const startDate = new Date(filterDateStart);
        if (reportDate < startDate) return false;
      }
      
      if (filterDateEnd) {
        const reportDate = new Date(report.finalizedAt);
        const endDate = new Date(filterDateEnd);
        endDate.setHours(23, 59, 59, 999); // End of day
        if (reportDate > endDate) return false;
      }
      
      return true;
    });
  }, [stats?.reports, searchTerm, filterTag, filterUser, filterReportType, filterDateStart, filterDateEnd]);

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setFilterTag('all');
    setFilterUser('all');
    setFilterDateStart('');
    setFilterDateEnd('');
    setFilterReportType('all');
  };

  // Check if any filter is active
  const hasActiveFilters = searchTerm || filterTag !== 'all' || filterUser !== 'all' || 
    filterDateStart || filterDateEnd || filterReportType !== 'all';

  // Prepare monthly data for chart
  const monthlyChartData = useMemo(() => {
    if (!stats?.monthlyStats) return [];
    
    const currentYear = new Date().getFullYear();
    return Object.entries(stats.monthlyStats)
      .filter(([key]) => key.startsWith(String(currentYear)))
      .map(([key, count]) => {
        const monthIndex = parseInt(key.split('-')[1]) - 1;
        return {
          name: MONTHS[monthIndex].substring(0, 3),
          fullName: MONTHS[monthIndex],
          total: count,
        };
      })
      .sort((a, b) => MONTHS.indexOf(a.fullName) - MONTHS.indexOf(b.fullName));
  }, [stats?.monthlyStats]);

  // Prepare user ranking data
  const userRankingData = useMemo(() => {
    if (!stats?.userStats) return [];
    
    return Object.values(stats.userStats)
      .sort((a, b) => b.count - a.count)
      .map((user, index) => ({
        name: user.name.split(' ')[0], // First name only
        fullName: user.name,
        relatorios: user.count,
        fill: COLORS[index % COLORS.length],
      }));
  }, [stats?.userStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  // Empty state but still allow import
  if (!stats || stats.totalReports === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <AlertCircle className="h-16 w-16 text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">{t('history.noReports')}</p>
          <p className="text-gray-400 text-sm mt-2">
            Os relatórios aparecerão aqui quando forem finalizados
          </p>
        </div>
        {/* Import button even when empty */}
        <div className="flex justify-center">
          <Button 
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="border-green-500 text-green-600 hover:bg-green-50"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar JSON
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportHistory}
            className="hidden"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Navbar interna */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow p-2">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-12">
            <TabsTrigger value="dashboard" className="flex items-center gap-2 h-10">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">{t('history.dashboard')}</span>
            </TabsTrigger>
            <TabsTrigger value="ranking" className="flex items-center gap-2 h-10">
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">{t('history.ranking')}</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2 h-10">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">{t('history.reports')}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 gap-4">
          {/* Total Reports Card */}
          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Total de Relatórios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{stats.totalReports}</p>
              <p className="text-orange-100 text-sm mt-1">Finalizados</p>
            </CardContent>
          </Card>

          {/* Monthly Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-500" />
                {t('history.reportsByMonth')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => [value, t('history.monthlyTotal')]}
                      labelFormatter={(label) => MONTHS.find(m => m.startsWith(label)) || label}
                    />
                    <Bar dataKey="total" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ranking Tab */}
      {activeTab === 'ranking' && (
        <div className="grid grid-cols-1 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-orange-500" />
                {t('history.reportsByUser')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={userRankingData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                    <Tooltip 
                      formatter={(value: number) => [value, 'Relatórios']}
                      labelFormatter={(label) => userRankingData.find(u => u.name === label)?.fullName || label}
                    />
                    <Bar dataKey="relatorios" radius={[0, 4, 4, 0]}>
                      {userRankingData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Podium */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Top 3 Colaboradores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-center gap-4 h-40">
                {userRankingData.slice(0, 3).map((user, index) => (
                  <div 
                    key={user.name} 
                    className={`flex flex-col items-center ${index === 0 ? 'order-2' : index === 1 ? 'order-1' : 'order-3'}`}
                  >
                    <div 
                      className={`w-16 h-${index === 0 ? '24' : index === 1 ? '20' : '16'} rounded-t-lg flex items-end justify-center pb-2`}
                      style={{ 
                        backgroundColor: index === 0 ? '#fbbf24' : index === 1 ? '#9ca3af' : '#cd7f32',
                        height: index === 0 ? '96px' : index === 1 ? '80px' : '64px'
                      }}
                    >
                      <span className="text-white font-bold text-lg">{user.relatorios}</span>
                    </div>
                    <div className="text-center mt-2">
                      <p className="font-semibold text-sm">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.relatorios} relatórios</p>
                    </div>
                    <div className="text-2xl mt-1">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {/* Botões de Exportar/Importar */}
          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={handleExportHistory}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar JSON
            </Button>
            <Button 
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="border-green-500 text-green-600 hover:bg-green-50"
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar JSON
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportHistory}
              className="hidden"
            />
          </div>

          {/* Search and Filters */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Search className="h-4 w-4 text-orange-500" />
                  Pesquisa e Filtros
                </CardTitle>
                <div className="flex gap-2">
                  {hasActiveFilters && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={clearFilters}
                      className="text-gray-500"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Limpar
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowFilters(!showFilters)}
                    className="text-orange-500"
                  >
                    <Filter className="h-4 w-4 mr-1" />
                    {showFilters ? 'Ocultar' : 'Filtros'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Pesquisar por descrição, TAG, pessoa, conclusão..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filters */}
              {showFilters && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-2">
                  {/* Filter by TAG */}
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">TAG</Label>
                    <Select value={filterTag} onValueChange={setFilterTag}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Todas TAGs" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas TAGs</SelectItem>
                        {uniqueTags.map(tag => (
                          <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Filter by User */}
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Pessoa</Label>
                    <Select value={filterUser} onValueChange={setFilterUser}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {uniqueUsers.map(user => (
                          <SelectItem key={user} value={user}>{user}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Filter by Report Type */}
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Tipo</Label>
                    <Select value={filterReportType} onValueChange={setFilterReportType}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="home">Relatório</SelectItem>
                        <SelectItem value="inspecao">Inspeção</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Filter by Date Start */}
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Data Início</Label>
                    <Input
                      type="date"
                      value={filterDateStart}
                      onChange={(e) => setFilterDateStart(e.target.value)}
                      className="h-9"
                    />
                  </div>

                  {/* Filter by Date End */}
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Data Fim</Label>
                    <Input
                      type="date"
                      value={filterDateEnd}
                      onChange={(e) => setFilterDateEnd(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
              )}

              {/* Active Filters Display */}
              {hasActiveFilters && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {searchTerm && (
                    <Badge variant="secondary" className="gap-1">
                      Busca: "{searchTerm}"
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchTerm('')} />
                    </Badge>
                  )}
                  {filterTag !== 'all' && (
                    <Badge variant="secondary" className="gap-1">
                      TAG: {filterTag}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterTag('all')} />
                    </Badge>
                  )}
                  {filterUser !== 'all' && (
                    <Badge variant="secondary" className="gap-1">
                      Pessoa: {filterUser}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterUser('all')} />
                    </Badge>
                  )}
                  {filterReportType !== 'all' && (
                    <Badge variant="secondary" className="gap-1">
                      Tipo: {filterReportType === 'home' ? 'Relatório' : 'Inspeção'}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterReportType('all')} />
                    </Badge>
                  )}
                  {filterDateStart && (
                    <Badge variant="secondary" className="gap-1">
                      De: {new Date(filterDateStart).toLocaleDateString('pt-BR')}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterDateStart('')} />
                    </Badge>
                  )}
                  {filterDateEnd && (
                    <Badge variant="secondary" className="gap-1">
                      Até: {new Date(filterDateEnd).toLocaleDateString('pt-BR')}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterDateEnd('')} />
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results Count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Mostrando <span className="font-semibold text-orange-600">{filteredReports.length}</span> de <span className="font-semibold">{stats.reports.length}</span> relatórios
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-500" />
                Relatórios Finalizados ({filteredReports.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredReports.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>Nenhum relatório encontrado com os filtros aplicados</p>
                  <Button variant="link" onClick={clearFilters} className="text-orange-500 mt-2">
                    Limpar filtros
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-3 font-medium">{t('history.table.user')}</th>
                        <th className="text-left p-3 font-medium">{t('history.table.type')}</th>
                        <th className="text-left p-3 font-medium">{t('history.table.tag')}</th>
                        <th className="text-left p-3 font-medium">{t('history.table.description')}</th>
                        <th className="text-left p-3 font-medium">{t('history.table.date')}</th>
                        <th className="text-left p-3 font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReports.map((report) => (
                        <tr key={report.id} className="border-b hover:bg-gray-50">
                          <td className="p-3">
                            <p className="font-medium">{report.userName}</p>
                          </td>
                          <td className="p-3">
                            <Badge variant={report.reportType === 'home' ? 'default' : 'secondary'}
                              className={report.reportType === 'home' ? 'bg-orange-500' : 'bg-green-500 text-white'}
                            >
                              {report.reportType === 'home' ? t('history.type.home') : t('history.type.inspecao')}
                            </Badge>
                            {report.machineDown && (
                              <Badge className="bg-red-500 text-white ml-1">
                                {t('history.machineDown')}
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 font-mono">{report.tag}</td>
                          <td className="p-3 max-w-xs truncate" title={report.descricao || ''}>
                            {report.descricao}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {new Date(report.finalizedAt).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="p-3">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-700"
                              onClick={() => handleDeleteClick(report.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Password Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-red-500" />
              Confirmar Exclusão
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-500">
              Digite a senha para excluir este relatório:
            </p>
            <div className="space-y-2">
              <Label htmlFor="delete-password">Senha</Label>
              <Input
                id="delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Digite a senha"
              />
            </div>
            {deleteError && (
              <p className="text-sm text-red-500">{deleteError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
