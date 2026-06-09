"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar, Save, Loader2, Plus, Trash2, Users, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const SHIFTS = ["Manhã (06:00-14:00)", "Tarde (14:00-22:00)", "Noite (22:00-06:00)"];

interface EscalaEntry {
  day: number;
  shift: number;
  employee: string;
}

export default function EscalaModal({ isAdmin }: { isAdmin: boolean }) {
  const { toast } = useToast();
  const [escala, setEscala] = useState<EscalaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEscala();
  }, []);

  const fetchEscala = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/escala");
      const data = await res.json();
      if (data.dados) {
        try {
          const parsed = JSON.parse(data.dados);
          setEscala(Array.isArray(parsed) ? parsed : []);
        } catch {
          setEscala([]);
        }
      }
    } catch {
      setEscala([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/escala", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dados: JSON.stringify(escala) }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      toast({ title: "Escala salva!", description: "A escala foi atualizada com sucesso." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar a escala.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getEmployee = (day: number, shift: number): string => {
    const entry = escala.find((e) => e.day === day && e.shift === shift);
    return entry?.employee || "";
  };

  const setEmployee = (day: number, shift: number, employee: string) => {
    setEscala((prev) => {
      const filtered = prev.filter((e) => !(e.day === day && e.shift === shift));
      if (employee.trim()) {
        return [...filtered, { day, shift, employee }];
      }
      return filtered;
    });
  };

  const shiftColors = [
    "bg-amber-50 border-amber-200",
    "bg-sky-50 border-sky-200",
    "bg-indigo-50 border-indigo-200",
  ];

  const shiftBadges = [
    <Badge key="manha" className="bg-amber-100 text-amber-700">Manhã</Badge>,
    <Badge key="tarde" className="bg-sky-100 text-sky-700">Tarde</Badge>,
    <Badge key="noite" className="bg-indigo-100 text-indigo-700">Noite</Badge>,
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-orange-500" /> Escala de Turno
          </DialogTitle>
        </DialogHeader>
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-orange-500" /> Escala de Turno
        </DialogTitle>
      </DialogHeader>

      <div className="text-sm text-slate-500 flex items-center gap-4">
        <span className="flex items-center gap-1"><Users className="h-4 w-4" /> Gerenciamento de escalas</span>
        <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> 3 turnos por dia</span>
      </div>

      {/* Schedule Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left font-semibold text-slate-600 border-b w-24">Turno</th>
              {DAYS.map((day) => (
                <th key={day} className="p-2 text-center font-semibold text-slate-600 border-b min-w-[120px]">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SHIFTS.map((shift, si) => (
              <tr key={si}>
                <td className={`p-2 border-b border-r ${shiftColors[si]} rounded-l-lg`}>
                  <div className="font-medium text-xs">{shiftBadges[si]}</div>
                </td>
                {DAYS.map((_, di) => (
                  <td key={di} className="p-1 border-b">
                    {isAdmin ? (
                      <Input
                        className="h-9 text-xs text-center"
                        placeholder="—"
                        value={getEmployee(di, si)}
                        onChange={(e) => setEmployee(di, si, e.target.value)}
                      />
                    ) : (
                      <div className="h-9 flex items-center justify-center text-xs text-slate-600">
                        {getEmployee(di, si) || "—"}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {saving ? "Salvando..." : "Salvar Escala"}
          </Button>
        </div>
      )}
    </div>
  );
}
