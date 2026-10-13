// Types for the Technical Report System

// Criticidade da peça
export type Criticality = 'Alta' | 'Média' | 'Baixa' | '';

export interface MachineData {
  modelo: string;
  sn: string;
  entrega: string;
  cliente: string;
}

export interface PhotoData {
  id: string;
  description: string;
  pn: string;
  serialNumber: string; // Novo campo para Serial Number
  partName: string;
  quantity: string;
  criticality: Criticality; // Criticidade: Alta, Média, Baixa
  imageData: string | null;
  secondaryImageData: string | null; // Segunda foto opcional (lado a lado)
  editedImageData: string | null;
  embeddedPhotos: EmbeddedPhoto[];
  hasAdditionalParts: boolean; // Novo campo
}

export interface EmbeddedPhoto {
  id: string;
  circleX: number;
  circleY: number;
  circleRadius: number;
  imageData: string;
}

export interface AdditionalPart {
  id: string;
  pn: string;
  serialNumber: string; // Novo campo para Serial Number
  partName: string;
  quantity: string;
  criticality: Criticality; // Criticidade: Alta, Média, Baixa
  parentPn: string; // PN da peça principal
  photoId?: string; // ID da foto principal (para associação quando PN está vazio)
}

export interface InspectionData {
  tag: string;
  modelo: string;
  sn: string;
  entrega: string;
  cliente: string;
  descricao: string;
  machineDown: 'Yes' | 'No' | '';
  data: string;
  dataFinal: string; // Novo campo opcional
  osExecucao: string; // Novo campo opcional
  inspetor: string;
  horimetro: string;
  // Fotos de identificação
  machinePhoto: string | null; // Foto da máquina inteira
  horimetroPhoto: string | null; // Foto do horímetro
  serialPhoto: string | null; // Foto do serial number
  localPhoto: string | null; // Foto do local
}

// Categoria de foto para a aba Home
export interface PhotoCategory {
  id: string;
  title: string;
  description: string;
  photos: PhotoData[];
  additionalParts: AdditionalPart[];
}

// Dados do relatório da aba Home (com categorias)
export interface HomeReportData {
  inspection: InspectionData;
  categories: PhotoCategory[];
  conclusion: string;
}

export interface ReportData {
  inspection: InspectionData;
  photos: PhotoData[];
  additionalParts: AdditionalPart[];
  conclusion: string;
  translation?: {
    sourceLang: string;
    targetLang: string;
    translations: Record<string, string>;
  };
}

export interface Config {
  MACHINE_DATA: Record<string, MachineData>;
  AUTO_SAVE_INTERVAL: number;
  INITIAL_PHOTO_COUNT: number;
  MAX_PHOTO_COUNT: number;
  TRANSLATE_CACHE_KEY: string;
}

export interface EditorTool {
  type: 'select' | 'pen' | 'circle' | 'rectangle' | 'arrow' | 'text' | 'photoCircle';
  color: string;
}

export interface PhotoEditorState {
  currentTool: EditorTool;
  isDrawing: boolean;
  objects: EditorObject[];
}

export interface EditorObject {
  id: string;
  type: 'path' | 'circle' | 'rectangle' | 'arrow' | 'text' | 'photoCircle';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  color: string;
  imageData?: string;
  path?: string[];
  text?: string;
}

// Categorias padrão para a aba Home
export const DEFAULT_CATEGORIES: Omit<PhotoCategory, 'photos' | 'additionalParts'>[] = [
  {
    id: 'contexto',
    title: 'Contexto da intervenção',
    description: 'Sintoma, data, OS/chamado, objetivo, escopo',
  },
  {
    id: 'componente',
    title: 'Foto do componente em questão',
    description: 'Condição atual de falha com PN',
  },
  {
    id: 'preparacao',
    title: 'Preparação de peças/recursos',
    description: 'Fotos + lista de peças (filtros, recursos, coisas que precisam para fazer a atividade)',
  },
  {
    id: 'desmontagem',
    title: 'Desmontagem',
    description: 'Fotos longe/médio/perto + observações (primeira parte da atividade)',
  },
  {
    id: 'diagnostico',
    title: 'Diagnóstico',
    description: 'O que foi identificado, evidências, medições',
  },
  {
    id: 'execucao',
    title: 'Execução do reparo/ajuste/substituição',
    description: 'Passos críticos, torques, parâmetros',
  },
  {
    id: 'montagem',
    title: 'Montagem',
    description: 'Fotos do componente instalado',
  },
  {
    id: 'testes',
    title: 'Testes e medições',
    description: 'Antes/depois',
  },
];
