// Email utility functions for Technical Report System
// Todos os emails são formatados em Português
import type { InspectionData, PhotoData, AdditionalPart, PhotoCategory } from '@/types/report';

// Email configuration
export const EMAIL_CONFIG = {
  // Destinatários para email de Conclusão (todos)
  conclusionRecipients: [
    'engenharia1@zaminebrasil.com',
    'victor-a@zaminebrasil.com',
    'fernando-p@zaminebrasil.com',
    'cristiano-c@zaminebrasil.com',
    'alvino-j@zaminebrasil.com',
  ],
  conclusionCc: [
    'julio-s@zaminebrasil.com',
    'wallysson-s@zaminebrasil.com',
    'ranielly-s@zaminebrasil.com',
    'marcos-b@zaminebrasil.com',
    'charles-a@zaminebrasil.com',
    'fabricio-c@zaminebrasil.com',
    'rafaela-m@zaminebrasil.com',
    'warlen-s@zaminebrasil.com',
    'cicero-c@zaminebrasil.com',
    'higor-a@zaminebrasil.com',
    'max-r@zaminebrasil.com',
    'marcelo-p@zaminebrasil.com',
    'jun-shibuya@zaminebrasil.com',
    'weslley-f@zaminebrasil.com',
    'emerson-a@zaminebrasil.com',
    'guilherme-r@zaminebrasil.com',
    'vinicius-m@zaminebrasil.com',
  ],
  // Destinatários para email de Análise (apenas alguns)
  analysisRecipients: [
    'wallysson-s@zaminebrasil.com',
    'emerson-a@zaminebrasil.com',
    'Max-r@zaminebrasil.com',
    'fabricio-c@zaminebrasil.com',
    
  ],
  analysisCc: [],
};

// Format date for display (without timezone issues)
function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  
  // Parse date manually to avoid timezone issues (YYYY-MM-DD format)
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const day = parts[2].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[0];
    return `${day}/${month}/${year}`;
  }
  
  return dateStr;
}

// Generate email subject
export function generateEmailSubject(
  inspection: InspectionData, 
  type: 'analysis' | 'conclusion',
  reportId?: string
): string {
  const typeLabel = type === 'analysis' ? 'Análise' : 'Conclusão';
  const tag = inspection.tag || 'Sem TAG';
  const modelo = inspection.modelo || '';
  
  return `[Relatório Técnico ${reportId || ''}] ${typeLabel} - ${tag}${modelo ? ` - ${modelo}` : ''}`.replace(/\[Relatório Técnico \]/, '[Relatório Técnico]');
}

// Generate plain text email body for analysis
export function generateAnalysisEmailBody(
  inspection: InspectionData,
  photos: PhotoData[],
  additionalParts: AdditionalPart[],
  categories?: PhotoCategory[],
  reportId?: string
): string {
  const lines: string[] = [];
  
  // Header
  lines.push('Prezados,');
  lines.push('');
  
  // Report ID
  if (reportId) {
    lines.push(`ID do Relatório: ${reportId}`);
    lines.push('');
  }
  
  // Introduction
  const descricao = inspection.descricao || 'intervenção técnica';
  const tag = inspection.tag || 'equipamento';
  const modelo = inspection.modelo || '';
  const dataExecucao = formatDate(inspection.data);
  
  lines.push(`Encaminho o relatório técnico referente à ${descricao} do ${tag}${modelo ? `, modelo ${modelo}` : ''}, realizado em ${dataExecucao}.`);
  lines.push('');
  lines.push('O serviço executado está devidamente descrito no relatório anexo.');
  lines.push('');
  lines.push('Permaneço à disposição para quaisquer esclarecimentos adicionais.');
  
  return lines.join('\n');
}

// Generate plain text email body for conclusion
export function generateConclusionEmailBody(
  inspection: InspectionData,
  conclusion: string,
  photos: PhotoData[],
  additionalParts: AdditionalPart[],
  categories?: PhotoCategory[],
  reportId?: string
): string {
  const lines: string[] = [];
  
  // Header
  lines.push('Prezados,');
  lines.push('');
  
  // Report ID
  if (reportId) {
    lines.push(`ID do Relatório: ${reportId}`);
    lines.push('');
  }
  
  // Introduction
  const descricao = inspection.descricao || 'intervenção técnica';
  const tag = inspection.tag || 'equipamento';
  const modelo = inspection.modelo || '';
  const dataExecucao = formatDate(inspection.data);
  
  lines.push(`Encaminho o relatório de conclusão referente à ${descricao} do ${tag}${modelo ? `, modelo ${modelo}` : ''}, realizado em ${dataExecucao}.`);
  lines.push('');
  lines.push('O serviço executado está devidamente descrito no relatório anexo.');
  lines.push('');
  lines.push('Permaneço à disposição para quaisquer esclarecimentos adicionais.');
  
  return lines.join('\n');
}

// Open email client with pre-filled data
export function openEmailClient(options: {
  to?: string[];
  cc?: string[];
  subject: string;
  body: string;
}): void {
  const { to = [], cc = [], subject, body } = options;
  
  // Build mailto URL
  const toStr = to.join(',');
  const ccStr = cc.join(',');
  
  // Create mailto link
  const mailtoUrl = `mailto:${toStr}?cc=${encodeURIComponent(ccStr)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  
  // Open email client
  window.location.href = mailtoUrl;
}
