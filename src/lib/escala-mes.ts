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
import { TZ_PADRAO, hojeNoFuso, montarDia, PESSOAS, lancamentosDaPlataforma, emIntervalo } from '@/lib/escala-auto';
import type { DiaEscala } from '@/lib/escala-auto';
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
  /** contagem de horas do mês (Spot/ADM) por técnico e total */
  horas: HorasMes;
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

export async function computarEscalaMes(
  ano: number,
  mes: number,
  tz: string = TZ_PADRAO
): Promise<EscalaMes> {
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) throw new Error('ano inválido');
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) throw new Error('mês inválido');
  const lanc = await lancamentosDaPlataforma();
  const n = diasNoMes(ano, mes);
  const dias: DiaEscala[] = [];
  const spot: Record<string, number> = {};
  const adm: Record<string, number> = {};
  for (let d = 1; d <= n; d++) {
    const dataStr = dataDe(ano, mes, d);
    dias.push(montarDia(dataStr, null, lanc));
    for (const p of PESSOAS) {
      const sp = lanc.spots.find((s) => s.person === p.letra && emIntervalo(dataStr, s.startDate, s.endDate));
      const hSp = Number(sp?.horasPorDia ?? 0);
      if (sp && hSp > 0) spot[p.letra] = (spot[p.letra] ?? 0) + hSp;
      const ad = lanc.adms.find((a) => a.person === p.letra && emIntervalo(dataStr, a.startDate, a.endDate));
      if (ad) {
        const m = minutosDe(ad.horaFim) - minutosDe(ad.horaInicio);
        if (m > 0) adm[p.letra] = (adm[p.letra] ?? 0) + m / 60;
      }
    }
  }
  const arred = (r: Record<string, number>) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v * 10) / 10]));
  const spotAr = arred(spot), admAr = arred(adm);
  const relatorios = await carregarRelatorios(dataDe(ano, mes, 1), dataDe(ano, mes, n));
  return {
    modo: 'mes',
    ano,
    mes,
    tz: tz || TZ_PADRAO,
    hoje: hojeNoFuso(tz || TZ_PADRAO),
    geradoEm: new Date().toISOString(),
    dias,
    horas: { spot: spotAr, spotTotal: Math.round(Object.values(spot).reduce((s, v) => s + v, 0) * 10) / 10,
             adm: admAr, admTotal: Math.round(Object.values(adm).reduce((s, v) => s + v, 0) * 10) / 10 },
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
