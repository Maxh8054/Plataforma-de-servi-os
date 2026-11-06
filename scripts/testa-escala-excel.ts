// Teste determinístico do gerador de Excel da escala.
// Uso: bun scripts/testa-escala-excel.ts
import * as XLSX from 'xlsx';
import { montarPlanilhaEscala } from '../src/lib/escala-excel';

const PESSOAS = [
  { letra: 'A' as const, nome: 'Marcos Paulo Moraes Borges' },
  { letra: 'B' as const, nome: 'Higor Ataides Macedo' },
  { letra: 'C' as const, nome: 'Weslley Ferreira de Siqueira' },
  { letra: 'D' as const, nome: 'Marcelo Goncalves de Paula' },
];

// novembro/2026 com marcações de teste em quem está de folga no dia 9 (verifico abaixo)
const dados = {
  atestados: { A: [{ startDate: '2026-11-09', endDate: '2026-11-11', porHora: false, horas: 0 }] },
  spots: { C: [{ startDate: '2026-11-20', endDate: '2026-11-20', horasPorDia: 3 }] },
  adms: {},
  eventos: { D: [{ tipo: 'férias' as const, startDate: '2026-11-23', endDate: '2026-11-26', horas: 8, operacao: 'subtrair' as const }] },
};

const wb = montarPlanilhaEscala({ ano: 2026, mes: 10, dados, pessoas: PESSOAS });
console.log('abas:', wb.SheetNames.join(', '));

const esc = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Escala'], { header: 1 });
console.log('Escala: linhas=', esc.length, 'cabeçalho=', JSON.stringify(esc[4]));
console.log('primeiro dia=', JSON.stringify(esc[5]));
// 09/11/2026 (domingo) = linha índice 5+8
console.log('09/11=', JSON.stringify(esc[13]));
// 23/11 (segunda) = linha 5+22
console.log('23/11=', JSON.stringify(esc[27]));

const marc = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Marcações'], { header: 1 });
console.log('Marcações: linhas=', marc.length);
marc.forEach((r, i) => console.log('  ', JSON.stringify(r)));

const res = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Resumo'], { header: 1 });
res.forEach((r) => console.log('  RES', JSON.stringify(r)));

// grava arquivo real e relê para validar estrutura de arquivo
XLSX.writeFile(wb, '/tmp/render/escala-teste.xlsx');
const re = XLSX.readFile('/tmp/render/escala-teste.xlsx');
console.log('RELÊ arquivo:', re.SheetNames.join(', '), '| Escala A5 =', re.Sheets['Escala']['A5']?.v);
