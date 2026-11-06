/**
 * Teste do Exportar Excel no LAYOUT do Gerador Escala 4x4 (ExcelJS).
 * Gera os workbooks em /tmp e confere estrutura: título, blocos por mês,
 * cores por letra, anotações (atestado etc.), legenda e configuração de página.
 */
import fs from 'fs';
import ExcelJS from 'exceljs';
import { montarWorkbookEscala, DadosEscalaX, PessoaX } from '../src/lib/escala-excel';

const PESSOAS: PessoaX[] = [
  { letra: 'A', nome: 'Marcos Paulo Moraes Borges' },
  { letra: 'B', nome: 'Higor Ataides Macedo' },
  { letra: 'C', nome: 'Weslley Ferreira de Siqueira' },
  { letra: 'D', nome: 'Marcelo Goncalves de Paula' },
];

// Marcações de exemplo: 05–08/12/2026 (atestado C, folga agendada D) + backup A→B no dia 07
const dados: DadosEscalaX = {
  atestados: { C: [{ id: 't1', startDate: '2026-12-05', endDate: '2026-12-08', porHora: false, horas: 11 }] },
  spots: {},
  adms: {},
  eventos: {
    D: [{ id: 't3', startDate: '2026-12-07', endDate: '2026-12-07', tipo: 'folga', horas: 0, operacao: 'adicionar' }],
    A: [{ id: 't4', startDate: '2026-12-07', endDate: '2026-12-07', tipo: 'backup', backupOf: 'B', horas: 0, operacao: 'adicionar' }],
  },
} as unknown as DadosEscalaX;

const ARGB = (v: unknown) => (v && typeof v === 'object' && 'argb' in (v as object) ? String((v as { argb: string }).argb) : '');

async function inspecionar(nome: string, wb: ExcelJS.Workbook, mostrarLinhas = 8) {
  const ws = wb.worksheets[0];
  console.log(`\n===== ${nome} =====`);
  console.log('planilhas:', wb.worksheets.map((w) => w.name).join(', '));
  console.log('A1 título:', JSON.stringify(ws.getCell('A1').value), '| mesclada A1:AG1?', ws.model.merges?.includes('A1:AG1'));
  console.log('imagens:', ws.getImages().length, '| orientação:', ws.pageSetup.orientation, '| gridlines:', ws.views[0]?.showGridLines);
  console.log('larguras A/2/33:', ws.getColumn(1).width, ws.getColumn(2).width, ws.getColumn(33).width);
  // cabeçalhos dos blocos (coluna A) e uma amostra dos dias
  for (let r = 5; r <= Math.min(ws.rowCount, 6 + mostrarLinhas); r++) {
    const vals: string[] = [];
    for (let c = 1; c <= Math.min(ws.columnCount, 12); c++) {
      const cell = ws.getRow(r).getCell(c);
      let s = String(cell.value ?? '');
      const fill = ARGB((cell.fill as { fgColor?: { argb?: string } })?.fgColor);
      if (fill && fill !== 'FFD8D8D8') s += `[${fill}]`;
      if (cell.note) s += `{nota: ${cell.note}}`;
      vals.push(s);
    }
    console.log(String(r).padStart(2, '0'), JSON.stringify(vals));
  }
  // procura a legenda
  for (let r = 1; r <= ws.rowCount; r++) {
    const v = ws.getRow(r).getCell(1).value;
    if (v === 'Legenda') {
      for (let i = 1; i <= 4; i++) {
        const letra = ws.getRow(r + i).getCell(1);
        const nome = ws.getRow(r + i).getCell(2).value;
        console.log('legenda', String(letra.value), ARGB((letra.fill as { fgColor?: { argb?: string } })?.fgColor), '→', String(nome));
      }
      break;
    }
  }
  console.log('formatação condicional:', ((ws.model as unknown as Record<string, unknown>).conditionalFormattings as unknown[] | undefined)?.length ?? 0, '| área impressão:', ws.pageSetup.printArea);
}

// 1) Mês inteiro (uma planilha "Dezembro 2026")
let wb = await montarWorkbookEscala({ periodo: { deISO: '2026-12-01', ateISO: '2026-12-31' }, dados, pessoas: PESSOAS });
await inspecionar('MÊS INTEIRO (dez/2026, com marcações)', wb);
fs.writeFileSync('/tmp/4x4-mes.xlsx', Buffer.from(await wb.xlsx.writeBuffer()));

// 2) Período parcial (data até data cortando o mês)
wb = await montarWorkbookEscala({ periodo: { deISO: '2026-12-10', ateISO: '2026-12-20' }, dados, pessoas: PESSOAS });
await inspecionar('PARCIAL 10–20/12/2026', wb, 10);
fs.writeFileSync('/tmp/4x4-parcial.xlsx', Buffer.from(await wb.xlsx.writeBuffer()));

// 3) Dois meses (nov + dez) → "Escala 4x4"
wb = await montarWorkbookEscala({ periodo: { deISO: '2026-11-25', ateISO: '2026-12-05' }, dados, pessoas: PESSOAS });
await inspecionar('DOIS MESES (25/11 a 05/12)', wb, 12);
fs.writeFileSync('/tmp/4x4-dois.xlsx', Buffer.from(await wb.xlsx.writeBuffer()));

// 4) Modo antigo (mês inteiro por ano/mes) continua funcionando
wb = await montarWorkbookEscala({ ano: 2026, mes: 11, dados, pessoas: PESSOAS });
await inspecionar('MODO ANTIGO (ano/mes = dez/2026)', wb, 4);

// 5) Datas invertidas normalizam
wb = await montarWorkbookEscala({ periodo: { deISO: '2026-12-31', ateISO: '2026-12-01' }, dados, pessoas: PESSOAS });
await inspecionar('INVERTIDO normalizado', wb, 4);

// 6) Banco vazio → só a grade base, sem notas
wb = await montarWorkbookEscala({ periodo: { deISO: '2026-12-01', ateISO: '2026-12-10' }, dados: { atestados: {}, spots: {}, adms: {}, eventos: {} }, pessoas: PESSOAS });
const ws = wb.worksheets[0];
let temNota = false;
ws.eachRow((row) => row.eachCell((c) => { if (c.note) temNota = true; }));
console.log('\nBANCO VAZIO → alguma anotação?', temNota, '(esperado false)');
fs.writeFileSync('/tmp/4x4-vazio.xlsx', Buffer.from(await wb.xlsx.writeBuffer()));

console.log('\nOK — todos os cenários geraram planilha no layout 4x4.');
