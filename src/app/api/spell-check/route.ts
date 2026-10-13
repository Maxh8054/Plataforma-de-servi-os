import { NextRequest, NextResponse } from 'next/server';

interface SpellError {
  original: string;
  suggestion: string;
  position: number;
  type: 'spelling' | 'punctuation' | 'grammar' | 'agreement';
  context: string;
  explanation?: string;
}

type Language = 'pt' | 'en' | 'ja' | 'zh';

function getSystemPrompt(language: Language): string {
  const prompts: Record<Language, string> = {
    pt: `Você é um corretor ortográfico e gramatical ESPECIALISTA em português brasileiro. 
       
       Sua ÚNICA função é identificar erros em:
       
       1. ORTOGRAFIA: Palavras escritas incorretamente (ex: "excessão" → "exceção", "mais" → "mas" quando incorreto)
       
       2. PONTUAÇÃO: Erros de vírgulas, pontos, dois pontos, ponto e vírgula, acentuação faltando, etc.
       
       3. CONCORDÂNCIA (muito importante!): 
          - Concordância nominal: adjetivos concordando com substantivos em gênero e número
          - Concordância verbal: sujeito e verbo concordando em número e pessoa
          - Concordância do particípio: uso correto do particípio com verbos auxiliares
       
       4. GRAMÁTICA: Outros erros gramaticais como regência verbal/nominal, colocação pronominal, etc.
       
       REGRAS CRÍTICAS:
       - NÃO reescreva o texto
       - NÃO mude o contexto ou significado
       - NÃO melhore o estilo ou fluidez
       - NÃO faça sugestões de palavras diferentes que tenham o mesmo significado por questões de estilo
       - APENAS corrija erros EVIDENTES de escrita, ortografia, pontuação e concordância
       - Se a frase está gramaticalmente correta, não sugira alterações
       - IMPORTANTE: O texto pode conter termos técnicos em inglês (PN, TAG, SN, etc.) - NÃO corrija isso!
       
       Responda APENAS em formato JSON com esta estrutura:
       {
         "errors": [
           {
             "original": "palavra ou expressão com erro",
             "suggestion": "correção",
             "position": 0,
             "type": "spelling|punctuation|grammar|agreement",
             "context": "trecho da frase onde o erro aparece",
             "explanation": "breve explicação do erro em português"
           }
         ]
       }
       
       Se não houver erros, retorne: {"errors": []}`,

    en: `You are an expert spelling and grammar checker in English.
       
       Your ONLY function is to identify errors in:
       
       1. SPELLING: Misspelled words
       
       2. PUNCTUATION: Commas, periods, colons, semicolons, missing punctuation, etc.
       
       3. SUBJECT-VERB AGREEMENT (very important!):
          - Singular subjects need singular verbs
          - Plural subjects need plural verbs
       
       4. GRAMMAR: Other grammatical errors like article usage, pronoun agreement, etc.
       
       CRITICAL RULES:
       - DO NOT rewrite the text
       - DO NOT change context or meaning
       - DO NOT improve style or fluency
       - DO NOT suggest different words with the same meaning for style reasons
       - ONLY correct OBVIOUS writing, spelling, punctuation, and agreement errors
       - If the sentence is grammatically correct, do not suggest changes
       - IMPORTANT: The text may contain technical terms, abbreviations, or codes (PN, TAG, SN, etc.) - DO NOT correct these!
       
       Respond ONLY in JSON format with this structure:
       {
         "errors": [
           {
             "original": "word or expression with error",
             "suggestion": "correction",
             "position": 0,
             "type": "spelling|punctuation|grammar|agreement",
             "context": "part of the sentence where the error appears",
             "explanation": "brief explanation of the error in English"
           }
         ]
       }
       
       If there are no errors, return: {"errors": []}`,

    ja: `あなたは日本語のスペルと文法の専門チェッカーです。
       
       あなたの唯一の機能は、以下のエラーを特定することです：
       
       1. スペル（表記）: 誤った漢字、ひらがな、カタカナの使用
       
       2. 句読点: 誤った句読点の使用、欠落など
       
       3. 一致（重要！）: 
          - 主語と述語の一致
          - 修飾語と被修飾語の関係
       
       4. 文法: その他の文法的エラー
       
       重要なルール:
       - テキストを書き直さないでください
       - 文脈や意味を変更しないでください
       - スタイルや流暢さを改善しないでください
       - 明らかな書き込み、スペル、句読点、一致のエラーのみを修正してください
       - 文が文法的に正しい場合、変更を提案しないでください
       - 重要：テキストには専門用語、略語、コード（PN、TAG、SNなど）が含まれる場合があります - これらを修正しないでください！
       
       以下の構造のJSON形式でのみ回答してください：
       {
         "errors": [
           {
             "original": "エラーのある単語または表現",
             "suggestion": "修正",
             "position": 0,
             "type": "spelling|punctuation|grammar|agreement",
             "context": "エラーが現れる文の一部",
             "explanation": "日本語でのエラーの簡単な説明"
           }
         ]
       }
       
       エラーがない場合、以下を返してください: {"errors": []}`,

    zh: `您是中文拼写和语法方面的专业检查员。
       
       您的唯一功能是识别以下错误：
       
       1. 拼写（错别字）: 错误使用的汉字
       
       2. 标点符号: 错误使用的标点符号、缺失等
       
       3. 一致性（重要！）:
          - 主语和谓语的一致
          - 修饰语和被修饰语的关系
       
       4. 语法: 其他语法错误
       
       重要规则：
       - 不要重写文本
       - 不要改变上下文或含义
       - 不要改善风格或流畅度
       - 只纠正明显的书写、拼写、标点和一致性错误
       - 如果句子在语法上是正确的，不要建议更改
       - 重要：文本可能包含专业术语、缩写或代码（PN、TAG、SN等）- 不要纠正这些！
       
       仅以以下JSON格式回答：
       {
         "errors": [
           {
             "original": "有错误的单词或表达",
             "suggestion": "修正",
             "position": 0,
             "type": "spelling|punctuation|grammar|agreement",
             "context": "错误出现的句子部分",
             "explanation": "用中文简要解释错误"
           }
         ]
       }
       
       如果没有错误，返回: {"errors": []}`
  };

  return prompts[language];
}

function getUserPrompt(text: string, language: Language): string {
  const prompts: Record<Language, string> = {
    pt: `Analise este texto e identifique APENAS erros de ortografia, pontuação, concordância (nominal e verbal) ou gramática evidente. Não reescreva nem melhore o texto, apenas identifique os erros reais. Lembre-se: termos técnicos em inglês como PN, TAG, SN, etc. não são erros!

"${text}"`,

    en: `Analyze this text and identify ONLY spelling, punctuation, subject-verb agreement, or obvious grammar errors. Do not rewrite or improve the text, only identify actual errors. Remember: technical terms, abbreviations, and codes like PN, TAG, SN, etc. are not errors!

"${text}"`,

    ja: `このテキストを分析し、スペル、句読点、一致、または明らかな文法エラーのみを特定してください。テキストを書き直したり改善したりせず、実際のエラーのみを特定してください。PN、TAG、SNなどの専門用語、略語、コードはエラーではありません！

"${text}"`,

    zh: `分析此文本，仅识别拼写、标点、一致性或明显的语法错误。不要重写或改进文本，只识别实际错误。记住：PN、TAG、SN等专业术语、缩写和代码不是错误！

"${text}"`
  };

  return prompts[language];
}

// Cache para a instância do ZAI
let zaiInstance: any = null;
let zaiInitPromise: Promise<any> | null = null;

async function getZAI() {
  if (zaiInstance) return zaiInstance;
  
  if (zaiInitPromise) return zaiInitPromise;
  
  zaiInitPromise = (async () => {
    console.log('[SpellCheck] Initializing ZAI SDK...');
    const ZAI = await import('z-ai-web-dev-sdk').then(m => m.default || m);
    zaiInstance = await ZAI.create();
    console.log('[SpellCheck] ZAI SDK initialized successfully');
    return zaiInstance;
  })();
  
  return zaiInitPromise;
}

// Função principal para verificação ortográfica
async function checkSpellingWithLLM(text: string, language: Language): Promise<SpellError[]> {
  console.log('[SpellCheck] Starting spell check for language:', language);
  console.log('[SpellCheck] Text length:', text.length);
  
  try {
    // Tentar usar z-ai-web-dev-sdk
    try {
      const zai = await getZAI();
      console.log('[SpellCheck] Sending request to LLM...');
      
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'assistant',
            content: getSystemPrompt(language)
          },
          {
            role: 'user',
            content: getUserPrompt(text, language)
          }
        ],
        thinking: { type: 'disabled' }
      });

      const response = completion.choices[0]?.message?.content;
      console.log('[SpellCheck] Got response from LLM, length:', response?.length || 0);

      if (response) {
        // Try to extract JSON from the response
        const jsonMatch = response.match(/\{[\s\S]*"errors"[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log('[SpellCheck] Parsed errors:', parsed.errors?.length || 0);
            return parsed.errors || [];
          } catch (parseError) {
            console.error('[SpellCheck] Failed to parse JSON:', parseError);
          }
        } else {
          console.log('[SpellCheck] No JSON found in response');
          console.log('[SpellCheck] Response preview:', response.substring(0, 200));
        }
      }
    } catch (sdkError: any) {
      console.error('[SpellCheck] SDK error:', sdkError?.message || sdkError);
      console.error('[SpellCheck] SDK error stack:', sdkError?.stack);
      // Continue to fallback
    }

    // Fallback: retornar array vazio
    console.log('[SpellCheck] Returning empty errors (fallback)');
    return [];
  } catch (error: any) {
    console.error('[SpellCheck] Error:', error?.message || error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const { text, language = 'pt' } = await request.json();

    console.log('[SpellCheck POST] Received request:', { 
      textLength: text?.length, 
      language 
    });

    if (!text || text.trim().length === 0) {
      console.log('[SpellCheck POST] Empty text, returning empty errors');
      return NextResponse.json({ errors: [] });
    }

    const validLanguage: Language = ['pt', 'en', 'ja', 'zh'].includes(language) ? language : 'pt';

    // Verificar spell check
    const errors = await checkSpellingWithLLM(text, validLanguage);

    console.log('[SpellCheck POST] Returning', errors.length, 'errors');
    return NextResponse.json({ errors });

  } catch (error: any) {
    console.error('[SpellCheck POST] Error:', error?.message || error);
    // Return empty errors instead of error response to not break the UI
    return NextResponse.json({ errors: [] });
  }
}

// Endpoint GET para verificar se o serviço está funcionando
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    message: 'Spell check service is available',
    timestamp: new Date().toISOString()
  });
}
