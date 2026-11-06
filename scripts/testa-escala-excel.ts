/**
 * Teste do Exportar Excel com período "data até data" + fallback da data mais próxima.
 * Gera os workbooks em /tmp e imprime as linhas-chave de cada aba.
 */
import { montarPlanilhaEscala, DadosEscalaX, PessoaX } from '../src/lib/escala-excel';
import * as XLSX from 'xlsx';

const PESSOAS: PessoaX[] = [
  { letra: 'A', nome: 'Marcos Paulo Moraes Borges' },
  { letra: 'B', nome: 'Higor Ataides Macedo' },
  { letra: 'C', nome: 'Weslley Ferreira de Siqueira' },
  { letra: 'D', nome: 'Marcelo Goncalves de Paula' },
];

// Marcações de exemplo: únicas datas COM registro = 05/12/2026 a 08/12/2026
const dados: DadosEscalaX = {
  atestados: { C: [{ id: 't1', startDate: '2026-12-05', endDate: '2026-12-08', porHora: false, horas: 11 }] },
  spots: { A: [{ id: 't2', startDate: '2026-12-06', endDate: '2026-12-06', horasPorDia: 12 }] },
  adms: {},
  eventos: { D: [{ id: 't3', startDate: '2026-12-07', endDate: '2026-12-07', tipo: 'folga', horas: 0, operacao: 'adicionar' }] },
} as unknown as DadosEscalaX;

const dump = (wb: XLSX.WorkBook, aba: string, n = 12) => {
  const ws = wb.Sheets[aba];
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });
  console.log(`\n===== ABA ${aba} (${rows.length} linhas) =====`);
  rows.slice(0, n).forEach((r, i) => console.log(`${String(i).padStart(2, '0')}:`, JSON.stringify(r)));
};

// 1) Período COM marcações dentro
let wb = montarPlanilhaEscala({ periodo: { deISO: '2026-12-01', ateISO: '2026-12-15' }, dados, pessoas: PESSOAS });
dump(wb, 'Escala', 10);
dump(wb, 'Marcações', 6);
dump(wb, 'Resumo', 6);
XLSX.writeFile(wb, '/tmp/teste-periodo-com-marcacoes.xlsx');

// 2) Período SEM marcações nenhuma → deve puxar das datas mais próximas (05–08/12)
wb = montarPlanilhaEscala({ periodo: { deISO: '2026-01-10', ateISO: '2026-01-20' }, dados, pessoas: PESSOAS });
dump(wb, 'Marcações', 8);
dump(wb, 'Escala', 8);
XLSX.writeFile(wb, '/tmp/teste-periodo-sem-marcacoes.xlsx');

// 3) Período atravessando meses (nov→dez) com marcações dentro
wb = montarPlanilhaEscala({ periodo: { deISO: '2026-11-25', ateISO: '2026-12-10' }, dados, pessoas: PESSOAS });
dump(wb, 'Escala', 8);
dump(wb, 'Marcações', 6);
XLSX.writeFile(wb, '/tmp/teste-periodo-entre-meses.xlsx');

// 4) Sem nenhuma marcação no banco → mensagem clara
wb = montarPlanilhaEscala({ periodo: { deISO: '2026-03-01', ateISO: '2026-03-31' }, dados: { atestados: {}, spots: {}, adms: {}, eventos: {} }, pessoas: PESSOAS });
dump(wb, 'Marcações', 4);
XLSX.writeFile(wb, '/tmp/teste-sem-nada.xlsx');

// 5) Modo antigo (mês inteiro) continua funcionando
wb = montarPlanilhaEscala({ ano: 2026, mes: 11, dados, pessoas: PESSOAS });
dump(wb, 'Escala', 8);
XLSX.writeFile(wb, '/tmp/teste-modo-mes.xlsx');

// 6) Datas invertidas no período (de > até) — deve normalizar sem quebrar
wb = montarPlanilhaEscala({ periodo: { deISO: '2026-12-10', ateISO: '2026-12-01' }, dados, pessoas: PESSOAS });
dump(wb, 'Escala', 8);
XLSX.writeFile(wb, '/tmp/teste-invertido.xlsx');

console.log('\nOK — todos os cenários geraram planilha.');
