import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

interface TranslateRequest {
  text?: string;
  texts?: string[];
  sourceLang: string;
  targetLang: string;
  sourceLangName: string;
  targetLangName: string;
  batch?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: TranslateRequest = await request.json();
    const { text, texts, sourceLang, targetLang, sourceLangName, targetLangName, batch } = body;
    
    // Initialize ZAI
    const zai = await ZAI.create();
    
    // If same language, return original
    if (sourceLang === targetLang) {
      if (batch && texts) {
        return NextResponse.json({ translations: texts });
      }
      return NextResponse.json({ translation: text });
    }
    
    // Batch translation
    if (batch && texts && texts.length > 0) {
      const prompt = `Translate the following texts from ${sourceLangName} to ${targetLangName}. 
Maintain the technical context and terminology.
Return ONLY a JSON array with the translations in the same order, without any explanation or additional text.

Texts to translate:
${texts.map((t, i) => `${i + 1}. "${t}"`).join('\n')}

Return format: ["translation1", "translation2", ...]`;

      const response = await zai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a professional technical translator. Translate accurately while maintaining technical terminology. Always respond with valid JSON arrays when requested.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
      });
      
      const content = response.choices[0]?.message?.content || '';
      
      // Parse JSON array from response
      try {
        // Try to extract JSON array from the response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const translations = JSON.parse(jsonMatch[0]);
          return NextResponse.json({ translations });
        }
      } catch (parseError) {
        console.error('Failed to parse batch translation:', parseError);
      }
      
      // Fallback: return original texts
      return NextResponse.json({ translations: texts });
    }
    
    // Single text translation
    if (text) {
      const prompt = `Translate the following text from ${sourceLangName} to ${targetLangName}.
Maintain technical context and terminology.
Return ONLY the translated text, without any explanation or additional text.

Text to translate: "${text}"`;

      const response = await zai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a professional technical translator. Translate accurately while maintaining technical terminology. Return only the translated text without any additional commentary.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
      });
      
      const translation = response.choices[0]?.message?.content?.trim() || text;
      
      return NextResponse.json({ translation });
    }
    
    return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    
  } catch (error) {
    console.error('Translation API error:', error);
    return NextResponse.json(
      { error: 'Translation failed' },
      { status: 500 }
    );
  }
}
