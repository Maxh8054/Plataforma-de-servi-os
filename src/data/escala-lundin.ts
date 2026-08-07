export interface EscalaLundinEntry {
  Cliente: string;
  Data: string; // DD/MM/YYYY format
  Letra: string; // A, B, C, D
  Colaborador: string;
  Turno: string; // "07:00 – 19:00", "19:00 – 07:00", "Folga"
  Dia_semana: string;
  Ano: number;
}

const CLIENTE = "Lundin Mining";

const TEAM: Record<string, string> = {
  A: "Weslley Siqueira",
  B: "Higor Ataides",
  C: "Marcos Paulo",
  D: "Marcelo",
};

const TURNO_MANHA = "07:00 – 19:00";
const TURNO_NOITE = "19:00 – 07:00";
const TURNO_FOLGA = "Folga";

const DIA_SEMANA: Record<number, string> = {
  0: "domingo",
  1: "segunda-feira",
  2: "terça-feira",
  3: "quarta-feira",
  4: "quinta-feira",
  5: "sexta-feira",
  6: "sábado",
};

/**
 * 8-day cycle definition (each phase lasts 2 days):
 *
 * Phase 0 (cycle day 7,0): D=Manhã, A=Noite, C=Folga, B=Folga
 * Phase 1 (cycle day 1-2): B=Manhã, D=Noite, A=Folga, C=Folga
 * Phase 2 (cycle day 3-4): C=Manhã, B=Noite, D=Folga, A=Folga
 * Phase 3 (cycle day 5-6): A=Manhã, C=Noite, B=Folga, D=Folga
 */
const CYCLE_PHASES: { manha: string; noite: string; folga1: string; folga2: string }[] = [
  { manha: "D", noite: "A", folga1: "C", folga2: "B" },
  { manha: "B", noite: "D", folga1: "A", folga2: "C" },
  { manha: "C", noite: "B", folga1: "D", folga2: "A" },
  { manha: "A", noite: "C", folga1: "B", folga2: "D" },
];

const CYCLE_LENGTH = 8; // days

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatDateDDMMYYYY(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatDateYYYYMMDD(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function generateLundinData(): EscalaLundinEntry[] {
  const entries: EscalaLundinEntry[] = [];

  const startDate = new Date(2026, 4, 1); // May 1, 2026 (month is 0-indexed)
  const endDate = new Date(2027, 0, 31); // January 31, 2027

  const startTime = startDate.getTime();
  const endTime = endDate.getTime();
  const msPerDay = 24 * 60 * 60 * 1000;

  for (let current = startTime; current <= endTime; current += msPerDay) {
    const date = new Date(current);
    const daysSinceStart = Math.round((current - startTime) / msPerDay);
    const cycleDay = daysSinceStart % CYCLE_LENGTH;
    const phaseIndex = Math.floor((cycleDay + 1) / 2) % 4;
    const phase = CYCLE_PHASES[phaseIndex];

    const letters = [phase.manha, phase.noite, phase.folga1, phase.folga2];
    const turnos = [TURNO_MANHA, TURNO_NOITE, TURNO_FOLGA, TURNO_FOLGA];

    const dataStr = formatDateDDMMYYYY(date);
    const diaSemana = DIA_SEMANA[date.getDay()];
    const ano = date.getFullYear();

    for (let i = 0; i < 4; i++) {
      const letra = letters[i];
      entries.push({
        Cliente: CLIENTE,
        Data: dataStr,
        Letra: letra,
        Colaborador: TEAM[letra],
        Turno: turnos[i],
        Dia_semana: diaSemana,
        Ano: ano,
      });
    }
  }

  return entries;
}

export const dataReport_Escala_Turno_Lundin: EscalaLundinEntry[] = generateLundinData();

/**
 * Map key format: "YYYY-MM-DD_Letter" (e.g., "2026-05-01_A")
 * Map value: the EscalaLundinEntry
 */
export const escalaLundinMap: Map<string, EscalaLundinEntry> = new Map(
  dataReport_Escala_Turno_Lundin.map((entry) => {
    // Parse DD/MM/YYYY to build YYYY-MM-DD
    const [dd, mm, yyyy] = entry.Data.split("/");
    const key = `${yyyy}-${mm}-${dd}_${entry.Letra}`;
    return [key, entry];
  })
);

/**
 * Helper to look up a shift for a given date and person letter.
 * @param date - JavaScript Date object
 * @param letter - Team letter: "A", "B", "C", or "D"
 * @returns The matching EscalaLundinEntry or undefined if not found
 */
export function getLundinShift(date: Date, letter: string): EscalaLundinEntry | undefined {
  const key = `${formatDateYYYYMMDD(date)}_${letter}`;
  return escalaLundinMap.get(key);
}
