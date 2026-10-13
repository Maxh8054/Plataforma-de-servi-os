'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Trash2, Download, Clock, Tag, User, FileText, Loader2, Save, X } from 'lucide-react';

interface ReportHistoryItem {
  id: string;
  name: string;
  reportType: string;
  tag: string | null;
  cliente: string | null;
  data: string;
  createdAt: string;
  updatedAt: string;
}

interface HistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadReport: (data: any, reportType: string) => void;
  onSaveReport?: (name: string, reportType: string) => Promise<void>;
  currentReportType: string;
}

export function HistoryDialog({
  open,
  onOpenChange,
  onLoadReport,
  onSaveReport,
  currentReportType,
}: HistoryDialogProps) {
  const [reports, setReports] = useState<ReportHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchReports();
    }
  }, [open]);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/history');
      if (response.ok) {
        const data = await response.json();
        setReports(data);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este relatório?')) return;

    try {
      const response = await fetch(`/api/history?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setReports(reports.filter((r) => r.id !== id));
      }
    } catch (error) {
      console.error('Error deleting report:', error);
    }
  };

  const handleLoad = (report: ReportHistoryItem) => {
    try {
      const data = JSON.parse(report.data);
      onLoadReport(data, report.reportType);
      onOpenChange(false);
    } catch (error) {
      console.error('Error loading report:', error);
      alert('Erro ao carregar relatório');
    }
  };

  const handleSave = async () => {
    if (!saveName.trim() || !onSaveReport) return;

    setIsSaving(true);
    try {
      await onSaveReport(saveName.trim(), currentReportType);
      setSaveName('');
      setShowSaveForm(false);
      fetchReports();
    } catch (error) {
      console.error('Error saving report:', error);
      alert('Erro ao salvar relatório');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getReportTypeLabel = (type: string) => {
    return type === 'home' ? 'Relatório' : 'Inspeção';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <History className="h-5 w-5 text-orange-500" />
            Histórico de Relatórios
          </DialogTitle>
          <DialogDescription>
            Acesse seus relatórios salvos na nuvem
          </DialogDescription>
        </DialogHeader>

        {/* Save current report section */}
        {onSaveReport && (
          <div className="border rounded-lg p-3 bg-orange-50">
            {!showSaveForm ? (
              <Button
                onClick={() => setShowSaveForm(true)}
                className="w-full bg-orange-500 hover:bg-orange-600"
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar Relatório Atual na Nuvem
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Nome do relatório..."
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    className="flex-1 h-10"
                  />
                  <Button
                    onClick={handleSave}
                    disabled={!saveName.trim() || isSaving}
                    className="bg-green-500 hover:bg-green-600 h-10"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowSaveForm(false);
                      setSaveName('');
                    }}
                    variant="outline"
                    className="h-10"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reports list */}
        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum relatório salvo</p>
              <p className="text-sm">Salve um relatório para acessá-lo de qualquer dispositivo</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                        <span className="font-medium truncate">{report.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {getReportTypeLabel(report.reportType)}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        {report.tag && (
                          <span className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            {report.tag}
                          </span>
                        )}
                        {report.cliente && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {report.cliente}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(report.updatedAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        onClick={() => handleLoad(report)}
                        className="h-8 bg-orange-500 hover:bg-orange-600"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Carregar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(report.id)}
                        className="h-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
