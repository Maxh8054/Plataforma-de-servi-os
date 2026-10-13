// Excel Export Utility for Parts Table
import * as XLSX from 'xlsx';
import type { InspectionData, PhotoData, AdditionalPart, PhotoCategory } from '@/types/report';
import { getSubPartsForPhoto, photoShouldBeInPartsTable, getDisplayPn } from './partsUtils';

function sanitizeForFilename(text: string): string {
  return text
    .trim()
    .substring(0, 60)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    || 'export';
}

interface ExcelPartRow {
  Cliente: string;
  Descrição: string;
  Equipamento: string;
  Data: string;
  Mês: string;
  PN: string;
  Quantidade: string;
  Criticidade: string;
  'Nome da Peça': string;
}

// Get month name from date string
function getMonthName(dateStr: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '-';
  
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  
  const monthIndex = parseInt(parts[1], 10) - 1;
  if (monthIndex >= 0 && monthIndex < 12) {
    return monthNames[monthIndex];
  }
  return '-';
}

// Format date for display
function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const day = parts[2].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[0];
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}

// Export parts table to Excel for Home tab (with categories)
export function exportPartsTableToExcelHome(
  inspection: InspectionData,
  categories: PhotoCategory[],
  reportId?: string
): void {
  const rows: ExcelPartRow[] = [];
  
  // Process all parts from all categories
  categories.forEach((category) => {
    // Photos that should appear in table (has PN or has sub-parts)
    category.photos.filter(p => photoShouldBeInPartsTable(p, category.additionalParts)).forEach((photo) => {
      rows.push({
        Cliente: inspection.cliente || '-',
        Descrição: inspection.descricao || '-',
        Equipamento: inspection.tag || '-',
        Data: formatDate(inspection.data),
        Mês: getMonthName(inspection.data),
        PN: getDisplayPn(photo, category.additionalParts),
        Quantidade: photo.quantity || '-',
        Criticidade: photo.criticality || '-',
        'Nome da Peça': photo.partName || '-',
      });
      
      // Sub-parts (matched by photoId)
      getSubPartsForPhoto(photo, category.additionalParts).forEach((subPart) => {
        rows.push({
          Cliente: inspection.cliente || '-',
          Descrição: inspection.descricao || '-',
          Equipamento: inspection.tag || '-',
          Data: formatDate(inspection.data),
          Mês: getMonthName(inspection.data),
          PN: subPart.pn,
          Quantidade: subPart.quantity || '-',
          Criticidade: subPart.criticality || '-',
          'Nome da Peça': subPart.partName || '-',
        });
      });
    });
  });
  
  generateExcelFile(rows, inspection, reportId);
}

// Export parts table to Excel for Inspeção tab
export function exportPartsTableToExcelInspecao(
  inspection: InspectionData,
  photos: PhotoData[],
  additionalParts: AdditionalPart[],
  reportId?: string
): void {
  const rows: ExcelPartRow[] = [];
  
  // Photos that should appear in table (has PN or has sub-parts)
  photos.filter(p => photoShouldBeInPartsTable(p, additionalParts)).forEach((photo) => {
    rows.push({
      Cliente: inspection.cliente || '-',
      Descrição: inspection.descricao || '-',
      Equipamento: inspection.tag || '-',
      Data: formatDate(inspection.data),
      Mês: getMonthName(inspection.data),
      PN: getDisplayPn(photo, additionalParts),
      Quantidade: photo.quantity || '-',
      Criticidade: photo.criticality || '-',
      'Nome da Peça': photo.partName || '-',
    });
    
    // Sub-parts (matched by photoId)
    getSubPartsForPhoto(photo, additionalParts).forEach((subPart) => {
      rows.push({
        Cliente: inspection.cliente || '-',
        Descrição: inspection.descricao || '-',
        Equipamento: inspection.tag || '-',
        Data: formatDate(inspection.data),
        Mês: getMonthName(inspection.data),
        PN: subPart.pn,
        Quantidade: subPart.quantity || '-',
        Criticidade: subPart.criticality || '-',
        'Nome da Peça': subPart.partName || '-',
      });
    });
  });
  
  generateExcelFile(rows, inspection, reportId);
}

// Generate the Excel file
function generateExcelFile(rows: ExcelPartRow[], inspection: InspectionData, reportId?: string): void {
  if (rows.length === 0) {
    alert('Não há peças para exportar.');
    return;
  }
  
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  
  // Set column widths
  const colWidths = [
    { wch: 20 }, // Cliente
    { wch: 30 }, // Descrição
    { wch: 15 }, // Equipamento
    { wch: 12 }, // Data
    { wch: 12 }, // Mês
    { wch: 15 }, // PN
    { wch: 10 }, // Quantidade
    { wch: 12 }, // Criticidade
    { wch: 30 }, // Nome da Peça
  ];
  ws['!cols'] = colWidths;
  
  // Add the worksheet to the workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Tabela de Peças');
  
  // Generate filename
  const tag = sanitizeForFilename(inspection.descricao || inspection.tag);
  const date = new Date().toISOString().split('T')[0];
  const filename = `Tabela_Pecas_${tag}_${reportId || ''}_${date}.xlsx`.replace(/__+/g, '_');
  
  // Write and download
  XLSX.writeFile(wb, filename);
}

// Export sub-parts to Excel in the same layout used for paste input
// Format: Part No. | Q'ty | Part Name (tab-separated, one per row)
export function exportSubPartsToExcel(
  subParts: AdditionalPart[],
  parentPn?: string
): void {
  if (subParts.length === 0) {
    alert('Não há sub-peças para exportar.');
    return;
  }

  const rows: { "Part No.": string; "Q'ty": string; "Part Name": string }[] =
    subParts.map(part => ({
      'Part No.': part.pn,
      "Q'ty": part.quantity || '',
      'Part Name': part.partName || '',
    }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Set column widths matching the input layout
  ws['!cols'] = [
    { wch: 20 }, // Part No.
    { wch: 8 },  // Q'ty
    { wch: 40 }, // Part Name
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Sub-peças');

  const parent = parentPn ? sanitizeForFilename(parentPn) : 'subpecas';
  const date = new Date().toISOString().split('T')[0];
  const filename = `Subpecas_${parent}_${date}.xlsx`.replace(/__+/g, '_');

  XLSX.writeFile(wb, filename);
}
