/**
 * Escala de turno para MÊS e ANO completos — alimenta a tela interativa da TV
 * (mesmo layout do Calendário: ◀ ▶ mudam o mês, "Ver o ano inteiro" mostra os
 * 12 meses de uma vez).
 *
 * Usa exatamente as MESMAS regras do slide automático (montarDia/statusDePessoa:
 * ciclo Lundin + lançamentos de atestados, spots, ADMs e eventos), então o que a
 * pessoa lança na plataforma (ou no editor do painel) aparece sozinho aqui.
 * Traz também a CONTAGEM DE HORAS do mês (Horas Spot e ADM) e as entregas do
 * RELATÓRIO TÉCNICO do mês — tudo direto do banco.
 */
import { TZ_PADRAO, hojeNoFuso, montarDia, PESSOAS, lancamentosDaPlataforma, emIntervalo, turnoBase } from '@/lib/escala-auto';
import type { DiaEscala, StatusPessoaDia } from '@/lib/escala-auto';
import { carregarRelatorios } from '@/lib/relatorio-tecnico';
import type { MapaRelatorios } from '@/lib/relatorio-tecnico';

const pad2 = (n: number) => String(n).padStart(2, '0');
const dataDe = (ano: number, mes: number, dia: number) => `${ano}-${pad2(mes)}-${pad2(dia)}`;
const diasNoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();

/** minutos de "HH:MM" (ou 0 se inválido) */
function minutosDe(h?: string | null): number {
  if (!h || !/^\d{1,2}:\d{2}$/.test(h)) return 0;
  const [hh, mm] = h.split(':').map(Number);
  return hh * 60 + mm;
}

export interface HorasMes {
  /** horas de Spot por letra (só soma os lançamentos que têm horas por dia) */
  spot: Record<string, number>;
  spotTotal: number;
  /** horas de ADM por letra (horaFim − horaInicio por dia do intervalo) */
  adm: Record<string, number>;
  admTotal: number;
  /** CONTAGEM DE HORAS por técnico — eventos (Atestado, Férias, Folga agendada)
   *  descontam das horas previstas e dos turnos do mês */
  tecnicos: HorasTecnico[];
}

export interface PerdaMes {
  motivo: string;
  dias: number;
  horas: number;
}

export interface HorasTecnico {
  letra: string;
  nome: string;
  /** horas que AINDA tem de turno no mês = 12h × (dias de turno do ciclo − dias
   *  perdidos com evento). Os eventos INFLUENCIAM: atestado/férias/folga agendada
   *  descontam aqui dentro. */
  previstas: number;
  /** horas efetivamente trabalhadas até agora: turnos completos + o turno em
   *  andamento proporcional (pelo relógio, no fuso da operação) + Spot + ADM */
  trabalhadas: number;
  /** turnos completos já feitos no mês */
  turnos: number;
  /** turnos esperados no mês (já descontando os eventos) */
  turnosPrev: number;
  /** horas de Spot lançadas até hoje (já contam dentro de trabalhadas) */
  spot: number;
  /** horas de ADM lançadas até hoje (já contam dentro de trabalhadas) */
  adm: number;
  /** horas perdidas por motivo: Atestado −24h, Férias −12h… (o mês inteiro) */
  perdas: PerdaMes[];
}

export interface EscalaMes {
  modo: 'mes';
  ano: number;
  mes: number; // 1-12
  tz: string;
  hoje: string; // YYYY-MM-DD
  geradoEm: string;
  /** todos os dias do mês (1..N), mesma estrutura do slide automático */
  dias: DiaEscala[];
  /** contagem de horas do mês (Spot/ADM + horas por técnico) */
  horas: HorasMes;
  /** turno BASE do ciclo por dia/letra: "D" diurno, "N" noturno, "F" folga —
   *  serve para a grade da TV desenhar “o dia que estaria escalado” sob um evento */
  base: Record<string, Record<string, 'D' | 'N' | 'F'>>;
  /** entregas do relatório técnico marcadas na plataforma, por dia/letra */
  relatorios: MapaRelatorios;
}

/** Mês completo (com horas e relatórios) — null se algo der errado (a TV segue no ar). */
export async function computarEscalaMesSeguro(
  ano: number,
  mes: number,
  tz: string = TZ_PADRAO
): Promise<EscalaMes | null> {
  try {
    return await computarEscalaMes(ano, mes, tz);
  } catch (error) {
    console.error('[escala-mes] falha ao calcular o mês:', error);
    return null;
  }
}

/** minutos decorridos do dia no fuso informado ("HH:MM" de agora) */
function minutosAgoraNoFuso(tz: string): number {
  try {
    const s = new Intl.DateTimeFormat('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    const [h, m] = s.split(':').map(Number);
    return (h % 24) * 60 + m;
  } catch {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  }
}

/** Turnos: 12 h — diurno 07:00–19:00, noturno 19:00–07:00 (do dia seguinte) */
const HORAS_TURNO = 12;
const INI_D = 7 * 60;
const INI_N = 19 * 60;

/** Horas acumuladas de UM turno (0..12): completo se já acabou, proporcional
 *  se está em andamento agora, 0 se não chegou. Imita o HTML da gestão. */
function horasDoTurno(dataStr: string, tipo: 'D' | 'N', hoje: string, agoraMin: number): number {
  const inicioMin = tipo === 'D' ? INI_D : INI_N;
  // minutos "absolutos" desde a meia-noite de hoje (imune a fuso: datas em UTC)
  const abs = (d: string, min: number) => Date.parse(`${d}T00:00:00Z`) / 60000 + min;
  const agoraAbs = abs(hoje, agoraMin);
  const t0 = abs(dataStr, inicioMin);
  const decorrido = (agoraAbs - t0) / 60;
  return Math.max(0, Math.min(HORAS_TURNO, decorrido));
}

export async function computarEscalaMes(
  ano: number,
  mes: number,
  tz: string = TZ_PADRAO
): Promise<EscalaMes> {
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) throw new Error('ano inválido');
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) throw new Error('mês inválido');
  const lanc = await lancamentosDaPlataforma();
  const n = diasNoMes(ano, mes);
  const fuso = tz || TZ_PADRAO;
  const hoje = hojeNoFuso(fuso);
  const agoraMin = minutosAgoraNoFuso(fuso);
  const dias: DiaEscala[] = [];
  const base: Record<string, Record<string, 'D' | 'N' | 'F'>> = {};
  const spot: Record<string, number> = {};
  const adm: Record<string, number> = {};
  const tec = new Map<string, HorasTecnico & { _perdas: Record<string, PerdaMes> }>();
  for (const p of PESSOAS) {
    tec.set(p.letra, { letra: p.letra, nome: p.nome, previstas: 0, trabalhadas: 0, turnos: 0, turnosPrev: 0, spot: 0, adm: 0, perdas: [], _perdas: {} });
  }
  for (let d = 1; d <= n; d++) {
    const dataStr = dataDe(ano, mes, d);
    const dia = montarDia(dataStr, null, lanc);
    dias.push(dia);
    const bDia: Record<string, 'D' | 'N' | 'F'> = {};
    for (const p of PESSOAS) {
      const tb = turnoBase(dataStr, p.letra);
      bDia[p.letra] = tb === 'Manhã' ? 'D' : tb === 'Noite' ? 'N' : 'F';
    }
    base[dataStr] = bDia;
    const todos: StatusPessoaDia[] = [...dia.diurno, ...dia.noturno, ...dia.fora];
    for (const p of PESSOAS) {
      const t = tec.get(p.letra)!;
      const st = todos.find((s) => s.letra === p.letra);
      const bL = bDia[p.letra];
      // evento que TIRA o turno: atestado / férias / folga agendada (folga do próprio ciclo não perde)
      const perdeu = !!(st && !st.trabalha && st.motivo && bL !== 'F');
      if (bL !== 'F' && !perdeu) {
        t.previstas += HORAS_TURNO;
        t.turnosPrev += 1;
      }
      if (perdeu) {
        const k = String(st!.motivo);
        const acc = t._perdas[k] || { motivo: k, dias: 0, horas: 0 };
        acc.dias += 1;
        acc.horas += HORAS_TURNO;
        t._perdas[k] = acc;
      }
      // horas do turno: dias passados contam inteiro; hoje conta proporcional ao relógio
      if (st && st.trabalha) {
        const tipo: 'D' | 'N' = st.efetivo === 'Noite' ? 'N' : 'D';
        const h = horasDoTurno(dataStr, tipo, hoje, agoraMin);
        t.trabalhadas += h;
        if (h >= HORAS_TURNO) t.turnos += 1;
      }
      // Spot/ADM também são horas trabalhadas — só até hoje (o mês inteiro fica nos totais)
      const sp = lanc.spots.find((s) => s.person === p.letra && emIntervalo(dataStr, s.startDate, s.endDate));
      const hSp = Number(sp?.horasPorDia ?? 0);
      if (sp && hSp > 0) {
        spot[p.letra] = (spot[p.letra] ?? 0) + hSp;
        if (dataStr <= hoje) { t.spot += hSp; t.trabalhadas += hSp; }
      }
      const ad = lanc.adms.find((a) => a.person === p.letra && emIntervalo(dataStr, a.startDate, a.endDate));
      if (ad) {
        const m = minutosDe(ad.horaFim) - minutosDe(ad.horaInicio);
        if (m > 0) {
          adm[p.letra] = (adm[p.letra] ?? 0) + m / 60;
          if (dataStr <= hoje) { t.adm += m / 60; t.trabalhadas += m / 60; }
        }
      }
    }
  }
  const arred = (r: Record<string, number>) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v * 10) / 10]));
  const spotAr = arred(spot), admAr = arred(adm);
  const tecnicos = [...tec.values()].map((t) => {
    const r = (x: number) => Math.round(x * 10) / 10;
    return {
      letra: t.letra, nome: t.nome,
      previstas: r(t.previstas), trabalhadas: r(t.trabalhadas),
      turnos: t.turnos, turnosPrev: t.turnosPrev,
      spot: r(t.spot), adm: r(t.adm),
      perdas: Object.values(t._perdas),
    };
  });
  const relatorios = await carregarRelatorios(dataDe(ano, mes, 1), dataDe(ano, mes, n));
  return {
    modo: 'mes',
    ano,
    mes,
    tz: fuso,
    hoje,
    geradoEm: new Date().toISOString(),
    dias,
    base,
    horas: { spot: spotAr, spotTotal: Math.round(Object.values(spot).reduce((s, v) => s + v, 0) * 10) / 10,
             adm: admAr, admTotal: Math.round(Object.values(adm).reduce((s, v) => s + v, 0) * 10) / 10,
             tecnicos },
    relatorios,
  };
}

export interface DiaAno {
  /** letra do técnico do turno diurno ('' se ninguém) */
  d: string;
  /** letra do técnico do turno noturno */
  n: string;
  /** motivo de quem está fora (Atestado/Férias/Folga…) no dia */
  fora?: string;
}

export interface EscalaAno {
  modo: 'ano';
  ano: number;
  tz: string;
  hoje: string;
  geradoEm: string;
  /** mapa "YYYY-MM-DD" → letras do dia (diurno/noturno + quem está fora) */
  dias: Record<string, DiaAno>;
}

/** Ano inteiro (letras por dia — leve, para os 12 mini-calendários da TV). */
export async function computarEscalaAnoSeguro(ano: number, tz: string = TZ_PADRAO): Promise<EscalaAno | null> {
  try {
    return await computarEscalaAno(ano, tz);
  } catch (error) {
    console.error('[escala-mes] falha ao calcular o ano:', error);
    return null;
  }
}

export async function computarEscalaAno(ano: number, tz: string = TZ_PADRAO): Promise<EscalaAno> {
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) throw new Error('ano inválido');
  const lanc = await lancamentosDaPlataforma();
  const dias: Record<string, DiaAno> = {};
  for (let m = 1; m <= 12; m++) {
    const n = diasNoMes(ano, m);
    for (let d = 1; d <= n; d++) {
      const dataStr = dataDe(ano, m, d);
      const dia = montarDia(dataStr, null, lanc);
      dias[dataStr] = {
        d: dia.diurno[0]?.letra ?? '',
        n: dia.noturno[0]?.letra ?? '',
        fora: dia.fora[0]?.motivo,
      };
    }
  }
  return {
    modo: 'ano',
    ano,
    tz: tz || TZ_PADRAO,
    hoje: hojeNoFuso(tz || TZ_PADRAO),
    geradoEm: new Date().toISOString(),
    dias,
  };
}
