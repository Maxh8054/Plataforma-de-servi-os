'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { getLundinShift } from '@/data/escala-lundin';

// Types
type PersonKey = 'A' | 'B' | 'C' | 'D';
type ShiftType = 'Manhã' | 'Noite' | 'Folga';

interface Atestado {
  id: string;
  person: PersonKey;
  startDate: string;
  endDate: string;
  porHora: boolean;
  horas: number;
}

interface Spot {
  id: string;
  person: PersonKey;
  startDate: string;
  endDate: string;
  horasPorDia: number;
}

interface ADM {
  id: string;
  person: PersonKey;
  startDate: string;
  endDate: string;
  horaInicio: string;
  horaFim: string;
}

interface Evento {
  id: string;
  person: PersonKey;
  tipo: 'folga' | 'viagem' | 'treinamento' | 'férias';
  startDate: string;
  endDate: string;
  horas: number;
  operacao: 'adicionar' | 'subtrair';
}

interface EscalaData {
  atestados: Record<PersonKey, Atestado[]>;
  spots: Record<PersonKey, Spot[]>;
  adms: Record<PersonKey, ADM[]>;
  eventos: Record<PersonKey, Evento[]>;
}

interface PersonInfo {
  key: PersonKey;
  name: string;
  photo: string;
}

// Person assignments matching dataReport_Escala_Turno_Lundin:
// A = Weslley Siqueira, B = Higor Ataides, C = Marcos Paulo, D = Marcelo
const PEOPLE: PersonInfo[] = [
  { key: 'A', name: 'Weslley Siqueira', photo: '/escala/Weslley.jpeg' },
  { key: 'B', name: 'Higor Ataides', photo: '/escala/Higor ataides.jpeg' },
  { key: 'C', name: 'Marcos Paulo', photo: '/escala/Marcos Paulo.jpeg' },
  { key: 'D', name: 'Marcelo', photo: '/escala/Marcelo.jpeg' },
];

const PERSON_FULL_NAMES: Record<PersonKey, string> = {
  A: 'A - Weslley Siqueira',
  B: 'B - Higor Ataides',
  C: 'C - Marcos Paulo',
  D: 'D - Marcelo',
};

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const MONTH_NAMES_UPPER = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

// Full Portuguese weekday names matching original HTML
const DAY_NAMES_FULL: Record<number, string> = {
  0: 'domingo',
  1: 'segunda-feira',
  2: 'terça-feira',
  3: 'quarta-feira',
  4: 'quinta-feira',
  5: 'sexta-feira',
  6: 'sábado',
};

// Lookup shift from the static Lundin data (May 2026 - Jan 2027)
// Falls back to a computed 8-day rotation cycle for dates outside the data range
function getShiftForDay(person: PersonKey, date: Date): ShiftType {
  const entry = getLundinShift(date, person);
  if (entry) {
    // Map the Turno string from the data to ShiftType
    if (entry.Turno === '07:00 – 19:00') return 'Manhã';
    if (entry.Turno === '19:00 – 07:00') return 'Noite';
    return 'Folga';
  }
  // Fallback: compute using the same 8-day rotation cycle for dates outside data range
  const startDate = new Date(2026, 4, 1); // May 1, 2026
  const diffTime = date.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const cycleDay = ((diffDays % 8) + 8) % 8;
  const phaseIndex = Math.floor((cycleDay + 1) / 2) % 4;
  // Phase 0 (cycle day 7,0): D=Manhã, A=Noite, B/C=Folga
  // Phase 1 (cycle day 1-2): B=Manhã, D=Noite, A/C=Folga
  // Phase 2 (cycle day 3-4): C=Manhã, B=Noite, A/D=Folga
  // Phase 3 (cycle day 5-6): A=Manhã, C=Noite, B/D=Folga
  const phaseMap: Record<string, ShiftType>[] = [
    { A: 'Noite', B: 'Folga', C: 'Folga', D: 'Manhã' },
    { A: 'Folga', B: 'Manhã', C: 'Folga', D: 'Noite' },
    { A: 'Folga', B: 'Noite', C: 'Manhã', D: 'Folga' },
    { A: 'Manhã', B: 'Folga', C: 'Noite', D: 'Folga' },
  ];
  return phaseMap[phaseIndex][person];
}

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

function formatDateBR(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function formatDateFromStr(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function isDateInRange(date: Date, startDate: string, endDate: string): boolean {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T23:59:59');
  return date >= start && date <= end;
}

// Shift cell background colors matching original HTML
const SHIFT_COLORS: Record<string, string> = {
  'Manhã': '#fff8e1',
  'Noite': '#e1f5fe',
  'Folga': '#e8f5e9',
};

// Person row highlight colors matching original HTML
const PERSON_HIGHLIGHT: Record<PersonKey, string> = {
  A: '#ffcdd2',
  B: '#c8e6c9',
  C: '#bbdefb',
  D: '#fff9c4',
};

// Shift format strings for display in the table
function getShiftDisplayString(shift: ShiftType): string {
  if (shift === 'Manhã') return '07:00 – 19:00';
  if (shift === 'Noite') return '19:00 – 07:00';
  return 'Folga';
}

// Map shift type to filter value
function getShiftFilterValue(shift: ShiftType): string {
  if (shift === 'Manhã') return '07:00 às 19:00';
  if (shift === 'Noite') return '19:00 às 07:00';
  return 'Folga';
}

// Format seconds into h m s
function formatSeconds(totalSec: number): string {
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

// Format countdown from seconds
function formatCountdown(totalSec: number): string {
  if (totalSec <= 0) return '00:00:00';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function EscalaModal({ onClose }: { onClose: () => void }) {
  const mainRef = useRef<HTMLDivElement>(null);

  // State
  const [data, setData] = useState<EscalaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [shiftFilter, setShiftFilter] = useState<string>('');
  const [personFilter, setPersonFilter] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Modal states
  const [atestadoModal, setAtestadoModal] = useState<{ open: boolean; person: PersonKey | null }>({ open: false, person: null });
  const [spotModal, setSpotModal] = useState<{ open: boolean; person: PersonKey | null }>({ open: false, person: null });
  const [admModal, setAdmModal] = useState<{ open: boolean; person: PersonKey | null }>({ open: false, person: null });
  const [eventoModal, setEventoModal] = useState<{ open: boolean; person: PersonKey | null }>({ open: false, person: null });

  // Atestado form
  const [atStartDate, setAtStartDate] = useState('');
  const [atEndDate, setAtEndDate] = useState('');
  const [atPorHora, setAtPorHora] = useState(false);
  const [atHoras, setAtHoras] = useState(1);

  // Spot form
  const [spStartDate, setSpStartDate] = useState('');
  const [spEndDate, setSpEndDate] = useState('');
  const [spHorasPorDia, setSpHorasPorDia] = useState(12);

  // ADM form
  const [admStartDate, setAdmStartDate] = useState('');
  const [admEndDate, setAdmEndDate] = useState('');
  const [admHoraInicio, setAdmHoraInicio] = useState('07:30');
  const [admHoraFim, setAdmHoraFim] = useState('16:50');

  // Evento form
  const [evTipo, setEvTipo] = useState<'folga' | 'viagem' | 'treinamento' | 'férias'>('folga');
  const [evStartDate, setEvStartDate] = useState('');
  const [evEndDate, setEvEndDate] = useState('');
  const [evHoras, setEvHoras] = useState(0);
  const [evOperacao, setEvOperacao] = useState<'adicionar' | 'subtrair'>('adicionar');

  // Set initial month/year to current
  useEffect(() => {
    const now = new Date();
    setSelectedMonth(now.getMonth());
    setSelectedYear(now.getFullYear());
  }, []);

  // Update clock every second for real-time seconds display
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/escala');
      if (res.ok) {
        const jsonData = await res.json();
        setData(jsonData);
      }
    } catch (err) {
      console.error('Error fetching escala data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save data
  const saveData = useCallback(async (newData: EscalaData) => {
    try {
      const res = await fetch('/api/escala', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData),
      });
      if (res.ok) {
        setData(newData);
      }
    } catch (err) {
      console.error('Error saving escala data:', err);
    }
  }, []);

  // Get overrides for a person on a specific date
  const getOverrides = useCallback((person: PersonKey, date: Date) => {
    if (!data) return { atestado: null as Atestado | null, spot: null as Spot | null, adm: null as ADM | null, evento: null as Evento | null };

    const atestado = data.atestados[person]?.find((a: Atestado) => isDateInRange(date, a.startDate, a.endDate)) || null;
    const spot = data.spots[person]?.find((s: Spot) => isDateInRange(date, s.startDate, s.endDate)) || null;
    const adm = data.adms[person]?.find((a: ADM) => isDateInRange(date, a.startDate, a.endDate)) || null;
    const evento = data.eventos[person]?.find((e: Evento) => isDateInRange(date, e.startDate, e.endDate)) || null;

    return { atestado, spot, adm, evento };
  }, [data]);

  // Get event icons for the Letra column (matching original HTML)
  const getEventIcons = useCallback((person: PersonKey, date: Date) => {
    if (!data) return '';
    const overrides = getOverrides(person, date);
    const icons: string[] = [];

    if (overrides.atestado) icons.push('🩺');
    if (overrides.spot) icons.push('⚡');
    if (overrides.evento) {
      const tipo = overrides.evento.tipo;
      if (tipo === 'férias') icons.push('🏖️');
      else if (tipo === 'viagem') icons.push('✈️');
      else if (tipo === 'treinamento') icons.push('📚');
      else if (tipo === 'folga') icons.push('📅');
    }
    if (overrides.adm) icons.push('🏢');

    return icons.join(' ');
  }, [data, getOverrides]);

  // Calculate hours worked for a person - matching original HTML logic with real-time tracking
  const calculateHoursWorked = useCallback((person: PersonKey) => {
    const now = currentTime;
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();
    const currentTotalMinutes = currentHour * 60 + currentMinute;

    const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
    const isRealCurrentMonth = (now.getMonth() === selectedMonth && now.getFullYear() === selectedYear);

    let totalWorkSeconds = 0;
    let workDays = 0;
    let totalDays = 0;

    // 1. Calculate base work from schedule
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(selectedYear, selectedMonth, day);
      const shift = getShiftForDay(person, date);
      const overrides = getOverrides(person, date);

      const isPast = date < new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const isToday = date.getTime() === new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      if (shift !== 'Folga') {
        totalDays++;

        let shiftSeconds = 0;

        // If not the real current month, assume full shifts
        if (!isRealCurrentMonth) {
          shiftSeconds = 12 * 3600;
        } else {
          // Real current month logic
          if (isPast) {
            if (shift === 'Manhã') {
              shiftSeconds = 12 * 3600;
            } else if (shift === 'Noite') {
              const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
              if (date.getTime() === yesterday.getTime()) {
                if (currentTotalMinutes >= 7 * 60) {
                  shiftSeconds = 12 * 3600;
                } else {
                  const hoursAfterMidnight = currentTotalMinutes * 60 + currentSecond;
                  shiftSeconds = (5 * 3600) + hoursAfterMidnight;
                }
              } else {
                shiftSeconds = 12 * 3600;
              }
            }
          } else if (isToday) {
            if (shift === 'Manhã') {
              if (currentTotalMinutes >= 7 * 60) {
                if (currentTotalMinutes >= 19 * 60) {
                  shiftSeconds = 12 * 3600;
                } else {
                  shiftSeconds = (currentTotalMinutes - 7 * 60) * 60 + currentSecond;
                }
              }
            } else if (shift === 'Noite') {
              if (currentTotalMinutes >= 19 * 60) {
                shiftSeconds = (currentTotalMinutes - 19 * 60) * 60 + currentSecond;
              }
            }
          }
        }

        totalWorkSeconds += shiftSeconds;

        if (isPast || (isToday && shiftSeconds > 0)) {
          workDays++;
        }
      }

      // Add spot hours on folga days
      if (shift === 'Folga' && overrides.spot) {
        totalWorkSeconds += overrides.spot.horasPorDia * 3600;
      }
    }

    // 2. Apply adjustments (Atestados, Spots, Eventos, ADM) matching original logic
    // --- ATESTADOS ---
    if (data && data.atestados[person]) {
      data.atestados[person].forEach((ast: Atestado) => {
        const [sy, sm, sd] = ast.startDate.split('-');
        const [ey, em, ed] = ast.endDate.split('-');
        const startDate = new Date(Number(sy), Number(sm) - 1, Number(sd));
        const endDate = new Date(Number(ey), Number(em) - 1, Number(ed));
        const loopDate = new Date(startDate);

        while (loopDate <= endDate) {
          if (loopDate.getMonth() === selectedMonth && loopDate.getFullYear() === selectedYear) {
            let shouldProcess = true;
            if (isRealCurrentMonth) {
              const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              if (loopDate > todayStart) shouldProcess = false;
            }

            if (shouldProcess) {
              const shift = getShiftForDay(person, loopDate);
              if (shift !== 'Folga') {
                if (ast.porHora) {
                  totalWorkSeconds -= ast.horas * 3600;
                } else {
                  totalWorkSeconds -= 12 * 3600;
                  workDays--;
                }
              }
            }
          }
          loopDate.setDate(loopDate.getDate() + 1);
        }
      });
    }

    // --- SPOTS ---
    if (data && data.spots[person]) {
      data.spots[person].forEach((sp: Spot) => {
        const [sy, sm, sd] = sp.startDate.split('-');
        const [ey, em, ed] = sp.endDate.split('-');
        const startDate = new Date(Number(sy), Number(sm) - 1, Number(sd));
        const endDate = new Date(Number(ey), Number(em) - 1, Number(ed));
        const loopDate = new Date(startDate);

        while (loopDate <= endDate) {
          if (loopDate.getMonth() === selectedMonth && loopDate.getFullYear() === selectedYear) {
            let shouldProcess = true;
            if (isRealCurrentMonth) {
              const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              if (loopDate > todayStart) shouldProcess = false;
            }
            if (shouldProcess) {
              totalWorkSeconds += sp.horasPorDia * 3600;
            }
          }
          loopDate.setDate(loopDate.getDate() + 1);
        }
      });
    }

    // --- EVENTOS ---
    if (data && data.eventos[person]) {
      data.eventos[person].forEach((evento: Evento) => {
        const [sy, sm, sd] = evento.startDate.split('-');
        const [ey, em, ed] = evento.endDate.split('-');
        const startDate = new Date(Number(sy), Number(sm) - 1, Number(sd));
        const endDate = new Date(Number(ey), Number(em) - 1, Number(ed));

        // Férias: subtract 12h per day and reduce work days
        if (evento.tipo === 'férias') {
          const loopDate = new Date(startDate);
          while (loopDate <= endDate) {
            if (loopDate.getMonth() === selectedMonth && loopDate.getFullYear() === selectedYear) {
              let shouldReduce = true;
              if (isRealCurrentMonth) {
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                if (loopDate > todayStart) shouldReduce = false;
              }
              if (shouldReduce) {
                const shift = getShiftForDay(person, loopDate);
                if (shift !== 'Folga') {
                  totalWorkSeconds -= 12 * 3600;
                  workDays--;
                }
              }
            }
            loopDate.setDate(loopDate.getDate() + 1);
          }
        } else if (evento.horas > 0) {
          // Other events with custom hours
          if (startDate.getMonth() === selectedMonth && startDate.getFullYear() === selectedYear) {
            const dayNum = startDate.getDate();
            if (!isRealCurrentMonth || dayNum <= now.getDate()) {
              const lastDate = (isRealCurrentMonth && now < endDate) ? now : endDate;
              let daysInEvento = 1;
              if (endDate >= startDate) {
                daysInEvento = Math.floor((lastDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              }
              if (evento.operacao === 'adicionar') {
                totalWorkSeconds += daysInEvento * evento.horas * 3600;
              } else {
                totalWorkSeconds -= daysInEvento * evento.horas * 3600;
              }
            }
          }
        }
      });
    }

    // --- ADM ---
    if (data && data.adms[person]) {
      data.adms[person].forEach((adm: ADM) => {
        const [sy, sm, sd] = adm.startDate.split('-');
        const [ey, em, ed] = adm.endDate.split('-');
        const startDate = new Date(Number(sy), Number(sm) - 1, Number(sd));
        const endDate = new Date(Number(ey), Number(em) - 1, Number(ed));

        if (startDate.getMonth() === selectedMonth && startDate.getFullYear() === selectedYear) {
          if (!isRealCurrentMonth || startDate <= new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
            const admStartParts = adm.horaInicio.split(':');
            const admEndParts = adm.horaFim.split(':');

            const admDailySeconds =
              (parseInt(admEndParts[0]) - parseInt(admStartParts[0])) * 3600 +
              (parseInt(admEndParts[1]) - parseInt(admStartParts[1])) * 60;

            const standardShiftSeconds = 12 * 3600;
            const admAdjustment = admDailySeconds - standardShiftSeconds;

            const lastDate = (isRealCurrentMonth && now < endDate) ? now : endDate;
            let daysInAdm = 1;
            if (endDate >= startDate) {
              daysInAdm = Math.floor((lastDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            }

            totalWorkSeconds += admAdjustment * daysInAdm;
          }
        }
      });
    }

    const displayWorkDays = workDays < 0 ? 0 : workDays;
    const hours = Math.floor(totalWorkSeconds / 3600);
    const minutes = Math.floor((totalWorkSeconds % 3600) / 60);
    const seconds = Math.floor(totalWorkSeconds % 60);

    return {
      totalWorkSeconds,
      hours,
      minutes,
      seconds,
      workDays: displayWorkDays,
      totalDays,
    };
  }, [selectedMonth, selectedYear, currentTime, data, getOverrides]);

  // Real-time shift status for each person
  const shiftStatus = useMemo(() => {
    const now = currentTime;
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    const currentTotalSeconds = currentHour * 3600 + currentMinute * 60 + now.getSeconds();

    const status: Record<PersonKey, {
      isOnShift: boolean;
      shiftType: ShiftType;
      shiftLabel: string;
      countdownSeconds: number;
      countdownLabel: string;
    }> = {} as Record<PersonKey, {
      isOnShift: boolean;
      shiftType: ShiftType;
      shiftLabel: string;
      countdownSeconds: number;
      countdownLabel: string;
    }>;

    for (const person of PEOPLE) {
      const todayShift = getShiftForDay(person.key, now);
      const yesterdayShift = getShiftForDay(person.key, new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
      const overrides = getOverrides(person.key, now);

      let isOnShift = false;
      let shiftType: ShiftType = todayShift;
      let shiftLabel = '';
      let countdownSeconds = 0;
      let countdownLabel = '';

      // Check if atestado overrides today
      const hasAtestado = overrides.atestado !== null;
      const hasFerias = overrides.evento?.tipo === 'férias';

      if (hasAtestado || hasFerias) {
        isOnShift = false;
        shiftType = 'Folga';
        shiftLabel = hasAtestado ? 'Atestado' : 'Férias';
        countdownSeconds = 0;
        countdownLabel = '';
      } else if (todayShift === 'Manhã') {
        // Morning shift: 07:00 - 19:00
        if (currentTotalMinutes >= 7 * 60 && currentTotalMinutes < 19 * 60) {
          isOnShift = true;
          shiftLabel = 'Manhã (07:00 – 19:00)';
          // Countdown to 19:00
          const endSeconds = 19 * 3600;
          countdownSeconds = endSeconds - currentTotalSeconds;
          countdownLabel = 'Tempo restante';
        } else if (currentTotalMinutes < 7 * 60) {
          isOnShift = false;
          shiftLabel = 'Manhã (07:00 – 19:00)';
          countdownSeconds = (7 * 3600) - currentTotalSeconds;
          countdownLabel = 'Início em';
        } else {
          // After 19:00 - shift is over, check if next shift is coming
          isOnShift = false;
          shiftLabel = 'Manhã (07:00 – 19:00)';
          countdownSeconds = 0;
          countdownLabel = 'Turno encerrado';
        }
      } else if (todayShift === 'Noite') {
        // Night shift: 19:00 - 07:00 (spans midnight)
        if (currentTotalMinutes >= 19 * 60) {
          isOnShift = true;
          shiftLabel = 'Noite (19:00 – 07:00)';
          // Countdown to 07:00 tomorrow
          const endSeconds = 24 * 3600 + 7 * 3600;
          countdownSeconds = endSeconds - currentTotalSeconds;
          countdownLabel = 'Tempo restante';
        } else if (currentTotalMinutes < 7 * 60) {
          // Could be continuing yesterday's night shift
          if (yesterdayShift === 'Noite') {
            isOnShift = true;
            shiftLabel = 'Noite (19:00 – 07:00)';
            const endSeconds = 7 * 3600;
            countdownSeconds = endSeconds - currentTotalSeconds;
            countdownLabel = 'Tempo restante';
          } else {
            isOnShift = false;
            shiftLabel = 'Noite (19:00 – 07:00)';
            countdownSeconds = (19 * 3600) - currentTotalSeconds;
            countdownLabel = 'Início em';
          }
        } else {
          // Between 07:00 and 19:00 - not on night shift yet
          isOnShift = false;
          shiftLabel = 'Noite (19:00 – 07:00)';
          countdownSeconds = (19 * 3600) - currentTotalSeconds;
          countdownLabel = 'Início em';
        }
      } else {
        // Folga
        isOnShift = false;
        shiftType = 'Folga';
        shiftLabel = 'Folga';
        countdownSeconds = 0;
        countdownLabel = '';
      }

      status[person.key] = {
        isOnShift,
        shiftType,
        shiftLabel,
        countdownSeconds,
        countdownLabel,
      };
    }

    return status;
  }, [currentTime, getOverrides]);

  // Handler functions
  const handleAddAtestado = () => {
    if (!atestadoModal.person || !data || !atStartDate || !atEndDate) return;

    const newAtestado: Atestado = {
      id: generateId(),
      person: atestadoModal.person,
      startDate: atStartDate,
      endDate: atEndDate,
      porHora: atPorHora,
      horas: atHoras,
    };

    const newData = {
      ...data,
      atestados: {
        ...data.atestados,
        [atestadoModal.person]: [...(data.atestados[atestadoModal.person] || []), newAtestado],
      },
    };

    saveData(newData);
    setAtestadoModal({ open: false, person: null });
    resetAtestadoForm();
  };

  const handleAddSpot = () => {
    if (!spotModal.person || !data || !spStartDate || !spEndDate) return;

    const newSpot: Spot = {
      id: generateId(),
      person: spotModal.person,
      startDate: spStartDate,
      endDate: spEndDate,
      horasPorDia: spHorasPorDia,
    };

    const newData = {
      ...data,
      spots: {
        ...data.spots,
        [spotModal.person]: [...(data.spots[spotModal.person] || []), newSpot],
      },
    };

    saveData(newData);
    setSpotModal({ open: false, person: null });
    resetSpotForm();
  };

  const handleAddADM = () => {
    if (!admModal.person || !data || !admStartDate || !admEndDate) return;

    const newADM: ADM = {
      id: generateId(),
      person: admModal.person,
      startDate: admStartDate,
      endDate: admEndDate,
      horaInicio: admHoraInicio,
      horaFim: admHoraFim,
    };

    const newData = {
      ...data,
      adms: {
        ...data.adms,
        [admModal.person]: [...(data.adms[admModal.person] || []), newADM],
      },
    };

    saveData(newData);
    setAdmModal({ open: false, person: null });
    resetADMForm();
  };

  const handleAddEvento = () => {
    if (!eventoModal.person || !data || !evStartDate || !evEndDate) return;

    const newEvento: Evento = {
      id: generateId(),
      person: eventoModal.person,
      tipo: evTipo,
      startDate: evStartDate,
      endDate: evEndDate,
      horas: evHoras,
      operacao: evOperacao,
    };

    const newData = {
      ...data,
      eventos: {
        ...data.eventos,
        [eventoModal.person]: [...(data.eventos[eventoModal.person] || []), newEvento],
      },
    };

    saveData(newData);
    setEventoModal({ open: false, person: null });
    resetEventoForm();
  };

  const handleDeleteItem = (type: 'atestados' | 'spots' | 'adms' | 'eventos', person: PersonKey, id: string) => {
    if (!data) return;
    const newData = {
      ...data,
      [type]: {
        ...data[type],
        [person]: data[type][person].filter((item: { id: string }) => item.id !== id),
      },
    };
    saveData(newData);
  };

  // Reset form functions
  const resetAtestadoForm = () => {
    setAtStartDate('');
    setAtEndDate('');
    setAtPorHora(false);
    setAtHoras(1);
  };

  const resetSpotForm = () => {
    setSpStartDate('');
    setSpEndDate('');
    setSpHorasPorDia(12);
  };

  const resetADMForm = () => {
    setAdmStartDate('');
    setAdmEndDate('');
    setAdmHoraInicio('07:30');
    setAdmHoraFim('16:50');
  };

  const resetEventoForm = () => {
    setEvTipo('folga');
    setEvStartDate('');
    setEvEndDate('');
    setEvHoras(0);
    setEvOperacao('adicionar');
  };

  // Reset filters
  const resetFilters = () => {
    setShiftFilter('');
    setPersonFilter('');
  };

  // Screenshot
  const captureScreenshot = async () => {
    if (!mainRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(mainRef.current, {
        backgroundColor: '#f5f7fa',
        scale: 2,
      });
      const link = document.createElement('a');
      const date = new Date();
      const timestamp = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}_${date.getHours()}h${date.getMinutes()}`;
      link.download = `screenshot_${timestamp}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Error capturing screenshot:', err);
    }
  };

  // Generate PPT
  const generatePowerPointReport = async () => {
    try {
      const PptxGenJS = (await import('pptxgenjs')).default;
      const pptx = new PptxGenJS();
      const daysInMonthVal = getDaysInMonth(selectedMonth, selectedYear);

      // Title slide
      const slide = pptx.addSlide();
      slide.addText(`Escala de Trabalho - Lundin Mining`, { x: 0.5, y: 0.5, fontSize: 24, bold: true, color: '2C3E50' });
      slide.addText(`${MONTH_NAMES[selectedMonth]} ${selectedYear}`, { x: 0.5, y: 1.2, fontSize: 18, color: '3498DB' });

      // Table slide - vertical layout matching original HTML
      const tableSlide = pptx.addSlide();
      const headerRow = ['Data', 'Dia da Semana', 'Letra', 'Colaborador', 'Turno'].map(h => ({
        text: h,
        options: { bold: true, color: 'FFFFFF', fill: { color: '3498DB' }, fontSize: 9 },
      }));

      const rows: Record<string, unknown>[][] = [headerRow];

      for (let day = 1; day <= daysInMonthVal; day++) {
        const date = new Date(selectedYear, selectedMonth, day);
        const weekday = DAY_NAMES_FULL[date.getDay()];

        for (const person of PEOPLE) {
          const shift = getShiftForDay(person.key, date);
          const shiftDisplay = getShiftDisplayString(shift);
          const bgColor = shift === 'Manhã' ? 'FFF8E1' : shift === 'Noite' ? 'E1F5FE' : 'E8F5E9';
          const letterBg = PERSON_HIGHLIGHT[person.key].replace('#', '');

          const row = [
            { text: formatDateBR(date), options: { fontSize: 8 } },
            { text: weekday, options: { fontSize: 8 } },
            { text: person.key, options: { fontSize: 8, fill: { color: letterBg } } },
            { text: person.name, options: { fontSize: 8 } },
            { text: shiftDisplay, options: { fontSize: 8, fill: { color: bgColor } } },
          ];
          rows.push(row);
        }
      }

      tableSlide.addTable(rows as unknown as Record<string, unknown>[][], {
        x: 0.2, y: 0.5, w: 9.5,
        fontSize: 8,
        border: { pt: 0.5, color: 'E0E6ED' },
        colW: [1.2, 1.5, 0.6, 1.8, 1.5],
      });

      await pptx.writeFile({ fileName: `escala-${MONTH_NAMES[selectedMonth]}-${selectedYear}.pptx` });
    } catch (err) {
      console.error('Error generating PPT:', err);
    }
  };

  // Generate month/year options
  const monthYearOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    for (let y = 2026; y <= 2027; y++) {
      for (let m = 0; m < 12; m++) {
        options.push({
          value: `${String(m + 1).padStart(2, '0')}/${y}`,
          label: `${MONTH_NAMES[m]}/${y}`,
        });
      }
    }
    return options;
  }, []);

  // Build table rows for the vertical layout (matching original HTML)
  const tableRows = useMemo(() => {
    const daysInMonthVal = getDaysInMonth(selectedMonth, selectedYear);
    const now = currentTime;
    const rows: {
      dateStr: string;
      weekday: string;
      letter: PersonKey;
      personName: string;
      shiftDisplay: string;
      shiftType: ShiftType;
      isToday: boolean;
      icons: string;
    }[] = [];

    for (let day = 1; day <= daysInMonthVal; day++) {
      const date = new Date(selectedYear, selectedMonth, day);
      const weekday = DAY_NAMES_FULL[date.getDay()];
      const dateStr = formatDateBR(date);
      const isToday = date.getDate() === now.getDate() &&
                      date.getMonth() === now.getMonth() &&
                      date.getFullYear() === now.getFullYear();

      for (const person of PEOPLE) {
        const shift = getShiftForDay(person.key, date);
        const shiftDisplay = getShiftDisplayString(shift);
        const icons = getEventIcons(person.key, date);

        // Apply filters
        if (shiftFilter) {
          const filterVal = getShiftFilterValue(shift);
          if (filterVal !== shiftFilter) continue;
        }

        if (personFilter && person.key !== personFilter) continue;

        rows.push({
          dateStr,
          weekday,
          letter: person.key,
          personName: person.name,
          shiftDisplay,
          shiftType: shift,
          isToday,
          icons,
        });
      }
    }

    return rows;
  }, [selectedMonth, selectedYear, currentTime, shiftFilter, personFilter, getEventIcons]);

  // Calendar vars
  const today = currentTime;
  const isCurrentMonth = today.getMonth() === selectedMonth && today.getFullYear() === selectedYear;

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, border: '4px solid #e0e6ed', borderTopColor: '#3498db',
            borderRadius: '50%', animation: 'spin 1s linear infinite',
          }} />
          <p style={{ color: '#666', marginTop: 12 }}>Carregando escala...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div
      ref={mainRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: '#f5f7fa',
        overflowY: 'auto',
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        padding: 20,
        maxWidth: 1400,
        margin: '0 auto',
        color: '#2c3e50',
      }}
    >
      {/* Voltar para Home button */}
      <button
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 20,
          left: 20,
          zIndex: 9999,
          background: 'linear-gradient(135deg, #f97316, #ea580c)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: 8,
          border: 'none',
          fontWeight: 600,
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          fontSize: '0.9rem',
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Voltar para Home
      </button>

      {/* Title + Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, marginBottom: 20, marginTop: 20, flexWrap: 'wrap' as const }}>
        <h2 style={{ margin: 0, color: '#2c3e50', textAlign: 'center' as const, fontWeight: 600, fontSize: '1.8rem' }}>
          Escala de Trabalho - Lundin Mining
        </h2>
        <button
          onClick={generatePowerPointReport}
          style={{ padding: '8px 15px', background: '#3498db', color: 'white', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.2s' }}
          onMouseOver={(e) => { e.currentTarget.style.background = '#2980b9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = '#3498db'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          Download Relatório PPT
        </button>
        <button
          onClick={captureScreenshot}
          style={{ padding: '8px 15px', background: '#27ae60', color: 'white', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.2s' }}
          onMouseOver={(e) => { e.currentTarget.style.background = '#219a52'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = '#27ae60'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          Capturar Tela (PNG)
        </button>
      </div>

      {/* Filters Container */}
      <div style={{
        background: '#fff',
        padding: 15,
        borderRadius: 8,
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        marginBottom: 20,
        display: 'flex',
        gap: 15,
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap' as const,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
          <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#2c3e50' }}>Mês/Ano</label>
          <select
            value={`${String(selectedMonth + 1).padStart(2, '0')}/${selectedYear}`}
            onChange={(e) => {
              const parts = e.target.value.split('/');
              setSelectedMonth(parseInt(parts[0]) - 1);
              setSelectedYear(parseInt(parts[1]));
            }}
            style={{ padding: '8px 15px', borderRadius: 6, border: '1px solid #ddd', background: 'white', color: '#2c3e50', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            {monthYearOptions.map(opt => (
              <option key={opt.value} value={opt.value} style={{ color: '#2c3e50' }}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
          <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#2c3e50' }}>Turno</label>
          <select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            style={{ padding: '8px 15px', borderRadius: 6, border: '1px solid #ddd', background: 'white', color: '#2c3e50', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            <option value="" style={{ color: '#2c3e50' }}>Todos</option>
            <option value="07:00 às 19:00" style={{ color: '#2c3e50' }}>Manhã (07:00 às 19:00)</option>
            <option value="19:00 às 07:00" style={{ color: '#2c3e50' }}>Noite (19:00 às 07:00)</option>
            <option value="Folga" style={{ color: '#2c3e50' }}>Folga</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
          <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#2c3e50' }}>Colaborador</label>
          <select
            value={personFilter}
            onChange={(e) => setPersonFilter(e.target.value)}
            style={{ padding: '8px 15px', borderRadius: 6, border: '1px solid #ddd', background: 'white', color: '#2c3e50', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            <option value="" style={{ color: '#2c3e50' }}>Todos</option>
            {PEOPLE.map(p => (
              <option key={p.key} value={p.key} style={{ color: '#2c3e50' }}>{PERSON_FULL_NAMES[p.key]}</option>
            ))}
          </select>
        </div>

        <button
          onClick={resetFilters}
          style={{ padding: '8px 15px', borderRadius: 6, border: '1px solid #ddd', background: 'white', color: '#2c3e50', cursor: 'pointer', fontSize: '0.9rem', marginTop: 18 }}
        >
          Limpar Filtros
        </button>
      </div>

      {/* ===== PRÓXIMO TURNO / EM TURNO - Real-time Status Section ===== */}
      <div style={{
        background: '#fff',
        padding: 20,
        borderRadius: 10,
        boxShadow: '0 2px 15px rgba(0,0,0,0.1)',
        marginBottom: 20,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 15,
          flexWrap: 'wrap' as const,
          gap: 10,
        }}>
          <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.2rem', fontWeight: 600 }}>
            Status em Tempo Real
          </h3>
          <div style={{
            background: '#f0f4f8',
            padding: '6px 14px',
            borderRadius: 6,
            fontSize: '0.9rem',
            color: '#2c3e50',
            fontWeight: 500,
            fontFamily: 'monospace',
          }}>
            {currentTime.toLocaleTimeString('pt-BR')}
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
        }}>
          {PEOPLE.map(person => {
            const status = shiftStatus[person.key];
            const hoursInfo = calculateHoursWorked(person.key);

            return (
              <div
                key={person.key}
                style={{
                  background: status.isOnShift ? '#f0fdf4' : '#f8fafc',
                  border: `2px solid ${status.isOnShift ? '#22c55e' : '#e2e8f0'}`,
                  borderRadius: 10,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.3s ease',
                }}
              >
                {/* Status indicator dot */}
                <div style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: status.isOnShift ? '#22c55e' : '#94a3b8',
                  boxShadow: status.isOnShift ? '0 0 8px rgba(34, 197, 94, 0.5)' : 'none',
                  flexShrink: 0,
                  animation: status.isOnShift ? 'pulse 2s ease-in-out infinite' : 'none',
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#2c3e50' }}>
                      {person.name}
                    </span>
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: status.isOnShift ? '#dcfce7' : '#f1f5f9',
                      color: status.isOnShift ? '#16a34a' : '#64748b',
                      fontWeight: 600,
                    }}>
                      {status.isOnShift ? 'Em Turno' : status.shiftType === 'Folga' ? 'Folga' : 'Aguardando'}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 2 }}>
                    {status.shiftLabel}
                  </div>

                  {status.isOnShift && status.countdownSeconds > 0 && (
                    <div style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 600, fontFamily: 'monospace' }}>
                      {status.countdownLabel}: {formatCountdown(status.countdownSeconds)}
                    </div>
                  )}

                  {!status.isOnShift && status.countdownSeconds > 0 && (
                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500, fontFamily: 'monospace' }}>
                      {status.countdownLabel}: {formatCountdown(status.countdownSeconds)}
                    </div>
                  )}

                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
                    Horas: {formatSeconds(hoursInfo.totalWorkSeconds > 0 ? hoursInfo.totalWorkSeconds : 0)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pulse animation style */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.2); }
        }
      `}</style>

      {/* Person Cards */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, margin: '20px 0', flexWrap: 'wrap' as const }}>
        {PEOPLE.map(person => {
          const hoursInfo = calculateHoursWorked(person.key);
          return (
            <div
              key={person.key}
              style={{
                background: '#fff',
                borderRadius: 8,
                padding: 15,
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                textAlign: 'center' as const,
                width: 180,
              }}
            >
              <img
                src={person.photo}
                alt={person.name}
                style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', marginBottom: 10 }}
                onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${person.key.toLowerCase()}/80/80.jpg`; }}
              />
              <div style={{ fontWeight: 600, marginBottom: 5, color: '#2c3e50' }}>{PERSON_FULL_NAMES[person.key]}</div>
              <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: 5 }}>
                Horas trabalhadas: {hoursInfo.hours}h {hoursInfo.minutes}m {hoursInfo.seconds}s
              </div>
              <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: 5 }}>
                Dias no mês: {hoursInfo.totalDays}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: 5 }}>
                Dias trabalhados: {hoursInfo.workDays}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5, justifyContent: 'center', marginTop: 10 }}>
                <button
                  onClick={() => { resetAtestadoForm(); setAtestadoModal({ open: true, person: person.key }); }}
                  style={{ padding: '3px 8px', fontSize: '0.7rem', border: 'none', borderRadius: 4, cursor: 'pointer', background: '#e74c3c', color: 'white' }}
                >
                  Atestado
                </button>
                <button
                  onClick={() => { resetSpotForm(); setSpotModal({ open: true, person: person.key }); }}
                  style={{ padding: '3px 8px', fontSize: '0.7rem', border: 'none', borderRadius: 4, cursor: 'pointer', background: '#27ae60', color: 'white' }}
                >
                  Spot
                </button>
                <button
                  onClick={() => { resetADMForm(); setAdmModal({ open: true, person: person.key }); }}
                  style={{ padding: '3px 8px', fontSize: '0.7rem', border: 'none', borderRadius: 4, cursor: 'pointer', background: '#9b59b6', color: 'white' }}
                >
                  ADM
                </button>
                <button
                  onClick={() => { resetEventoForm(); setEventoModal({ open: true, person: person.key }); }}
                  style={{ padding: '3px 8px', fontSize: '0.7rem', border: 'none', borderRadius: 4, cursor: 'pointer', background: '#FF9800', color: 'white' }}
                >
                  Eventos
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Month Title */}
      <div style={{ textAlign: 'center' as const, fontSize: '1.5rem', fontWeight: 'bold', marginBottom: 15, color: '#2c3e50' }}>
        {MONTH_NAMES_UPPER[selectedMonth]}/{selectedYear}
      </div>

      {/* ===== VERTICAL TABLE (matching original HTML) ===== */}
      <div style={{ overflowX: 'auto' as const }}>
        <table style={{
          borderCollapse: 'collapse',
          width: '100%',
          background: '#fff',
          boxShadow: '0 2px 15px rgba(0,0,0,0.1)',
          borderRadius: 10,
          overflow: 'hidden',
          fontSize: '0.9rem',
          marginBottom: 30,
        }}>
          <thead>
            <tr>
              {['Data', 'Dia da Semana', 'Letra', 'Colaborador', 'Turno'].map(header => (
                <th key={header} style={{
                  backgroundColor: '#3498db',
                  color: 'white',
                  position: 'sticky',
                  top: 0,
                  fontWeight: 500,
                  fontSize: '0.9rem',
                  border: '1px solid #e0e6ed',
                  padding: '10px 5px',
                  textAlign: 'center' as const,
                  verticalAlign: 'middle' as const,
                }}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, idx) => {
              // Determine shift background color
              let shiftBg = '#fff';
              let shiftTextColor = '#2c3e50';
              if (row.shiftType === 'Manhã') {
                shiftBg = '#fff8e1';
              } else if (row.shiftType === 'Noite') {
                shiftBg = '#e1f5fe';
              } else if (row.shiftType === 'Folga') {
                shiftBg = '#e8f5e9';
                shiftTextColor = '#2e7d32';
              }

              // Letra cell background color
              const letterBg = PERSON_HIGHLIGHT[row.letter];

              return (
                <tr
                  key={`${row.dateStr}-${row.letter}`}
                  style={{
                    backgroundColor: idx % 2 === 1 ? '#f8fafc' : 'transparent',
                    boxShadow: row.isToday ? '0 0 0 2px #e74c3c' : undefined,
                    position: 'relative' as const,
                    zIndex: row.isToday ? 1 : undefined,
                  }}
                >
                  {/* Data */}
                  <td style={{
                    border: '1px solid #e0e6ed',
                    padding: '10px 5px',
                    textAlign: 'center' as const,
                    verticalAlign: 'middle' as const,
                    color: '#2c3e50',
                  }}>
                    {row.dateStr}
                  </td>

                  {/* Dia da Semana */}
                  <td style={{
                    border: '1px solid #e0e6ed',
                    padding: '10px 5px',
                    textAlign: 'center' as const,
                    verticalAlign: 'middle' as const,
                    color: '#2c3e50',
                  }}>
                    {row.weekday}
                  </td>

                  {/* Letra + Event Icons */}
                  <td style={{
                    border: '1px solid #e0e6ed',
                    padding: '10px 5px',
                    textAlign: 'center' as const,
                    verticalAlign: 'middle' as const,
                    backgroundColor: letterBg,
                    color: '#2c3e50',
                    fontWeight: 600,
                  }}>
                    {row.letter}
                    {row.icons && (
                      <span style={{ fontSize: '1rem', marginLeft: 5, verticalAlign: 'middle' }}>{row.icons}</span>
                    )}
                  </td>

                  {/* Colaborador */}
                  <td style={{
                    border: '1px solid #e0e6ed',
                    padding: '10px 5px',
                    textAlign: 'center' as const,
                    verticalAlign: 'middle' as const,
                    color: '#2c3e50',
                  }}>
                    {row.personName}
                  </td>

                  {/* Turno */}
                  <td style={{
                    border: '1px solid #e0e6ed',
                    padding: '10px 5px',
                    textAlign: 'center' as const,
                    verticalAlign: 'middle' as const,
                    backgroundColor: shiftBg,
                    color: shiftTextColor,
                  }}>
                    {row.shiftDisplay}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ========== MODALS ========== */}

      {/* Atestado Modal */}
      {atestadoModal.open && (
        <div
          style={{ display: 'flex', position: 'fixed' as const, top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 1000, justifyContent: 'center', alignItems: 'center' }}
          onClick={() => { setAtestadoModal({ open: false, person: null }); resetAtestadoForm(); }}
        >
          <div
            style={{ background: 'white', padding: 20, borderRadius: 8, width: 350, maxHeight: '80vh', overflowY: 'auto', color: '#2c3e50' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 10, color: '#2c3e50' }}>Registrar Atestado</h3>
            <p style={{ marginBottom: 10, color: '#2c3e50' }}>{atestadoModal.person && PERSON_FULL_NAMES[atestadoModal.person]}</p>

            {/* History */}
            {data && atestadoModal.person && data.atestados[atestadoModal.person]?.length > 0 && (
              <div style={{ marginBottom: 15, borderBottom: '1px solid #eee', paddingBottom: 10 }}>
                <h4 style={{ marginBottom: 5, color: '#2c3e50' }}>Histórico:</h4>
                {data.atestados[atestadoModal.person].map((at: Atestado) => (
                  <div key={at.id} style={{ fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ color: '#2c3e50' }}>{formatDateFromStr(at.startDate)} a {formatDateFromStr(at.endDate)} {at.porHora ? `(${at.horas}h)` : '(12h/dia)'}</span>
                    <button onClick={() => handleDeleteItem('atestados', atestadoModal.person!, at.id)} style={{ padding: '2px 6px', fontSize: '0.7rem', background: '#e74c3c', color: 'white', border: 'none', borderRadius: 3, cursor: 'pointer' }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', marginBottom: 5, color: '#2c3e50' }}>Data Início:</label>
              <input type="date" value={atStartDate} onChange={(e) => setAtStartDate(e.target.value)} style={{ width: '100%', padding: 5, border: '1px solid #ddd', borderRadius: 4, color: '#2c3e50' }} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', marginBottom: 5, color: '#2c3e50' }}>Data Fim:</label>
              <input type="date" value={atEndDate} onChange={(e) => setAtEndDate(e.target.value)} style={{ width: '100%', padding: 5, border: '1px solid #ddd', borderRadius: 4, color: '#2c3e50' }} />
            </div>

            {/* Checkbox Atestado por Hora */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#2c3e50' }}>
                <input type="checkbox" checked={atPorHora} onChange={(e) => setAtPorHora(e.target.checked)} style={{ marginRight: 8 }} />
                Atestado por hora
              </label>
            </div>

            {/* Horas input (hidden by default) */}
            {atPorHora && (
              <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', marginBottom: 5, color: '#2c3e50' }}>Quantidade de Horas:</label>
                <input type="number" value={atHoras} onChange={(e) => setAtHoras(Number(e.target.value))} min={1} max={12} style={{ width: '100%', padding: 5, border: '1px solid #ddd', borderRadius: 4, color: '#2c3e50' }} />
                <div style={{ marginBottom: 15, color: '#666', fontSize: '0.8rem', marginTop: 5 }}>
                  * Se marcado, reduz apenas as horas informadas (não reduz contagem de dias).
                </div>
              </div>
            )}

            {/* Default text */}
            {!atPorHora && (
              <div style={{ marginBottom: 15, color: '#666', fontSize: '0.85rem', fontStyle: 'italic' }}>
                * Se desmarcado, reduzirá automaticamente 12h/dia e a contagem de dias trabalhados.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={handleAddAtestado} style={{ padding: '5px 10px', background: '#27ae60', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Salvar</button>
              <button onClick={() => { setAtestadoModal({ open: false, person: null }); resetAtestadoForm(); }} style={{ padding: '5px 10px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Spot Modal */}
      {spotModal.open && (
        <div
          style={{ display: 'flex', position: 'fixed' as const, top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 1000, justifyContent: 'center', alignItems: 'center' }}
          onClick={() => { setSpotModal({ open: false, person: null }); resetSpotForm(); }}
        >
          <div
            style={{ background: 'white', padding: 20, borderRadius: 8, width: 350, maxHeight: '80vh', overflowY: 'auto', color: '#2c3e50' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 10, color: '#2c3e50' }}>Registrar Spot</h3>
            <p style={{ marginBottom: 10, color: '#2c3e50' }}>{spotModal.person && PERSON_FULL_NAMES[spotModal.person]}</p>

            {/* History */}
            {data && spotModal.person && data.spots[spotModal.person]?.length > 0 && (
              <div style={{ marginBottom: 15, borderBottom: '1px solid #eee', paddingBottom: 10 }}>
                <h4 style={{ marginBottom: 5, color: '#2c3e50' }}>Histórico:</h4>
                {data.spots[spotModal.person].map((sp: Spot) => (
                  <div key={sp.id} style={{ fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ color: '#2c3e50' }}>{formatDateFromStr(sp.startDate)} a {formatDateFromStr(sp.endDate)} ({sp.horasPorDia}h/d)</span>
                    <button onClick={() => handleDeleteItem('spots', spotModal.person!, sp.id)} style={{ padding: '2px 6px', fontSize: '0.7rem', background: '#e74c3c', color: 'white', border: 'none', borderRadius: 3, cursor: 'pointer' }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', marginBottom: 5, color: '#2c3e50' }}>Data Início:</label>
              <input type="date" value={spStartDate} onChange={(e) => setSpStartDate(e.target.value)} style={{ width: '100%', padding: 5, border: '1px solid #ddd', borderRadius: 4, color: '#2c3e50' }} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', marginBottom: 5, color: '#2c3e50' }}>Data Fim:</label>
              <input type="date" value={spEndDate} onChange={(e) => setSpEndDate(e.target.value)} style={{ width: '100%', padding: 5, border: '1px solid #ddd', borderRadius: 4, color: '#2c3e50' }} />
            </div>
            <div style={{ marginBottom: 15 }}>
              <label style={{ display: 'block', marginBottom: 5, color: '#2c3e50' }}>Horas por dia:</label>
              <input type="number" value={spHorasPorDia} onChange={(e) => setSpHorasPorDia(Number(e.target.value))} min={1} max={12} style={{ width: '100%', padding: 5, border: '1px solid #ddd', borderRadius: 4, color: '#2c3e50' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={handleAddSpot} style={{ padding: '5px 10px', background: '#27ae60', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Salvar</button>
              <button onClick={() => { setSpotModal({ open: false, person: null }); resetSpotForm(); }} style={{ padding: '5px 10px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ADM Modal */}
      {admModal.open && (
        <div
          style={{ display: 'flex', position: 'fixed' as const, top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 1000, justifyContent: 'center', alignItems: 'center' }}
          onClick={() => { setAdmModal({ open: false, person: null }); resetADMForm(); }}
        >
          <div
            style={{ background: 'white', padding: 20, borderRadius: 8, width: 350, maxHeight: '80vh', overflowY: 'auto', color: '#2c3e50' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 10, color: '#2c3e50' }}>Registrar Período ADM</h3>
            <p style={{ marginBottom: 10, color: '#2c3e50' }}>{admModal.person && PERSON_FULL_NAMES[admModal.person]}</p>

            {/* History */}
            {data && admModal.person && data.adms[admModal.person]?.length > 0 && (
              <div style={{ marginBottom: 15, borderBottom: '1px solid #eee', paddingBottom: 10 }}>
                <h4 style={{ marginBottom: 5, color: '#2c3e50' }}>Histórico:</h4>
                {data.adms[admModal.person].map((adm: ADM) => (
                  <div key={adm.id} style={{ fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ color: '#2c3e50' }}>{formatDateFromStr(adm.startDate)} a {formatDateFromStr(adm.endDate)} ({adm.horaInicio}-{adm.horaFim})</span>
                    <button onClick={() => handleDeleteItem('adms', admModal.person!, adm.id)} style={{ padding: '2px 6px', fontSize: '0.7rem', background: '#e74c3c', color: 'white', border: 'none', borderRadius: 3, cursor: 'pointer' }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', marginBottom: 5, color: '#2c3e50' }}>Data Início:</label>
              <input type="date" value={admStartDate} onChange={(e) => setAdmStartDate(e.target.value)} style={{ width: '100%', padding: 5, border: '1px solid #ddd', borderRadius: 4, color: '#2c3e50' }} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', marginBottom: 5, color: '#2c3e50' }}>Data Fim:</label>
              <input type="date" value={admEndDate} onChange={(e) => setAdmEndDate(e.target.value)} style={{ width: '100%', padding: 5, border: '1px solid #ddd', borderRadius: 4, color: '#2c3e50' }} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', marginBottom: 5, color: '#2c3e50' }}>Horário Início (padrão 07:30):</label>
              <input type="time" value={admHoraInicio} onChange={(e) => setAdmHoraInicio(e.target.value)} style={{ width: '100%', padding: 5, border: '1px solid #ddd', borderRadius: 4, color: '#2c3e50' }} />
            </div>
            <div style={{ marginBottom: 15 }}>
              <label style={{ display: 'block', marginBottom: 5, color: '#2c3e50' }}>Horário Fim (padrão 16:50):</label>
              <input type="time" value={admHoraFim} onChange={(e) => setAdmHoraFim(e.target.value)} style={{ width: '100%', padding: 5, border: '1px solid #ddd', borderRadius: 4, color: '#2c3e50' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={handleAddADM} style={{ padding: '5px 10px', background: '#9b59b6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Salvar</button>
              <button onClick={() => { setAdmModal({ open: false, person: null }); resetADMForm(); }} style={{ padding: '5px 10px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Evento Modal */}
      {eventoModal.open && (
        <div
          style={{ display: 'flex', position: 'fixed' as const, top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 1000, justifyContent: 'center', alignItems: 'center' }}
          onClick={() => { setEventoModal({ open: false, person: null }); resetEventoForm(); }}
        >
          <div
            style={{ background: 'white', padding: 20, borderRadius: 8, width: 350, maxHeight: '80vh', overflowY: 'auto', color: '#2c3e50' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 10, color: '#2c3e50' }}>Registrar Evento</h3>
            <p style={{ marginBottom: 10, color: '#2c3e50' }}>{eventoModal.person && PERSON_FULL_NAMES[eventoModal.person]}</p>

            {/* History */}
            {data && eventoModal.person && data.eventos[eventoModal.person]?.length > 0 && (
              <div style={{ marginBottom: 15, borderBottom: '1px solid #eee', paddingBottom: 10 }}>
                <h4 style={{ marginBottom: 5, color: '#2c3e50' }}>Histórico:</h4>
                {data.eventos[eventoModal.person].map((ev: Evento) => (
                  <div key={ev.id} style={{ fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ color: '#2c3e50' }}>{formatDateFromStr(ev.startDate)} a {formatDateFromStr(ev.endDate)} ({ev.tipo}, {ev.operacao === 'adicionar' ? '+' : '-'}{ev.horas}h)</span>
                    <button onClick={() => handleDeleteItem('eventos', eventoModal.person!, ev.id)} style={{ padding: '2px 6px', fontSize: '0.7rem', background: '#e74c3c', color: 'white', border: 'none', borderRadius: 3, cursor: 'pointer' }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', marginBottom: 5, color: '#2c3e50' }}>Tipo de Evento:</label>
              <select
                value={evTipo}
                onChange={(e) => setEvTipo(e.target.value as 'folga' | 'viagem' | 'treinamento' | 'férias')}
                style={{ width: '100%', padding: 5, border: '1px solid #ddd', borderRadius: 4, color: '#2c3e50' }}
              >
                <option value="folga" style={{ color: '#2c3e50' }}>Folga</option>
                <option value="viagem" style={{ color: '#2c3e50' }}>Viagem</option>
                <option value="treinamento" style={{ color: '#2c3e50' }}>Treinamento</option>
                <option value="férias" style={{ color: '#2c3e50' }}>Férias</option>
              </select>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', marginBottom: 5, color: '#2c3e50' }}>Data Início:</label>
              <input type="date" value={evStartDate} onChange={(e) => setEvStartDate(e.target.value)} style={{ width: '100%', padding: 5, border: '1px solid #ddd', borderRadius: 4, color: '#2c3e50' }} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', marginBottom: 5, color: '#2c3e50' }}>Data Fim:</label>
              <input type="date" value={evEndDate} onChange={(e) => setEvEndDate(e.target.value)} style={{ width: '100%', padding: 5, border: '1px solid #ddd', borderRadius: 4, color: '#2c3e50' }} />
            </div>

            <div style={{ marginBottom: 15 }}>
              <label style={{ display: 'block', marginBottom: 5, color: '#2c3e50' }}>Horas (Ignorado para Férias/Folga):</label>
              <input type="number" value={evHoras} onChange={(e) => setEvHoras(Number(e.target.value))} min={0} placeholder="Horas do evento" style={{ width: '100%', padding: 5, border: '1px solid #ddd', borderRadius: 4, color: '#2c3e50' }} />
              <div style={{ marginTop: 5 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', marginRight: 15, color: '#2c3e50' }}>
                  <input type="radio" name="evento-horas-tipo" checked={evOperacao === 'adicionar'} onChange={() => setEvOperacao('adicionar')} style={{ marginRight: 5 }} />
                  Acrescentar
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', color: '#2c3e50' }}>
                  <input type="radio" name="evento-horas-tipo" checked={evOperacao === 'subtrair'} onChange={() => setEvOperacao('subtrair')} style={{ marginRight: 5 }} />
                  Reduzir
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={handleAddEvento} style={{ padding: '5px 10px', background: '#FF9800', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Salvar</button>
              <button onClick={() => { setEventoModal({ open: false, person: null }); resetEventoForm(); }} style={{ padding: '5px 10px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
