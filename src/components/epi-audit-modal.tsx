"use client";

import { useState, useEffect, useCallback, useRef, useMemo, type ChangeEvent } from "react";

// ======================== TYPES ========================

interface EpiCategoryItem {
  tipo: string;
  nomes: string;
  condicao: boolean;
  substituicao: boolean;
  higienizado: boolean;
  outro?: string;
  motivoSubstituicao?: Record<string, string>;
}

interface EpiAudit {
  id: string;
  data: string;
  responsavel: string;
  funcao: string;
  colaborador: string;
  area: string;
  observacoes: string;
  epis: EpiCategoryItem[];
  createdAt: string;
  foto?: string;
}

interface EpiAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  stateName?: string;
}

interface ToastMessage {
  id: string;
  text: string;
  type: "success" | "error" | "info";
}

interface AuditStats {
  total: number;
  green: number;
  yellow: number;
  red: number;
  greenPct: number;
  yellowPct: number;
  redPct: number;
}

// ======================== CONSTANTS ========================

const STORAGE_KEY = "epiAudits";

const EPI_CATEGORIES: { tipo: string; opcoes: string[] }[] = [
  { tipo: "Proteção Auditiva (Ouvido)", opcoes: ["Protetor Auricular", "Abafador de Ruído", "Plug Descartável"] },
  { tipo: "Proteção para Cabeça", opcoes: ["Capacete"] },
  { tipo: "Proteção para Olhos", opcoes: ["Óculos de Proteção", "Viseira"] },
  { tipo: "Proteção Respiratória", opcoes: ["Máscara"] },
  { tipo: "Proteção para Mãos", opcoes: ["Luvas de Borracha", "Luvas PU", "Luvas de Vaqueta"] },
  { tipo: "Proteção Facial", opcoes: ["Protetor Facial", "Máscara Facial", "Viseira Completa"] },
  { tipo: "Proteção para Pé/Pernas", opcoes: ["Botas de Segurança", "Perneiras"] },
];

const MESES_PT: Record<string, string> = {
  "01": "Janeiro", "02": "Fevereiro", "03": "Março", "04": "Abril",
  "05": "Maio", "06": "Junho", "07": "Julho", "08": "Agosto",
  "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro",
};

// ======================== HELPERS ========================

function formatDateLabel(dateStr: string): string {
  const [year, month] = dateStr.split("-");
  return `${MESES_PT[month] || month} ${year}`;
}

function createEmptyFormData() {
  return {
    data: new Date().toISOString().split("T")[0],
    responsavel: "",
    funcao: "",
    colaborador: "",
    area: "",
    observacoes: "",
    foto: undefined as string | undefined,
    epis: EPI_CATEGORIES.map((cat) => ({
      tipo: cat.tipo,
      nomes: "",
      condicao: true,
      substituicao: false,
      higienizado: true,
      outro: "",
      motivoSubstituicao: {},
    })),
  };
}

function getStatusColor(epi: EpiCategoryItem): "green" | "yellow" | "red" | "gray" {
  if (!epi.nomes) return "gray";
  if (epi.substituicao || !epi.condicao) return "red";
  if (!epi.higienizado) return "yellow";
  return "green";
}

function getEpiNamesArray(epi: EpiCategoryItem): string[] {
  if (!epi.nomes) return [];
  return epi.nomes.split(", ").map((n) => n.trim()).filter(Boolean);
}

function calcStats(auditList: EpiAudit[]): AuditStats {
  let totalEpi = 0;
  let greenCount = 0;
  let yellowCount = 0;
  let redCount = 0;

  for (const audit of auditList) {
    for (const epi of audit.epis) {
      if (!epi.nomes) continue;
      totalEpi += 1;
      const status = getStatusColor(epi);
      if (status === "green") greenCount++;
      else if (status === "yellow") yellowCount++;
      else if (status === "red") redCount++;
    }
  }

  return {
    total: totalEpi,
    green: greenCount,
    yellow: yellowCount,
    red: redCount,
    greenPct: totalEpi > 0 ? Math.round((greenCount / totalEpi) * 100) : 0,
    yellowPct: totalEpi > 0 ? Math.round((yellowCount / totalEpi) * 100) : 0,
    redPct: totalEpi > 0 ? Math.round((redCount / totalEpi) * 100) : 0,
  };
}

function groupAuditsByMonth(audits: EpiAudit[]): Record<string, EpiAudit[]> {
  const groups: Record<string, EpiAudit[]> = {};
  const sorted = [...audits].sort(
    (a, b) => new Date(b.createdAt || b.data).getTime() - new Date(a.createdAt || a.data).getTime()
  );
  for (const audit of sorted) {
    const label = formatDateLabel(audit.data);
    if (!groups[label]) groups[label] = [];
    groups[label].push(audit);
  }
  return groups;
}

function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-orange-400 font-semibold">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

// ======================== STATIC SUB-COMPONENTS ========================

function StatusBadge({ status }: { status: "green" | "yellow" | "red" | "gray" }) {
  const colors: Record<string, string> = {
    green: "bg-green-500/20 text-green-400 border-green-500/30",
    yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    red: "bg-red-500/20 text-red-400 border-red-500/30",
    gray: "bg-zinc-700/50 text-zinc-500 border-zinc-600/30",
  };
  const labels: Record<string, string> = { green: "Bom", yellow: "Atenção", red: "Substituir", gray: "Vazio" };
  const dotColors: Record<string, string> = {
    green: "bg-green-400", yellow: "bg-yellow-400", red: "bg-red-400", gray: "bg-zinc-500",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border max-w-[160px] truncate ${colors[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColors[status]}`} />
      {labels[status]}
    </span>
  );
}

// ======================== AUTOCOMPLETE INPUT ========================

interface AutocompleteInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suggestions: string[];
  required?: boolean;
}

function AutocompleteInput({ label, value, onChange, placeholder, suggestions, required }: AutocompleteInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!value.trim()) return suggestions.slice(0, 5);
    const lower = value.toLowerCase();
    return suggestions
      .filter((s) => s.toLowerCase().includes(lower))
      .slice(0, 5);
  }, [value, suggestions]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setFocusedIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-zinc-400 text-xs mb-1 font-medium">
        {label}{required && " *"}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowDropdown(true);
          setFocusedIndex(-1);
        }}
        onFocus={() => {
          if (filtered.length > 0) setShowDropdown(true);
        }}
        onKeyDown={(e) => {
          if (!showDropdown || filtered.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setFocusedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setFocusedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
          } else if (e.key === "Enter" && focusedIndex >= 0) {
            e.preventDefault();
            onChange(filtered[focusedIndex]);
            setShowDropdown(false);
            setFocusedIndex(-1);
          } else if (e.key === "Escape") {
            setShowDropdown(false);
            setFocusedIndex(-1);
          }
        }}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 sm:py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
      />
      {showDropdown && filtered.length > 0 && (
        <div className="absolute z-[100] left-0 right-0 top-full mt-1 bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto overscroll-contain">
          {filtered.map((suggestion, idx) => (
            <button
              key={suggestion}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(suggestion);
                setShowDropdown(false);
                setFocusedIndex(-1);
              }}
              onMouseEnter={() => setFocusedIndex(idx)}
              className={`w-full px-3 py-2.5 sm:py-2 text-left text-sm transition-colors min-h-[44px] sm:min-h-0 flex items-center ${
                idx === focusedIndex
                  ? "bg-orange-500/20 text-orange-300"
                  : "text-zinc-300 hover:bg-zinc-700/80"
              }`}
            >
              {highlightMatch(suggestion, value)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ======================== HISTORY PANEL ========================

interface HistoryPanelProps {
  audits: EpiAudit[];
  monthGroups: Record<string, EpiAudit[]>;
  expandedMonths: Set<string>;
  expandedCollaborators: Set<string>;
  confirmDeleteId: string | null;
  onToggleMonth: (month: string) => void;
  onToggleCollaborator: (key: string) => void;
  onOpenDetail: (collaborator: string, monthLabel: string, monthAudits: EpiAudit[]) => void;
  onSetConfirmDeleteId: (id: string | null) => void;
  onDeleteSingle: (id: string) => void;
}

function HistoryPanel({
  audits,
  monthGroups,
  expandedMonths,
  expandedCollaborators,
  confirmDeleteId,
  onToggleMonth,
  onToggleCollaborator,
  onOpenDetail,
  onSetConfirmDeleteId,
  onDeleteSingle,
}: HistoryPanelProps) {
  if (audits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <span className="material-icons text-5xl text-zinc-600 mb-3">inventory_2</span>
        <p className="text-zinc-400 text-sm">Nenhuma auditoria registrada.</p>
        <p className="text-zinc-500 text-xs mt-1">Preencha o formulário para começar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {Object.entries(monthGroups).map(([monthLabel, monthAudits]) => {
        const isExpanded = expandedMonths.has(monthLabel);
        const collaborators = [...new Set(monthAudits.map((a) => a.colaborador))];

        return (
          <div key={monthLabel} className="rounded-xl border border-zinc-700/50 overflow-hidden">
            <button
              onClick={() => onToggleMonth(monthLabel)}
              className="w-full flex items-center justify-between px-4 py-3.5 sm:py-3 bg-zinc-800/80 hover:bg-zinc-700/80 active:bg-zinc-600/80 transition-colors min-h-[44px] sm:min-h-0"
            >
              <div className="flex items-center gap-3">
                <span className="material-icons text-orange-500 text-xl">calendar_month</span>
                <span className="text-white font-semibold text-sm">{monthLabel}</span>
                <span className="bg-zinc-700 text-zinc-300 text-xs px-2 py-0.5 rounded-full">
                  {monthAudits.length} {monthAudits.length === 1 ? "auditoria" : "auditorias"}
                </span>
              </div>
              <span className={`material-icons text-zinc-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
                expand_more
              </span>
            </button>

            {isExpanded && (
              <div className="border-t border-zinc-700/50">
                {collaborators.map((collab) => {
                  const collabKey = `${monthLabel}-${collab}`;
                  const isCollabExpanded = expandedCollaborators.has(collabKey);
                  const collabAudits = monthAudits.filter((a) => a.colaborador === collab);
                  const collabStats = calcStats(collabAudits);

                  return (
                    <div key={collabKey} className="border-b border-zinc-700/30 last:border-b-0">
                      <div className="flex items-center">
                        <button
                          onClick={() => onToggleCollaborator(collabKey)}
                          className="flex-1 flex items-center gap-3 px-4 py-3 sm:py-2.5 hover:bg-zinc-700/50 active:bg-zinc-600/50 transition-colors text-left min-h-[44px] sm:min-h-0"
                        >
                          <span className="material-icons text-zinc-400 text-lg">
                            {isCollabExpanded ? "expand_more" : "chevron_right"}
                          </span>
                          {collabAudits[0]?.foto ? (
                            <img
                              src={collabAudits[0].foto}
                              alt=""
                              className="w-7 h-7 rounded-full object-cover border border-orange-500/40 flex-shrink-0"
                            />
                          ) : (
                            <span className="material-icons text-orange-400/70 text-lg">person</span>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-zinc-200 text-sm font-medium truncate">{collab}</p>
                            <p className="text-zinc-500 text-xs">
                              {collabAudits.length} {collabAudits.length === 1 ? "registro" : "registros"}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {collabStats.green > 0 && (
                              <span className="w-2 h-2 rounded-full bg-green-500" title="Bom estado" />
                            )}
                            {collabStats.yellow > 0 && (
                              <span className="w-2 h-2 rounded-full bg-yellow-500" title="Atenção" />
                            )}
                            {collabStats.red > 0 && (
                              <span className="w-2 h-2 rounded-full bg-red-500" title="Substituir" />
                            )}
                          </div>
                        </button>
                        <button
                          onClick={() => onOpenDetail(collab, monthLabel, monthAudits)}
                          className="px-3 py-3 sm:py-2.5 text-zinc-400 hover:text-orange-400 active:bg-zinc-700/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                          title="Ver detalhes"
                        >
                          <span className="material-icons text-lg">visibility</span>
                        </button>
                      </div>

                      {isCollabExpanded && (
                        <div className="bg-zinc-900/50 px-4 pb-3">
                          {collabAudits.map((audit) => (
                            <div
                              key={audit.id}
                              className="flex items-center gap-3 py-2 border-t border-zinc-700/30 first:border-t-0"
                            >
                              {audit.foto && (
                                <img
                                  src={audit.foto}
                                  alt=""
                                  className="w-8 h-8 rounded-full object-cover border border-zinc-600 flex-shrink-0"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-zinc-400 text-xs">
                                    {new Date(audit.data).toLocaleDateString("pt-BR")}
                                  </span>
                                  {audit.area && (
                                    <span className="text-zinc-600 text-xs">• {audit.area}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  {audit.epis.map((epi, ei) => (
                                    <StatusBadge key={ei} status={getStatusColor(epi)} />
                                  ))}
                                </div>
                              </div>
                              <button
                                onClick={() => onSetConfirmDeleteId(audit.id)}
                                className="p-2 sm:p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 rounded-lg transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                                title="Excluir auditoria"
                              >
                                <span className="material-icons text-lg">delete_outline</span>
                              </button>

                              {confirmDeleteId === audit.id && (
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteSingle(audit.id);
                                    }}
                                    className="px-3 py-2 sm:px-2 sm:py-1 bg-red-500 hover:bg-red-600 active:bg-red-700 active:scale-95 text-white text-xs rounded-md transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                                  >
                                    Sim
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSetConfirmDeleteId(null);
                                    }}
                                    className="px-3 py-2 sm:px-2 sm:py-1 bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 active:scale-95 text-zinc-300 text-xs rounded-md transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                                  >
                                    Não
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ======================== FORM PANEL ========================

interface FormPanelProps {
  formData: ReturnType<typeof createEmptyFormData>;
  audits: EpiAudit[];
  onUpdateField: (field: string, value: string) => void;
  onUpdateEpi: (index: number, field: keyof EpiCategoryItem, value: string | boolean) => void;
  onMultiSelect: (epiIndex: number, option: string) => void;
  onSave: () => void;
}

function FormPanel({ formData, audits, onUpdateField, onUpdateEpi, onMultiSelect, onSave }: FormPanelProps) {
  const collaboratorSuggestions = useMemo(() => {
    const names = new Set<string>();
    for (const a of audits) {
      if (a.colaborador?.trim()) names.add(a.colaborador.trim());
    }
    return Array.from(names).sort();
  }, [audits]);

  const funcaoSuggestions = useMemo(() => {
    const names = new Set<string>();
    for (const a of audits) {
      if (a.funcao?.trim()) names.add(a.funcao.trim());
    }
    return Array.from(names).sort();
  }, [audits]);

  const collabFuncaoMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of audits) {
      if (a.colaborador?.trim() && a.funcao?.trim()) {
        map.set(a.colaborador.trim(), a.funcao.trim());
      }
    }
    return map;
  }, [audits]);

  const prevCollabRef = useRef(formData.colaborador);

  useEffect(() => {
    if (formData.colaborador !== prevCollabRef.current) {
      prevCollabRef.current = formData.colaborador;
      const knownFuncao = collabFuncaoMap.get(formData.colaborador.trim());
      if (knownFuncao && !formData.funcao.trim()) {
        onUpdateField("funcao", knownFuncao);
      }
    }
  }, [formData.colaborador, formData.funcao, collabFuncaoMap, onUpdateField]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      className="space-y-4"
    >
      {/* Basic Info */}
      <div className="bg-zinc-800/60 rounded-xl p-3 sm:p-4 border border-zinc-700/40">
        <h4 className="text-orange-400 font-semibold text-sm mb-3 flex items-center gap-2">
          <span className="material-icons text-lg">assignment</span>
          Informações da Auditoria
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-zinc-400 text-xs mb-1 font-medium">Data *</label>
            <input
              type="date"
              value={formData.data}
              onChange={(e) => onUpdateField("data", e.target.value)}
              className="w-full px-3 py-2.5 sm:py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-zinc-400 text-xs mb-1 font-medium">Responsável *</label>
            <input
              type="text"
              value={formData.responsavel}
              onChange={(e) => onUpdateField("responsavel", e.target.value)}
              placeholder="Nome do responsável"
              className="w-full px-3 py-2.5 sm:py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>
          <AutocompleteInput
            label="Função"
            value={formData.funcao}
            onChange={(val) => onUpdateField("funcao", val)}
            placeholder="Ex: Mecânico"
            suggestions={funcaoSuggestions}
          />
          <AutocompleteInput
            label="Colaborador"
            value={formData.colaborador}
            onChange={(val) => onUpdateField("colaborador", val)}
            placeholder="Nome do colaborador"
            suggestions={collaboratorSuggestions}
            required
          />
          <div>
            <label className="block text-zinc-400 text-xs mb-1 font-medium">Área</label>
            <input
              type="text"
              value={formData.area}
              onChange={(e) => onUpdateField("area", e.target.value)}
              placeholder="Ex: Oficina"
              className="w-full px-3 py-2.5 sm:py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-zinc-400 text-xs mb-1 font-medium">Observações</label>
          <textarea
            value={formData.observacoes}
            onChange={(e) => onUpdateField("observacoes", e.target.value)}
            placeholder="Observações adicionais..."
            rows={2}
            className="w-full px-3 py-2.5 sm:py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors resize-none"
          />
        </div>
      </div>

      {/* EPI Categories */}
      <div className="bg-zinc-800/60 rounded-xl p-3 sm:p-4 border border-zinc-700/40">
        <h4 className="text-orange-400 font-semibold text-sm mb-3 flex items-center gap-2">
          <span className="material-icons text-lg">shield</span>
          Equipamentos de Proteção Individual
        </h4>
        <div className="space-y-4">
          {EPI_CATEGORIES.map((cat, catIdx) => {
            const epi = formData.epis[catIdx];
            const isSubstituicao = epi?.substituicao ?? false;

            return (
              <div key={cat.tipo} className="bg-zinc-900/50 rounded-lg p-3 sm:p-4 border border-zinc-700/30">
                <p className="text-zinc-200 text-sm font-medium mb-2">{cat.tipo}</p>

                {/* Multi-select toggles */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {cat.opcoes.map((opt) => {
                    const isSelected = epi?.nomes
                      ?.split(", ")
                      .filter(Boolean)
                      .includes(opt) ?? false;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => onMultiSelect(catIdx, opt)}
                        className={`px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium border transition-all min-h-[44px] sm:min-h-0 flex items-center active:scale-95 ${
                          isSelected
                            ? "bg-orange-500/20 border-orange-500/50 text-orange-400"
                            : "bg-zinc-800 border-zinc-600 text-zinc-400 hover:border-zinc-500 active:bg-zinc-700"
                        }`}
                      >
                        {isSelected && <span className="material-icons text-xs align-middle mr-1">check</span>}
                        {opt}
                      </button>
                    );
                  })}
                  {/* Outro option */}
                  {(() => {
                    const isOutroSelected = epi?.nomes
                      ?.split(", ")
                      .filter(Boolean)
                      .includes("Outro") ?? false;
                    return (
                      <button
                        type="button"
                        onClick={() => onMultiSelect(catIdx, "Outro")}
                        className={`px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium border transition-all min-h-[44px] sm:min-h-0 flex items-center active:scale-95 ${
                          isOutroSelected
                            ? "bg-orange-500/20 border-orange-500/50 text-orange-400"
                            : "bg-zinc-800 border-zinc-600 text-zinc-400 hover:border-zinc-500 active:bg-zinc-700"
                        }`}
                      >
                        {isOutroSelected && <span className="material-icons text-xs align-middle mr-1">check</span>}
                        Outro
                      </button>
                    );
                  })()}
                </div>

                {/* Outro text input */}
                {epi?.nomes?.split(", ").filter(Boolean).includes("Outro") && (
                  <input
                    type="text"
                    value={epi.outro || ""}
                    onChange={(e) => onUpdateEpi(catIdx, "outro", e.target.value)}
                    placeholder="Descreva o EPI..."
                    className="w-full px-3 py-2.5 sm:py-1.5 bg-zinc-800 border border-zinc-600 rounded-lg text-white text-xs sm:text-xs placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors mb-2"
                  />
                )}

                {/* Checkboxes - only show when names selected */}
                {epi?.nomes && (
                  <>
                    <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                      <label className={`flex items-center gap-2 sm:gap-1.5 py-1.5 sm:py-1 min-h-[44px] sm:min-h-0 ${isSubstituicao ? "cursor-not-allowed opacity-40" : "cursor-pointer"} group`}>
                        <input
                          type="checkbox"
                          checked={epi.condicao}
                          disabled={isSubstituicao}
                          onChange={(e) => onUpdateEpi(catIdx, "condicao", e.target.checked)}
                          className="w-5 h-5 sm:w-3.5 sm:h-3.5 rounded border-zinc-500 bg-zinc-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-0 accent-orange-500 disabled:opacity-50"
                        />
                        <span className="text-xs text-zinc-400 group-hover:text-zinc-300 transition-colors">
                          Boas condições
                        </span>
                      </label>
                      <label className="flex items-center gap-2 sm:gap-1.5 py-1.5 sm:py-1 min-h-[44px] sm:min-h-0 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={isSubstituicao}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            onUpdateEpi(catIdx, "substituicao", checked);
                            if (checked) {
                              onUpdateEpi(catIdx, "condicao", false);
                              onUpdateEpi(catIdx, "motivoSubstituicao", {});
                            } else {
                              onUpdateEpi(catIdx, "motivoSubstituicao", {});
                            }
                          }}
                          className="w-5 h-5 sm:w-3.5 sm:h-3.5 rounded border-zinc-500 bg-zinc-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-0 accent-orange-500"
                        />
                        <span className="text-xs text-zinc-400 group-hover:text-zinc-300 transition-colors">
                          Substituição
                        </span>
                      </label>
                      <label className="flex items-center gap-2 sm:gap-1.5 py-1.5 sm:py-1 min-h-[44px] sm:min-h-0 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={epi.higienizado}
                          onChange={(e) => onUpdateEpi(catIdx, "higienizado", e.target.checked)}
                          className="w-5 h-5 sm:w-3.5 sm:h-3.5 rounded border-zinc-500 bg-zinc-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-0 accent-orange-500"
                        />
                        <span className="text-xs text-zinc-400 group-hover:text-zinc-300 transition-colors">
                          Higienizado
                        </span>
                      </label>
                    </div>

                    {/* Motivo da substituição field */}
                    {isSubstituicao && (
                      <div className="mt-2 space-y-2">
                        {getEpiNamesArray(epi).map((itemName) => (
                          <div key={itemName}>
                            <label className="block text-red-400/80 text-xs mb-1 font-medium">
                              Motivo da substituição — {itemName} *
                            </label>
                            <input
                              type="text"
                              value={epi.motivoSubstituicao?.[itemName] || ""}
                              onChange={(e) => {
                                const current = epi.motivoSubstituicao || {};
                                onUpdateEpi(catIdx, "motivoSubstituicao", { ...current, [itemName]: e.target.value });
                              }}
                              placeholder={"Ex: Desgaste excessivo, prazo vencido..."}
                              className="w-full px-3 py-2.5 sm:py-1.5 bg-zinc-800 border border-red-500/40 rounded-lg text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <button
        type="submit"
        className="w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 active:scale-[0.98] text-white py-3 min-h-[44px] rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-orange-500/20"
      >
        <span className="material-icons text-lg">save</span>
        Salvar Auditoria
      </button>
    </form>
  );
}

// ======================== PRINT REPORT HELPER ========================

function generatePrintHTML(auditsForPrint: EpiAudit[], stats: AuditStats): string {
  if (auditsForPrint.length === 0) return "";

  const latest = auditsForPrint[0];
  const allDates = auditsForPrint.map((a) => a.data).sort();
  const allDatesFormatted = [...new Set(allDates)].map((d) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR")).join(", ");

  const fotoHtml = latest.foto
    ? `<td colspan="5" style="padding:12px;text-align:center;"><img src="${latest.foto}" style="max-width:160px;max-height:160px;border-radius:12px;border:2px solid #ea580c;object-fit:cover;" alt="Foto do colaborador" /></td>`
    : "";

  let epiRows = "";
  for (const audit of auditsForPrint) {
    for (const epi of audit.epis) {
      if (!epi.nomes) continue;
      const status = getStatusColor(epi);
      const statusIcon = status === "green" ? "✅ Boas condições" : status === "yellow" ? "🟡 Atenção" : status === "red" ? "🔴 Substituição" : "⚪ Vazio";
      const higIcon = epi.higienizado ? "✅" : "❌";
      const motivo = (() => {
        if (!epi.substituicao || !epi.motivoSubstituicao) return "";
        const entries = Object.entries(epi.motivoSubstituicao).filter(([, v]) => v?.trim());
        if (entries.length === 0) return "";
        return `<br><span style="color:#b91c1c;font-size:11px;">Motivos:</span><br>` + entries.map(([k, v]) => `<span style="color:#b91c1c;font-size:11px;">• ${k}: ${v}</span>`).join("<br>");
      })();

      epiRows += `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;">${new Date(audit.data + "T12:00:00").toLocaleDateString("pt-BR")}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:500;">${epi.tipo}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;">${epi.nomes}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;">${statusIcon}${motivo}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">${higIcon}</td>
        </tr>`;
    }
  }

  const greenW = stats.total > 0 ? stats.greenPct : 0;
  const yellowW = stats.total > 0 ? stats.yellowPct : 0;
  const redW = stats.total > 0 ? stats.redPct : 0;
  const now = new Date().toLocaleString("pt-BR");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Auditoria de EPIs</title>
  <style>
    @page { margin: 10mm; size: A4; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; background: #fff; padding: 20px; }
    @media print { body { padding: 0; } }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #ea580c; padding-bottom: 16px; margin-bottom: 24px; }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .header-left img { height: 50px; }
    .header-left h1 { font-size: 20px; font-weight: 700; color: #ea580c; }
    .header-left p { font-size: 12px; color: #666; }
    .header-date { text-align: right; font-size: 12px; color: #666; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px; }
    .info-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
    .info-card .label { font-size: 10px; text-transform: uppercase; color: #6b7280; font-weight: 600; margin-bottom: 4px; }
    .info-card .value { font-size: 14px; font-weight: 600; color: #1a1a1a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #f3f4f6; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; color: #374151; font-weight: 600; border-bottom: 2px solid #d1d5db; }
    .stats-section { margin-bottom: 24px; }
    .stats-section h2 { font-size: 16px; font-weight: 700; margin-bottom: 12px; color: #374151; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
    .stat-card { border-radius: 8px; padding: 12px; text-align: center; }
    .stat-card .stat-value { font-size: 24px; font-weight: 700; }
    .stat-card .stat-label { font-size: 11px; color: #6b7280; margin-top: 2px; }
    .stat-green { background: #f0fdf4; border: 1px solid #bbf7d0; } .stat-green .stat-value { color: #16a34a; }
    .stat-yellow { background: #fefce8; border: 1px solid #fef08a; } .stat-yellow .stat-value { color: #ca8a04; }
    .stat-red { background: #fef2f2; border: 1px solid #fecaca; } .stat-red .stat-value { color: #dc2626; }
    .stat-total { background: #f3f4f6; border: 1px solid #d1d5db; } .stat-total .stat-value { color: #374151; }
    .bar-chart { margin-top: 12px; }
    .bar-row { display: flex; align-items: center; margin-bottom: 8px; }
    .bar-label { width: 100px; font-size: 12px; font-weight: 500; color: #374151; flex-shrink: 0; }
    .bar-track { flex: 1; height: 24px; background: #f3f4f6; border-radius: 6px; overflow: hidden; position: relative; }
    .bar-fill { height: 100%; border-radius: 6px; display: flex; align-items: center; padding-left: 8px; color: #fff; font-size: 11px; font-weight: 600; min-width: 0; transition: width 0.5s; }
    .bar-fill-green { background: #22c55e; } .bar-fill-yellow { background: #eab308; } .bar-fill-red { background: #ef4444; }
    .bar-pct { width: 50px; text-align: right; font-size: 12px; font-weight: 600; color: #374151; flex-shrink: 0; margin-left: 8px; }
    .footer { border-top: 2px solid #e5e7eb; padding-top: 16px; margin-top: 32px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #9ca3af; }
    .btn-print { position: fixed; top: 20px; right: 20px; background: #ea580c; color: #fff; border: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(234,88,12,0.3); }
    .btn-print:hover { background: #c2410c; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <img src="/images/zamine-logo.png" alt="Zamine Brasil" onerror="this.style.display='none'">
      <div>
        <h1>Relatório de Auditoria de EPIs</h1>
        <p>Zamine Brasil - Plataforma de Serviços</p>
      </div>
    </div>
    <div class="header-date">
      <strong>Gerado em:</strong><br>${now}
    </div>
  </div>

  ${fotoHtml ? `<table style="margin-bottom:16px;"><tbody><tr>${fotoHtml}</tr></tbody></table>` : ""}

  <div class="info-grid">
    <div class="info-card"><div class="label">Colaborador</div><div class="value">${latest.colaborador}</div></div>
    <div class="info-card"><div class="label">Função</div><div class="value">${latest.funcao || "—"}</div></div>
    <div class="info-card"><div class="label">Área</div><div class="value">${latest.area || "—"}</div></div>
    <div class="info-card"><div class="label">Responsável</div><div class="value">${latest.responsavel}</div></div>
    <div class="info-card"><div class="label">Data(s)</div><div class="value" style="font-size:12px;">${allDatesFormatted}</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:90px;">Data</th>
        <th style="width:160px;">Tipo EPI</th>
        <th>Equipamentos</th>
        <th style="width:150px;">Status</th>
        <th style="width:70px;text-align:center;">Higienizado</th>
      </tr>
    </thead>
    <tbody>${epiRows}</tbody>
  </table>

  <div class="stats-section">
    <h2>Resumo Estatístico</h2>
    <div class="stats-grid">
      <div class="stat-card stat-total"><div class="stat-value">${stats.total}</div><div class="stat-label">Total Verificado</div></div>
      <div class="stat-card stat-green"><div class="stat-value">${stats.greenPct}%</div><div class="stat-label">Boas Condições</div></div>
      <div class="stat-card stat-yellow"><div class="stat-value">${stats.yellowPct}%</div><div class="stat-label">Atenção</div></div>
      <div class="stat-card stat-red"><div class="stat-value">${stats.redPct}%</div><div class="stat-label">Substituição</div></div>
    </div>
    <div class="bar-chart">
      <div class="bar-row">
        <div class="bar-label">🟢 Boas Condições</div>
        <div class="bar-track"><div class="bar-fill bar-fill-green" style="width:${greenW}%">${greenW > 8 ? greenW + "%" : ""}</div></div>
        <div class="bar-pct">${greenW}%</div>
      </div>
      <div class="bar-row">
        <div class="bar-label">🟡 Atenção</div>
        <div class="bar-track"><div class="bar-fill bar-fill-yellow" style="width:${yellowW}%">${yellowW > 8 ? yellowW + "%" : ""}</div></div>
        <div class="bar-pct">${yellowW}%</div>
      </div>
      <div class="bar-row">
        <div class="bar-label">🔴 Substituição</div>
        <div class="bar-track"><div class="bar-fill bar-fill-red" style="width:${redW}%">${redW > 8 ? redW + "%" : ""}</div></div>
        <div class="bar-pct">${redW}%</div>
      </div>
    </div>
  </div>

</body>
</html>`;
}

// ======================== EXCEL EXPORT HELPER ========================

function generateExcelHTML(auditsForExcel: EpiAudit[], stats: AuditStats): string {
  if (auditsForExcel.length === 0) return "";

  const latest = auditsForExcel[0];
  const dateStr = new Date(latest.data + "T12:00:00").toLocaleDateString("pt-BR");
  const now = new Date().toLocaleString("pt-BR");

  const fotoRow = latest.foto
    ? `<tr><td colspan="5" style="text-align:center;padding:8px;"><em style="color:#666;font-size:10px;">[Foto anexada - disponível no relatório PDF]</em></td></tr>`
    : "";

  let epiRows = "";
  for (const audit of auditsForExcel) {
    for (const epi of audit.epis) {
      if (!epi.nomes) continue;
      const status = getStatusColor(epi);
      const statusText = status === "green" ? "Bom" : status === "yellow" ? "Atenção" : status === "red" ? "Substituição" : "Vazio";
      const motivoEntries = epi.substituicao && epi.motivoSubstituicao
        ? Object.entries(epi.motivoSubstituicao).filter(([, v]) => v?.trim())
        : [];
      const motivo = motivoEntries.length > 0 ? ` | Motivo: ${motivoEntries.map(([k, v]) => `${k}: ${v}`).join('; ')}` : "";
      const higText = epi.higienizado ? "Sim" : "Não";

      epiRows += `<tr>
        <td style="padding:4px 8px;border:1px solid #ccc;font-size:11px;">${new Date(audit.data + "T12:00:00").toLocaleDateString("pt-BR")}</td>
        <td style="padding:4px 8px;border:1px solid #ccc;font-size:11px;font-weight:bold;">${epi.tipo}</td>
        <td style="padding:4px 8px;border:1px solid #ccc;font-size:11px;">${epi.nomes}${motivo}</td>
        <td style="padding:4px 8px;border:1px solid #ccc;font-size:11px;">${statusText}</td>
        <td style="padding:4px 8px;border:1px solid #ccc;font-size:11px;text-align:center;">${higText}</td>
      </tr>`;
    }
  }

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Auditoria EPI</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
<body>
<table>
  <tr><td colspan="5" style="font-size:16px;font-weight:bold;color:#ea580c;padding:12px;">Relatório de Auditoria de EPIs - Zamine Brasil</td></tr>
  <tr><td style="padding:4px;font-weight:bold;font-size:12px;">Colaborador:</td><td style="padding:4px;font-size:12px;">${latest.colaborador}</td><td style="padding:4px;font-weight:bold;font-size:12px;">Data:</td><td style="padding:4px;font-size:12px;">${dateStr}</td><td></td></tr>
  <tr><td style="padding:4px;font-weight:bold;font-size:12px;">Responsável:</td><td style="padding:4px;font-size:12px;">${latest.responsavel}</td><td style="padding:4px;font-weight:bold;font-size:12px;">Função:</td><td style="padding:4px;font-size:12px;">${latest.funcao || "-"}</td><td></td></tr>
  <tr><td style="padding:4px;font-weight:bold;font-size:12px;">Área:</td><td style="padding:4px;font-size:12px;">${latest.area || "-"}</td><td style="padding:4px;font-weight:bold;font-size:12px;">Gerado em:</td><td style="padding:4px;font-size:12px;">${now}</td><td></td></tr>
  ${fotoRow}
  <tr><td colspan="5" style="height:8px;"></td></tr>
  <tr style="background:#ea580c;color:#fff;">
    <th style="padding:6px 8px;border:1px solid #ccc;font-size:11px;">Data</th>
    <th style="padding:6px 8px;border:1px solid #ccc;font-size:11px;">Tipo EPI</th>
    <th style="padding:6px 8px;border:1px solid #ccc;font-size:11px;">Equipamentos</th>
    <th style="padding:6px 8px;border:1px solid #ccc;font-size:11px;">Status</th>
    <th style="padding:6px 8px;border:1px solid #ccc;font-size:11px;">Higienizado</th>
  </tr>
  ${epiRows}
  <tr><td colspan="5" style="height:8px;"></td></tr>
  <tr style="background:#f3f4f6;font-weight:bold;">
    <td style="padding:6px 8px;border:1px solid #ccc;font-size:12px;" colspan="5">Resumo: Total ${stats.total} | Bom ${stats.greenPct}% | Atenção ${stats.yellowPct}% | Substituição ${stats.redPct}%</td>
  </tr>
</table>
</body></html>`;
}

// ======================== EMAIL EXPORT HELPER ========================

function generateEmailBody(auditsForEmail: EpiAudit[], stats: AuditStats): { subject: string; body: string } {
  if (auditsForEmail.length === 0) return { subject: "", body: "" };

  const latest = auditsForEmail[0];
  const dateStr = new Date(latest.data + "T12:00:00").toLocaleDateString("pt-BR");

  const subject = `Auditoria de EPIs - ${latest.colaborador} - ${dateStr}`;

  let body = `AUDITORIA DE EPIS\n`;
  body += `${"=".repeat(40)}\n\n`;
  body += `Colaborador: ${latest.colaborador}\n`;
  body += `Data: ${dateStr}\n`;
  body += `Responsável: ${latest.responsavel}\n`;
  if (latest.funcao) body += `Função: ${latest.funcao}\n`;
  if (latest.area) body += `Área: ${latest.area}\n`;
  body += `\n${"-".repeat(40)}\n`;
  body += `ITENS VERIFICADOS:\n\n`;

  for (const audit of auditsForEmail) {
    for (const epi of audit.epis) {
      if (!epi.nomes) continue;
      const status = getStatusColor(epi);
      const statusIcon = status === "green" ? "✅ Bom" : status === "yellow" ? "🟡 Atenção" : "🔴 Substituição";
      body += `• ${epi.tipo}: ${epi.nomes} - ${statusIcon}`;
      if (epi.substituicao && epi.motivoSubstituicao) {
        const motivosEntries = Object.entries(epi.motivoSubstituicao).filter(([, v]) => v?.trim());
        if (motivosEntries.length > 0) {
          body += ` (Motivos: ${motivosEntries.map(([k, v]) => `${k}: ${v}`).join('; ')})`;
        }
      }
      if (!epi.higienizado) body += ` [Não higienizado]`;
      body += "\n";
    }
  }

  body += `\n${"-".repeat(40)}\n`;
  body += `RESUMO:\n`;
  body += `• Total de EPIs verificados: ${stats.total}\n`;
  body += `• Boas condições: ${stats.greenPct}%\n`;
  body += `• Atenção: ${stats.yellowPct}%\n`;
  body += `• Necessita substituição: ${stats.redPct}%\n`;
  body += `\n${"=".repeat(40)}\n`;
  body += `Gerado pela Plataforma Zamine Brasil\n`;

  return { subject, body };
}

// ======================== CAMERA CAPTURE DIALOG ========================

interface CameraCaptureDialogProps {
  isOpen: boolean;
  onCapture: (base64: string) => void;
  onCancel: () => void;
}

function CameraCaptureDialog({ isOpen, onCapture, onCancel }: CameraCaptureDialogProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Stop stream when dialog closes
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      return;
    }

    let cancelled = false;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        if (!cancelled) {
          setCameraError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
        }
      }
    }
    startCamera();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen]);

  const handleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const maxSize = 400;
    let w = video.videoWidth;
    let h = video.videoHeight;
    if (w > maxSize) {
      h = Math.round((h * maxSize) / w);
      w = maxSize;
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    onCapture(dataUrl);
    // Stop stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [onCapture]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-end sm:items-center justify-center z-[80] max-h-[90vh] sm:max-h-[85vh]">
      <div className="bg-zinc-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm border-0 sm:border border-zinc-700/50 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-zinc-700/50 flex items-center justify-between">
          <h3 className="text-orange-400 font-semibold text-sm flex items-center gap-2">
            <span className="material-icons text-lg">photo_camera</span>
            Capturar Foto
          </h3>
          <button onClick={onCancel} className="text-zinc-400 hover:text-white active:text-white active:bg-zinc-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg">
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="p-4 sm:p-5 flex-1 overflow-y-auto overscroll-contain">
          {cameraError ? (
            <div className="text-center py-6">
              <span className="material-icons text-4xl text-red-400 mb-2 block">videocam_off</span>
              <p className="text-red-400 text-sm">{cameraError}</p>
            </div>
          ) : (
            <div className="relative rounded-xl sm:rounded-2xl overflow-hidden bg-black aspect-[3/4] sm:aspect-[4/3] mb-4">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            {!cameraError && (
              <button
                onClick={handleCapture}
                className="flex-1 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 active:scale-[0.98] text-white py-3 min-h-[44px] rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <span className="material-icons text-lg">camera</span>
                Capturar
              </button>
            )}
            <button
              onClick={onCancel}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 active:scale-[0.98] text-zinc-300 py-3 min-h-[44px] rounded-xl font-semibold transition-colors text-sm border border-zinc-600/50"
            >
              Cancelar
            </button>
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}

// ======================== PHOTO PROMPT DIALOG ========================

interface PhotoPromptDialogProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

function PhotoPromptDialog({ isOpen, onAccept, onDecline }: PhotoPromptDialogProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-[75]">
      <div className="bg-zinc-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-xs border-0 sm:border border-zinc-700/50 shadow-2xl p-4 sm:p-6 text-center max-h-[90vh] sm:max-h-[85vh] overflow-y-auto overscroll-contain">
        <div className="w-14 h-14 rounded-full bg-orange-500/15 flex items-center justify-center mx-auto mb-4">
          <span className="material-icons text-orange-500 text-2xl">photo_camera</span>
        </div>
        <h3 className="text-white font-semibold text-base sm:text-lg mb-2">Tirar foto do colaborador?</h3>
        <p className="text-zinc-400 text-sm mb-5">Deseja capturar uma foto do colaborador para anexar à auditoria?</p>
        <div className="flex items-center gap-3">
          <button
            onClick={onAccept}
            className="flex-1 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 active:scale-[0.98] text-white py-2.5 min-h-[44px] rounded-xl font-semibold transition-colors text-sm flex items-center justify-center gap-1.5"
          >
            <span className="material-icons text-base">check</span>
            Sim
          </button>
          <button
            onClick={onDecline}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 active:scale-[0.98] text-zinc-300 py-2.5 min-h-[44px] rounded-xl font-semibold transition-colors text-sm border border-zinc-600/50"
          >
            Não
          </button>
        </div>
      </div>
    </div>
  );
}

// ======================== DETAIL SUB-MODAL ========================

interface DetailSubModalProps {
  detailAudits: EpiAudit[];
  detailTitle: string;
  detailStats: AuditStats | null;
  selectedForDelete: Set<string>;
  onClose: () => void;
  onDeleteSingle: (id: string) => void;
  onDeleteSelected: () => void;
  onToggleSelect: (id: string) => void;
  onPrint: () => void;
  onExportExcel: () => void;
  onExportEmail: () => void;
  onRemovePhoto: (id: string) => void;
}

function DetailSubModal({
  detailAudits,
  detailTitle,
  detailStats,
  selectedForDelete,
  onClose,
  onDeleteSingle,
  onDeleteSelected,
  onToggleSelect,
  onPrint,
  onExportExcel,
  onExportEmail,
  onRemovePhoto,
}: DetailSubModalProps) {
  if (!detailAudits) return null;

  // Find the latest photo from these audits
  const latestPhoto = detailAudits.find((a) => a.foto)?.foto;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] overflow-hidden">
      <div className="bg-zinc-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[85vh] flex flex-col border-0 sm:border border-zinc-700/50 shadow-2xl overscroll-contain">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-zinc-700/50 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button onClick={onClose} className="text-zinc-400 hover:text-white active:bg-zinc-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg">
              <span className="material-icons">arrow_back</span>
            </button>
            <div className="min-w-0">
              <h3 className="text-orange-400 font-semibold text-sm sm:text-base truncate">{detailTitle}</h3>
              <p className="text-zinc-500 text-xs">{detailAudits.length} registro(s)</p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0 flex-wrap justify-end">
            <button
              onClick={onExportExcel}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 sm:py-2 bg-green-600/20 hover:bg-green-600/30 active:bg-green-600/40 text-green-400 text-xs rounded-lg transition-colors border border-green-500/30 min-h-[44px] sm:min-h-0"
              title="Exportar Excel"
            >
              <span className="material-icons text-sm">table_chart</span>
              <span className="hidden sm:inline">Excel</span>
            </button>
            <button
              onClick={onExportEmail}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 sm:py-2 bg-blue-600/20 hover:bg-blue-600/30 active:bg-blue-600/40 text-blue-400 text-xs rounded-lg transition-colors border border-blue-500/30 min-h-[44px] sm:min-h-0"
              title="Enviar por Email"
            >
              <span className="material-icons text-sm">email</span>
              <span className="hidden sm:inline">Email</span>
            </button>
            <button
              onClick={onPrint}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 sm:py-2 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-white text-xs rounded-lg transition-colors border border-zinc-600/50 min-h-[44px] sm:min-h-0"
              title="Imprimir relatório"
            >
              <span className="material-icons text-sm">print</span>
              <span className="hidden sm:inline">Imprimir</span>
            </button>
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white active:bg-zinc-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg">
              <span className="material-icons">close</span>
            </button>
          </div>
        </div>

        {/* Photo area */}
        {latestPhoto && (
          <div className="px-4 sm:px-5 py-3 border-b border-zinc-700/30 flex items-center gap-3 sm:gap-4 flex-shrink-0">
            <img
              src={latestPhoto}
              alt="Foto do colaborador"
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl object-cover border-2 border-orange-500/40"
            />
            <div className="flex-1 min-w-0">
              <p className="text-zinc-300 text-xs font-medium">Foto do colaborador</p>
              <p className="text-zinc-500 text-xs">Anexada à auditoria</p>
            </div>
            {detailAudits.filter((a) => a.foto).length === 1 && (
              <button
                onClick={() => {
                  const auditWithPhoto = detailAudits.find((a) => a.foto);
                  if (auditWithPhoto) onRemovePhoto(auditWithPhoto.id);
                }}
                className="flex items-center gap-1 px-2.5 py-2 sm:py-1.5 text-red-400 hover:bg-red-500/10 active:bg-red-500/20 rounded-lg transition-colors text-xs min-h-[44px] sm:min-h-0"
                title="Remover foto"
              >
                <span className="material-icons text-sm">delete</span>
                <span className="hidden sm:inline">Remover</span>
              </button>
            )}
          </div>
        )}

        {/* Stats bar */}
        {detailStats && detailStats.total > 0 && (
          <div className="px-4 sm:px-5 py-3 border-b border-zinc-700/30 flex items-center gap-3 sm:gap-4 flex-wrap flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-icons text-green-400 text-sm">check_circle</span>
              <span className="text-xs text-zinc-300">
                <span className="font-semibold text-green-400">{detailStats.greenPct}%</span> bom estado
              </span>
            </div>
            {detailStats.red > 0 && (
              <div className="flex items-center gap-2">
                <span className="material-icons text-red-400 text-sm">warning</span>
                <span className="text-xs text-zinc-300">
                  <span className="font-semibold text-red-400">{detailStats.redPct}%</span> substituir
                </span>
              </div>
            )}
            <div className="text-xs text-zinc-500">{detailStats.total} EPI(s) verificado(s)</div>
          </div>
        )}

        {/* Delete selected bar */}
        {selectedForDelete.size > 0 && (
          <div className="px-5 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between flex-shrink-0 gap-2">
            <span className="text-xs text-red-400 flex-shrink-0">{selectedForDelete.size} selecionado(s)</span>
            <button
              onClick={onDeleteSelected}
              className="flex items-center gap-1 px-3 py-2 bg-red-500 hover:bg-red-600 active:bg-red-700 active:scale-95 text-white text-xs rounded-lg transition-colors min-h-[44px] sm:min-h-0"
            >
              <span className="material-icons text-sm">delete</span>
              Excluir
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5 py-4 space-y-4">
          {detailAudits.map((audit) => {
            const isSelected = selectedForDelete.has(audit.id);
            return (
              <div
                key={audit.id}
                className={`bg-zinc-800/60 rounded-xl p-4 border transition-colors ${
                  isSelected ? "border-red-500/50 bg-red-500/5" : "border-zinc-700/40"
                }`}
              >
                {/* Audit header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(audit.id)}
                      className="w-5 h-5 sm:w-4 sm:h-4 rounded border-zinc-500 bg-zinc-900 text-orange-500 focus:ring-orange-500 accent-orange-500"
                    />
                    {audit.foto && (
                      <img
                        src={audit.foto}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover border border-zinc-600"
                      />
                    )}
                    <div>
                      <p className="text-white text-sm font-medium">
                        {new Date(audit.data).toLocaleDateString("pt-BR")}
                      </p>
                      <p className="text-zinc-500 text-xs">
                        Resp: {audit.responsavel}
                        {audit.funcao && ` • ${audit.funcao}`}
                        {audit.area && ` • ${audit.area}`}
                      </p>
                    </div>
                  </div>
              <div className="flex items-center gap-1">
                    {audit.foto && (
                      <button
                        onClick={() => onRemovePhoto(audit.id)}
                        className="p-2 sm:p-1.5 text-zinc-500 hover:text-orange-400 hover:bg-orange-500/10 active:bg-orange-500/20 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                        title="Remover foto"
                      >
                        <span className="material-icons text-base">no_photography</span>
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteSingle(audit.id)}
                      className="p-2 sm:p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                      title="Excluir"
                    >
                      <span className="material-icons text-lg">delete_outline</span>
                    </button>
                  </div>
                </div>

                {/* Observações */}
                {audit.observacoes && (
                  <p className="text-zinc-400 text-xs mb-3 bg-zinc-900/50 rounded-lg px-3 py-2 border-l-2 border-orange-500/40">
                    {audit.observacoes}
                  </p>
                )}

                {/* EPI List */}
                <div className="space-y-2">
                  {audit.epis.map((epi, ei) => {
                    const status = getStatusColor(epi);
                    const names = getEpiNamesArray(epi);
                    return (
                      <div key={ei}>
                        <div className="flex items-center gap-3 py-1.5">
                          <StatusBadge status={status} />
                          <div className="flex-1 min-w-0">
                            <p className="text-zinc-300 text-xs font-medium">{epi.tipo}</p>
                            <p className="text-zinc-500 text-xs truncate">{names.join(", ")}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {epi.condicao && (
                              <span className="material-icons text-green-500 text-sm" title="Boas condições">check</span>
                            )}
                            {epi.higienizado && (
                              <span className="material-icons text-blue-400 text-sm" title="Higienizado">water_drop</span>
                            )}
                            {epi.substituicao && (
                              <span className="material-icons text-red-400 text-sm" title="Substituição">autorenew</span>
                            )}
                          </div>
                        </div>
                        {epi.substituicao && epi.motivoSubstituicao && (() => {
                          const entries = Object.entries(epi.motivoSubstituicao).filter(([, v]) => v?.trim());
                          return entries.length > 0;
                        })() && (
                          <div className="ml-8 mb-1 px-2.5 py-1.5 bg-red-500/10 rounded-lg border-l-2 border-red-500/40 space-y-1">
                            {Object.entries(epi.motivoSubstituicao || {}).filter(([, v]) => v?.trim()).map(([itemName, motivo]) => (
                              <p key={itemName} className="text-red-400/80 text-xs">
                                <span className="font-medium">{itemName}:</span> {motivo}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ======================== INDICADORES PANEL ========================

interface IndicadoresPanelProps {
  audits: EpiAudit[];
}

function IndicadoresPanel({ audits }: IndicadoresPanelProps) {
  const [filterCollab, setFilterCollab] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterArea, setFilterArea] = useState("");

  // Compute all unique values
  const allCollaborators = useMemo(() => {
    const s = new Set<string>();
    for (const a of audits) if (a.colaborador?.trim()) s.add(a.colaborador.trim());
    return Array.from(s).sort();
  }, [audits]);

  const allMonths = useMemo(() => {
    const s = new Set<string>();
    for (const a of audits) s.add(a.data.slice(0, 7));
    return Array.from(s).sort().reverse();
  }, [audits]);

  const allAreas = useMemo(() => {
    const s = new Set<string>();
    for (const a of audits) if (a.area?.trim()) s.add(a.area.trim());
    return Array.from(s).sort();
  }, [audits]);

  // Filtered audits
  const filteredAudits = useMemo(() => {
    return audits.filter((a) => {
      if (filterCollab && a.colaborador !== filterCollab) return false;
      if (filterMonth && !a.data.startsWith(filterMonth)) return false;
      if (filterArea && a.area !== filterArea) return false;
      return true;
    });
  }, [audits, filterCollab, filterMonth, filterArea]);

  // Summary stats
  const totalAudits = filteredAudits.length;
  const totalCollaborators = new Set(filteredAudits.map((a) => a.colaborador)).size;
  const overallStats = useMemo(() => calcStats(filteredAudits), [filteredAudits]);

  // Monthly trend (only existing months)
  const monthlyTrend = useMemo(() => {
    const monthMap = new Map<string, { count: number; conformity: number }>();
    for (const a of filteredAudits) {
      if (!a.data) continue;
      const key = a.data.slice(0, 7); // "YYYY-MM"
      const existing = monthMap.get(key) || { count: 0, conformity: 0 };
      existing.count++;
      const stats = calcStats([a]);
      existing.conformity = stats.total > 0 ? stats.greenPct : 0;
      monthMap.set(key, existing);
    }
    // Sort by date descending, take last 12
    const sortedKeys = Array.from(monthMap.keys()).sort().reverse().slice(0, 12);
    return sortedKeys.map((key) => {
      const [year, month] = key.split("-");
      const label = MESES_PT[month]?.slice(0, 3) || month;
      const data = monthMap.get(key)!;
      return { key, label: `${label} ${year.slice(2)}`, count: data.count, conformity: data.conformity };
    });
  }, [filteredAudits]);

  const maxMonthCount = Math.max(...monthlyTrend.map((m) => m.count), 1);

  // Conformity pie data
  const pieGreen = overallStats.greenPct;
  const pieYellow = overallStats.yellowPct;
  const pieRed = overallStats.redPct;
  const pieGray = 100 - pieGreen - pieYellow - pieRed;
  const pieGradient = pieGreen > 0 || pieYellow > 0 || pieRed > 0
    ? `conic-gradient(#22c55e 0% ${pieGreen}%, #eab308 ${pieGreen}% ${pieGreen + pieYellow}%, #ef4444 ${pieGreen + pieYellow}% ${pieGreen + pieYellow + pieRed}%, #52525b ${pieGreen + pieYellow + pieRed}% 100%)`
    : "#52525b";

  // Top collaborators ranking
  const collaboratorRanking = useMemo(() => {
    const map = new Map<string, { count: number; green: number; total: number }>();
    for (const a of filteredAudits) {
      const c = a.colaborador;
      if (!c) continue;
      const existing = map.get(c) || { count: 0, green: 0, total: 0 };
      existing.count++;
      for (const epi of a.epis) {
        if (!epi.nomes) continue;
        existing.total++;
        if (getStatusColor(epi) === "green") existing.green++;
      }
      map.set(c, existing);
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, audits: data.count, conformity: data.total > 0 ? Math.round((data.green / data.total) * 100) : 0 }))
      .sort((a, b) => b.audits - a.audits)
      .slice(0, 8);
  }, [filteredAudits]);

  // EPI categories breakdown
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { total: number; red: number; yellow: number }>();
    for (const a of filteredAudits) {
      for (const epi of a.epis) {
        if (!epi.nomes) continue;
        const existing = map.get(epi.tipo) || { total: 0, red: 0, yellow: 0 };
        existing.total++;
        const st = getStatusColor(epi);
        if (st === "red") existing.red++;
        else if (st === "yellow") existing.yellow++;
        map.set(epi.tipo, existing);
      }
    }
    return Array.from(map.entries())
      .map(([tipo, data]) => ({ tipo, total: data.total, red: data.red, yellow: data.yellow, issuePct: data.total > 0 ? Math.round(((data.red + data.yellow) / data.total) * 100) : 0 }))
      .sort((a, b) => b.issuePct - a.issuePct);
  }, [filteredAudits]);

  const maxCatIssue = Math.max(...categoryBreakdown.map((c) => c.issuePct), 1);

  // Recent 5 audits
  const recentAudits = useMemo(() => {
    return [...filteredAudits]
      .sort((a, b) => new Date(b.createdAt || b.data).getTime() - new Date(a.createdAt || a.data).getTime())
      .slice(0, 5);
  }, [filteredAudits]);

  if (audits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="material-icons text-5xl text-zinc-600 mb-3">analytics</span>
        <p className="text-zinc-400 text-sm">Nenhum dado para os indicadores.</p>
        <p className="text-zinc-500 text-xs mt-1">Registre auditorias para ver as estatísticas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <div className="bg-zinc-800/60 rounded-xl p-3 sm:p-4 border border-zinc-700/40">
          <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
            <span className="material-icons text-orange-400 text-lg">fact_check</span>
            <span className="text-zinc-400 text-[11px] sm:text-xs font-medium">Total Auditorias</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">{totalAudits}</p>
        </div>
        <div className="bg-zinc-800/60 rounded-xl p-3 sm:p-4 border border-zinc-700/40">
          <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
            <span className="material-icons text-orange-400 text-lg">groups</span>
            <span className="text-zinc-400 text-[11px] sm:text-xs font-medium">Colaboradores</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">{totalCollaborators}</p>
        </div>
        <div className="bg-zinc-800/60 rounded-xl p-3 sm:p-4 border border-zinc-700/40">
          <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
            <span className="material-icons text-orange-400 text-lg">shield</span>
            <span className="text-zinc-400 text-[11px] sm:text-xs font-medium">EPIs Verificados</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">{overallStats.total}</p>
        </div>
        <div className="bg-zinc-800/60 rounded-xl p-3 sm:p-4 border border-zinc-700/40">
          <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
            <span className="material-icons text-orange-400 text-lg">trending_up</span>
            <span className="text-zinc-400 text-[11px] sm:text-xs font-medium">% Conformidade</span>
          </div>
          <p className={`text-xl sm:text-2xl font-bold ${overallStats.greenPct >= 80 ? "text-green-400" : overallStats.greenPct >= 50 ? "text-yellow-400" : "text-red-400"}`}>
            {overallStats.greenPct}%
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-zinc-800/60 rounded-xl p-3 border border-zinc-700/40">
        <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={filterCollab}
          onChange={(e) => setFilterCollab(e.target.value)}
          className="w-full sm:flex-1 sm:min-w-[120px] px-3 py-2.5 sm:py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-xs focus:outline-none focus:border-orange-500 min-h-[44px] sm:min-h-0"
        >
          <option value="">Todos Colaboradores</option>
          {allCollaborators.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="w-full sm:flex-1 sm:min-w-[120px] px-3 py-2.5 sm:py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-xs focus:outline-none focus:border-orange-500 min-h-[44px] sm:min-h-0"
        >
          <option value="">Todos os Meses</option>
          {allMonths.map((m) => <option key={m} value={m}>{formatDateLabel(m + "-01")}</option>)}
        </select>
        <select
          value={filterArea}
          onChange={(e) => setFilterArea(e.target.value)}
          className="w-full sm:flex-1 sm:min-w-[120px] px-3 py-2.5 sm:py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-xs focus:outline-none focus:border-orange-500 min-h-[44px] sm:min-h-0"
        >
          <option value="">Todas as Áreas</option>
          {allAreas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        {(filterCollab || filterMonth || filterArea) && (
          <button
            onClick={() => { setFilterCollab(""); setFilterMonth(""); setFilterArea(""); }}
            className="w-full sm:w-auto px-3 py-2.5 sm:py-2 bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 text-zinc-300 text-xs rounded-lg transition-colors flex items-center justify-center gap-1 min-h-[44px] sm:min-h-0"
          >
            <span className="material-icons text-sm">clear</span>
            Limpar
          </button>
        )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Monthly Trend Bar Chart */}
        <div className="bg-zinc-800/60 rounded-xl p-3 sm:p-4 border border-zinc-700/40">
          <h4 className="text-zinc-300 font-semibold text-sm mb-4 flex items-center gap-2">
            <span className="material-icons text-orange-400 text-base">bar_chart</span>
            Auditorias por Mês
          </h4>
          <div className="flex items-end gap-1 sm:gap-1.5 h-32 sm:h-40 overflow-x-auto pb-1">
            {monthlyTrend.map((m) => {
              const h = maxMonthCount > 0 ? Math.max((m.count / maxMonthCount) * 100, 4) : 4;
              const barColor = m.conformity > 80 ? "bg-green-500" : m.conformity > 50 ? "bg-yellow-500" : m.count > 0 ? "bg-red-500" : "bg-zinc-700";
              return (
                <div key={m.key} className="flex-1 min-w-[28px] sm:min-w-0 flex flex-col items-center gap-1">
                  <div className="text-zinc-500 text-[10px]">{m.count > 0 ? m.count : ""}</div>
                  <div
                    className={`w-full rounded-t-sm ${barColor} transition-all`}
                    style={{ height: `${h}%`, minHeight: "4px" }}
                    title={`${m.label}: ${m.count} auditorias, ${m.conformity}% conformidade`}
                  />
                  <div className="text-zinc-500 text-[9px] leading-tight text-center truncate w-full">{m.label}</div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 justify-center">
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /><span className="text-zinc-500 text-[10px]">&gt;80%</span></div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /><span className="text-zinc-500 text-[10px]">50-80%</span></div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /><span className="text-zinc-500 text-[10px]">&lt;50%</span></div>
          </div>
        </div>

        {/* Conformidade Pie Chart */}
        <div className="bg-zinc-800/60 rounded-xl p-3 sm:p-4 border border-zinc-700/40">
          <h4 className="text-zinc-300 font-semibold text-sm mb-4 flex items-center gap-2">
            <span className="material-icons text-orange-400 text-base">donut_small</span>
            Distribuição de Conformidade
          </h4>
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 justify-center">
            <div
              className="w-24 h-24 sm:w-32 sm:h-32 rounded-full flex-shrink-0 shadow-lg"
              style={{ background: pieGradient }}
            />
            <div className="space-y-2 flex flex-row sm:flex-col gap-x-4 sm:gap-x-0">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-green-500 flex-shrink-0" />
                <span className="text-zinc-300 text-xs">Bom: <span className="font-semibold text-green-400">{pieGreen}%</span></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-yellow-500 flex-shrink-0" />
                <span className="text-zinc-300 text-xs">Atenção: <span className="font-semibold text-yellow-400">{pieYellow}%</span></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-red-500 flex-shrink-0" />
                <span className="text-zinc-300 text-xs">Substituir: <span className="font-semibold text-red-400">{pieRed}%</span></span>
              </div>
              {pieGray > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-zinc-600 flex-shrink-0" />
                  <span className="text-zinc-300 text-xs">Vazio: <span className="font-semibold text-zinc-400">{pieGray}%</span></span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Top Collaborators Table */}
      <div className="bg-zinc-800/60 rounded-xl p-3 sm:p-4 border border-zinc-700/40">
        <h4 className="text-zinc-300 font-semibold text-sm mb-3 flex items-center gap-2">
          <span className="material-icons text-orange-400 text-base">emoji_events</span>
          Ranking de Colaboradores
        </h4>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-700/50">
                <th className="text-left py-2 px-2 text-zinc-400 font-medium w-8">#</th>
                <th className="text-left py-2 px-2 text-zinc-400 font-medium">Colaborador</th>
                <th className="text-center py-2 px-2 text-zinc-400 font-medium hidden sm:table-cell">Auditorias</th>
                <th className="text-center py-2 px-2 text-zinc-400 font-medium">Conformidade</th>
              </tr>
            </thead>
            <tbody>
              {collaboratorRanking.map((c, i) => (
                <tr key={c.name} className="border-b border-zinc-700/20 hover:bg-zinc-700/20 transition-colors">
                  <td className="py-2 px-2 text-zinc-500 w-8">{i + 1}</td>
                  <td className="py-2 px-2 text-zinc-200 font-medium truncate max-w-[140px] sm:max-w-none">{c.name}</td>
                  <td className="py-2 px-2 text-center text-zinc-300 hidden sm:table-cell">{c.audits}</td>
                  <td className="py-2 px-2 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.conformity >= 80 ? "bg-green-500/20 text-green-400" : c.conformity >= 50 ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"
                    }`}>
                      {c.conformity}%
                    </span>
                  </td>
                </tr>
              ))}
              {collaboratorRanking.length === 0 && (
                <tr><td colSpan={3} className="py-4 text-center text-zinc-500">Sem dados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EPI Categories Breakdown */}
      <div className="bg-zinc-800/60 rounded-xl p-3 sm:p-4 border border-zinc-700/40">
        <h4 className="text-zinc-300 font-semibold text-sm mb-3 flex items-center gap-2">
          <span className="material-icons text-orange-400 text-base">category</span>
          Problemas por Categoria de EPI
        </h4>
        <div className="space-y-2.5">
          {categoryBreakdown.map((cat) => (
            <div key={cat.tipo}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-zinc-300 text-xs font-medium truncate flex-1 mr-2">{cat.tipo}</span>
                <span className="text-zinc-400 text-[10px] ml-2 flex-shrink-0">{cat.red + cat.yellow}/{cat.total} problemas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-4 bg-zinc-700/50 rounded-full overflow-hidden flex">
                  <div className="h-full bg-red-500" style={{ width: `${cat.total > 0 ? (cat.red / cat.total) * 100 : 0}%` }} />
                  <div className="h-full bg-yellow-500" style={{ width: `${cat.total > 0 ? (cat.yellow / cat.total) * 100 : 0}%` }} />
                </div>
                <span className={`text-xs font-medium w-10 text-right ${cat.issuePct > 50 ? "text-red-400" : cat.issuePct > 20 ? "text-yellow-400" : "text-green-400"}`}>
                  {cat.issuePct}%
                </span>
              </div>
            </div>
          ))}
          {categoryBreakdown.length === 0 && (
            <p className="text-zinc-500 text-xs text-center py-3">Sem dados</p>
          )}
        </div>
      </div>

      {/* Recent Audits */}
      <div className="bg-zinc-800/60 rounded-xl p-3 sm:p-4 border border-zinc-700/40">
        <h4 className="text-zinc-300 font-semibold text-sm mb-3 flex items-center gap-2">
          <span className="material-icons text-orange-400 text-base">schedule</span>
          Auditorias Recentes
        </h4>
        <div className="space-y-2">
          {recentAudits.map((a) => {
            const st = calcStats([a]);
            const dotColor = st.greenPct >= 80 ? "bg-green-400" : st.greenPct >= 50 ? "bg-yellow-400" : "bg-red-400";
            return (
              <div key={a.id} className="flex items-center gap-3 py-2 px-3 bg-zinc-900/40 rounded-lg hover:bg-zinc-900/60 active:bg-zinc-800/60 transition-colors min-h-[44px]">
                <span className={`w-2.5 h-2.5 rounded-full ${dotColor} flex-shrink-0`} />
                {a.foto && (
                  <img src={a.foto} alt="" className="w-7 h-7 rounded-full object-cover border border-zinc-600 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-200 text-xs font-medium truncate">{a.colaborador}</p>
                  <p className="text-zinc-500 text-[10px]">{new Date(a.data).toLocaleDateString("pt-BR")} • {a.area || "Sem área"}</p>
                </div>
                <span className={`text-xs font-medium ${st.greenPct >= 80 ? "text-green-400" : st.greenPct >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                  {st.greenPct}%
                </span>
              </div>
            );
          })}
          {recentAudits.length === 0 && (
            <p className="text-zinc-500 text-xs text-center py-3">Sem dados</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ======================== MAIN COMPONENT ========================

export default function EpiAuditModal({ isOpen, onClose, stateName }: EpiAuditModalProps) {
  const [audits, setAudits] = useState<EpiAudit[]>([]);
  const [formData, setFormData] = useState(createEmptyFormData);
  const [mobileTab, setMobileTab] = useState<"history" | "form" | "indicadores">("history");
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedCollaborators, setExpandedCollaborators] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [detailAudits, setDetailAudits] = useState<EpiAudit[] | null>(null);
  const [detailTitle, setDetailTitle] = useState("");
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);

  // Photo capture state
  const [showPhotoPrompt, setShowPhotoPrompt] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [pendingAuditData, setPendingAuditData] = useState<EpiAudit | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | undefined>(undefined);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ---- Toast helper ----
  const addToast = useCallback((text: string, type: ToastMessage["type"] = "success") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // ---- Load audits from localStorage ----
  const loadAudits = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setAudits([]);
        return;
      }
      const parsed: EpiAudit[] = JSON.parse(raw);
      const migrated = parsed.map((a) => ({
        ...a,
        id: a.id || crypto.randomUUID(),
        createdAt: a.createdAt || a.data,
      }));
      const needsSave = parsed.some((a) => !a.id || !a.createdAt);
      if (needsSave) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      }
      setAudits(migrated);
    } catch {
      setAudits([]);
      addToast("Erro ao carregar auditorias do armazenamento local.", "error");
    }
  }, [addToast]);

  // Load audits when modal opens, and auto-expand latest month
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      setHasAutoExpanded(false);
      loadAudits();
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, loadAudits]);

  // Auto-expand latest month once after audits load
  useEffect(() => {
    if (!isOpen || hasAutoExpanded || audits.length === 0) return;
    const groups = groupAuditsByMonth(audits);
    const months = Object.keys(groups);
    if (months.length > 0) {
      const timer = setTimeout(() => {
        setExpandedMonths(new Set([months[0]]));
        setHasAutoExpanded(true);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, audits, hasAutoExpanded]);

  // ---- Save audits ----
  const saveAudits = useCallback((newAudits: EpiAudit[]) => {
    setAudits(newAudits);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newAudits));
    } catch {
      addToast("Erro ao salvar no armazenamento local.", "error");
    }
  }, [addToast]);

  // ---- Form handlers ----
  const updateFormData = useCallback((field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateEpi = useCallback((index: number, field: keyof EpiCategoryItem, value: string | boolean) => {
    setFormData((prev) => {
      const newEpis = [...prev.epis];
      newEpis[index] = { ...newEpis[index], [field]: value };
      return { ...prev, epis: newEpis };
    });
  }, []);

  const handleMultiSelect = useCallback((epiIndex: number, option: string) => {
    setFormData((prev) => {
      const epi = { ...prev.epis[epiIndex] };
      const currentNames = epi.nomes ? epi.nomes.split(", ").filter(Boolean) : [];
      if (currentNames.includes(option)) {
        epi.nomes = currentNames.filter((n) => n !== option).join(", ");
        if (option === "Outro") epi.outro = "";
      } else {
        epi.nomes = [...currentNames, option].join(", ");
      }
      const newEpis = [...prev.epis];
      newEpis[epiIndex] = epi;
      return { ...prev, epis: newEpis };
    });
  }, []);

  // ---- Finalize save with optional photo ----
  const finalizeSave = useCallback((photo: string | undefined) => {
    if (!pendingAuditData) return;

    const auditWithPhoto = { ...pendingAuditData };
    if (photo) auditWithPhoto.foto = photo;

    const updated = [auditWithPhoto, ...audits];
    saveAudits(updated);
    setFormData(createEmptyFormData());
    setPendingAuditData(null);
    setCapturedPhoto(undefined);
    addToast("Auditoria salva com sucesso!");
    setMobileTab("history");
  }, [pendingAuditData, audits, saveAudits, addToast]);

  const handleSave = useCallback(() => {
    if (!formData.data) {
      addToast("Preencha a data da auditoria.", "error");
      return;
    }
    if (!formData.responsavel.trim()) {
      addToast("Preencha o campo Responsável.", "error");
      return;
    }
    if (!formData.colaborador.trim()) {
      addToast("Preencha o campo Colaborador.", "error");
      return;
    }

    for (const epi of formData.epis) {
      if (epi.substituicao && epi.nomes) {
        const names = getEpiNamesArray(epi);
        const motivos = epi.motivoSubstituicao || {};
        for (const name of names) {
          if (!motivos[name]?.trim()) {
            addToast(`Preencha o motivo da substituição para: ${name} (${epi.tipo})`, "error");
            return;
          }
        }
      }
    }

    const filledEpis = formData.epis.filter((epi) => {
      if (!epi.nomes) return false;
      const names = epi.nomes.split(", ").filter(Boolean);
      if (names.length === 0) return false;
      if (names.length === 1 && names[0] === "Outro" && !epi.outro?.trim()) return false;
      return true;
    });

    if (filledEpis.length === 0) {
      addToast("Selecione ao menos um EPI para a auditoria.", "error");
      return;
    }

    const processedEpis = filledEpis.map((epi) => {
      const names = epi.nomes.split(", ").filter(Boolean);
      const finalNames = names.map((n) => (n === "Outro" && epi.outro?.trim() ? epi.outro.trim() : n));
      // Remap motivoSubstituicao keys when "Outro" is replaced with custom text
      const motivos = epi.motivoSubstituicao || {};
      const remappedMotivos: Record<string, string> = {};
      for (const n of names) {
        const finalName = n === "Outro" && epi.outro?.trim() ? epi.outro.trim() : n;
        if (motivos[n]) {
          remappedMotivos[finalName] = motivos[n];
        }
      }
      return { ...epi, nomes: finalNames.join(", "), motivoSubstituicao: remappedMotivos };
    });

    const newAudit: EpiAudit = {
      id: crypto.randomUUID(),
      data: formData.data,
      responsavel: formData.responsavel.trim(),
      funcao: formData.funcao.trim(),
      colaborador: formData.colaborador.trim(),
      area: formData.area.trim(),
      observacoes: formData.observacoes.trim(),
      epis: processedEpis,
      createdAt: new Date().toISOString(),
    };

    setPendingAuditData(newAudit);
    setShowPhotoPrompt(true);
  }, [formData, addToast]);

  // Photo capture callbacks
  const handlePhotoAccept = useCallback(() => {
    setShowPhotoPrompt(false);
    setShowCamera(true);
  }, []);

  const handlePhotoDecline = useCallback(() => {
    setShowPhotoPrompt(false);
    finalizeSave(undefined);
  }, [finalizeSave]);

  const handlePhotoCaptured = useCallback((base64: string) => {
    setShowCamera(false);
    setCapturedPhoto(base64);
    finalizeSave(base64);
  }, [finalizeSave]);

  // ---- Delete handlers ----
  const deleteSingleAudit = useCallback(
    (id: string) => {
      const updated = audits.filter((a) => a.id !== id);
      saveAudits(updated);
      addToast("Auditoria removida.", "info");
      setConfirmDeleteId(null);
      if (detailAudits) {
        const remaining = detailAudits.filter((a) => a.id !== id);
        if (remaining.length === 0) {
          setDetailAudits(null);
        } else {
          setDetailAudits(remaining);
        }
      }
    },
    [audits, saveAudits, addToast, detailAudits]
  );

  const deleteSelectedAudits = useCallback(() => {
    const updated = audits.filter((a) => !selectedForDelete.has(a.id));
    saveAudits(updated);
    addToast(`${selectedForDelete.size} auditoria(s) removida(s).`, "info");
    setSelectedForDelete(new Set());
    if (detailAudits) {
      const remaining = detailAudits.filter((a) => !selectedForDelete.has(a.id));
      if (remaining.length === 0) {
        setDetailAudits(null);
      } else {
        setDetailAudits(remaining);
      }
    }
  }, [audits, selectedForDelete, saveAudits, addToast, detailAudits]);

  // ---- Remove photo from audit ----
  const removePhotoFromAudit = useCallback(
    (id: string) => {
      const updated = audits.map((a) => a.id === id ? { ...a, foto: undefined } : a);
      saveAudits(updated);
      addToast("Foto removida da auditoria.", "info");
      if (detailAudits) {
        const updatedDetail = detailAudits.map((a) => a.id === id ? { ...a, foto: undefined } : a);
        setDetailAudits(updatedDetail);
      }
    },
    [audits, saveAudits, addToast, detailAudits]
  );

  // ---- Export JSON ----
  const handleExport = useCallback(() => {
    if (audits.length === 0) {
      addToast("Nenhuma auditoria para exportar.", "info");
      return;
    }
    const json = JSON.stringify(audits, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().split("T")[0];
    a.href = url;
    a.download = `auditoria_epis_${today}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast("Exportação realizada com sucesso!");
  }, [audits, addToast]);

  // ---- Import JSON ----
  const handleImport = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string) as EpiAudit[];
          if (!Array.isArray(imported)) {
            addToast("Arquivo inválido: formato não reconhecido.", "error");
            return;
          }

          const valid = imported.every(
            (a) =>
              typeof a.data === "string" &&
              typeof a.responsavel === "string" &&
              typeof a.colaborador === "string" &&
              Array.isArray(a.epis)
          );
          if (!valid) {
            addToast("Arquivo inválido: estrutura de dados incorreta.", "error");
            return;
          }

          const importedWithIds = imported.map((a) => ({
            ...a,
            id: a.id || crypto.randomUUID(),
            createdAt: a.createdAt || a.data,
          }));

          const existingMap = new Map(audits.map((a) => [a.id, a]));
          let newCount = 0;
          let updatedCount = 0;

          for (const imp of importedWithIds) {
            if (existingMap.has(imp.id)) {
              existingMap.set(imp.id, imp);
              updatedCount++;
            } else {
              existingMap.set(imp.id, imp);
              newCount++;
            }
          }

          const merged = Array.from(existingMap.values());
          saveAudits(merged);

          const msg =
            newCount > 0 && updatedCount > 0
              ? `${newCount} nova(s) e ${updatedCount} atualizada(s).`
              : newCount > 0
                ? `${newCount} nova(s) auditoria(s) importada(s).`
                : updatedCount > 0
                  ? `${updatedCount} auditoria(s) atualizada(s).`
                  : "Nenhuma alteração.";
          addToast(msg);
        } catch {
          addToast("Erro ao importar arquivo. Verifique o formato JSON.", "error");
        }
      };
      reader.readAsText(file);

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [audits, saveAudits, addToast]
  );

  // ---- Toggle expand helpers ----
  const toggleMonth = useCallback((month: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }, []);

  const toggleCollaborator = useCallback((key: string) => {
    setExpandedCollaborators((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ---- Detail view ----
  const openDetailView = useCallback((collaborator: string, monthLabel: string, monthAudits: EpiAudit[]) => {
    setDetailTitle(`${collaborator} - ${monthLabel}`);
    setDetailAudits(monthAudits.filter((a) => a.colaborador === collaborator));
    setSelectedForDelete(new Set());
  }, []);

  const closeDetailView = useCallback(() => {
    setDetailAudits(null);
    setSelectedForDelete(new Set());
  }, []);

  const toggleSelectForDelete = useCallback((id: string) => {
    setSelectedForDelete((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ---- Print report ----
  const handlePrintReport = useCallback(() => {
    if (!detailAudits || detailAudits.length === 0) {
      addToast("Nenhuma auditoria para imprimir.", "info");
      return;
    }
    const auditsToPrint = selectedForDelete.size > 0
      ? detailAudits.filter((a) => selectedForDelete.has(a.id))
      : detailAudits;
    if (auditsToPrint.length === 0) {
      addToast("Nenhuma auditoria selecionada para imprimir.", "info");
      return;
    }
    const stats = calcStats(auditsToPrint);
    const html = generatePrintHTML(auditsToPrint, stats);
    // Use hidden iframe to print - no URL, no header, no footer shown
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();
      iframe.onload = () => {
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 5000);
      };
      // Fallback if onload doesn't fire
      setTimeout(() => {
        try { iframe.contentWindow?.print(); } catch {}
        setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 3000);
      }, 1000);
    } else {
      document.body.removeChild(iframe);
      addToast("Não foi possível imprimir. Verifique o bloqueador de pop-ups.", "error");
    }
  }, [detailAudits, selectedForDelete, addToast]);

  // ---- Export Excel ----
  const handleExportExcel = useCallback(() => {
    if (!detailAudits || detailAudits.length === 0) {
      addToast("Nenhuma auditoria para exportar.", "info");
      return;
    }
    const auditsToExport = selectedForDelete.size > 0
      ? detailAudits.filter((a) => selectedForDelete.has(a.id))
      : detailAudits;
    if (auditsToExport.length === 0) {
      addToast("Nenhuma auditoria selecionada.", "info");
      return;
    }
    const stats = calcStats(auditsToExport);
    const html = generateExcelHTML(auditsToExport, stats);
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const latest = auditsToExport[0];
    const safeName = (latest.colaborador || "colaborador").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    const dateSlug = latest.data.replace(/-/g, "");
    a.href = url;
    a.download = `auditoria_epis_${safeName}_${dateSlug}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast("Exportação Excel realizada com sucesso!");
  }, [detailAudits, selectedForDelete, addToast]);

  // ---- Export Email ----
  const handleExportEmail = useCallback(() => {
    if (!detailAudits || detailAudits.length === 0) {
      addToast("Nenhuma auditoria para enviar.", "info");
      return;
    }
    const auditsForEmail = selectedForDelete.size > 0
      ? detailAudits.filter((a) => selectedForDelete.has(a.id))
      : detailAudits;
    if (auditsForEmail.length === 0) {
      addToast("Nenhuma auditoria selecionada.", "info");
      return;
    }
    const stats = calcStats(auditsForEmail);
    const { subject, body } = generateEmailBody(auditsForEmail, stats);
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }, [detailAudits, selectedForDelete, addToast]);

  // ---- Tab change helper ----
  const changeTab = useCallback((tab: "history" | "form" | "indicadores") => {
    setMobileTab(tab);
  }, []);

  // ======================== RENDER ========================

  if (!isOpen) return null;

  const monthGroups = groupAuditsByMonth(audits);
  const detailStats = detailAudits ? calcStats(detailAudits) : null;
  const activeTab = mobileTab;

  return (
    <div className="fixed inset-0 z-50" onWheel={(e) => e.stopPropagation()}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />

      {/* Modal container - fills viewport on mobile, centered card on desktop */}
      <div className="absolute inset-0 sm:inset-4 sm:flex sm:items-center sm:justify-center overflow-hidden">
        <div className="relative flex flex-col h-full w-full sm:h-auto sm:max-h-[92vh] sm:max-w-5xl lg:max-w-6xl bg-zinc-900 sm:rounded-2xl sm:border border-zinc-700/50 shadow-2xl overflow-hidden">
          <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />

          {/* ===== Header ===== */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-700/50 bg-zinc-900 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center flex-shrink-0">
                <span className="material-icons text-orange-500">verified</span>
              </div>
              <div className="min-w-0">
                <h2 className="text-orange-400 font-bold text-base sm:text-lg truncate">
                  Auditoria de EPIs
                </h2>
                {stateName && <p className="text-zinc-500 text-xs">{stateName}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleExport}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-white text-xs rounded-lg transition-colors border border-zinc-600/50"
                title="Exportar JSON"
              >
                <span className="material-icons text-sm">download</span>
                Exportar
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 hover:text-white text-xs rounded-lg transition-colors border border-zinc-600/50"
                title="Importar JSON"
              >
                <span className="material-icons text-sm">upload</span>
                Importar
              </button>
              <button
                onClick={handleExport}
                className="sm:hidden p-2 text-zinc-400 hover:text-white active:bg-zinc-700 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Exportar"
              >
                <span className="material-icons text-lg">download</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="sm:hidden p-2 text-zinc-400 hover:text-white active:bg-zinc-700 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Importar"
              >
                <span className="material-icons text-lg">upload</span>
              </button>
              <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white active:bg-zinc-700 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                <span className="material-icons text-xl">close</span>
              </button>
            </div>
          </div>

          {/* Hidden file input */}
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />

          {/* ===== Tab Bar ===== */}
          <div className="flex border-b border-zinc-700/50 bg-zinc-900/50 flex-shrink-0">
            <button
              onClick={() => changeTab("history")}
              className={`flex items-center justify-center gap-1.5 px-4 sm:px-6 py-3 sm:py-2.5 text-xs sm:text-sm font-medium transition-colors relative flex-1 sm:flex-none min-h-[44px] sm:min-h-0 active:bg-zinc-800 ${
                activeTab === "history"
                  ? "text-orange-400"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <span className="material-icons text-base">history</span>
              <span className="hidden sm:inline">Histórico</span>
              <span className="sm:hidden">Histórico</span>
              {audits.length > 0 && (
                <span className="bg-zinc-700 text-zinc-300 text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full">{audits.length}</span>
              )}
              {activeTab === "history" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />}
            </button>
            <button
              onClick={() => changeTab("form")}
              className={`flex items-center justify-center gap-1.5 px-4 sm:px-6 py-3 sm:py-2.5 text-xs sm:text-sm font-medium transition-colors relative flex-1 sm:flex-none min-h-[44px] sm:min-h-0 active:bg-zinc-800 ${
                activeTab === "form"
                  ? "text-orange-400"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <span className="material-icons text-base">add_circle</span>
              <span>Formulário</span>
              {activeTab === "form" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />}
            </button>
            <button
              onClick={() => changeTab("indicadores")}
              className={`flex items-center justify-center gap-1.5 px-4 sm:px-6 py-3 sm:py-2.5 text-xs sm:text-sm font-medium transition-colors relative flex-1 sm:flex-none min-h-[44px] sm:min-h-0 active:bg-zinc-800 ${
                activeTab === "indicadores"
                  ? "text-orange-400"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <span className="material-icons text-base">analytics</span>
              <span>Indicadores</span>
              {activeTab === "indicadores" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />}
            </button>
          </div>

          {/* ===== Tab Content - ONLY the active tab renders ===== */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {activeTab === "history" && (
              <div className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-zinc-300 font-semibold text-sm sm:text-base flex items-center gap-2">
                    <span className="material-icons text-orange-400 text-lg">history</span>
                    Histórico de Auditorias
                  </h3>
                  {audits.length > 0 && <span className="text-zinc-500 text-xs">{audits.length} total</span>}
                </div>
                <HistoryPanel
                  audits={audits}
                  monthGroups={monthGroups}
                  expandedMonths={expandedMonths}
                  expandedCollaborators={expandedCollaborators}
                  confirmDeleteId={confirmDeleteId}
                  onToggleMonth={toggleMonth}
                  onToggleCollaborator={toggleCollaborator}
                  onOpenDetail={openDetailView}
                  onSetConfirmDeleteId={setConfirmDeleteId}
                  onDeleteSingle={deleteSingleAudit}
                />
              </div>
            )}

            {activeTab === "form" && (
              <div className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-zinc-300 font-semibold text-sm sm:text-base flex items-center gap-2">
                    <span className="material-icons text-orange-400 text-lg">add_circle</span>
                    Nova Auditoria
                  </h3>
                </div>
                <FormPanel
                  formData={formData}
                  audits={audits}
                  onUpdateField={updateFormData}
                  onUpdateEpi={updateEpi}
                  onMultiSelect={handleMultiSelect}
                  onSave={handleSave}
                />
              </div>
            )}

            {activeTab === "indicadores" && (
              <div className="p-4 sm:p-5">
                <IndicadoresPanel audits={audits} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail sub-modal */}
      {detailAudits && (
        <DetailSubModal
          detailAudits={detailAudits}
          detailTitle={detailTitle}
          detailStats={detailStats}
          selectedForDelete={selectedForDelete}
          onClose={closeDetailView}
          onDeleteSingle={deleteSingleAudit}
          onDeleteSelected={deleteSelectedAudits}
          onToggleSelect={toggleSelectForDelete}
          onPrint={handlePrintReport}
          onExportExcel={handleExportExcel}
          onExportEmail={handleExportEmail}
          onRemovePhoto={removePhotoFromAudit}
        />
      )}

      {/* Photo prompt dialog */}
      <PhotoPromptDialog
        isOpen={showPhotoPrompt}
        onAccept={handlePhotoAccept}
        onDecline={handlePhotoDecline}
      />

      {/* Camera capture dialog */}
      <CameraCaptureDialog
        isOpen={showCamera}
        onCapture={handlePhotoCaptured}
        onCancel={() => {
          setShowCamera(false);
          finalizeSave(undefined);
        }}
      />

      {/* Toast notifications */}
      <div className="fixed bottom-20 sm:bottom-4 left-2 right-2 sm:left-1/2 sm:-translate-x-1/2 z-[90] flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 border max-w-full sm:max-w-md ${
              toast.type === "success"
                ? "bg-green-500/90 text-white border-green-400/50"
                : toast.type === "error"
                  ? "bg-red-500/90 text-white border-red-400/50"
                  : "bg-zinc-700/90 text-zinc-200 border-zinc-600/50"
            }`}
            style={{ animation: "epiToastSlideUp 0.3s ease-out" }}
          >
            <span className="material-icons text-base">
              {toast.type === "success" ? "check_circle" : toast.type === "error" ? "error" : "info"}
            </span>
            {toast.text}
          </div>
        ))}
      </div>

      <style jsx global>{`
        @keyframes epiToastSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
