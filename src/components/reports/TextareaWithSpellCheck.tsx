'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Check, X, AlertCircle, HelpCircle, Sparkles } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SpellError {
  original: string;
  suggestion: string;
  position: number;
  type: 'spelling' | 'punctuation' | 'grammar' | 'agreement';
  context: string;
  explanation?: string;
}

interface TextareaWithSpellCheckProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  language?: 'pt' | 'en' | 'ja' | 'zh';
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function TextareaWithSpellCheck({
  value,
  onChange,
  placeholder = '',
  className = '',
  minHeight = 'min-h-[80px]',
  language = 'pt',
  t
}: TextareaWithSpellCheckProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [errors, setErrors] = useState<SpellError[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showNoErrors, setShowNoErrors] = useState(false);
  const [appliedCorrections, setAppliedCorrections] = useState<Set<number>>(new Set());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // Log para verificar se o componente está sendo montado
  useEffect(() => {
    console.log('[SpellCheck] Component mounted, language:', language);
    isMountedRef.current = true;
    return () => {
      console.log('[SpellCheck] Component unmounted');
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [language]);

  // Log quando errors muda
  useEffect(() => {
    console.log('[SpellCheck] Errors state changed:', errors.length, 'errors');
  }, [errors]);

  // Debounced spell check - executa automaticamente enquanto digita
  const debouncedSpellCheck = useCallback(async (text: string) => {
    if (!text.trim()) {
      setErrors([]);
      return;
    }

    // Cancelar requisição anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    console.log('[SpellCheck] Starting automatic check for:', text.substring(0, 50));
    setIsChecking(true);

    try {
      // Adicionar timestamp para evitar cache
      const timestamp = Date.now();
      const response = await fetch(`/api/spell-check?t=${timestamp}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({ text, language }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('[SpellCheck] Auto check result:', data.errors?.length || 0, 'errors', data);
      
      // Só atualiza o estado se o componente ainda estiver montado
      if (isMountedRef.current) {
        setErrors(data.errors || []);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[SpellCheck] Request aborted');
        return;
      }
      console.error('[SpellCheck] Auto check failed:', error);
      if (isMountedRef.current) {
        setErrors([]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsChecking(false);
      }
    }
  }, [language]);

  // Effect para detectar erros em tempo real com debounce
  useEffect(() => {
    // Limpar timer anterior
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Só verificar se tiver texto
    if (value.trim()) {
      console.log('[SpellCheck] Scheduling debounce check in 800ms, text:', value.substring(0, 30));
      // Debounce de 800ms para não chamar a API a cada tecla
      debounceTimerRef.current = setTimeout(() => {
        console.log('[SpellCheck] Debounce triggered, calling API...');
        debouncedSpellCheck(value);
      }, 800);
    } else {
      console.log('[SpellCheck] Empty value, clearing errors');
      setErrors([]);
    }

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        console.log('[SpellCheck] Cleaning up debounce timer');
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [value, debouncedSpellCheck]);

  // Manual spell check (quando clica no Z)
  const handleSpellCheck = useCallback(async () => {
    console.log('[SpellCheck] Manual check clicked. Current errors:', errors.length, 'Has text:', !!value.trim());
    
    if (errors.length > 0) {
      console.log('[SpellCheck] Opening popover with existing errors');
      setIsOpen(true);
      return;
    }
    
    if (!value.trim()) {
      console.log('[SpellCheck] No text to check');
      return;
    }
    
    // Cancelar requisição anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    console.log('[SpellCheck] No errors yet, calling API...');
    console.log('[SpellCheck] Sending text:', value, 'language:', language);
    setIsChecking(true);
    setShowNoErrors(false);
    
    try {
      const requestBody = JSON.stringify({ text: value, language });
      console.log('[SpellCheck] Request body:', requestBody);
      
      // Adicionar timestamp para evitar cache
      const timestamp = Date.now();
      const response = await fetch(`/api/spell-check?t=${timestamp}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: requestBody,
        signal: abortControllerRef.current.signal,
      });

      console.log('[SpellCheck] Response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('[SpellCheck] Full response data:', JSON.stringify(data));
      const newErrors = data.errors || [];
      console.log('[SpellCheck] Manual check result:', newErrors.length, 'errors', newErrors);
      
      // Só atualiza o estado se o componente ainda estiver montado
      if (isMountedRef.current) {
        setErrors(newErrors);
        
        // Só abre se houver erros
        if (newErrors.length > 0) {
          console.log('[SpellCheck] Opening popover');
          setIsOpen(true);
        } else {
          console.log('[SpellCheck] No errors found, showing feedback');
          setShowNoErrors(true);
          // Auto-hide after 2 seconds
          setTimeout(() => {
            if (isMountedRef.current) {
              setShowNoErrors(false);
            }
          }, 2000);
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[SpellCheck] Request aborted');
        return;
      }
      console.error('[SpellCheck] Manual check failed:', error);
    } finally {
      if (isMountedRef.current) {
        setIsChecking(false);
      }
    }
  }, [errors.length, value, language]);

  const applyCorrection = useCallback((error: SpellError, index: number) => {
    // Replace the original word with the suggestion
    const regex = new RegExp(error.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const newValue = value.replace(regex, error.suggestion);
    onChange(newValue);
    
    // Mark as applied
    setAppliedCorrections(prev => new Set([...prev, index]));
    
    // Remove this error from the list
    setErrors(prev => prev.filter((_, i) => i !== index));
  }, [value, onChange]);

  const applyAllCorrections = useCallback(() => {
    let newValue = value;
    errors.forEach(error => {
      const regex = new RegExp(error.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      newValue = newValue.replace(regex, error.suggestion);
    });
    onChange(newValue);
    setErrors([]);
    setIsOpen(false);
  }, [errors, value, onChange]);

  const dismissError = useCallback((index: number) => {
    setErrors(prev => prev.filter((_, i) => i !== index));
  }, []);

  const getTypeLabel = (type: string) => {
    const labels: Record<string, Record<string, string>> = {
      spelling: { pt: 'Ortografia', en: 'Spelling', ja: 'スペル', zh: '拼写' },
      punctuation: { pt: 'Pontuação', en: 'Punctuation', ja: '句読点', zh: '标点' },
      grammar: { pt: 'Gramática', en: 'Grammar', ja: '文法', zh: '语法' },
      agreement: { pt: 'Concordância', en: 'Agreement', ja: '一致', zh: '一致性' },
    };
    return labels[type]?.[language] || type;
  };

  // Letra representativa para cada tipo
  const getTypeLetter = (type: string) => {
    switch (type) {
      case 'spelling':
        return 'Z'; // Z para ortografia
      case 'punctuation':
        return 'P';
      case 'grammar':
        return 'G';
      case 'agreement':
        return 'C';
      default:
        return '?';
    }
  };

  // Badge estilizado com letra grande e colorida
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'spelling':
        return 'bg-red-500 text-white font-bold text-sm px-2 py-0.5 rounded shadow-sm';
      case 'punctuation':
        return 'bg-yellow-500 text-white font-bold text-sm px-2 py-0.5 rounded shadow-sm';
      case 'grammar':
        return 'bg-purple-500 text-white font-bold text-sm px-2 py-0.5 rounded shadow-sm';
      case 'agreement':
        return 'bg-blue-500 text-white font-bold text-sm px-2 py-0.5 rounded shadow-sm';
      default:
        return 'bg-gray-500 text-white font-bold text-sm px-2 py-0.5 rounded shadow-sm';
    }
  };

  const getTypeIconColor = (type: string) => {
    switch (type) {
      case 'spelling':
        return 'text-red-500';
      case 'punctuation':
        return 'text-yellow-500';
      case 'grammar':
        return 'text-purple-500';
      case 'agreement':
        return 'text-blue-500';
      default:
        return 'text-gray-500';
    }
  };

  // Determinar cor do fundo do Z - vermelho se houver qualquer erro
  const getZButtonStyle = () => {
    if (isChecking) {
      return 'bg-gray-100 text-gray-500';
    }
    
    if (showNoErrors) {
      return 'bg-green-500 text-white shadow-md';
    }
    
    if (errors.length === 0) {
      return 'bg-transparent text-gray-400 hover:bg-orange-50 hover:text-orange-500';
    }

    // Qualquer erro = Z vermelho
    return 'bg-red-500 text-white shadow-md';
  };

  // Contar erros por tipo
  const errorCounts = {
    spelling: errors.filter(e => e.type === 'spelling').length,
    punctuation: errors.filter(e => e.type === 'punctuation').length,
    grammar: errors.filter(e => e.type === 'grammar').length,
    agreement: errors.filter(e => e.type === 'agreement').length,
  };

  return (
    <div className="relative">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${className} ${minHeight} pr-12`}
      />
      
      {/* Spell Check Button - Z com fundo colorido */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`absolute top-2 right-2 h-8 w-8 p-0 rounded-md font-bold transition-all duration-300 ${getZButtonStyle()}`}
            onClick={handleSpellCheck}
            disabled={!value.trim()}
            title={errors.length > 0 ? `${errors.length} erro(s) encontrado(s)` : t('spellCheck.title')}
          >
            {isChecking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : showNoErrors ? (
              <Check className="h-4 w-4" />
            ) : (
              <div className="relative">
                <span className="text-lg font-bold">Z</span>
                {errors.length > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-5 h-5 bg-black rounded-full text-[10px] text-white flex items-center justify-center px-1 font-normal">
                    {errors.length}
                  </span>
                )}
              </div>
            )}
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-80 p-0" align="end">
          {errors.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">{t('spellCheck.noErrors')}</h4>
              <p className="text-sm text-gray-500">O texto está correto!</p>
            </div>
          ) : (
            <>
              <div className="p-3 border-b bg-gradient-to-r from-orange-50 to-amber-50">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    {t('spellCheck.foundErrors', { count: errors.length })}
                  </h4>
                  {errors.length > 1 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={applyAllCorrections}
                    >
                      {t('spellCheck.applyAll')}
                    </Button>
                  )}
                </div>
                {/* Mini contador por tipo */}
                <div className="flex gap-1 mt-2 flex-wrap">
                  {errorCounts.spelling > 0 && (
                    <Badge className="bg-red-500 text-white text-[10px] h-5">
                      Z: {errorCounts.spelling}
                    </Badge>
                  )}
                  {errorCounts.agreement > 0 && (
                    <Badge className="bg-blue-500 text-white text-[10px] h-5">
                      C: {errorCounts.agreement}
                    </Badge>
                  )}
                  {errorCounts.grammar > 0 && (
                    <Badge className="bg-purple-500 text-white text-[10px] h-5">
                      G: {errorCounts.grammar}
                    </Badge>
                  )}
                  {errorCounts.punctuation > 0 && (
                    <Badge className="bg-yellow-500 text-white text-[10px] h-5">
                      P: {errorCounts.punctuation}
                    </Badge>
                  )}
                </div>
              </div>
              
              <ScrollArea className="max-h-80">
                <div className="p-2 space-y-2">
                  {errors.map((error, index) => (
                    <div
                      key={index}
                      className="p-3 bg-white rounded-lg border hover:border-orange-200 transition-colors shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={getTypeBadge(error.type)}>
                                {getTypeLetter(error.type)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{getTypeLabel(error.type)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-gray-400 hover:text-gray-600"
                          onClick={() => dismissError(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-red-600 line-through decoration-red-300 bg-red-50 px-1 rounded">
                            {error.original}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="text-green-600 font-medium bg-green-50 px-1 rounded">
                            {error.suggestion}
                          </span>
                        </div>
                        
                        {error.context && (
                          <p className="text-xs text-gray-500 italic mt-1 bg-gray-50 px-2 py-1 rounded">
                            "{error.context}"
                          </p>
                        )}

                        {error.explanation && (
                          <div className="flex items-start gap-1 mt-2 p-2 bg-blue-50 rounded border border-blue-100">
                            <HelpCircle className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${getTypeIconColor(error.type)}`} />
                            <p className="text-xs text-blue-700">
                              {error.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <Button
                        size="sm"
                        className="w-full mt-3 h-8 text-xs bg-orange-500 hover:bg-orange-600"
                        onClick={() => applyCorrection(error, index)}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        {t('spellCheck.apply')}
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
