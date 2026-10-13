import { NextRequest, NextResponse } from 'next/server';

const LANGUAGE_CODES: Record<string, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  ja: 'ja',
  zh: 'zh-CN',
};

// Use MyMemory Translation API (free, no API key needed)
// Supports auto-detection of source language
async function translateText(text: string, targetLang: string): Promise<string> {
  const targetCode = LANGUAGE_CODES[targetLang] || targetLang;
  
  // Use autodetect for source language - MyMemory will detect the language automatically
  const langPair = `autodetect|${targetCode.split('-')[0]}`;
  
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return data.responseData.translatedText;
    }
    
    // Fallback: return original text
    return text;
  } catch (error) {
    console.error('Translation API error:', error);
    return text;
  }
}

// Batch translate with rate limiting
async function translateBatch(texts: string[], targetLang: string): Promise<string[]> {
  const translations: string[] = [];
  
  // Process in parallel with a limit of 5 concurrent requests
  const BATCH_LIMIT = 5;
  
  for (let i = 0; i < texts.length; i += BATCH_LIMIT) {
    const batch = texts.slice(i, i + BATCH_LIMIT);
    
    const batchResults = await Promise.all(
      batch.map(text => translateText(text, targetLang))
    );
    
    translations.push(...batchResults);
    
    // Small delay between batches to avoid rate limiting
    if (i + BATCH_LIMIT < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return translations;
}

export async function POST(request: NextRequest) {
  try {
    const { texts, targetLanguage } = await request.json();
    
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ error: 'No texts provided' }, { status: 400 });
    }
    
    if (!targetLanguage) {
      return NextResponse.json({ error: 'No target language provided' }, { status: 400 });
    }
    
    // Translate all texts with auto-detection of source language
    const translations = await translateBatch(texts, targetLanguage);
    
    return NextResponse.json({ 
      success: true, 
      translations,
      count: translations.length 
    });
    
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json({ 
      error: 'Translation failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
