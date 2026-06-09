// Full verification against ALL user data
const CYCLE_PHASES = [
  { manha: "D", noite: "A", folga1: "C", folga2: "B" },
  { manha: "B", noite: "D", folga1: "A", folga2: "C" },
  { manha: "C", noite: "B", folga1: "D", folga2: "A" },
  { manha: "A", noite: "C", folga1: "B", folga2: "D" },
];
const TURNO_MANHA = "07:00 – 19:00";
const TURNO_NOITE = "19:00 – 07:00";
const TURNO_FOLGA = "Folga";
function pad2(n) { return n.toString().padStart(2, "0"); }

const startDate = new Date(2026, 4, 1);
const msPerDay = 24 * 60 * 60 * 1000;

const generated = {};
for (let d = new Date(2026, 4, 1); d <= new Date(2027, 0, 31); d = new Date(d.getTime() + msPerDay)) {
  const daysSinceStart = Math.round((d.getTime() - startDate.getTime()) / msPerDay);
  const cycleDay = daysSinceStart % 8;
  const phaseIndex = Math.floor((cycleDay + 1) / 2) % 4;
  const phase = CYCLE_PHASES[phaseIndex];
  const letters = [phase.manha, phase.noite, phase.folga1, phase.folga2];
  const turnos = [TURNO_MANHA, TURNO_NOITE, TURNO_FOLGA, TURNO_FOLGA];
  const dataStr = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  for (let i = 0; i < 4; i++) {
    generated[`${dataStr}_${letters[i]}`] = turnos[i];
  }
}

// Read the user data from stdin
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  const userData = JSON.parse(input);
  let passed = 0, failed = 0;
  for (const u of userData) {
    const key = `${u.Data}_${u.Letra}`;
    const actual = generated[key];
    if (actual === u.Turno) {
      passed++;
    } else {
      failed++;
      if (failed <= 10) console.log(`✗ ${u.Data} ${u.Letra}: Expected "${u.Turno}", Got "${actual || 'NOT FOUND'}"`);
    }
  }
  console.log(`\nTotal: ${passed + failed} entries checked`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  if (failed > 10) console.log(`(showing first 10 failures only)`);
});
