import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Language } from '@/lib/translations';
import { t as translateT, translateText, translateBatch, LANGUAGE_NAMES, LANGUAGE_FLAGS } from '@/lib/translations';

interface TranslationCache {
  [key: string]: {
    [lang: string]: string;
  };
}

const MAX_CACHE_ENTRIES = 500;

interface TranslationState {
  // Current language
  language: Language;
  
  // Translation cache for dynamic texts
  cache: TranslationCache;
  
  // Loading states
  isTranslating: boolean;
  
  // Actions
  setLanguage: (lang: Language) => void;
  
  // Get static translation (use useTranslation hook for reactive updates)
  t: (key: string, params?: Record<string, string | number>) => string;
  
  // Translate dynamic text (with caching)
  translateDynamic: (text: string) => Promise<string>;
  
  // Translate batch of dynamic texts
  translateDynamicBatch: (texts: string[]) => Promise<string[]>;
  
  // Clear cache
  clearCache: () => void;
  
  // Get language info
  getLanguageName: (lang?: Language) => string;
  getLanguageFlag: (lang?: Language) => string;
  
  // Pre-translate all dynamic content in the report
  preTranslateReport: (data: {
    inspection: Record<string, unknown>;
    photos: Array<Record<string, unknown>>;
    conclusion: string;
  }) => Promise<{
    inspection: Record<string, unknown>;
    photos: Array<Record<string, unknown>>;
    conclusion: string;
  }>;
}

// Custom hook that returns a reactive translation function
export function useTranslation() {
  const language = useTranslationStore((state) => state.language);
  const setLanguage = useTranslationStore((state) => state.setLanguage);
  
  // Create a fresh translation function each render based on current language
  const t = (key: string, params?: Record<string, string | number>) => 
    translateT(key, language, params);
  
  return { language, setLanguage, t };
}

export const useTranslationStore = create<TranslationState>()(
  persist(
    (set, get) => ({
      language: 'pt',
      cache: {},
      isTranslating: false,
      
      setLanguage: (lang) => set({ language: lang }),
      
      t: (key, params) => {
        const state = get();
        return translateT(key, state.language, params);
      },
      
      getT: () => {
        const state = get();
        return (key: string, params?: Record<string, string | number>) => 
          translateT(key, state.language, params);
      },
      
      translateDynamic: async (text) => {
        if (!text || text.trim() === '') return text;
        
        const state = get();
        const currentLang = state.language;
        
        // If Portuguese, return original
        if (currentLang === 'pt') return text;
        
        // Check cache
        const cacheKey = text.trim().toLowerCase();
        if (state.cache[cacheKey]?.[currentLang]) {
          return state.cache[cacheKey][currentLang];
        }
        
        // Translate
        set({ isTranslating: true });
        try {
          const translation = await translateText(text, currentLang, 'pt');
          
          // Update cache
          set((state) => {
            const cacheEntries = Object.entries(state.cache);
            const limitedCache = cacheEntries.length > MAX_CACHE_ENTRIES
              ? Object.fromEntries(cacheEntries.slice(-MAX_CACHE_ENTRIES + 50))
              : state.cache;
            return {
              cache: {
                ...limitedCache,
                [cacheKey]: {
                  ...(limitedCache as TranslationCache)[cacheKey],
                  [currentLang]: translation,
                },
              },
              isTranslating: false,
            };
          });
          
          return translation;
        } catch (error) {
          set({ isTranslating: false });
          return text;
        }
      },
      
      translateDynamicBatch: async (texts) => {
        if (!texts || texts.length === 0) return texts;
        
        const state = get();
        const currentLang = state.language;
        
        // If Portuguese, return originals
        if (currentLang === 'pt') return texts;
        
        // Find texts that need translation (not in cache)
        const translations: string[] = [...texts];
        const toTranslate: { index: number; text: string }[] = [];
        
        texts.forEach((text, index) => {
          if (!text || text.trim() === '') return;
          
          const cacheKey = text.trim().toLowerCase();
          if (state.cache[cacheKey]?.[currentLang]) {
            translations[index] = state.cache[cacheKey][currentLang];
          } else {
            toTranslate.push({ index, text });
          }
        });
        
        // If all cached, return
        if (toTranslate.length === 0) return translations;
        
        // Translate batch
        set({ isTranslating: true });
        try {
          const textsToTranslate = toTranslate.map(t => t.text);
          const newTranslations = await translateBatch(textsToTranslate, currentLang, 'pt');
          
          // Update translations and cache
          const cacheEntries = Object.entries(state.cache);
          const limitedCache = cacheEntries.length > MAX_CACHE_ENTRIES
            ? Object.fromEntries(cacheEntries.slice(-MAX_CACHE_ENTRIES + 50))
            : state.cache;
          const newCache: TranslationCache = { ...limitedCache };
          toTranslate.forEach((item, i) => {
            translations[item.index] = newTranslations[i];
            const cacheKey = item.text.trim().toLowerCase();
            newCache[cacheKey] = {
              ...newCache[cacheKey],
              [currentLang]: newTranslations[i],
            };
          });
          
          set({ cache: newCache, isTranslating: false });
          return translations;
        } catch (error) {
          set({ isTranslating: false });
          return texts;
        }
      },
      
      clearCache: () => set({ cache: {} }),
      
      getLanguageName: (lang) => {
        return LANGUAGE_NAMES[lang || get().language];
      },
      
      getLanguageFlag: (lang) => {
        return LANGUAGE_FLAGS[lang || get().language];
      },
      
      preTranslateReport: async (data) => {
        const state = get();
        const currentLang = state.language;
        
        if (currentLang === 'pt') return data;
        
        set({ isTranslating: true });
        
        try {
          // Collect all texts to translate
          const textsToTranslate: string[] = [];
          
          // From inspection
          if (data.inspection.descricao) textsToTranslate.push(data.inspection.descricao as string);
          
          // From photos
          data.photos.forEach(photo => {
            if (photo.description) textsToTranslate.push(photo.description as string);
            if (photo.partName) textsToTranslate.push(photo.partName as string);
          });
          
          // From conclusion
          if (data.conclusion) textsToTranslate.push(data.conclusion);
          
          // Translate all
          const translations = await translateBatch(textsToTranslate, currentLang, 'pt');
          
          // Apply translations
          let translationIndex = 0;
          const translatedInspection = { ...data.inspection };
          if (translatedInspection.descricao) {
            translatedInspection.descricao = translations[translationIndex++];
          }
          
          const translatedPhotos = data.photos.map(photo => {
            const translatedPhoto = { ...photo };
            if (translatedPhoto.description) {
              translatedPhoto.description = translations[translationIndex++];
            }
            if (translatedPhoto.partName) {
              translatedPhoto.partName = translations[translationIndex++];
            }
            return translatedPhoto;
          });
          
          let translatedConclusion = data.conclusion;
          if (translatedConclusion) {
            translatedConclusion = translations[translationIndex];
          }
          
          set({ isTranslating: false });
          
          return {
            inspection: translatedInspection,
            photos: translatedPhotos,
            conclusion: translatedConclusion,
          };
        } catch (error) {
          set({ isTranslating: false });
          return data;
        }
      },
    }),
    {
      name: 'translation-storage',
      partialize: (state) => {
        const cacheEntries = Object.entries(state.cache);
        // Limit cache size to prevent localStorage quota issues
        const limitedCache = cacheEntries.length > MAX_CACHE_ENTRIES
          ? Object.fromEntries(cacheEntries.slice(-MAX_CACHE_ENTRIES))
          : state.cache;
        return {
          language: state.language,
          cache: limitedCache,
        };
      },
    }
  )
);
