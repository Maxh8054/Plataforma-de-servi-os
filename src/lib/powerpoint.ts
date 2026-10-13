import pptxgen from 'pptxgenjs';
import { saveAs } from 'file-saver';
import type { InspectionData, PhotoData, AdditionalPart, PhotoCategory } from '@/types/report';
import { getSubPartsForPhoto, photoShouldBeInPartsTable, getDisplayPn } from './partsUtils';
import { t, type Language } from './translations';
import { coverCropImage, maybeCoverCropImage, getImageInfo } from './coverCrop';

// Photo dimensions in inches
const SLIDE_MARGIN = 0.15;  // Reduced lateral margin
const PHOTO_LANDSCAPE_W = 4.8;
const PHOTO_LANDSCAPE_H = 3.2;
const PHOTO_PORTRAIT_W = 3.3;
const PHOTO_PORTRAIT_H = 3.2;
// When one slot is dual (side-by-side), same width as any other container
const DUAL_PHOTO_H = 3.2;
const CONTAINER_GAP = 0.1;  // Gap between the two photo containers on a slide

// Sanitize text for use in filenames
function sanitizeForFilename(text: string): string {
  return text
    .trim()
    .substring(0, 60)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    || 'Inspecao';
}

// Helper function to generate a black image with white text
function generateSerialNumberImage(serialNumber: string): string {
  const canvas = document.createElement('canvas');
  const width = 400;
  const height = 400;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    // Black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    
    // White text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw serial number
    const displayText = serialNumber || 'N/A';
    ctx.fillText(displayText, width / 2, height / 2);
  }
  
  return canvas.toDataURL('image/png');
}

// Logo placeholder (base64) - Replace with actual logo
const LOGO_BASE64 = 'data:image/png;base64,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';


interface PowerPointOptions {
  inspection: InspectionData;
  photos: PhotoData[];
  additionalParts: AdditionalPart[];
  conclusion: string;
  language?: Language;
  reportId?: string;
  translatedData?: {
    inspection: InspectionData;
    photos: PhotoData[];
    conclusion: string;
  };
}

interface HomePowerPointOptions {
  inspection: InspectionData;
  categories: PhotoCategory[];
  conclusion: string;
  language?: Language;
  reportId?: string;
  translatedData?: {
    inspection: InspectionData;
    categories: PhotoCategory[];
    conclusion: string;
  };
}

export async function generatePowerPoint(options: PowerPointOptions): Promise<void> {
  const { inspection, photos, additionalParts, conclusion, language = 'pt', reportId, translatedData } = options;
  const isTranslated = language !== 'pt';
  
  // Use translated data if available, otherwise use original
  const finalInspection = translatedData?.inspection || inspection;
  const finalPhotos = translatedData?.photos || photos;
  const finalConclusion = translatedData?.conclusion || conclusion;
  
  const pptx = new pptxgen();
  
  // Set presentation properties
  pptx.author = 'Z-Services AI';
  pptx.title = `Relatório Técnico - ${finalInspection.tag || 'Máquina'}`;
  pptx.subject = finalInspection.descricao || 'Inspeção Técnica';
  
  // Generate slides
  generateCoverSlide(pptx, finalInspection, language, reportId);
  
  // Slide de Identificação da Máquina (sempre gerado)
  await generateMachineIdentificationSlide(pptx, finalInspection, language);
  
  await generatePhotoSlides(pptx, finalPhotos, language);
  generatePartsTableSlides(pptx, finalPhotos, additionalParts, language);
  
  if (finalConclusion.trim()) {
    generateConclusionSlide(pptx, finalConclusion, language);
  }
  
  generateFinalSlide(pptx, language, reportId);
  
  // Save the file
  const fileName = `Relatorio_${sanitizeForFilename(finalInspection.descricao || finalInspection.tag)}_${reportId || ''}_${formatDateForFileName(finalInspection.data)}.pptx`.replace(/__+/g, '_');
  const blob = await pptx.write({ outputType: 'blob' }) as Blob;
  saveAs(blob, fileName);
}

// ============================================
// HOME POWERPOINT - Com Categorias
// ============================================
export async function generateHomePowerPoint(options: HomePowerPointOptions): Promise<void> {
  const { inspection, categories, conclusion, language = 'pt', reportId, translatedData } = options;
  const isTranslated = language !== 'pt';
  
  // Use translated data if available, otherwise use original
  const finalInspection = translatedData?.inspection || inspection;
  const finalCategories = translatedData?.categories || categories;
  const finalConclusion = translatedData?.conclusion || conclusion;
  
  const pptx = new pptxgen();
  
  // Set presentation properties
  pptx.author = 'Z-Services AI';
  pptx.title = `Relatório Técnico - ${finalInspection.tag || 'Máquina'}`;
  pptx.subject = finalInspection.descricao || 'Inspeção Técnica';
  
  // Generate slides
  generateCoverSlide(pptx, finalInspection, language, reportId);
  
  // Slide de Identificação da Máquina (sempre gerado)
  await generateMachineIdentificationSlide(pptx, finalInspection, language);
  
  // Generate category slides
  for (const [index, category] of finalCategories.entries()) {
    const photosWithImages = category.photos.filter(p => p.imageData);
    if (photosWithImages.length > 0) {
      await generateCategorySlides(pptx, category, index + 1, language);
    }
  }

  // Collect all parts from all categories for the parts table
  const allPhotos: PhotoData[] = [];
  const allAdditionalParts: AdditionalPart[] = [];
  finalCategories.forEach(category => {
    allPhotos.push(...category.photos);
    allAdditionalParts.push(...category.additionalParts);
  });
  
  generatePartsTableSlides(pptx, allPhotos, allAdditionalParts, language);
  
  if (finalConclusion.trim()) {
    generateConclusionSlide(pptx, finalConclusion, language);
  }
  
  generateFinalSlide(pptx, language, reportId);
  
  // Save the file
  const fileName = `Relatorio_Home_${sanitizeForFilename(finalInspection.descricao || finalInspection.tag)}_${reportId || ''}_${formatDateForFileName(finalInspection.data)}.pptx`.replace(/__+/g, '_');
  const blob = await pptx.write({ outputType: 'blob' }) as Blob;
  saveAs(blob, fileName);
}

// Helper function to get translated category title and description
function getCategoryTranslation(categoryId: string, language: Language): { title: string; description: string } {
  const titleKey = `category.${categoryId}`;
  const descKey = `category.${categoryId}Desc`;
  
  return {
    title: t(titleKey, language, { defaultValue: categoryId }),
    description: t(descKey, language, { defaultValue: '' }),
  };
}

/**
 * Detect photo orientation and return appropriate PPT dimensions.
 */
async function getPhotoDimensions(photo: PhotoData): Promise<{ w: number; h: number; isPortrait: boolean }> {
  const imgData = photo.editedImageData || photo.imageData;
  if (!imgData) return { w: PHOTO_LANDSCAPE_W, h: PHOTO_LANDSCAPE_H, isPortrait: false };
  try {
    const info = await getImageInfo(imgData);
    return info.isPortrait
      ? { w: PHOTO_PORTRAIT_W, h: PHOTO_PORTRAIT_H, isPortrait: true }
      : { w: PHOTO_LANDSCAPE_W, h: PHOTO_LANDSCAPE_H, isPortrait: false };
  } catch {
    return { w: PHOTO_LANDSCAPE_W, h: PHOTO_LANDSCAPE_H, isPortrait: false };
  }
}

/**
 * Calculate x,y positions for 1 or 2 photos on a slide,
 * centering them horizontally.
 */
function layoutPhotos(
  dims1: { w: number; h: number } | null,
  dims2: { w: number; h: number } | null,
  y: number,
  gap: number
): Array<{ photo: PhotoData; x: number; y: number; w: number; h: number } | null> {
  const result: Array<{ photo: PhotoData; x: number; y: number; w: number; h: number } | null> = [null, null];
  
  if (!dims1 && !dims2) return result;
  
  if (dims1 && !dims2) {
    // Single photo: center it
    result[0] = { photo: null!, x: (10 - dims1.w) / 2, y, w: dims1.w, h: dims1.h };
    return result;
  }
  
  if (dims1 && dims2) {
    // Two photos: center them together
    const totalW = dims1.w + gap + dims2.w;
    const startX = (10 - totalW) / 2;
    result[0] = { photo: null!, x: startX, y, w: dims1.w, h: dims1.h };
    result[1] = { photo: null!, x: startX + dims1.w + gap, y, w: dims2.w, h: dims2.h };
    return result;
  }
  
  // Only dims2 (shouldn't happen)
  result[1] = { photo: null!, x: (10 - dims2.w) / 2, y, w: dims2.w, h: dims2.h };
  return result;
}

/**
 * Get height based on image aspect ratio for a given width.
 * Returns a default height if image data can't be parsed.
 */
async function getAspectRatioHeight(targetW: number, imgData: string): Promise<number> {
  try {
    const info = await getImageInfo(imgData);
    const ratio = info.height / info.width;
    const h = targetW * ratio;
    // Clamp between 2.5 and 3.2 inches
    return Math.max(2.5, Math.min(3.2, h));
  } catch {
    return PHOTO_LANDSCAPE_H;
  }
}

async function generateCategorySlides(
  pptx: pptxgen, 
  category: PhotoCategory, 
  categoryNumber: number,
  language: Language
) {
  const isTranslated = language !== 'pt';
  const photosWithImages = category.photos.filter(p => p.imageData);
  const slideCount = Math.ceil(photosWithImages.length / 2);
  
  // Get translated title
  const { title: translatedTitle } = getCategoryTranslation(category.id, language);
  
  for (let i = 0; i < slideCount; i++) {
    const slide = pptx.addSlide();
    addCategoryHeader(slide, `${categoryNumber}. ${translatedTitle.toUpperCase()}`);
    
    const photo1 = photosWithImages[i * 2];
    const photo2 = photosWithImages[i * 2 + 1];
    
    const isDual1 = !!(photo1?.secondaryImageData && photo1?.imageData);
    const isDual2 = !!(photo2?.secondaryImageData && photo2?.imageData);
    
    // Calculate widths: dual photos get wider slots
    let w1: number, h1: number, w2: number, h2: number;
    const y = 1.35;
    const gap = CONTAINER_GAP;
    const usableW = 10 - SLIDE_MARGIN * 2;
    
    if (isDual1 && isDual2) {
      // Both dual: equal wide slots
      w1 = (usableW - gap) / 2;
      w2 = w1;
      h1 = DUAL_PHOTO_H;
      h2 = DUAL_PHOTO_H;
    } else if (isDual1) {
      // Photo 1 dual, photo 2 single
      w1 = PHOTO_LANDSCAPE_W;
      w2 = usableW - w1 - gap;
      h1 = DUAL_PHOTO_H;
      h2 = photo2 ? (photo2.editedImageData || photo2.imageData ? await getAspectRatioHeight(w2, photo2.editedImageData || photo2.imageData!) : PHOTO_LANDSCAPE_H) : PHOTO_LANDSCAPE_H;
    } else if (isDual2) {
      // Photo 1 single, photo 2 dual
      w2 = PHOTO_LANDSCAPE_W;
      w1 = usableW - w2 - gap;
      h1 = photo1 ? (photo1.editedImageData || photo1.imageData ? await getAspectRatioHeight(w1, photo1.editedImageData || photo1.imageData!) : PHOTO_LANDSCAPE_H) : PHOTO_LANDSCAPE_H;
      h2 = DUAL_PHOTO_H;
    } else {
      // Both single: use orientation detection
      const dims1 = photo1 ? await getPhotoDimensions(photo1) : null;
      const dims2 = photo2 ? await getPhotoDimensions(photo2) : null;
      const positions = layoutPhotos(dims1, dims2, y, gap);
      
      if (photo1?.imageData && positions[0]) {
        await addPhotoToSlide(slide, photo1, positions[0].x, positions[0].y, positions[0].w, positions[0].h, language, String(i * 2 + 1));
      }
      if (photo2?.imageData && positions[1]) {
        await addPhotoToSlide(slide, photo2, positions[1].x, positions[1].y, positions[1].w, positions[1].h, language, String(i * 2 + 2));
      }
      addStandardFooter(slide);
      continue;
    }
    
    // Place photos with calculated widths
    const x1 = SLIDE_MARGIN;
    const x2 = x1 + w1 + gap;
    
    if (photo1?.imageData) {
      await addPhotoToSlide(slide, photo1, x1, y, w1, h1, language, String(i * 2 + 1));
    }
    if (photo2?.imageData) {
      await addPhotoToSlide(slide, photo2, x2, y, w2, h2, language, String(i * 2 + 2));
    }
    
    addStandardFooter(slide);
  }
}

function generateCoverSlide(pptx: pptxgen, inspection: InspectionData, language: Language, reportId?: string) {
  const isTranslated = language !== 'pt';
  const slide = pptx.addSlide();
  
  // Header
  addStandardHeader(slide, isTranslated ? 'INSPECTION' : 'INSPEÇÃO');
  
  // Title
  slide.addText(isTranslated ? 'Technical Report' : 'Relatório Técnico', {
    x: 0.3,
    y: 1.05,
    w: 6,
    h: 0.6,
    fontSize: 18,
    bold: true,
    color: '000000',
    fontFace: 'Arial',
  });
  
  // Info card background
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.3,
    y: 1.85,
    w: 9.4,
    h: 3.8,
    fill: { color: 'F8F9FA' },
    line: { color: 'E0E0E0', width: 1 },
  });
  
  // Left border
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.3,
    y: 1.85,
    w: 0.08,
    h: 3.8,
    fill: { color: 'FF6600' },
  });
  
  // Card title
  slide.addText(isTranslated ? 'Execution Information' : 'Informações da Execução', {
    x: 0.5,
    y: 1.93,
    w: 8,
    h: 0.35,
    fontSize: 9,
    bold: true,
    color: '000000',
    fontFace: 'Arial',
  });
  
  // Machine info
  let infoY = 2.3;
  const machineInfo = [
    { label: isTranslated ? 'TAG:' : 'TAG:', value: inspection.tag || '-' },
    { label: isTranslated ? 'Model:' : 'Modelo:', value: inspection.modelo || '-' },
    { label: 'SN:', value: inspection.sn || '-' },
    { label: isTranslated ? 'Delivery:' : 'Entrega:', value: inspection.entrega || '-' },
    { label: isTranslated ? 'Customer:' : 'Cliente:', value: inspection.cliente || '-' },
    { label: isTranslated ? 'Description:' : 'Descrição:', value: inspection.descricao || '-' },
    { label: 'MACHINE DOWN?:', value: inspection.machineDown || '-' },
    { label: isTranslated ? 'Report ID:' : 'ID do Relatório:', value: reportId || '-' },
  ];
  
  machineInfo.forEach(info => {
    slide.addText(info.label, {
      x: 0.5,
      y: infoY,
      w: 1.5,
      h: 0.22,
      fontSize: 9,
      bold: true,
      color: '000000',
      fontFace: 'Arial',
    });
    
    slide.addText(info.value, {
      x: 2,
      y: infoY,
      w: 7,
      h: 0.22,
      fontSize: 9,
      color: '000000',
      fontFace: 'Arial',
    });
    
    infoY += 0.22;
  });
  
  // Separator
  slide.addShape(pptx.ShapeType.line, {
    x: 0.5,
    y: infoY + 0.1,
    w: 8.5,
    h: 0,
    line: { color: 'E0E0E0', width: 1, dashType: 'dash' },
  });
  
  // Report data section
  infoY += 0.25;
  slide.addText(isTranslated ? 'REPORT DATA' : 'DADOS DO RELATÓRIO', {
    x: 0.5,
    y: infoY,
    w: 8,
    h: 0.22,
    fontSize: 8,
    bold: true,
    color: 'FF6600',
    fontFace: 'Arial',
  });
  
  infoY += 0.22;
  
  const reportInfo = [
    { 
      label: isTranslated ? 'Execution Date:' : 'Data da Execução:', 
      value: formatDateForDisplay(inspection.data) || '-' 
    },
  ];
  
  // Add Data Final if provided
  if (inspection.dataFinal) {
    reportInfo.push({
      label: isTranslated ? 'End Date:' : 'Data Final:',
      value: formatDateForDisplay(inspection.dataFinal),
    });
  }
  
  // Add OS de Execução if provided
  if (inspection.osExecucao) {
    reportInfo.push({
      label: isTranslated ? 'Work Order:' : 'OS de Execução:',
      value: inspection.osExecucao,
    });
  }
  
  reportInfo.push(
    { 
      label: isTranslated ? 'Names of Performers:' : 'Nomes dos Executantes:', 
      value: inspection.inspetor || '-' 
    },
    { 
      label: isTranslated ? 'Hour Meter:' : 'Horímetro:', 
      value: inspection.horimetro || '-' 
    }
  );
  
  reportInfo.forEach(info => {
    slide.addText(info.label, {
      x: 0.5,
      y: infoY,
      w: 1.5,
      h: 0.22,
      fontSize: 9,
      bold: true,
      color: '000000',
      fontFace: 'Arial',
    });
    
    slide.addText(info.value, {
      x: 2,
      y: infoY,
      w: 7,
      h: 0.22,
      fontSize: 9,
      color: '000000',
      fontFace: 'Arial',
    });
    
    infoY += 0.22;
  });
  
  // Footer
  addStandardFooter(slide);
}

async function generateMachineIdentificationSlide(pptx: pptxgen, inspection: InspectionData, language: Language) {
  const isTranslated = language !== 'pt';
  const slide = pptx.addSlide();
  addStandardHeader(slide, isTranslated ? 'MACHINE IDENTIFICATION' : 'IDENTIFICAÇÃO DA MÁQUINA');
  
  // Title
  slide.addText(isTranslated ? 'Machine Identification' : 'Identificação da Máquina', {
    x: 0.3,
    y: 1.1,
    w: 9.4,
    h: 0.4,
    fontSize: 16,
    bold: true,
    color: '000000',
    fontFace: 'Arial',
    align: 'center',
  });
  
  // Photo positions (4 columns) - centered on slide
  const photoWidth = 2.1;
  const photoHeight = 2.1;
  const gap = 0.3;
  const totalWidth = (photoWidth * 4) + (gap * 3);
  const startX = (10 - totalWidth) / 2; // Center the photo group
  const photoY = 1.7;
  
  // Photo 1: Equipamento
  const photo1X = startX;
  if (inspection.machinePhoto) {
    const processed = await maybeCoverCropImage(inspection.machinePhoto, { targetW: photoWidth, targetH: photoHeight });
    slide.addImage({
      data: processed,
      x: photo1X,
      y: photoY,
      w: photoWidth,
      h: photoHeight,
    });
  } else {
    slide.addShape(pptx.ShapeType.rect, {
      x: photo1X,
      y: photoY,
      w: photoWidth,
      h: photoHeight,
      fill: { color: 'F5F5F5' },
      line: { color: 'CCCCCC', width: 2, dashType: 'dash' },
    });
    // Placeholder with camera icon
    slide.addText('📷', {
      x: photo1X,
      y: photoY + photoHeight / 2 - 0.4,
      w: photoWidth,
      h: 0.5,
      fontSize: 24,
      color: 'CCCCCC',
      fontFace: 'Arial',
      align: 'center',
    });
    slide.addText(isTranslated ? 'Equipment Photo' : 'Foto do Equipamento', {
      x: photo1X,
      y: photoY + photoHeight / 2 + 0.1,
      w: photoWidth,
      h: 0.35,
      fontSize: 8,
      color: '999999',
      fontFace: 'Arial',
      align: 'center',
      italic: true,
    });
  }
  
  // Label 1: TAG
  slide.addShape(pptx.ShapeType.rect, {
    x: photo1X,
    y: photoY + photoHeight,
    w: photoWidth,
    h: 0.4,
    fill: { color: 'FF6600' },
  });
  slide.addText(inspection.tag || (isTranslated ? 'Equipment TAG' : 'TAG do Equipamento'), {
    x: photo1X,
    y: photoY + photoHeight + 0.03,
    w: photoWidth,
    h: 0.35,
    fontSize: 9,
    bold: true,
    color: 'FFFFFF',
    fontFace: 'Arial',
    align: 'center',
  });
  
  // Photo 2: Horímetro
  const photo2X = startX + photoWidth + gap;
  if (inspection.horimetroPhoto) {
    const processed = await maybeCoverCropImage(inspection.horimetroPhoto, { targetW: photoWidth, targetH: photoHeight });
    slide.addImage({
      data: processed,
      x: photo2X,
      y: photoY,
      w: photoWidth,
      h: photoHeight,
    });
  } else {
    slide.addShape(pptx.ShapeType.rect, {
      x: photo2X,
      y: photoY,
      w: photoWidth,
      h: photoHeight,
      fill: { color: 'F5F5F5' },
      line: { color: 'CCCCCC', width: 2, dashType: 'dash' },
    });
    // Placeholder with camera icon
    slide.addText('📷', {
      x: photo2X,
      y: photoY + photoHeight / 2 - 0.4,
      w: photoWidth,
      h: 0.5,
      fontSize: 24,
      color: 'CCCCCC',
      fontFace: 'Arial',
      align: 'center',
    });
    slide.addText(isTranslated ? 'Hour Meter Photo' : 'Foto do Horímetro', {
      x: photo2X,
      y: photoY + photoHeight / 2 + 0.1,
      w: photoWidth,
      h: 0.35,
      fontSize: 8,
      color: '999999',
      fontFace: 'Arial',
      align: 'center',
      italic: true,
    });
  }
  
  // Label 2: Horímetro
  slide.addShape(pptx.ShapeType.rect, {
    x: photo2X,
    y: photoY + photoHeight,
    w: photoWidth,
    h: 0.4,
    fill: { color: 'FF6600' },
  });
  slide.addText(`${isTranslated ? 'Hour Meter' : 'Horímetro'}: ${inspection.horimetro || '-'}`, {
    x: photo2X,
    y: photoY + photoHeight + 0.03,
    w: photoWidth,
    h: 0.35,
    fontSize: 9,
    bold: true,
    color: 'FFFFFF',
    fontFace: 'Arial',
    align: 'center',
  });
  
  // Photo 3: Serial Number
  const photo3X = startX + (photoWidth + gap) * 2;

  if (inspection.serialPhoto) {
    const processed = await maybeCoverCropImage(inspection.serialPhoto, { targetW: photoWidth, targetH: photoHeight });
    slide.addImage({
      data: processed,
      x: photo3X,
      y: photoY,
      w: photoWidth,
      h: photoHeight,
    });
  } else {
    // Black background with white serial number text
    slide.addShape(pptx.ShapeType.rect, {
      x: photo3X,
      y: photoY,
      w: photoWidth,
      h: photoHeight,
      fill: { color: '000000' },
      line: { color: 'CCCCCC', width: 2, dashType: 'solid' },
    });
    const serialNumber = inspection.sn || '-';
    slide.addText(serialNumber, {
      x: photo3X,
      y: photoY + photoHeight / 2 - 0.25,
      w: photoWidth,
      h: 0.5,
      fontSize: 18,
      bold: true,
      color: 'FFFFFF',
      fontFace: 'Arial',
      align: 'center',
    });
  }
  
  // Label 3: Serial Number
  slide.addShape(pptx.ShapeType.rect, {
    x: photo3X,
    y: photoY + photoHeight,
    w: photoWidth,
    h: 0.4,
    fill: { color: 'FF6600' },
  });
  slide.addText(`${isTranslated ? 'SN' : 'NS'}: ${inspection.sn || '-'}`, {
    x: photo3X,
    y: photoY + photoHeight + 0.03,
    w: photoWidth,
    h: 0.35,
    fontSize: 9,
    bold: true,
    color: 'FFFFFF',
    fontFace: 'Arial',
    align: 'center',
  });
  
  // Photo 4: Local
  const photo4X = startX + (photoWidth + gap) * 3;
  if (inspection.localPhoto) {
    const processed = await maybeCoverCropImage(inspection.localPhoto, { targetW: photoWidth, targetH: photoHeight });
    slide.addImage({
      data: processed,
      x: photo4X,
      y: photoY,
      w: photoWidth,
      h: photoHeight,
    });
  } else {
    slide.addShape(pptx.ShapeType.rect, {
      x: photo4X,
      y: photoY,
      w: photoWidth,
      h: photoHeight,
      fill: { color: 'F5F5F5' },
      line: { color: 'CCCCCC', width: 2, dashType: 'dash' },
    });
    // Placeholder with camera icon
    slide.addText('📷', {
      x: photo4X,
      y: photoY + photoHeight / 2 - 0.4,
      w: photoWidth,
      h: 0.5,
      fontSize: 24,
      color: 'CCCCCC',
      fontFace: 'Arial',
      align: 'center',
    });
    slide.addText(isTranslated ? 'Location Photo' : 'Foto do Local', {
      x: photo4X,
      y: photoY + photoHeight / 2 + 0.1,
      w: photoWidth,
      h: 0.35,
      fontSize: 8,
      color: '999999',
      fontFace: 'Arial',
      align: 'center',
      italic: true,
    });
  }
  
  // Label 4: Local
  slide.addShape(pptx.ShapeType.rect, {
    x: photo4X,
    y: photoY + photoHeight,
    w: photoWidth,
    h: 0.4,
    fill: { color: 'FF6600' },
  });
  slide.addText(isTranslated ? 'Location' : 'Local', {
    x: photo4X,
    y: photoY + photoHeight + 0.03,
    w: photoWidth,
    h: 0.35,
    fontSize: 9,
    bold: true,
    color: 'FFFFFF',
    fontFace: 'Arial',
    align: 'center',
  });
  
  addStandardFooter(slide);
}

async function generatePhotoSlides(pptx: pptxgen, photos: PhotoData[], language: Language) {
  const isTranslated = language !== 'pt';
  const photosWithImages = photos.filter(p => p.imageData);
  const slideCount = Math.ceil(photosWithImages.length / 2);
  
  for (let i = 0; i < slideCount; i++) {
    const slide = pptx.addSlide();
    addStandardHeader(slide, isTranslated ? 'PHOTOS' : 'FOTOS');
    
    const photo1 = photosWithImages[i * 2];
    const photo2 = photosWithImages[i * 2 + 1];
    
    const isDual1 = !!(photo1?.secondaryImageData && photo1?.imageData);
    const isDual2 = !!(photo2?.secondaryImageData && photo2?.imageData);
    
    let w1: number, h1: number, w2: number, h2: number;
    const y = 1.35;
    const gap = CONTAINER_GAP;
    const usableW = 10 - SLIDE_MARGIN * 2;
    
    if (isDual1 && isDual2) {
      w1 = (usableW - gap) / 2;
      w2 = w1;
      h1 = DUAL_PHOTO_H;
      h2 = DUAL_PHOTO_H;
    } else if (isDual1) {
      w1 = PHOTO_LANDSCAPE_W;
      w2 = usableW - w1 - gap;
      h1 = DUAL_PHOTO_H;
      h2 = photo2 ? (photo2.editedImageData || photo2.imageData ? await getAspectRatioHeight(w2, photo2.editedImageData || photo2.imageData!) : PHOTO_LANDSCAPE_H) : PHOTO_LANDSCAPE_H;
    } else if (isDual2) {
      w2 = PHOTO_LANDSCAPE_W;
      w1 = usableW - w2 - gap;
      h1 = photo1 ? (photo1.editedImageData || photo1.imageData ? await getAspectRatioHeight(w1, photo1.editedImageData || photo1.imageData!) : PHOTO_LANDSCAPE_H) : PHOTO_LANDSCAPE_H;
      h2 = DUAL_PHOTO_H;
    } else {
      const dims1 = photo1 ? await getPhotoDimensions(photo1) : null;
      const dims2 = photo2 ? await getPhotoDimensions(photo2) : null;
      const positions = layoutPhotos(dims1, dims2, y, gap);
      
      if (photo1?.imageData && positions[0]) {
        await addPhotoToSlide(slide, photo1, positions[0].x, positions[0].y, positions[0].w, positions[0].h, language, String(i * 2 + 1));
      }
      if (photo2?.imageData && positions[1]) {
        await addPhotoToSlide(slide, photo2, positions[1].x, positions[1].y, positions[1].w, positions[1].h, language, String(i * 2 + 2));
      }
      addStandardFooter(slide);
      continue;
    }
    
    const x1 = SLIDE_MARGIN;
    const x2 = x1 + w1 + gap;
    
    if (photo1?.imageData) {
      await addPhotoToSlide(slide, photo1, x1, y, w1, h1, language, String(i * 2 + 1));
    }
    if (photo2?.imageData) {
      await addPhotoToSlide(slide, photo2, x2, y, w2, h2, language, String(i * 2 + 2));
    }
    
    addStandardFooter(slide);
  }
}

async function addPhotoToSlide(
  slide: pptxgen.Slide, 
  photo: PhotoData, 
  x: number, 
  y: number, 
  w: number, 
  h: number,
  language: Language,
  photoRef: string
) {
  const isTranslated = language !== 'pt';
  
  // Check if we have a secondary photo (two photos side by side)
  const hasSecondaryPhoto = photo.secondaryImageData && photo.imageData;
  
  // Calculate photo widths
  const dualGap = 0.05;  // Small gap between primary and secondary photo
  const photoWidth = hasSecondaryPhoto ? (w - dualGap) / 2 : w;
  
  // Photo info overlay (if PN exists)
  if (photo.pn) {
    slide.addShape(slide._slideLayout?._presLayout?.pptx?.ShapeType?.rect || 'rect', {
      x: x,
      y: y - 0.25,
      w: w,
      h: 0.3,
      fill: { color: '000000', transparency: 70 },
    });
    
    let infoText = `${isTranslated ? 'Part Number:' : 'Numero da Peça:'} ${photo.pn}`;
    if (photo.partName) infoText += ` ${photo.partName}`;
    if (photo.quantity) infoText += ` ${isTranslated ? 'Qty:' : 'Qtd:'} ${photo.quantity}`;
    
    slide.addText(infoText, {
      x: x + 0.1,
      y: y - 0.22,
      w: w - 0.2,
      h: 0.22,
      fontSize: 8,
      color: 'FFFFFF',
      fontFace: 'Arial',
    });
  }
  
  // Primary Photo
  if (photo.imageData) {
    const processed = await maybeCoverCropImage(photo.editedImageData || photo.imageData, { targetW: photoWidth, targetH: h });
    slide.addImage({
      data: processed || '',
      x: x,
      y: y,
      w: photoWidth,
      h: h,
    });
  }
  
  // Secondary Photo (lado a lado)
  if (photo.secondaryImageData) {
    const secondX = hasSecondaryPhoto ? x + photoWidth + dualGap : x;
    const secondW = hasSecondaryPhoto ? photoWidth : w;
    const processed = await maybeCoverCropImage(photo.secondaryImageData, { targetW: secondW, targetH: h });
    slide.addImage({
      data: processed,
      x: secondX,
      y: y,
      w: secondW,
      h: h,
    });
  }
  
  // Photo reference badge
  const refLabel = isTranslated ? `Photo ${photoRef}` : `Foto ${photoRef}`;
  slide.addShape(slide._slideLayout?._presLayout?.pptx?.ShapeType?.rect || 'rect', {
    x: x + 0.08,
    y: y + h - 0.38,
    w: 0.7,
    h: 0.3,
    fill: { color: '000000', transparency: 40 },
    rectRadius: 0.04,
  });
  slide.addText(refLabel, {
    x: x + 0.08,
    y: y + h - 0.38,
    w: 0.7,
    h: 0.3,
    fontSize: 8,
    color: 'FFFFFF',
    fontFace: 'Arial',
    bold: true,
    align: 'center',
    valign: 'middle',
  });

  // Description
  if (photo.description) {
    slide.addShape(slide._slideLayout?._presLayout?.pptx?.ShapeType?.rect || 'rect', {
      x: x,
      y: y + h,
      w: w,
      h: 0.6,
      fill: { color: 'FF6600' },
    });
    
    slide.addText(photo.description.substring(0, 150), {
      x: x + 0.1,
      y: y + h + 0.05,
      w: w - 0.2,
      h: 0.5,
      fontSize: 8,
      color: 'FFFFFF',
      fontFace: 'Arial',
    });
  }
}

// Interface for hierarchical parts structure
interface PartRow {
  pn: string;
  serialNumber: string;
  partName: string;
  quantity: string;
  isSubPart: boolean;
  parentPn?: string;
  indent: number;
  photoRef?: string;
}

function generatePartsTableSlides(
  pptx: pptxgen, 
  photos: PhotoData[], 
  additionalParts: AdditionalPart[],
  language: Language
) {
  const isTranslated = language !== 'pt';
  // Build photo ref maps (same numbering as generatePhotoSlides)
  const photosWithImages = photos.filter(p => p.imageData);
  const photoRefMap = new Map<string, string>();   // PN → photo number
  const photoIdRefMap = new Map<string, string>();  // photo ID → photo number
  photosWithImages.forEach((p, idx) => {
    if (p.pn) photoRefMap.set(p.pn, String(idx + 1));
    photoIdRefMap.set(p.id, String(idx + 1));
  });

  // Build hierarchical parts structure
  const partRows: PartRow[] = [];
  
  // Process each photo that should be in the table (has PN or has sub-parts)
  photos
    .filter(p => photoShouldBeInPartsTable(p, additionalParts))
    .forEach(photo => {
      const displayPn = getDisplayPn(photo, additionalParts);
      const photoRef = photo.pn
        ? photoRefMap.get(photo.pn)
        : photoIdRefMap.get(photo.id);
      
      // Add main part
      partRows.push({
        pn: displayPn,
        serialNumber: photo.serialNumber || '',
        partName: photo.partName || '-',
        quantity: photo.quantity || '-',
        isSubPart: false,
        indent: 0,
        photoRef,
      });
      
      // Find and add all sub-parts for this photo
      const subParts = getSubPartsForPhoto(photo, additionalParts);
      subParts.forEach(subPart => {
        partRows.push({
          pn: subPart.pn,
          serialNumber: subPart.serialNumber || '',
          partName: subPart.partName,
          quantity: subPart.quantity,
          isSubPart: true,
          parentPn: displayPn,
          indent: 1,
          photoRef,
        });
      });
    });
  
  if (partRows.length === 0) return;
  
  // Calculate slides needed (8 rows per slide - peças principais + sub-peças)
  const rowsPerSlide = 8;
  const slidesNeeded = Math.ceil(partRows.length / rowsPerSlide);
  
  for (let slideIndex = 0; slideIndex < slidesNeeded; slideIndex++) {
    const slide = pptx.addSlide();
    addStandardHeader(slide, isTranslated ? 'PARTS TABLE' : 'TABELA DE PEÇAS');
    
    // Table title with page indicator if multiple slides
    const titleText = slidesNeeded > 1 
      ? `${isTranslated ? 'Parts Table' : 'Tabela de Peças'} (${slideIndex + 1}/${slidesNeeded})`
      : (isTranslated ? 'Parts Table (Part Number)' : 'Tabela de Peças (Numero da Peça)');
    
    slide.addText(titleText, {
      x: 0.5,
      y: 1.2,
      w: 8,
      h: 0.4,
      fontSize: 14,
      bold: true,
      color: '000000',
      fontFace: 'Arial',
    });
    
    // Table header
    const headerY = 1.7;
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.5,
      y: headerY,
      w: 9,
      h: 0.4,
      fill: { color: '000000' },
    });
    
    const headers = [
      { text: isTranslated ? 'Ref' : 'Ref', x: 0.5, w: 0.6 },
      { text: isTranslated ? 'PN (Serial)' : 'PN (Serial)', x: 1.1, w: 2.2 },
      { text: isTranslated ? 'Part Name' : 'Nome da Peça', x: 3.3, w: 2.6 },
      { text: isTranslated ? 'Qty' : 'Qtd', x: 5.9, w: 1 },
      { text: isTranslated ? 'Type' : 'Tipo', x: 6.9, w: 2.6 },
    ];
    
    headers.forEach(header => {
      slide.addText(header.text, {
        x: header.x,
        y: headerY + 0.05,
        w: header.w,
        h: 0.3,
        fontSize: 10,
        bold: true,
        color: 'FFFFFF',
        fontFace: 'Arial',
        align: 'center',
      });
    });
    
    // Table rows
    const startIdx = slideIndex * rowsPerSlide;
    const endIdx = Math.min(startIdx + rowsPerSlide, partRows.length);
    const slideParts = partRows.slice(startIdx, endIdx);
    
    let rowY = headerY + 0.4;
    const rowHeight = 0.35;
    
    slideParts.forEach((part, idx) => {
      // Row background - different colors for main and sub-parts
      const bgColor = part.isSubPart ? 'FFF5E6' : (idx % 2 === 0 ? 'F8F9FA' : 'FFFFFF');
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.5,
        y: rowY,
        w: 9,
        h: rowHeight,
        fill: { color: bgColor },
        line: part.isSubPart ? { color: 'FFE0B2', width: 0.5 } : undefined,
      });
      
      // Ref column (Foto X)
      const refText = part.photoRef 
        ? (isTranslated ? `Photo ${part.photoRef}` : `Foto ${part.photoRef}`)
        : '-';
      slide.addText(refText, {
        x: 0.5,
        y: rowY + 0.05,
        w: 0.6,
        h: rowHeight - 0.1,
        fontSize: part.isSubPart ? 8 : 9,
        color: part.photoRef ? 'FF6600' : '999999',
        fontFace: 'Arial',
        align: 'center',
        valign: 'middle',
        bold: !!part.photoRef,
      });

      // Sub-part indicator (arrow or dash)
      if (part.isSubPart) {
        slide.addText('└─', {
          x: 1.1,
          y: rowY + 0.05,
          w: 0.3,
          h: rowHeight - 0.1,
          fontSize: 9,
          color: 'FF6600',
          fontFace: 'Arial',
          align: 'center',
          valign: 'middle',
        });
      }
      
      // Part Number with Serial (with indent for sub-parts)
      const pnX = part.isSubPart ? 1.35 : 1.1;
      const pnText = part.serialNumber 
        ? `${part.pn} (${part.serialNumber})`
        : part.pn;
      slide.addText(pnText, {
        x: pnX,
        y: rowY + 0.05,
        w: part.isSubPart ? 1.95 : 2.2,
        h: rowHeight - 0.1,
        fontSize: part.isSubPart ? 8 : 9,
        color: part.isSubPart ? 'CC5200' : '000000',
        fontFace: 'Arial',
        align: 'center',
        valign: 'middle',
        italic: part.isSubPart,
      });
      
      // Part Name
      slide.addText(part.partName, {
        x: 3.3,
        y: rowY + 0.05,
        w: 2.6,
        h: rowHeight - 0.1,
        fontSize: part.isSubPart ? 8 : 9,
        color: part.isSubPart ? '666666' : '000000',
        fontFace: 'Arial',
        align: 'center',
        valign: 'middle',
        italic: part.isSubPart,
      });
      
      // Quantity
      slide.addText(part.quantity, {
        x: 5.9,
        y: rowY + 0.05,
        w: 1,
        h: rowHeight - 0.1,
        fontSize: part.isSubPart ? 8 : 9,
        color: '000000',
        fontFace: 'Arial',
        align: 'center',
        valign: 'middle',
      });
      
      // Type column
      const typeText = part.isSubPart 
        ? (isTranslated ? '↳ Sub-part' : '↳ Sub-peça')
        : (isTranslated ? 'Main' : 'Principal');
      
      slide.addText(typeText, {
        x: 6.9,
        y: rowY + 0.05,
        w: 2.6,
        h: rowHeight - 0.1,
        fontSize: part.isSubPart ? 8 : 9,
        color: part.isSubPart ? 'FF6600' : '000000',
        fontFace: 'Arial',
        align: 'center',
        valign: 'middle',
        italic: part.isSubPart,
      });
      
      rowY += rowHeight;
    });
    
    addStandardFooter(slide);
  }
}

function generateConclusionSlide(pptx: pptxgen, conclusion: string, language: Language) {
  const isTranslated = language !== 'pt';
  const slide = pptx.addSlide();
  addStandardHeader(slide, isTranslated ? 'CONCLUSION' : 'CONCLUSÃO');
  
  // Title
  slide.addText(isTranslated ? 'Conclusion' : 'Conclusão', {
    x: 0.5,
    y: 1.2,
    w: 8,
    h: 0.4,
    fontSize: 14,
    bold: true,
    color: '000000',
    fontFace: 'Arial',
  });
  
  // Conclusion text
  slide.addText(conclusion, {
    x: 0.5,
    y: 1.8,
    w: 9,
    h: 4,
    fontSize: 10,
    color: '000000',
    fontFace: 'Arial',
    valign: 'top',
  });
  
  addStandardFooter(slide);
}

function generateFinalSlide(pptx: pptxgen, language: Language = 'pt', reportId?: string) {
  const isTranslated = language !== 'pt';
  const slide = pptx.addSlide();
  
  // Separator line
  slide.addShape(pptx.ShapeType.rect, {
    x: 4.5,
    y: 0.8,
    w: 1,
    h: 0.08,
    fill: { color: 'FF6600' },
  });
  
  // Logo
  slide.addImage({
    data: LOGO_BASE64,
    x: 3.5,
    y: 1.1,
    w: 3,
    h: 1.7,
    sizing: { type: 'contain' },
  });
  
  // Safety quote
  slide.addText('"If it\'s not safe, don\'t do it!"', {
    x: 1,
    y: 3.0,
    w: 8,
    h: 0.8,
    fontSize: 28,
    bold: true,
    color: 'FF6600',
    fontFace: 'Arial',
    align: 'center',
  });
  
  slide.addText('"There is nothing so important and urgent that it can\'t be done safely"', {
    x: 1,
    y: 4.0,
    w: 8,
    h: 0.6,
    fontSize: 22,
    bold: true,
    color: 'FF6600',
    fontFace: 'Arial',
    align: 'center',
  });
  
  // End text
  slide.addText(isTranslated ? 'END' : 'FIM', {
    x: 4,
    y: 5.0,
    w: 2,
    h: 0.8,
    fontSize: 28,
    bold: true,
    color: 'FF6600',
    fontFace: 'Arial',
    align: 'center',
  });
  
  // Report ID reference
  if (reportId) {
    slide.addText(`ID: ${reportId}`, {
      x: 7,
      y: 6.7,
      w: 2.7,
      h: 0.25,
      fontSize: 7,
      color: '999999',
      fontFace: 'Arial',
      align: 'right',
    });
  }

  // Footer
  slide.addText(isTranslated ? '© 2024 - Services Department | All rights reserved' : '© 2024 - Departamento de Serviços | Todos os direitos reservados', {
    x: 0.3,
    y: 7,
    w: 9.4,
    h: 0.3,
    fontSize: 8,
    color: '666666',
    fontFace: 'Arial',
    align: 'center',
  });
}

// Header específico para slides de categoria - título sem quebra de linha
function addCategoryHeader(slide: pptxgen.Slide, title: string) {
  // Logo
  slide.addImage({
    data: LOGO_BASE64,
    x: SLIDE_MARGIN,
    y: 0.2,
    w: 1.5,
    h: 0.5,
    sizing: { type: 'contain' },
  });
  
  // Title - em uma única linha, ajustando automaticamente
  slide.addText(title, {
    x: SLIDE_MARGIN,
    y: 0.2,
    w: 10 - SLIDE_MARGIN * 2,
    h: 0.5,
    fontSize: 10,
    bold: true,
    color: '000000',
    fontFace: 'Arial',
    align: 'right',
    valign: 'middle',
    autoFit: {
      shrinkText: true,
      fontSizeMin: 6, // Tamanho mínimo da fonte
    },
  });
  
  // Separator line
  slide.addShape('rect' as any, {
    x: SLIDE_MARGIN,
    y: 0.9,
    w: 10 - SLIDE_MARGIN * 2,
    h: 0.04,
    fill: { color: 'FF6600' },
  });
}

function addStandardHeader(slide: pptxgen.Slide, title: string) {
  // Logo
  slide.addImage({
    data: LOGO_BASE64,
    x: SLIDE_MARGIN,
    y: 0.2,
    w: 1.5,
    h: 0.5,
    sizing: { type: 'contain' },
  });
  
  // Title - largura total para evitar quebra de linha
  slide.addText(title, {
    x: SLIDE_MARGIN,
    y: 0.2,
    w: 10 - SLIDE_MARGIN * 2,
    h: 0.5,
    fontSize: 10,
    bold: true,
    color: '000000',
    fontFace: 'Arial',
    align: 'right',
    valign: 'middle',
    autoFit: {
      shrinkText: true,
      fontSizeMin: 6,
    },
  });
  
  // Separator line
  slide.addShape('rect' as any, {
    x: SLIDE_MARGIN,
    y: 0.9,
    w: 10 - SLIDE_MARGIN * 2,
    h: 0.04,
    fill: { color: 'FF6600' },
  });
}

function addStandardFooter(slide: pptxgen.Slide) {
  slide.addText('© 2024 - Departamento de Manutenção Industrial | Todos os direitos reservados', {
    x: SLIDE_MARGIN,
    y: 7,
    w: 10 - SLIDE_MARGIN * 2,
    h: 0.3,
    fontSize: 8,
    color: '000000',
    fontFace: 'Arial',
    align: 'center',
  });
}

function formatDateForFileName(dateString: string): string {
  if (!dateString) return new Date().toISOString().split('T')[0];
  
  // Parse date manually to avoid timezone issues
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const day = parts[2].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[0];
    return `${day}-${month}-${year}`;
  }
  
  // Fallback: use current date
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatDateForDisplay(dateString: string): string {
  if (!dateString) return '';
  
  // Parse date manually to avoid timezone issues (YYYY-MM-DD format)
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const day = parts[2].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[0];
    return `${day}/${month}/${year}`;
  }
  
  return dateString;
}
