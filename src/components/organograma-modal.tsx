'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authFetch } from '@/store/auth-store';
import './organograma.css';

/**
 * Organograma ZAMine — modal da plataforma.
 * Layout em cascata (linha central + cartões acima/abaixo + base lateral).
 * Pessoas vêm de /api/organograma; as FOTOS são resolvidas automaticamente
 * PELO NOME a partir do cadastro de colaboradores do painel TV
 * (aba Aniversariantes) — para crescer o organograma, basta editar aqui
 * (admin): adicionar/editar/remover pessoas e salvar.
 */

type Posicao = 'linha' | 'acima' | 'abaixo' | 'base';

type Pessoa = {
  id: string;
  nome: string;
  cargo: string;
  posicao: Posicao;
  fileira: number;
  ligacao: 'continua' | 'tracejada';
  vaga: boolean;
  fotoUrl?: string | null;
};

const ROTULO_POSICAO: Record<Posicao, string> = {
  linha: 'Linha central (gerência)',
  acima: 'Acima da linha',
  abaixo: 'Abaixo da linha',
  base: 'Base (lateral)',
};

function iniciais(nome: string): string {
  const t = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (!t.length) return '?';
  return t.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function novaId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID().slice(0, 12);
  } catch { /* ignore */ }
  return `p-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

/* ---------- cartão de pessoa (mesmo visual do layout de referência) ---------- */

function Cartao({ p, row }: { p: Pessoa; row?: boolean }) {
  const nome = p.vaga && !p.nome.trim() ? 'Vaga em aberto' : p.nome.trim() || '—';
  return (
    <div className={`on${row ? ' row' : ''}${p.vaga ? ' vaga' : ''}`}>
      <div className="oa">
        {p.fotoUrl ? (
          <img src={p.fotoUrl} alt={nome} loading="lazy" />
        ) : !p.vaga ? (
          <span className="ini">{iniciais(nome)}</span>
        ) : null}
      </div>
      <div className="ot">
        <b>{nome}</b>
        <span>{p.cargo.trim() || '\u00A0'}</span>
      </div>
    </div>
  );
}

/* ---------- modal ---------- */

export default function OrganogramaModal({ open, onClose, isAdmin }: { open: boolean; onClose: () => void; isAdmin: boolean }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [info, setInfo] = useState<{ atualizadoEm: string | null; atualizadoPor: string | null }>({ atualizadoEm: null, atualizadoPor: null });

  const [modoEdicao, setModoEdicao] = useState(false);
  const [rascunho, setRascunho] = useState<Pessoa[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const vpRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await authFetch('/api/organograma');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erro ao carregar o organograma');
      setPessoas(j.pessoas || []);
      setInfo({ atualizadoEm: j.atualizadoEm || null, atualizadoPor: j.atualizadoPor || null });
      setErro('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar o organograma');
    } finally {
      setCarregando(false);
    }
  }, []);

  /* carrega quando o modal abre (setState só depois de await, com cancelamento) */
  useEffect(() => {
    if (!open) return;
    let ativo = true;
    (async () => {
      try {
        const r = await authFetch('/api/organograma');
        const j = await r.json();
        if (!ativo) return;
        if (!r.ok) throw new Error(j.error || 'Erro ao carregar o organograma');
        setPessoas(j.pessoas || []);
        setInfo({ atualizadoEm: j.atualizadoEm || null, atualizadoPor: j.atualizadoPor || null });
        setErro('');
      } catch (e) {
        if (!ativo) return;
        setErro(e instanceof Error ? e.message : 'Erro ao carregar o organograma');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [open]);

  /** fecha o modal descartando rascunho, se estiver editando */
  const fecharTudo = () => {
    if (modoEdicao) { setModoEdicao(false); setRascunho([]); setMsg(null); }
    onClose();
  };

  const exibindo = modoEdicao ? rascunho : pessoas;

  const { linha, colunas, base, nCols } = useMemo(() => {
    const linha = exibindo.filter((p) => p.posicao === 'linha');
    const acima = exibindo.filter((p) => p.posicao === 'acima');
    const abaixo = exibindo.filter((p) => p.posicao === 'abaixo');
    const base = exibindo.filter((p) => p.posicao === 'base');
    const nCols = Math.max(0, ...acima.map((p) => p.fileira), ...abaixo.map((p) => p.fileira));
    const colunas = Array.from({ length: nCols }, (_, i) => ({
      acima: acima.find((p) => p.fileira === i + 1) || null,
      abaixo: abaixo.find((p) => p.fileira === i + 1) || null,
    }));
    return { linha, colunas, base, nCols };
  }, [exibindo]);

  /* ajusta o desenho à largura disponível (mesma lógica do layout de referência) */
  const ajustar = useCallback(() => {
    const vp = vpRef.current, tree = treeRef.current;
    if (!vp || !tree) return;
    tree.style.transform = 'none';
    const largura = tree.scrollWidth || 1;
    const altura = tree.scrollHeight || 1;
    const escala = Math.min(1, vp.clientWidth / largura);
    const escalaFinal = Math.max(escala, 0.45); // piso para não virar poeira no celular (rola na horizontal)
    tree.style.transform = `scale(${escalaFinal})`;
    const alvo = Math.round(altura * escalaFinal);
    const atual = parseFloat(vp.style.height || '0');
    if (Math.abs(atual - alvo) > 1) vp.style.height = `${alvo}px`;
  }, []);

  useEffect(() => {
    if (!open || carregando || erro) return;
    ajustar();
    const ro = new ResizeObserver(ajustar);
    if (vpRef.current) ro.observe(vpRef.current);
    window.addEventListener('resize', ajustar);
    return () => { ro.disconnect(); window.removeEventListener('resize', ajustar); };
  }, [open, carregando, erro, ajustar, exibindo, modoEdicao]);

  /* ---------- edição (admin) ---------- */

  const iniciarEdicao = () => {
    setRascunho(pessoas.map((p) => ({ ...p })));
    setMsg(null);
    setModoEdicao(true);
  };
  const cancelarEdicao = () => { setModoEdicao(false); setRascunho([]); setMsg(null); };

  const upd = (id: string, patch: Partial<Pessoa>) =>
    setRascunho((rs) => rs.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const mover = (id: string, dir: -1 | 1) =>
    setRascunho((rs) => {
      const i = rs.findIndex((p) => p.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= rs.length || rs[i].posicao !== rs[j].posicao) return rs;
      const copia = [...rs];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });

  const remover = (id: string) => setRascunho((rs) => rs.filter((p) => p.id !== id));

  /** Ao trocar a posição, sugere a próxima fileira livre do novo grupo (1, 2, 3…) */
  const mudarPosicao = (id: string, nova: Posicao) =>
    setRascunho((rs) =>
      rs.map((p) => {
        if (p.id !== id) return p;
        if (nova !== 'acima' && nova !== 'abaixo') return { ...p, posicao: nova, fileira: 0 };
        const grupo = rs.filter((x) => x.posicao === nova && x.id !== id);
        const proxima = Math.max(0, ...grupo.map((x) => x.fileira)) + 1;
        return { ...p, posicao: nova, fileira: proxima };
      })
    );

  const adicionar = () =>
    setRascunho((rs) => {
      const mesmo = rs.filter((p) => p.posicao === 'abaixo');
      const proxima = Math.max(0, ...mesmo.map((p) => p.fileira)) + 1;
      return [...rs, { id: novaId(), nome: '', cargo: '', posicao: 'abaixo', fileira: proxima, ligacao: 'continua', vaga: false, fotoUrl: null }];
    });

  const salvar = async () => {
    setSalvando(true);
    setMsg(null);
    try {
      const r = await authFetch('/api/organograma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pessoas: rascunho.map(({ fotoUrl, ...p }) => p) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erro ao salvar');
      setPessoas(j.pessoas || []);
      setInfo({ atualizadoEm: j.atualizadoEm || null, atualizadoPor: j.atualizadoPor || null });
      setModoEdicao(false);
      setRascunho([]);
      setMsg({ tipo: 'ok', texto: 'Organograma atualizado com sucesso.' });
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro ao salvar' });
    } finally {
      setSalvando(false);
    }
  };

  /* foto resolvida no carregamento (para o editor mostrar quem casou pelo nome) */
  const fotoPorId = useMemo(() => {
    const m = new Map<string, string | null>();
    pessoas.forEach((p) => m.set(p.id, p.fotoUrl || null));
    return m;
  }, [pessoas]);

  if (!open) return null;

  const colunasGrid = linha.length + nCols + (base.length ? 1 : 0);
  const infoAtualizacao = info.atualizadoEm
    ? `Atualizado em ${new Date(info.atualizadoEm).toLocaleDateString('pt-BR')} por ${info.atualizadoPor || '—'}`
    : 'Layout padrão — edite para personalizar';

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-[90] p-2 sm:p-4" onClick={fecharTudo}>
      <div className="w-full max-w-[1700px] h-[95vh] overflow-y-auto overscroll-contain bg-black rounded-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className="sticky top-0 z-10 bg-black px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-800">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button onClick={modoEdicao ? cancelarEdicao : fecharTudo} className="text-zinc-400 hover:text-white flex items-center gap-1 shrink-0">
                <span className="material-icons text-lg sm:text-xl">arrow_back</span>
                <span className="text-xs sm:text-sm">{modoEdicao ? 'Descartar' : 'Voltar'}</span>
              </button>
              <div className="h-4 sm:h-5 w-px bg-zinc-800 shrink-0"></div>
              <img src="/images/zamine-logo.png" alt="Zamine" className="h-6 sm:h-8" />
              <div className="hidden sm:flex items-center gap-1 text-[11px] text-zinc-500 truncate">
                <span className="material-icons text-sm">{info.atualizadoEm ? 'history' : 'info_outline'}</span>
                <span className="truncate">{infoAtualizacao}</span>
              </div>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2 shrink-0">
                {!modoEdicao ? (
                  <button
                    onClick={iniciarEdicao}
                    className="flex items-center gap-1 px-3 sm:px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm font-semibold transition-colors min-h-[44px]"
                  >
                    <span className="material-icons text-base">edit</span>
                    Editar
                  </button>
                ) : (
                  <>
                    <button
                      onClick={cancelarEdicao}
                      className="px-3 sm:px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs sm:text-sm font-medium transition-colors min-h-[44px]"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={salvar}
                      disabled={salvando}
                      className="flex items-center gap-1 px-3 sm:px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold transition-colors min-h-[44px]"
                    >
                      <span className="material-icons text-base">{salvando ? 'hourglass_top' : 'save'}</span>
                      {salvando ? 'Salvando…' : 'Salvar'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Conteúdo */}
        {carregando ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-zinc-400">
            <span className="material-icons text-4xl animate-spin text-orange-500">sync</span>
            <p className="text-sm">Carregando organograma…</p>
          </div>
        ) : erro ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-zinc-400 px-4 text-center">
            <span className="material-icons text-4xl text-red-400">error_outline</span>
            <p className="text-sm">{erro}</p>
            <button onClick={() => { setCarregando(true); carregar(); }} className="mt-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm min-h-[44px]">Tentar de novo</button>
          </div>
        ) : (
          <>
            {/* Desenho */}
            <section className="zm-org em-modal">
              <div className="hdr">
                <div>
                  <small>Services — Lundin Mining</small>
                  <h1>Nossa equipe</h1>
                </div>
              </div>
              <div className="vp" ref={vpRef}>
                <div className="tree" ref={treeRef} style={{ gridTemplateColumns: `repeat(${Math.max(colunasGrid, 1)}, auto)` }}>
                  {/* Linha central */}
                  {linha.map((p, i) => (
                    <div className={`c${i === 0 ? ' first' : ''}`} key={p.id}>
                      <div className="t"></div>
                      <div className="m sp"><Cartao p={p} /></div>
                      <div className="b"></div>
                    </div>
                  ))}
                  {/* Colunas acima/abaixo */}
                  {colunas.map((col, i) => {
                    const vh = ['vh'];
                    if (col.acima) vh.push('up');
                    if (col.abaixo) vh.push('dn');
                    if (col.acima?.ligacao === 'tracejada') vh.push('dt');
                    if (col.abaixo?.ligacao === 'tracejada') vh.push('db');
                    return (
                      <div className="c" key={col.acima?.id || col.abaixo?.id || `col-${i}`}>
                        <div className="t">
                          {col.acima && (
                            <>
                              <Cartao p={col.acima} />
                              <i className={`stem${col.acima.ligacao === 'tracejada' ? ' dash' : ''}`}></i>
                            </>
                          )}
                        </div>
                        <div className="m sp"><i className={vh.join(' ')}></i></div>
                        <div className="b">
                          {col.abaixo && (
                            <>
                              <i className={`stem${col.abaixo.ligacao === 'tracejada' ? ' dash' : ''}`}></i>
                              <Cartao p={col.abaixo} />
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {/* Base lateral */}
                  {base.length > 0 && (
                    <div className="base">
                      <div className="bl">
                        {base.map((p) => (
                          <div className="bi" key={p.id}>
                            <i className={`hst${p.ligacao === 'tracejada' ? ' dash' : ''}`}></i>
                            <Cartao p={p} row />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Editor (admin) */}
            {modoEdicao && (
              <div className="px-4 sm:px-8 pb-10 max-w-4xl mx-auto w-full">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <span className="material-icons text-orange-500">tune</span>
                      Editar organograma
                    </h2>
                    <button
                      onClick={adicionar}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs sm:text-sm font-medium min-h-[44px]"
                    >
                      <span className="material-icons text-base text-orange-400">person_add</span>
                      Adicionar pessoa
                    </button>
                  </div>
                  <p className="text-[11px] sm:text-xs text-zinc-400 leading-relaxed mb-4">
                    As fotos são buscadas <strong className="text-zinc-200">automaticamente pelo nome</strong> no cadastro de colaboradores
                    (Painel TV → Aniversariantes). Se alguém entrar na equipe, adicione aqui com o mesmo nome do cadastro que a foto aparece sozinha.
                    <strong className="text-zinc-200"> Fileira</strong> = coluna depois da linha central (1, 2, 3…); quem tem a mesma fileira
                    em cima e embaixo fica na mesma coluna do desenho.
                  </p>

                  <div className="flex flex-col gap-3 max-h-[52vh] overflow-y-auto pr-1 organograma-editor-lista">
                    {rascunho.map((p, idx) => {
                      const foto = p.id.startsWith('p-') ? fotoPorId.get(p.id) ?? null : null;
                      return (
                        <div key={p.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 sm:p-4 flex flex-col gap-3">
                          <div className="flex items-start gap-3">
                            <div className="w-11 h-11 rounded-full overflow-hidden bg-zinc-800 border-2 border-orange-500/70 flex items-center justify-center shrink-0">
                              {foto ? (
                                <img src={foto} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[10px] text-zinc-500 leading-tight text-center px-0.5">{p.vaga ? 'vaga' : 'sem foto'}</span>
                              )}
                            </div>
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
                              <input
                                value={p.nome}
                                onChange={(e) => upd(p.id, { nome: e.target.value })}
                                placeholder={p.vaga ? 'Vaga em aberto (pode ficar vazio)' : 'Nome (igual ao cadastro de colaboradores)'}
                                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-orange-500 min-h-[44px]"
                              />
                              <input
                                value={p.cargo}
                                onChange={(e) => upd(p.id, { cargo: e.target.value })}
                                placeholder="Cargo (ex.: Mechanical Technician)"
                                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-orange-500 min-h-[44px]"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={p.posicao}
                              onChange={(e) => mudarPosicao(p.id, e.target.value as Posicao)}
                              className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-xs sm:text-sm focus:outline-none focus:border-orange-500 min-h-[44px]"
                            >
                              {(Object.keys(ROTULO_POSICAO) as Posicao[]).map((k) => (
                                <option key={k} value={k}>{ROTULO_POSICAO[k]}</option>
                              ))}
                            </select>

                            {(p.posicao === 'acima' || p.posicao === 'abaixo') && (
                              <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                                Fileira
                                <input
                                  type="number"
                                  min={1}
                                  max={24}
                                  value={p.fileira || ''}
                                  onChange={(e) => upd(p.id, { fileira: Math.max(1, Math.min(24, parseInt(e.target.value, 10) || 1)) })}
                                  className="w-16 px-2 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-orange-500 min-h-[44px]"
                                />
                              </label>
                            )}

                            {p.posicao !== 'linha' && (
                              <select
                                value={p.ligacao}
                                onChange={(e) => upd(p.id, { ligacao: e.target.value as 'continua' | 'tracejada' })}
                                className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-xs sm:text-sm focus:outline-none focus:border-orange-500 min-h-[44px]"
                              >
                                <option value="continua">Linha contínua</option>
                                <option value="tracejada">Linha tracejada</option>
                              </select>
                            )}

                            <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={p.vaga}
                                onChange={(e) => upd(p.id, { vaga: e.target.checked })}
                                className="w-4 h-4 accent-orange-500"
                              />
                              Vaga em aberto
                            </label>

                            <div className="flex items-center gap-1 ml-auto">
                              <button onClick={() => mover(p.id, -1)} disabled={idx === 0} title="Mover para cima"
                                className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 disabled:opacity-40 min-h-[44px] min-w-[44px] flex items-center justify-center">
                                <span className="material-icons text-base">arrow_upward</span>
                              </button>
                              <button onClick={() => mover(p.id, 1)} disabled={idx === rascunho.length - 1} title="Mover para baixo"
                                className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 disabled:opacity-40 min-h-[44px] min-w-[44px] flex items-center justify-center">
                                <span className="material-icons text-base">arrow_downward</span>
                              </button>
                              <button onClick={() => remover(p.id)} title="Remover pessoa"
                                className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-red-400 hover:text-red-300 hover:border-red-500/50 min-h-[44px] min-w-[44px] flex items-center justify-center">
                                <span className="material-icons text-base">delete_outline</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {msg && (
                    <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.tipo === 'ok' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                      {msg.texto}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Aviso flutuante (fora do modo edição também) */}
      {msg && !modoEdicao && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[95]">
          <div className={`rounded-full px-4 py-2 text-sm shadow-lg ${msg.tipo === 'ok' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {msg.texto}
          </div>
        </div>
      )}
    </div>
  );
}
