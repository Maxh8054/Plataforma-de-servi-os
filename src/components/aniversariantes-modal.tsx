'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authFetch } from '@/store/auth-store';
import './aniversariantes.css';

/**
 * Aniversariantes ZAMine — modal da plataforma (botão no rodapé).
 * Layout portado do arquivo de referência (zm-ani): cabeçalho com o mês,
 * banner de festa quando alguém faz aniversário hoje, grade de cartões com
 * foto circular e selo do dia, confete no fundo.
 *
 * Os dados vêm DO CADASTRO DE COLABORADORES DO PAINEL TV (aba Aniversariantes)
 * via /api/aniversariantes — nada é digitado aqui: para adicionar/editar/
 * remover aniversariantes, basta atualizar o cadastro no Painel TV que esta
 * tela reflete sozinha (as fotos são as mesmas do cadastro, servidas do banco).
 * A equipe inteira vem no payload (12 meses) e o modal filtra por mês no
 * cliente; o "hoje" é calculado no servidor no fuso America/Sao_Paulo.
 */

type Aniversariante = { nome: string; dia: number; mes: number; setor: string; fotoUrl: string | null };

type Dados = {
  mesAtual: number;
  diaHoje: number;
  pessoas: Aniversariante[];
  atualizadoEm: string | null;
  atualizadoPor: string | null;
};

const NOMES_MESES = ['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const ABREV_MESES = ['', 'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const CONECTIVOS = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);

/** "ADRIANA MARA DO NASCIMENTO" → "Adriana Mara do Nascimento" (o cadastro vem em caixa alta) */
function nomeBonito(nome: string): string {
  return String(nome || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i > 0 && CONECTIVOS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

function iniciais(nome: string): string {
  const t = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (!t.length) return '?';
  return t.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

/** lista de nomes para o banner de festa: "Ana" · "Ana e Bruno" · "Ana, Bruno e Cesar" */
function listarNomes(nomes: string[]): string {
  if (!nomes.length) return '';
  if (nomes.length === 1) return nomes[0];
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

export default function AniversariantesModal({ open, onClose, isAdmin }: { open: boolean; onClose: () => void; isAdmin: boolean }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState<Dados | null>(null);
  const [mesSel, setMesSel] = useState(0); // 0 = carregando; 1..12

  const secaoRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const aplicar = useCallback((j: { mesAtual?: number; diaHoje?: number; pessoas?: Aniversariante[]; atualizadoEm?: string | null; atualizadoPor?: string | null }) => {
    const mesAtual = j.mesAtual || new Date().getMonth() + 1;
    setDados({
      mesAtual,
      diaHoje: j.diaHoje || 1,
      pessoas: Array.isArray(j.pessoas) ? j.pessoas : [],
      atualizadoEm: j.atualizadoEm || null,
      atualizadoPor: j.atualizadoPor || null,
    });
    setMesSel(mesAtual);
    setErro('');
  }, []);

  const carregar = useCallback(async () => {
    try {
      const r = await authFetch('/api/aniversariantes');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erro ao carregar os aniversariantes');
      aplicar(j);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar os aniversariantes');
    } finally {
      setCarregando(false);
    }
  }, [aplicar]);

  /* carrega quando o modal abre (setState só depois de await, com cancelamento;
     ao reabrir mostra os dados anteriores e atualiza por cima, sem piscar spinner) */
  useEffect(() => {
    if (!open) return;
    let ativo = true;
    (async () => {
      try {
        const r = await authFetch('/api/aniversariantes');
        const j = await r.json();
        if (!ativo) return;
        if (!r.ok) throw new Error(j.error || 'Erro ao carregar os aniversariantes');
        aplicar(j);
      } catch (e) {
        if (!ativo) return;
        setErro(e instanceof Error ? e.message : 'Erro ao carregar os aniversariantes');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [open, aplicar]);

  /* ---------- dados derivados ---------- */

  const pessoasMes = useMemo(() => {
    if (!dados || !mesSel) return [];
    return dados.pessoas.filter((p) => p.mes === mesSel); // já vem ordenado por dia da API
  }, [dados, mesSel]);

  const hojeNoMes = useMemo(() => {
    if (!dados || mesSel !== dados.mesAtual) return null;
    return dados.diaHoje;
  }, [dados, mesSel]);

  const festa = !!hojeNoMes && pessoasMes.some((p) => p.dia === hojeNoMes);

  const nomesFesta = useMemo(
    () => (hojeNoMes ? pessoasMes.filter((p) => p.dia === hojeNoMes).map((p) => nomeBonito(p.nome).split(' ')[0]) : []),
    [pessoasMes, hojeNoMes]
  );

  const mudarMes = (dir: number) => setMesSel((m) => ((m - 1 + dir + 12) % 12) + 1);

  /* ---------- confete do fundo (parado no dia comum; caindo no dia de festa) ---------- */

  useEffect(() => {
    if (!open || carregando || erro) return;
    const root = secaoRef.current;
    const cv = canvasRef.current;
    if (!root || !cv) return;
    const cx = cv.getContext('2d');
    if (!cx) return;
    const reduz = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const corAccent = () => getComputedStyle(root).getPropertyValue('--accent').trim() || '#ff6600';
    const corMuted = () => getComputedStyle(root).getPropertyValue('--muted').trim();

    /* modo parado: confete discreto espalhado no topo do fundo (mesmo PRNG do layout de referência) */
    const desenharParado = () => {
      const w = root.clientWidth, h = root.clientHeight, r = window.devicePixelRatio || 1;
      cv.width = w * r; cv.height = h * r; cv.style.width = `${w}px`; cv.style.height = `${h}px`;
      cx.setTransform(r, 0, 0, r, 0, 0);
      cx.clearRect(0, 0, w, h);
      let s = 7;
      const acc = corAccent();
      for (let i = 0; i < 46; i++) {
        s = (s * 9301 + 49297) % 233280; const x = (s / 233280) * w;
        s = (s * 9301 + 49297) % 233280; const y = (s / 233280) * h * 0.32;
        s = (s * 9301 + 49297) % 233280; const k = s / 233280;
        if (x > w * 0.42 && x < w * 0.7 && y < h * 0.2) continue;
        cx.save(); cx.translate(x, y); cx.rotate(k * 6.28); cx.globalAlpha = 0.25 + k * 0.5;
        cx.fillStyle = k > 0.5 ? acc : corMuted();
        if (k < 0.33) { cx.beginPath(); cx.arc(0, 0, 2 + k * 6, 0, 6.28); cx.fill(); } else { cx.fillRect(-5, -1.5, 10, 3); }
        cx.restore();
      }
    };

    if (!festa || reduz) {
      desenharParado();
      const ro = new ResizeObserver(desenharParado);
      ro.observe(root);
      window.addEventListener('resize', desenharParado);
      return () => { ro.disconnect(); window.removeEventListener('resize', desenharParado); };
    }

    /* modo festa: confete caindo */
    type Peca = { x: number; y: number; vy: number; vx: number; r: number; vr: number; w: number; h: number; c: string; o: number; f: boolean };
    const cores = [corAccent(), '#ffffff', '#ffb27a', corMuted()];
    let W = 0, H = 0, raf = 0;
    const pecas: Peca[] = [];
    const nova = (topo: boolean): Peca => ({
      x: Math.random() * W,
      y: topo ? -20 : Math.random() * H,
      vy: 0.6 + Math.random() * 1.4,
      vx: -0.4 + Math.random() * 0.8,
      r: Math.random() * 6.28,
      vr: -0.08 + Math.random() * 0.16,
      w: 5 + Math.random() * 7,
      h: 3 + Math.random() * 4,
      c: cores[Math.floor(Math.random() * cores.length)],
      o: Math.random() * 6.28,
      f: Math.random() < 0.3,
    });
    const dimensionar = () => {
      W = root.clientWidth; H = root.clientHeight;
      const r = window.devicePixelRatio || 1;
      cv.width = W * r; cv.height = H * r; cv.style.width = `${W}px`; cv.style.height = `${H}px`;
      cx.setTransform(r, 0, 0, r, 0, 0);
    };

    dimensionar();
    for (let i = 0; i < 140; i++) pecas.push(nova(false));
    cv.style.opacity = '1';

    const ciclo = () => {
      cx.clearRect(0, 0, W, H);
      for (let i = 0; i < pecas.length; i++) {
        const p = pecas[i];
        p.y += p.vy; p.o += 0.03; p.x += p.vx + Math.sin(p.o) * 0.6; p.r += p.vr;
        if (p.y > H + 20) { pecas[i] = nova(true); continue; }
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.globalAlpha = 0.85; cx.fillStyle = p.c;
        if (p.f) { cx.beginPath(); cx.arc(0, 0, p.h * 0.8, 0, 6.28); cx.fill(); } else { cx.scale(1, Math.cos(p.o)); cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
        cx.restore();
      }
      raf = requestAnimationFrame(ciclo);
    };
    ciclo();

    const ro = new ResizeObserver(dimensionar);
    ro.observe(root);
    window.addEventListener('resize', dimensionar);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('resize', dimensionar); };
  }, [open, carregando, erro, festa]);

  if (!open) return null;

  const n = pessoasMes.length;
  const nCols = n <= 4 ? Math.max(n, 1) : n <= 6 ? 3 : n <= 8 ? 4 : n <= 10 ? 5 : 6;
  const ano = new Date().getFullYear();
  const infoAtualizacao = dados?.atualizadoEm
    ? `Cadastro do Painel TV atualizado em ${new Date(dados.atualizadoEm).toLocaleDateString('pt-BR')}${dados.atualizadoPor ? ` por ${dados.atualizadoPor}` : ''}`
    : 'Cadastro do Painel TV — aba Aniversariantes';

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-[90] p-2 sm:p-4" onClick={onClose}>
      <div className="w-full max-w-[1700px] h-[95vh] overflow-y-auto overscroll-contain bg-black rounded-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className="sticky top-0 z-10 bg-black px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-800">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button onClick={onClose} className="text-zinc-400 hover:text-white flex items-center gap-1 shrink-0">
                <span className="material-icons text-lg sm:text-xl">arrow_back</span>
                <span className="text-xs sm:text-sm">Voltar</span>
              </button>
              <div className="h-4 sm:h-5 w-px bg-zinc-800 shrink-0"></div>
              <img src="/images/zamine-logo.png" alt="Zamine" className="h-6 sm:h-8" />
              <div className="hidden lg:flex items-center gap-1 text-[11px] text-zinc-500 truncate">
                <span className="material-icons text-sm">cake</span>
                <span className="truncate">{infoAtualizacao}</span>
              </div>
            </div>
            {/* Navegação de meses */}
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => mudarMes(-1)} title="Mês anterior" aria-label="Mês anterior"
                className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 min-h-[44px] min-w-[44px] flex items-center justify-center">
                <span className="material-icons text-base">chevron_left</span>
              </button>
              <span className="text-xs sm:text-sm text-white font-semibold capitalize min-w-[96px] sm:min-w-[130px] text-center" aria-live="polite">
                {NOMES_MESES[mesSel] || '—'} <span className="text-zinc-500 font-normal">{ano}</span>
              </span>
              <button onClick={() => mudarMes(1)} title="Próximo mês" aria-label="Próximo mês"
                className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 min-h-[44px] min-w-[44px] flex items-center justify-center">
                <span className="material-icons text-base">chevron_right</span>
              </button>
              {isAdmin && (
                <a href="/html/painel-tv-goias.html" target="_blank" rel="noreferrer" title="Editar o cadastro da equipe no Painel TV (aba Aniversariantes)"
                  className="hidden sm:flex items-center gap-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-orange-400 hover:border-orange-500/50 text-xs min-h-[44px] ml-1">
                  <span className="material-icons text-base">edit</span>
                  Editar no Painel TV
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        {carregando ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-zinc-400">
            <span className="material-icons text-4xl animate-spin text-orange-500">sync</span>
            <p className="text-sm">Carregando aniversariantes…</p>
          </div>
        ) : erro ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-zinc-400 px-4 text-center">
            <span className="material-icons text-4xl text-red-400">error_outline</span>
            <p className="text-sm">{erro}</p>
            <button onClick={() => { setCarregando(true); carregar(); }} className="mt-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm min-h-[44px]">Tentar de novo</button>
          </div>
        ) : (
          <section className={`zm-ani em-modal${festa ? ' festa' : ''}`} ref={secaoRef} aria-labelledby="zmAniT">
            <canvas className="dots" aria-hidden="true" ref={canvasRef}></canvas>
            <header className="hd">
              <div>
                <small>ZAMine · Alto Horizonte</small>
                <h1 id="zmAniT">Aniversariantes<br />de <em>{NOMES_MESES[mesSel] || '—'}</em></h1>
              </div>
              <div className="meta">
                <p><b>{n}</b>aniversariantes<br />no mês</p>
                <img className="logo" alt="ZAMine" src="/images/zamine-logo.png" />
              </div>
            </header>

            {festa && (
              <div className="festa-b" aria-live="polite">
                <svg className="bolo" viewBox="0 0 64 64" aria-hidden="true">
                  <rect x="10" y="30" width="44" height="24" rx="4" fill="currentColor" />
                  <path d="M10 38c5 4 9 4 14 0s9-4 14 0 9 4 14 0" stroke="#fff" strokeWidth="3" fill="none" opacity=".6" />
                  <rect x="20" y="18" width="4" height="12" rx="2" fill="currentColor" />
                  <rect x="30" y="16" width="4" height="14" rx="2" fill="currentColor" />
                  <rect x="40" y="18" width="4" height="12" rx="2" fill="currentColor" />
                  <path d="M22 10c2 3 2 5 0 7-2-2-2-4 0-7zM32 8c2 3 2 5 0 7-2-2-2-4 0-7zM42 10c2 3 2 5 0 7-2-2-2-4 0-7z" fill="#fff" />
                </svg>
                <div>
                  <small>Hoje é dia de festa</small>
                  <b>Parabéns, {listarNomes(nomesFesta)}!</b>
                </div>
              </div>
            )}

            {n > 0 ? (
              <ol className="grid" style={{ '--c': nCols } as React.CSSProperties}>
                {pessoasMes.map((p, i) => {
                  const hoje = !!hojeNoMes && p.dia === hojeNoMes;
                  const passou = !!hojeNoMes && p.dia < hojeNoMes;
                  const nome = nomeBonito(p.nome);
                  return (
                    <li className={`p${hoje ? ' hoje' : ''}${passou ? ' passou' : ''}`} key={`${p.dia}-${p.nome}-${i}`}>
                      <div className="ph">
                        <div className="av">
                          {p.fotoUrl ? <img src={p.fotoUrl} alt={nome} loading="lazy" /> : <span>{iniciais(nome)}</span>}
                        </div>
                        <span className="day">{hoje ? 'HOJE' : `${String(p.dia).padStart(2, '0')} ${ABREV_MESES[p.mes]}`}</span>
                      </div>
                      <b>{nome}</b>
                      {p.setor ? <small>{nomeBonito(p.setor)}</small> : null}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="vazio">
                <span className="material-icons" aria-hidden="true">cake_outlined</span>
                <b>Sem aniversariantes em {NOMES_MESES[mesSel] || '—'}</b>
                <p>O cadastro da equipe é feito no Painel TV, aba Aniversariantes.</p>
              </div>
            )}

            <div className="ft"><span>Parabéns a todos! A ZAMine deseja um novo ano cheio de saúde e segurança.</span><i></i></div>
          </section>
        )}
      </div>
    </div>
  );
}
