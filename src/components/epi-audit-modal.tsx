"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Shield, CheckCircle2, XCircle, Send, Loader2, AlertTriangle,
  HardHat, ClipboardCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface AuditRecord {
  id: string;
  employeeName: string;
  equipmentType: string;
  status: "conforme" | "nao_conforme";
  observations: string;
  auditor: string;
  date: string;
}

const EPI_TYPES = [
  "Capacete",
  "Luvas de Segurança",
  "Botas com Biqueira de Aço",
  "Óculos de Proteção",
  "Protetor Auricular",
  "Máscara Respiratória",
  "Cinto de Segurança",
  "Colete Refletivo",
  "Protetor Facial",
  "Avental de Proteção",
];

export default function EpiAuditModal({ userEmail }: { userEmail: string }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const [form, setForm] = useState({
    employeeName: "",
    equipmentType: "",
    status: "conforme" as "conforme" | "nao_conforme",
    observations: "",
  });

  const handleSubmit = async () => {
    if (!form.employeeName || !form.equipmentType) {
      toast({ title: "Campos obrigatórios", description: "Preencha o nome e o tipo de EPI.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/epi-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          auditor: userEmail,
          date: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Erro ao enviar");

      toast({
        title: "Auditoria registrada!",
        description: `${form.equipmentType} — ${form.status === "conforme" ? "Conforme" : "Não Conforme"}`,
      });

      setRecords((prev) => [
        {
          id: Date.now().toString(),
          ...form,
          auditor: userEmail,
          date: new Date().toLocaleDateString("pt-BR"),
        },
        ...prev,
      ]);

      setForm({ employeeName: "", equipmentType: "", status: "conforme", observations: "" });
    } catch {
      toast({ title: "Erro", description: "Não foi possível registrar a auditoria.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-orange-500" /> Auditoria de EPI
        </DialogTitle>
      </DialogHeader>

      <p className="text-sm text-slate-500">
        Registre a verificação de Equipamentos de Proteção Individual dos colaboradores.
      </p>

      {/* Form */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome do Colaborador</Label>
            <Input
              value={form.employeeName}
              onChange={(e) => setForm({ ...form, employeeName: e.target.value })}
              placeholder="Nome completo"
            />
          </div>
          <div className="space-y-2">
            <Label>Tipo de EPI</Label>
            <Select value={form.equipmentType} onValueChange={(v) => setForm({ ...form, equipmentType: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o EPI" />
              </SelectTrigger>
              <SelectContent>
                {EPI_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <div className="flex gap-3">
            <Button
              type="button"
              variant={form.status === "conforme" ? "default" : "outline"}
              className={form.status === "conforme" ? "bg-emerald-500 hover:bg-emerald-600" : ""}
              onClick={() => setForm({ ...form, status: "conforme" })}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" /> Conforme
            </Button>
            <Button
              type="button"
              variant={form.status === "nao_conforme" ? "default" : "outline"}
              className={form.status === "nao_conforme" ? "bg-red-500 hover:bg-red-600" : ""}
              onClick={() => setForm({ ...form, status: "nao_conforme" })}
            >
              <XCircle className="h-4 w-4 mr-2" /> Não Conforme
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea
            value={form.observations}
            onChange={(e) => setForm({ ...form, observations: e.target.value })}
            placeholder="Observações adicionais..."
            rows={3}
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-orange-500 hover:bg-orange-600"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ClipboardCheck className="h-4 w-4 mr-2" />
          )}
          {submitting ? "Registrando..." : "Registrar Auditoria"}
        </Button>
      </div>

      {/* History */}
      {records.length > 0 && (
        <>
          <Separator />
          <div>
            <Button
              variant="ghost"
              className="w-full text-slate-500"
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? "Ocultar" : "Ver"} registros recentes ({records.length})
            </Button>

            {showHistory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-2 mt-3 max-h-60 overflow-y-auto"
              >
                {records.map((r) => (
                  <Card key={r.id} className={r.status === "nao_conforme" ? "border-red-200 bg-red-50/50" : "border-emerald-200 bg-emerald-50/50"}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm text-slate-800">{r.employeeName}</p>
                        <p className="text-xs text-slate-500">{r.equipmentType} — {r.date}</p>
                      </div>
                      {r.status === "conforme" ? (
                        <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-3 w-3 mr-1" />Conforme</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700"><AlertTriangle className="h-3 w-3 mr-1" />Não Conforme</Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </motion.div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
