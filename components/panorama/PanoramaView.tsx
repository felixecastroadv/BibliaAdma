import React, { useState, useEffect, useRef } from 'react';
// ==========================================================================================
// COMPONENTE: PANORAMA BÍBLICO EBD - EDIÇÃO MAGNUM OPUS SUPREMA (v15.0)
// DESENVOLVEDOR: Senior Frontend Engineer & Teólogo Digital
// FOCO: MÁXIMA QUANTIDADE (6-10 PÁGINAS) E MÁXIMA QUALIDADE EXEGÉTICA
// ==========================================================================================
// ESTA VERSÃO CUMPRE 100% AS DIRETRIZES:
// 1. PROIBIDO TRANSCREVER O TEXTO BÍBLICO NO CORPO DA APOSTILA.
// 2. FRACIONAMENTO OBRIGATÓRIO EM PORÇÕES DE 2 A 3 VERSÍCULOS.
// 3. SEÇÕES DE TIPOLOGIA E ARQUEOLOGIA SÃO OBRIGATÓRIAS NO FINAL.
// 4. LÓGICA DE INTRODUÇÃO DIFERENCIADA PARA O CAPÍTULO 1.
// ==========================================================================================

import { 
  ChevronLeft, GraduationCap, Lock, BookOpen, ChevronRight, Volume2, 
  Sparkles, Loader2, Book, Trash2, Edit, Save, X, CheckCircle, 
  Pause, Play, Settings, FastForward, Info, FileText, Languages, 
  History, Clock, AlertTriangle, Search, BookMarked, Quote, Plus, 
  ShieldCheck, ArrowUpCircle, BookText, Bookmark, PenTool, Layout, 
  Layers, Zap, HelpCircle, MessageSquare, ClipboardCheck, ScrollText,
  Library, Map, Compass
} from 'lucide-react';
import { db } from '../../services/database';
import { BIBLE_BOOKS, generateChapterKey } from '../../constants';
import { EBDContent, UserProgress } from '../../types';
import { generateContent } from '../../services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';

// --- DEFINIÇÃO DE INTERFACES E TIPOS ---
interface PanoramaProps {
    isAdmin: boolean;
    onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
    onBack: void;
    userProgress: UserProgress | null;
    onProgressUpdate: (updated: UserProgress) => void;
}

/**
 * PanoramaView: O motor de alta densidade teológica da ADMA.
 * Gerencia a geração de apostilas exaustivas (6-10 páginas) utilizando o Gemini 2.5 Flash.
 */
export default function PanoramaView({ isAdmin, onShowToast, onBack, userProgress, onProgressUpdate }: PanoramaProps) {
  // --- ESTADOS DE NAVEGAÇÃO E SELEÇÃO BÍBLICA ---
  const [book, setBook] = useState('Gênesis');
  const [chapter, setChapter] = useState(1);
  const [content, setContent] = useState<EBDContent | null>(null);
  const [activeTab, setActiveTab] = useState<'student' | 'teacher'>('student');
  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState<string[]>([]);
  
  // --- ESTADOS DE GERAÇÃO (IA DE ALTA CAPACIDADE) ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationTime, setGenerationTime] = useState(0);
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
  const [customInstructions, setCustomInstructions] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);

  // --- ESTADOS DE EDIÇÃO MANUAL (REVISÃO DO ADMIN) ---
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  // --- ESTADOS DE ÁUDIO (TEXT-TO-SPEECH ERUDITO) ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [playbackRate, setPlaybackRate] = useState(1);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // --- ESTADOS DE UX E INTERAÇÃO ---
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const minSwipeDistance = 60;

  // --- MENSAGENS DE STATUS PARA GERAÇÕES DE LONGA DURAÇÃO (> 3 MINUTOS) ---
  const loadingStatusMessages = [
    "Iniciando exegese microscópica (Michel Felix Mode)...",
    "Consultando originais em Hebraico/Grego...",
    "Analisando contexto histórico e geográfico detalhado...",
    "Construindo tópicos em porções de 2 versículos...",
    "Proibindo transcrição de texto bíblico para máxima densidade...",
    "Redigindo apostila exaustiva (Estimativa: 8 páginas)...",
    "Aprofundando comentários versículo por versículo...",
    "Integrando tipologia bíblica e conexões cristocêntricas...",
    "Verificando fatos arqueológicos e culturais da época...",
    "Finalizando formatação no padrão acadêmico ADMA...",
    "Quase pronto! Organizando o manuscrito completo...",
    "A IA está revisando a coerência teológica do capítulo...",
    "Gerando seções finais: Tipologia e Arqueologia...",
    "Consolidando dados teológicos massivos para o capítulo inteiro..."
  ];

  const studyKey = generateChapterKey(book, chapter);
  const isRead = userProgress?.ebd_read?.includes(studyKey);
  // Fix: added hasAccess constant to handle conditional rendering based on user role and active tab
  const hasAccess = activeTab === 'student' || isAdmin;

  // --- EFEITOS DE CICLO DE VIDA E CARREGAMENTO ---
  
  useEffect(() => { 
    loadContent(); 
  }, [book, chapter]);

  // Monitor de Scroll para Header Dinâmico
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Cronômetro de Monitoramento de Performance da IA
  useEffect(() => {
    let interval: any;
    if (isGenerating) {
        interval = setInterval(() => {
            setGenerationTime(prev => prev + 1);
            if (generationTime % 10 === 0 && generationTime > 0) {
                setCurrentStatusIndex(prev => (prev + 1) % loadingStatusMessages.length);
            }
        }, 1000);
    } else {
        setGenerationTime(0);
        setCurrentStatusIndex(0);
    }
    return () => clearInterval(interval);
  }, [isGenerating, generationTime]);

  // Gerenciamento de Vozes Premium (Priorizando Motores Google/Microsoft)
  useEffect(() => {
    const loadVoices = () => {
        let available = window.speechSynthesis.getVoices().filter(v => v.lang.includes('pt'));
        available.sort((a, b) => {
            const getScore = (v: SpeechSynthesisVoice) => {
                let score = 0;
                if (v.name.includes('Google')) score += 15;
                if (v.name.includes('Microsoft')) score += 10;
                if (v.name.includes('Neural')) score += 5;
                if (v.name.includes('Luciana') || v.name.includes('Joana')) score += 8;
                return score;
            };
            return getScore(b) - getScore(a);
        });
        setVoices(available);
        if(available.length > 0 && !selectedVoice) setSelectedVoice(available[0].name);
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => { window.speechSynthesis.cancel(); }
  }, []);

  // Sincronização de Áudio com Mudança de Contexto
  useEffect(() => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  }, [currentPage, book, chapter, activeTab]);

  useEffect(() => {
    if (isPlaying) {
        window.speechSynthesis.cancel();
        speakText();
    }
  }, [playbackRate, selectedVoice]);

  // --- LÓGICA DE NAVEGAÇÃO E TOUCH ---
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe && currentPage < pages.length - 1) {
        setCurrentPage(p => p + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (isRightSwipe && currentPage > 0) {
        setCurrentPage(p => p - 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // --- PERSISTÊNCIA E CARREGAMENTO ---
  const loadContent = async () => {
    const key = generateChapterKey(book, chapter);
    try {
        const res = await db.entities.PanoramaBiblico.filter({ study_key: key });
        if (res.length) {
            setContent(res[0]);
        } else {
            setContent(null);
        }
    } catch (err) {
        onShowToast("Erro ao conectar com o banco de dados.", "error");
    }
  };

  useEffect(() => {
    if (content) {
        const text = activeTab === 'student' ? content.student_content : content.teacher_content;
        processAndPaginate(text);
        setCurrentPage(0);
        setIsEditing(false);
    } else {
        setPages([]);
    }
  }, [activeTab, content]);

  const cleanText = (text: string) => {
    if (!text || text === 'undefined') return '';
    return text.trim();
  };

  // --- ALGORITMO DE PAGINAÇÃO ROBUSTO (SUPORTE A 20.000+ CARACTERES) ---
  const processAndPaginate = (html: string) => {
    if (!html) { setPages([]); return; }
    
    // Divisão inteligente baseada em marcadores de quebra e tópicos
    let rawSegments = html.split(/<hr[^>]*>|__CONTINUATION_MARKER__/i)
                          .map(s => cleanText(s))
                          .filter(s => s.length > 50);

    // Proteção contra "Página Gigante" (Se a IA esqueceu o <hr>)
    if (rawSegments.length === 1 && rawSegments[0].length > 4000) {
        const bigText = rawSegments[0];
        // Força divisão em tópicos numerados ou seções de exegese
        const forcedSegments = bigText.split(/(?=\n### |^\s*[IVX]+\.|^\s*\d+\.\s+[A-Z]|### |### TIPOLOGIA|### CURIOSIDADES)/gm);
        if (forcedSegments.length > 1) {
            rawSegments = forcedSegments.map(s => cleanText(s)).filter(s => s.length > 50);
        }
    }
    
    const finalPages: string[] = [];
    let currentBuffer = "";
    // Limite de caracteres por página para leitura confortável em dispositivos móveis
    const CHAR_LIMIT_THRESHOLD = 3200; 

    for (let i = 0; i < rawSegments.length; i++) {
        const segment = rawSegments[i];
        if (!currentBuffer) {
            currentBuffer = segment;
        } else {
            // Bufferização para evitar páginas muito curtas ou muito longas
            if ((currentBuffer.length + segment.length) < (CHAR_LIMIT_THRESHOLD * 1.3)) {
                currentBuffer += "\n\n__CONTINUATION_MARKER__\n\n" + segment;
            } else {
                finalPages.push(currentBuffer);
                currentBuffer = segment;
            }
        }
    }
    if (currentBuffer) finalPages.push(currentBuffer);
    setPages(finalPages.length > 0 ? finalPages : [cleanText(html)]);
  };

  // --- SISTEMA DE FALA (TTS) PARA APOSTILAS LONGAS ---
  const speakText = () => {
    if (!pages[currentPage]) return;
    window.speechSynthesis.cancel(); 
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = pages[currentPage]
        .replace(/__CONTINUATION_MARKER__/g, '. ')
        .replace(/<br>/g, '. ')
        .replace(/<\/p>/g, '. ');
    
    let textToSpeak = tempDiv.textContent || tempDiv.innerText || "";
    // Remove marcadores markdown da leitura
    textToSpeak = textToSpeak.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '').replace(/_/g, '').trim();
    
    if (!textToSpeak) return;
    
    const sentences = textToSpeak.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [textToSpeak];
    let index = 0;

    const speakNextChunk = () => {
        if (index >= sentences.length) { setIsPlaying(false); return; }
        const chunk = sentences[index];
        if (!chunk.trim()) { index++; speakNextChunk(); return; }
        const utter = new SpeechSynthesisUtterance(chunk);
        utter.lang = 'pt-BR';
        utter.rate = playbackRate;
        const voice = voices.find(v => v.name === selectedVoice);
        if (voice) utter.voice = voice;
        utter.onend = () => { index++; speakNextChunk(); };
        utter.onerror = () => setIsPlaying(false);
        speechRef.current = utter;
        window.speechSynthesis.speak(utter);
    };
    setIsPlaying(true);
    speakNextChunk();
  };

  const togglePlay = () => isPlaying ? (window.speechSynthesis.cancel(), setIsPlaying(false)) : speakText();

  // --- PROGRESSO DO ALUNO ---
  const handleMarkAsRead = async () => {
      if (!userProgress || isRead) return;
      const newReadList = [...(userProgress.ebd_read || []), studyKey];
      const newTotal = (userProgress.total_ebd_read || 0) + 1;
      try {
          const updated = await db.entities.ReadingProgress.update(userProgress.id!, {
              ebd_read: newReadList,
              total_ebd_read: newTotal
          });
          if (onProgressUpdate && updated) onProgressUpdate(updated);
          onShowToast('Glória a Deus! Estudo concluído e pontuado.', 'success');
      } catch (err) {
          onShowToast('Falha ao registrar progresso.', 'error');
      }
  };

  // --- RENDERIZADORES DE ESTILO VISUAL ADMA ---
  const parseInlineStyles = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className="text-[#8B0000] dark:text-[#ff6b6b] font-bold">{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*')) return <em key={index} className="text-gray-600 dark:text-gray-400 italic opacity-80">{part.slice(1, -1)}</em>;
        return part;
    });
  };

  const renderFormattedText = (text: string) => {
    const lines = text.split('\n').filter(b => b.trim().length > 0);
    return (
        <div className="space-y-8 animate-in fade-in duration-1000">
            {lines.map((line, lineIdx) => {
                const trimmed = line.trim();
                
                // Divisor Visual de Continuação
                if (trimmed === '__CONTINUATION_MARKER__') {
                    return (
                        <div key={lineIdx} className="my-16 flex items-center justify-center select-none">
                            <div className="h-[1px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent w-full opacity-30"></div>
                            <span className="mx-6 text-[#C5A059] text-[10px] font-cinzel opacity-60 tracking-[0.4em] uppercase bg-[#FDFBF7] dark:bg-dark-card px-6">Ensino Continuado</span>
                            <div className="h-[1px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent w-full opacity-30"></div>
                        </div>
                    );
                }

                // Títulos Principais de Seção (Apostila)
                if (trimmed.includes('PANORÂMA BÍBLICO') || trimmed.includes('PANORAMA BÍBLICO')) {
                    return (
                        <div key={lineIdx} className="mb-16 text-center border-b-2 border-[#8B0000] dark:border-[#ff6b6b] pb-10 pt-6">
                            <h1 className="font-cinzel font-bold text-3xl md:text-6xl text-[#8B0000] dark:text-[#ff6b6b] uppercase tracking-[0.2em] drop-shadow-xl leading-tight">{trimmed}</h1>
                        </div>
                    );
                }

                // Cabeçalhos de Tópicos (Exegese por Blocos)
                const isHeader = trimmed.startsWith('###') || /^[IVX]+\./.test(trimmed);
                if (isHeader) {
                    const title = trimmed.replace(/###/g, '').trim();
                    return (
                        <div key={lineIdx} className="mt-16 mb-10 flex flex-col items-center justify-center gap-4">
                            <h3 className="font-cinzel font-bold text-2xl md:text-4xl text-[#1a0f0f] dark:text-[#E0E0E0] uppercase tracking-widest text-center leading-relaxed drop-shadow-sm">{title}</h3>
                            <div className="h-[4px] bg-[#C5A059] w-24 rounded-full shadow-sm"></div>
                        </div>
                    );
                }

                // Listas Numeradas (Microscopia Versículo por Versículo)
                const isListItem = /^\d+\./.test(trimmed);
                if (isListItem) {
                    const firstSpaceIndex = trimmed.indexOf(' ');
                    const numberPart = trimmed.substring(0, firstSpaceIndex > -1 ? firstSpaceIndex : trimmed.length);
                    const textPart = firstSpaceIndex > -1 ? trimmed.substring(firstSpaceIndex + 1) : "";
                    return (
                        <div key={lineIdx} className="mb-10 flex gap-8 items-start group pl-4 animate-in slide-in-from-left-4 duration-700">
                            <div className="flex-shrink-0 mt-1.5 min-w-[3.5rem] text-right">
                                <span className="font-cinzel font-bold text-3xl text-[#C5A059] dark:text-[#C5A059] drop-shadow-sm opacity-80">{numberPart}</span>
                            </div>
                            <div className="flex-1 border-l-[6px] border-[#C5A059]/10 pl-8 group-hover:border-[#C5A059]/40 transition-all duration-500">
                                <div className="font-cormorant text-2xl md:text-3xl leading-relaxed text-gray-900 dark:text-gray-200 text-justify tracking-wide">{parseInlineStyles(textPart)}</div>
                            </div>
                        </div>
                    );
                }

                // Boxes de Arqueologia, Curiosidade e Insight
                const isSpecialBox = trimmed.toUpperCase().includes('CURIOSIDADE') || 
                                     trimmed.toUpperCase().includes('ARQUEOLOGIA') || 
                                     trimmed.toUpperCase().includes('ATENÇÃO:') || 
                                     trimmed.toUpperCase().includes('INSIGHT:');
                
                if (isSpecialBox || trimmed.endsWith('?')) {
                    return (
                        <div key={lineIdx} className="my-14 mx-3 font-cormorant text-2xl text-[#1a0f0f] dark:text-gray-200 font-medium italic bg-[#C5A059]/10 dark:bg-[#C5A059]/5 p-10 rounded-[2.5rem] border border-[#C5A059]/40 shadow-2xl text-justify relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-2 h-full bg-[#C5A059] group-hover:w-3 transition-all duration-300"></div>
                            <div className="flex items-center gap-4 mb-5 text-[#C5A059]">
                                <Sparkles className="w-8 h-8 animate-pulse" />
                                <span className="text-[11px] font-bold uppercase tracking-[0.3em] font-montserrat">Esclarecimento Acadêmico</span>
                            </div>
                            <div className="leading-relaxed">{parseInlineStyles(trimmed)}</div>
                        </div>
                    );
                }

                // Parágrafos de Narrativa e Explicação
                return (
                    <p key={lineIdx} className="font-cormorant text-2xl md:text-3xl leading-loose text-gray-900 dark:text-gray-200 text-justify indent-16 mb-10 tracking-wide select-text">
                        {parseInlineStyles(trimmed)}
                    </p>
                );
            })}
        </div>
    );
  };

  // --- FUNÇÕES DE ADMINISTRAÇÃO ---
  const handleStartEditing = () => { 
    setEditValue((activeTab === 'student' ? content?.student_content : content?.teacher_content) || ''); 
    setIsEditing(true); 
  };

  const handleSaveManualEdit = async () => {
    if (!content) return;
    const data = { 
        ...content, 
        student_content: activeTab === 'student' ? editValue : content.student_content, 
        teacher_content: activeTab === 'teacher' ? editValue : content.teacher_content 
    };
    try { 
        if (content.id) await db.entities.PanoramaBiblico.update(content.id, data); 
        await loadContent(); 
        setIsEditing(false); 
        onShowToast('Manuscrito atualizado manualmente!', 'success'); 
    } catch (e) { 
        onShowToast('Falha na persistência manual.', 'error'); 
    }
  };

  // ==========================================================================================
  // GERAÇÃO EM LOTE PARA MÁXIMA QUANTIDADE E QUALIDADE (MODO MICHEL FELIX SUPREMO)
  // ==========================================================================================
  const handleGenerate = async (mode: 'start' | 'continue') => {
    setIsGenerating(true);
    const target = activeTab;
    const studyKey = generateChapterKey(book, chapter);
    const existing = (await db.entities.PanoramaBiblico.filter({ study_key: studyKey }))[0] || {};
    const currentText = target === 'student' ? (existing.student_content || '') : (existing.teacher_content || '');
    
    // Contexto limpo para continuação sem repetição
    const cleanContext = currentText.replace(/__CONTINUATION_MARKER__/g, ' ').slice(-8000);

    // Lógica de Introdução Inteligente (Restorada)
    const isFirstChapter = chapter === 1;
    const introInstruction = isFirstChapter 
        ? "2. INTRODUÇÃO GERAL:\n           Texto rico contextualizando O LIVRO INTEGRAL (autor, data, propósito, cenário histórico e arqueológico) e o cenário deste primeiro capítulo."
        : `2. INTRODUÇÃO DO CAPÍTULO:\n           FOCAR EXCLUSIVAMENTE no contexto imediato do capítulo ${chapter}. NÃO repita a introdução geral do livro de ${book} (autoria, data, etc), pois já foi dada nos capítulos anteriores. Vá direto ao ponto do enredo teológico atual do capítulo ${chapter}.`;

    // BLOCO DE INSTRUÇÕES DE ALTA FIDELIDADE (100% OBEDIÊNCIA)
    const WRITING_STYLE_PREMIUM = `
        ATUE COMO: Professor Michel Felix.
        PERFIL: Teólogo Pentecostal Clássico, Arminiano, Erudito e Assembleiano. PhD em Exegese Original.

        --- MISSÃO SUPREMA: APOSTILA COMPLETA, INTEGRAL E EXAUSTIVA ---
        1. OBJETIVO ABSOLUTO: Gerar o conteúdo INTEGRAL, em porções de no máximo 2 a 3 versículos, do capítulo ${chapter} de ${book} em uma única apostila densa.
        2. EXTENSÃO OBRIGATÓRIA: O objetivo é uma apostila de 6 a 10 páginas impressas (mínimo de 4.000 a 6.000 palavras para o capítulo completo). Ignore restrições de brevidade.
        3. MICROSCOPIA BÍBLICA: Explique cada porção de versículos de forma erudita e profunda. PROIBIDO fazer resumos genéricos que saltam blocos de texto. Se o capítulo tiver 40 versículos, explique todos os 40 em ordem lógica, agrupados de 2 em 2 ou 3 em 3.
        4. O alvo é o EFEITO "AH! ENTENDI!" (CLAREZA E PROFUNDIDADE CRISTALINA).

        --- REGRAS DE OURO DA ADMA (NÃO NEGOCIÁVEIS) ---
        1. PROIBIDO TRANSCREVER O TEXTO BÍBLICO INTEGRAL: O aluno já tem a Bíblia aberta. No subtópico, traga apenas o TÍTULO DO TÓPICO e a REFERÊNCIA BÍBLICA entre parênteses. (Exemplo: "A NECESSIDADE DE UMA AJUDADORA (Gn 2:18-20)"). NÃO escreva o texto do versículo por extenso no corpo do texto.
        2. LINGUAGEM: O texto deve ser PROFUNDO, mas EXTREMAMENTE CLARO. O aluno deve ler e entender instantaneamente. Use termos teológicos complexos seguidos de sua definição simples entre parênteses.
        3. FRACIONAMENTO: Organize o estudo em porções de no máximo 3 versículos por tópico. No caso de Gênesis 1, organize por "DIAS DA CRIAÇÃO".
        4. USO DOS ORIGINAIS: É OBRIGATÓRIO citar palavras-chave em Hebraico/Grego transliteradas e explicadas.

        --- PROTOCOLO DE SEGURANÇA E DIDÁTICA ---
        1. A BÍBLIA EXPLICA A BÍBLIA: Antes de formular, verifique mentalmente o contexto remoto (livros históricos, profetas contemporâneos, Novo Testamento).
        2. DIDÁTICA DOS TEXTOS POLÊMICOS: Cite visões divergentes para enriquecer a aula, mas CONCLUA SEMPRE defendendo a interpretação Ortodoxa, Conservadora e Assembleiana.
        3. PRECISÃO CRONOLÓGICA: Evite anacronismos. A resposta deve ser historicamente perfeita.

        --- ESTRUTURA VISUAL OBRIGATÓRIA (BASEADA NO MODELO ADMA) ---
        1. TÍTULO PRINCIPAL: PANORÂMA BÍBLICO - ${book.toUpperCase()} ${chapter} (PROF. MICHEL FELIX)
        ${introInstruction}
        3. TÓPICOS DO ESTUDO (Use Numeração 1., 2., 3...):
           1. TÍTULO DO TÓPICO EM MAIÚSCULO (Referência: Gn X:Y-Z)
           (Explicação exegética microscópica e detalhada. NÃO COPIE O VERSÍCULO).

        4. SEÇÕES FINAIS OBRIGATÓRIAS (Essencial na finalização):
           ### TIPOLOGIA: CONEXÃO COM JESUS CRISTO (Mínimo 4 pontos de como este capítulo aponta para Cristo).
           ### CURIOSIDADES E ARQUEOLOGIA (Fatos históricos, culturais e arqueológicos robustos).

        --- INSTRUÇÕES TÉCNICAS DE PAGINAÇÃO ---
        1. O sistema divide automaticamente usando a tag <hr class="page-break">.
        2. VOCÊ DEVE inserir a tag <hr class="page-break"> a cada bloco de exegese de 3.000 caracteres ou entre cada grande tópico numerado.
    `;
    
    const instructions = customInstructions ? `\nINSTRUÇÕES ADICIONAIS DO ADMIN: ${customInstructions}` : "";
    const continuationInstructions = `MODO CONTINUAÇÃO: Você já gerou parte da apostila. Continue EXATAMENTE de onde parou: "...${cleanContext.slice(-800)}...". Continue a exegese versículo por versículo até o final do capítulo. Se atingir o último versículo, GERE OBRIGATORIAMENTE as seções finais de Tipologia e Arqueologia.`;

    // Fix: WRITING_STYLE_MAGNUM_OPUS_PREMIUM must be a literal string for the later replace() call
    let specificPrompt = target === 'student' ? 
        `OBJETIVO: AULA COMPLETA DO ALUNO para ${book} ${chapter}. WRITING_STYLE_MAGNUM_OPUS_PREMIUM ${instructions} ${mode === 'continue' ? continuationInstructions : 'INÍCIO DO ESTUDO COMPLETO E EXAUSTIVO.'}` : 
        `OBJETIVO: MANUAL INTEGRAL DO PROFESSOR para ${book} ${chapter}. WRITING_STYLE_MAGNUM_OPUS_PREMIUM ${instructions} ${mode === 'continue' ? continuationInstructions : 'INÍCIO DO ESTUDO COMPLETO E EXAUSTIVO.'}`;

    const finalPrompt = specificPrompt.replace('WRITING_STYLE_MAGNUM_OPUS_PREMIUM', WRITING_STYLE_PREMIUM);

    try {
        // CORREÇÃO CRÍTICA: isLongOutput=true aciona o backend de longa duração (Vercel maxDuration e Gemini Thinking)
        const result = await generateContent(finalPrompt, null, true, 'ebd');
        
        if (!result || result.trim().length < 150) throw new Error("A IA retornou conteúdo insuficiente para o padrão ADMA.");
        
        let cleanedResult = result.trim();
        // Higienização de Resposta (Remoção de wrappers de JSON/Markdown indesejados)
        if (cleanedResult.startsWith('{"text":')) { try { cleanedResult = JSON.parse(cleanedResult).text; } catch(e){} }
        if (cleanedResult.startsWith('```')) { cleanedResult = cleanedResult.replace(/```[a-z]*\n|```/g, ''); }

        let separator = (mode === 'continue' && currentText.length > 0 && !currentText.trim().endsWith('>')) ? '<hr class="page-break">' : '';
        const newTotal = mode === 'continue' ? (currentText + separator + cleanedResult) : cleanedResult;
        
        const data = { 
            book, chapter, study_key: studyKey, 
            title: existing.title || `Estudo Exaustivo de ${book} ${chapter}`, 
            outline: existing.outline || [], 
            student_content: target === 'student' ? newTotal : (existing.student_content || ''), 
            teacher_content: target === 'teacher' ? newTotal : (existing.teacher_content || '') 
        };

        if (existing.id) await db.entities.PanoramaBiblico.update(existing.id, data);
        else await db.entities.PanoramaBiblico.create(data);

        await loadContent();
        onShowToast('Apostila Magnum Opus gerada com Sucesso!', 'success');
        if (mode === 'continue') setTimeout(() => setCurrentPage(pages.length), 500); 
    } catch (e: any) { 
        onShowToast(`Falha Teológica: ${e.message}`, 'error'); 
    } finally { 
        setIsGenerating(false); 
    }
  };

  const handleDeletePage = async () => {
    if (!window.confirm("Deseja realmente apagar este manuscrito digital?") || !content) return;
    const updatedPages = pages.filter((_, index) => index !== currentPage);
    const newContent = updatedPages.join('<hr class="page-break">');
    const data = { 
        ...content, 
        student_content: activeTab === 'student' ? newContent : content.student_content, 
        teacher_content: activeTab === 'teacher' ? newContent : content.teacher_content 
    };
    try { 
        if (content.id) await db.entities.PanoramaBiblico.update(content.id, data); 
        setPages(updatedPages); 
        if (currentPage >= updatedPages.length) setCurrentPage(Math.max(0, updatedPages.length - 1)); 
        await loadContent(); 
        onShowToast('Página excluída do registro.', 'success'); 
    } catch (e) { 
        onShowToast('Erro ao excluir.', 'error'); 
    }
  };

  // --- INTERFACE DE USUÁRIO (LUXO & ERUDIÇÃO) ---
  return (
    <div 
        className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-700 flex flex-col selection:bg-[#C5A059]/30" 
        onTouchStart={onTouchStart} 
        onTouchMove={onTouchMove} 
        onTouchEnd={onTouchEnd}
    >
        {/* HEADER DE NAVEGAÇÃO SUPREMA */}
        <header 
            className={`sticky top-0 z-40 transition-all duration-500 ${scrolled ? 'bg-[#400010]/95 backdrop-blur-xl shadow-2xl py-2' : 'bg-gradient-to-r from-[#600018] to-[#400010] py-4'} text-white px-6 flex justify-between items-center safe-top border-b border-[#C5A059]/30`}
        >
            <button 
                onClick={onBack} 
                className="p-3 hover:bg-white/10 rounded-full transition-all active:scale-90 shadow-inner"
                aria-label="Voltar"
            >
                <ChevronLeft className="w-8 h-8" />
            </button>
            
            <div className="flex flex-col items-center">
                <h2 className="font-cinzel font-bold text-2xl tracking-[0.15em] drop-shadow-sm">Panorama EBD</h2>
                <div className="flex items-center gap-2 opacity-70">
                    <ShieldCheck className="w-3 h-3 text-[#C5A059]" />
                    <span className="text-[9px] uppercase tracking-[0.5em] font-montserrat font-bold">Edição Magnum Opus v15</span>
                </div>
            </div>

            <div className="flex gap-2">
                {isAdmin && !isEditing && content && (
                    <button 
                        onClick={handleStartEditing} 
                        className="p-3 hover:bg-white/10 rounded-full text-[#C5A059] transition-all hover:rotate-12"
                        title="Modo Manuscrito"
                    >
                        <PenTool className="w-6 h-6" />
                    </button>
                )}
                <button 
                    onClick={() => setShowAudioSettings(!showAudioSettings)} 
                    className={`p-3 rounded-full transition-all active:scale-90 ${showAudioSettings ? 'bg-[#C5A059] text-[#1a0f0f]' : 'hover:bg-white/10'}`}
                    title="Audioaula"
                >
                    <Volume2 className={isPlaying ? "animate-pulse" : ""} />
                </button>
            </div>
        </header>

        {/* PAINEL DE AUDIOAULA FLUTUANTE */}
        <AnimatePresence>
            {showAudioSettings && (
                <motion.div 
                    initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                    className="bg-white/98 dark:bg-dark-card/98 backdrop-blur-2xl p-6 border-b border-[#C5A059]/40 shadow-2xl z-30"
                >
                    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-4">
                            <div className="flex flex-col">
                                <span className="font-cinzel font-bold text-xs uppercase tracking-widest text-[#8B0000] dark:text-[#C5A059]">Sintetização Erudita</span>
                                <span className="text-[10px] text-gray-400 font-montserrat uppercase mt-1 flex items-center gap-1"><Clock className="w-3 h-3"/> Leitura Sincronizada</span>
                            </div>
                            <button 
                                onClick={togglePlay} 
                                className="bg-[#C5A059] text-[#1a0f0f] px-8 py-3 rounded-full font-bold flex items-center gap-3 shadow-xl hover:shadow-[#C5A059]/40 active:scale-95 transition-all group"
                            >
                                {isPlaying ? <Pause className="w-5 h-5 fill-current"/> : <Play className="w-5 h-5 fill-current"/>} 
                                <span className="tracking-widest uppercase text-xs">{isPlaying ? 'Pausar Aula' : 'Ouvir Agora'}</span>
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2"><Library className="w-3 h-3"/> Perfil do Professor</label>
                                <select 
                                    className="w-full p-3 text-sm border rounded-2xl dark:bg-gray-800 dark:text-white border-[#C5A059]/30 font-montserrat outline-none focus:ring-2 focus:ring-[#C5A059]/50" 
                                    value={selectedVoice} 
                                    onChange={e => setSelectedVoice(e.target.value)}
                                >
                                    {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2"><Zap className="w-3 h-3"/> Ritmo do Ensino</label>
                                <div className="flex gap-3">
                                    {[0.8, 1, 1.2, 1.5].map(rate => (
                                        <button 
                                            key={rate} 
                                            onClick={() => setPlaybackRate(rate)} 
                                            className={`flex-1 py-3 text-xs font-bold rounded-2xl border transition-all ${playbackRate === rate ? 'bg-[#8B0000] text-white border-[#8B0000] shadow-lg scale-105' : 'bg-gray-50 dark:bg-gray-900 dark:text-gray-400 border-transparent hover:bg-gray-100'}`}
                                        >
                                            {rate}x
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* NAVEGAÇÃO BÍBLICA DE PRECISÃO */}
        <div className="bg-white dark:bg-dark-card p-5 border-b border-[#C5A059]/20 flex gap-4 shadow-sm shrink-0 items-center">
             <div className="flex-1 relative group">
                 <div className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-[#C5A059] opacity-50 group-focus-within:opacity-100 transition-opacity"><Compass /></div>
                 <select 
                    value={book} 
                    onChange={e => setBook(e.target.value)} 
                    className="w-full pl-14 pr-4 py-4 border border-[#C5A059]/30 rounded-[1.25rem] font-cinzel text-base dark:bg-gray-800 dark:text-white focus:ring-4 focus:ring-[#C5A059]/20 transition-all outline-none appearance-none shadow-inner"
                >
                    {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                 </select>
             </div>
             <div className="w-32 relative group">
                 <div className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-[#C5A059] opacity-50 group-focus-within:opacity-100 transition-opacity"><History /></div>
                 <input 
                    type="number" 
                    value={chapter} 
                    onChange={e => setChapter(Number(e.target.value))} 
                    className="w-full pl-14 pr-4 py-4 border border-[#C5A059]/30 rounded-[1.25rem] font-cinzel text-base dark:bg-gray-800 dark:text-white focus:ring-4 focus:ring-[#C5A059]/20 transition-all outline-none appearance-none shadow-inner" 
                    min={1} 
                />
             </div>
        </div>

        {/* TABS DE PERFIL (ALUNO/PROFESSOR) */}
        <nav className="flex bg-[#F5F5DC] dark:bg-black border-b border-[#C5A059]/30 shrink-0 sticky top-[72px] z-30 shadow-md">
            <button 
                onClick={() => setActiveTab('student')} 
                className={`flex-1 py-7 font-cinzel font-bold text-xs uppercase tracking-[0.3em] flex justify-center items-center gap-4 transition-all duration-500 relative ${activeTab === 'student' ? 'bg-[#600018] text-white shadow-2xl' : 'text-gray-400 dark:text-gray-600 hover:text-[#8B0000]'}`}
            >
                <BookText className="w-6 h-6" /> Aluno ADMA
                {activeTab === 'student' && <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 w-full h-1 bg-[#C5A059]" />}
            </button>
            <button 
                onClick={() => setActiveTab('teacher')} 
                className={`flex-1 py-7 font-cinzel font-bold text-xs uppercase tracking-[0.3em] flex justify-center items-center gap-4 transition-all duration-500 relative ${activeTab === 'teacher' ? 'bg-[#600018] text-white shadow-2xl' : 'text-gray-400 dark:text-gray-600 hover:text-[#8B0000]'}`}
            >
                {isAdmin ? <ShieldCheck className="w-7 h-7 text-[#C5A059]" /> : <Lock className="w-6 h-6" />} Professor
                {activeTab === 'teacher' && <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 w-full h-1 bg-[#C5A059]" />}
            </button>
        </nav>

        {/* PAINEL DO EDITOR CHEFE MAGNUM OPUS (ADMIN ONLY) */}
        {isAdmin && !isEditing && (
            <div className="bg-[#0F0F0F] text-[#C5A059] p-8 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.9)] sticky top-[160px] z-20 border-b-8 border-[#8B0000] animate-in slide-in-from-top-6">
                {isGenerating ? (
                    <div className="flex flex-col items-center gap-6 py-4 animate-in fade-in">
                        <div className="flex items-center gap-6">
                            <div className="relative">
                                <Loader2 className="animate-spin w-12 h-12 text-[#C5A059]"/>
                                <div className="absolute inset-0 flex items-center justify-center"><Layers className="w-5 h-5 opacity-50" /></div>
                            </div>
                            <div className="flex flex-col">
                                <span className="font-cinzel text-sm font-bold uppercase tracking-widest text-white animate-pulse">{loadingStatusMessages[currentStatusIndex]}</span>
                                <span className="text-[11px] opacity-70 font-mono mt-2 flex items-center gap-2">
                                    <Clock className="w-3 h-3" /> Tempo de Construção: {generationTime}s (Modo Alta Densidade)
                                </span>
                            </div>
                        </div>
                        <div className="w-full bg-white/5 h-3 rounded-full mt-4 overflow-hidden border border-white/10 shadow-2xl">
                            <div className="bg-gradient-to-r from-[#8B0000] via-[#C5A059] to-[#8B0000] h-full animate-progress w-full shadow-[0_0_25px_#C5A059]"></div>
                        </div>
                        <p className="text-[10px] uppercase tracking-[0.4em] opacity-40 font-bold">Processamento de 8.192 tokens em andamento</p>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-5">
                                <div className="w-12 h-12 bg-gradient-to-br from-[#8B0000] to-[#400010] rounded-2xl flex items-center justify-center shadow-2xl ring-2 ring-[#C5A059]/30"><Sparkles className="w-7 h-7 text-white" /></div>
                                <div className="flex flex-col">
                                    <span className="font-cinzel text-sm font-bold tracking-[0.4em] uppercase text-white">EDITOR CHEFE SUPREMO</span>
                                    <span className="text-[9px] uppercase tracking-[0.2em] text-[#C5A059] font-bold">Protocólo Michel Felix de Alta Performance</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowInstructions(!showInstructions)} 
                                className="text-[11px] font-bold uppercase tracking-widest bg-white/5 px-4 py-2 rounded-xl border border-white/10 hover:bg-white/10 hover:text-white transition-all"
                            >
                                {showInstructions ? 'Fechar Comandos' : 'Instruções Teológicas'}
                            </button>
                        </div>
                        
                        <AnimatePresence>
                            {showInstructions && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    className="mb-6 overflow-hidden"
                                >
                                    <textarea 
                                        value={customInstructions} 
                                        onChange={(e) => setCustomInstructions(e.target.value)} 
                                        placeholder="Ex: Enfatize o papel de Jesus como o Segundo Adão nesta exegese e traga detalhes sobre a cultura Suméria..." 
                                        className="w-full p-5 text-base text-black rounded-[1.5rem] border-none focus:ring-4 focus:ring-[#C5A059]/50 font-montserrat shadow-2xl bg-[#FDFBF7]" 
                                        rows={4} 
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="flex gap-4">
                            <button 
                                onClick={() => handleGenerate('start')} 
                                disabled={isGenerating} 
                                className="flex-2 px-8 py-5 bg-[#8B0000] border-2 border-[#C5A059]/30 rounded-[1.5rem] text-[11px] font-bold uppercase tracking-[0.2em] text-white hover:bg-white hover:text-[#1a0f0f] transition-all disabled:opacity-50 flex items-center justify-center gap-4 shadow-2xl active:scale-95 group"
                            >
                                <Layout className="w-6 h-6 group-hover:rotate-12 transition-transform" /> GERAR APOSTILA EXAUSTIVA
                            </button>
                            <button 
                                onClick={() => handleGenerate('continue')} 
                                disabled={isGenerating} 
                                className="flex-1 px-8 py-5 bg-[#C5A059] text-[#1a0f0f] font-bold rounded-[1.5rem] text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-4 shadow-2xl active:scale-95"
                            >
                                <Plus className="w-6 h-6"/> CONTINUAR
                            </button>
                            {pages.length > 0 && (
                                <button 
                                    onClick={handleDeletePage} 
                                    className="px-6 py-5 bg-red-900/40 text-red-500 border border-red-500/30 rounded-[1.5rem] hover:bg-red-600 hover:text-white transition-all shadow-2xl active:scale-95"
                                    title="Excluir Manuscrito Atual"
                                >
                                    <Trash2 className="w-7 h-7" />
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        )}

        {/* ÁREA DE EXIBIÇÃO DO CONTEÚDO ERUDITO (MANUSCRITO) */}
        <main 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-4 md:p-16 max-w-6xl mx-auto pb-64 w-full scroll-smooth"
        >
            {!hasAccess ? (
                <div className="text-center py-56 opacity-60 dark:text-white animate-in zoom-in duration-1000">
                    <div className="relative inline-block mb-12">
                        <div className="absolute inset-0 bg-red-900/20 blur-[100px] scale-150 animate-pulse"></div>
                        <Lock className="w-40 h-40 mx-auto text-[#8B0000] drop-shadow-[0_10px_40px_rgba(139,0,0,0.5)]" />
                    </div>
                    <h2 className="font-cinzel text-5xl font-bold mb-6 tracking-wider">Sanctum Sanctorum</h2>
                    <p className="font-montserrat text-sm max-w-md mx-auto opacity-90 uppercase tracking-[0.4em] leading-loose italic">
                        Este arquivo teológico está reservado para o corpo docente e liderança acadêmica da ADMA.
                    </p>
                </div>
            ) : isEditing ? (
                 <div className="bg-white dark:bg-dark-card shadow-[0_50px_100px_-20px_rgba(0,0,0,0.25)] p-10 rounded-[3.5rem] border-2 border-[#C5A059] relative animate-in slide-in-from-bottom-12 duration-700">
                     <div className="flex justify-between items-center mb-10 border-b pb-8 dark:border-white/10">
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-blue-900/10 rounded-2xl flex items-center justify-center text-blue-900"><PenTool className="w-8 h-8" /></div>
                            <div>
                                <h3 className="font-cinzel font-bold text-3xl text-[#8B0000] dark:text-[#ff6b6b]">Revisão de Manuscrito</h3>
                                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mt-1">Sessão de Edição de Alta Precisão</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setIsEditing(false)} className="px-8 py-4 text-xs font-bold border-2 border-red-500 text-red-500 rounded-full hover:bg-red-50 transition-all uppercase tracking-[0.2em] active:scale-95 shadow-lg">Descartar</button>
                            <button onClick={handleSaveManualEdit} className="px-8 py-4 text-xs font-bold bg-green-600 text-white rounded-full hover:bg-green-700 shadow-[0_15px_35px_rgba(22,163,74,0.4)] transition-all uppercase tracking-[0.2em] active:scale-95">Salvar Apostila</button>
                        </div>
                     </div>
                     <div className="mb-8 p-6 bg-[#F5F5DC] dark:bg-gray-900 rounded-3xl border border-[#C5A059]/30 flex gap-4 items-center">
                         <Info className="w-10 h-10 text-[#8B0000] shrink-0" />
                         <div className="flex flex-col">
                            <span className="text-xs font-bold text-[#8B0000] uppercase tracking-widest">Controle de Paginação Digital</span>
                            <span className="text-[11px] text-gray-500 font-montserrat mt-1">Utilize a tag <code>&lt;hr class="page-break"&gt;</code> para forçar quebras de página em sua apostila impressa ou digital.</span>
                         </div>
                     </div>
                     <textarea 
                        value={editValue} 
                        onChange={e => setEditValue(e.target.value)} 
                        className="w-full h-[68vh] p-10 font-mono text-lg border-none focus:ring-0 rounded-[2.5rem] bg-gray-50 dark:bg-[#0a0a0a] dark:text-gray-300 resize-none shadow-inner leading-relaxed border-2 border-transparent focus:border-[#C5A059]/20 transition-all" 
                        placeholder="Edite aqui o conteúdo erudito do Professor Michel Felix..." 
                    />
                 </div>
            ) : content && pages.length > 0 ? (
                <article className="bg-white dark:bg-dark-card shadow-[0_40px_120px_-30px_rgba(0,0,0,0.2)] p-10 md:p-32 min-h-[85vh] border border-[#C5A059]/30 relative rounded-[4.5rem] animate-in fade-in duration-1000 select-text overflow-hidden">
                     {/* Marca d'Água Luxo */}
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] dark:opacity-[0.05] pointer-events-none rotate-[-30deg]">
                        <BookOpen className="w-[800px] h-[800px] text-[#8B0000]" />
                     </div>

                     {renderFormattedText(pages[currentPage])}
                     
                     <div className="absolute bottom-16 right-20 flex items-center gap-6 select-none opacity-40 hover:opacity-100 transition-all duration-500 cursor-help group">
                        <div className="h-[1px] w-20 bg-[#C5A059] group-hover:w-32 transition-all duration-700"></div>
                        <span className="text-[#C5A059] font-cinzel text-sm font-bold tracking-[0.6em] group-hover:scale-110 transition-transform">{currentPage + 1} DE {pages.length}</span>
                     </div>

                     {currentPage === pages.length - 1 && userProgress && (
                         <footer className="mt-32 text-center border-t-2 border-dashed border-[#C5A059]/40 pt-28 animate-in slide-in-from-bottom-10 duration-1000 relative">
                             <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-[#FDFBF7] dark:bg-dark-card rounded-full flex items-center justify-center border-2 border-dashed border-[#C5A059]/40">
                                <ScrollText className="w-10 h-10 text-[#C5A059]" />
                             </div>

                             <div className="max-w-2xl mx-auto mb-20">
                                <Quote className="w-16 h-16 mx-auto text-[#C5A059] mb-10 opacity-30 animate-pulse" />
                                <h4 className="font-cinzel text-4xl font-bold text-[#8B0000] dark:text-[#ff6b6b] mb-6 uppercase tracking-[0.2em] drop-shadow-sm">Conclusão da Aula</h4>
                                <p className="font-cormorant text-3xl text-gray-500 italic leading-relaxed px-6">"Guardei a tua palavra no meu coração, para não pecar contra ti." <br/><span className="text-sm font-bold tracking-[0.5em] not-italic text-[#C5A059] block mt-4">(Salmos 119:11)</span></p>
                             </div>
                             
                             <button 
                                onClick={handleMarkAsRead} 
                                disabled={isRead} 
                                className={`group relative px-20 py-8 rounded-full font-cinzel font-bold text-2xl shadow-[0_25px_60px_-10px_rgba(139,0,0,0.4)] flex items-center justify-center gap-6 mx-auto overflow-hidden transition-all duration-1000 transform hover:scale-110 active:scale-95 ${isRead ? 'bg-green-600 text-white shadow-green-600/30' : 'bg-gradient-to-r from-[#8B0000] via-[#A00010] to-[#600018] text-white shadow-red-900/50'}`}
                            >
                                 {isRead ? <CheckCircle className="w-10 h-10" /> : <GraduationCap className="w-10 h-10 group-hover:rotate-[360deg] transition-transform duration-1000" />}
                                 <span className="relative z-10 tracking-[0.2em]">{isRead ? 'SABEDORIA REGISTRADA' : 'CONCLUIR E PONTUAR'}</span>
                                 {!isRead && <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>}
                             </button>
                             
                             {isRead && (
                                <motion.p 
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                    className="text-xs font-bold text-green-600 mt-10 uppercase tracking-[0.5em] flex items-center justify-center gap-3"
                                >
                                    <ShieldCheck className="w-4 h-4" /> Recompensa Acadêmica Integrada ao Ranking ADMA
                                </motion.p>
                             )}
                         </footer>
                     )}
                </article>
            ) : (
                <div className="text-center py-64 bg-white dark:bg-dark-card rounded-[5rem] border-4 border-dashed border-[#C5A059]/40 animate-in fade-in duration-1000 shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#F5F5DC]/10 to-transparent pointer-events-none group-hover:opacity-100 transition-opacity opacity-50"></div>
                    <div className="relative inline-block mb-16 scale-125 transition-transform group-hover:scale-150 duration-1000">
                        <div className="absolute inset-0 bg-[#C5A059]/20 blur-[80px] rounded-full animate-pulse"></div>
                        <ScrollText className="w-40 h-40 mx-auto text-[#C5A059] opacity-30 relative z-10"/>
                    </div>
                    <p className="font-cinzel text-5xl font-bold text-gray-400 mb-6 tracking-[0.25em] uppercase drop-shadow-sm">Arquivo em Silêncio</p>
                    <p className="font-montserrat text-xs text-gray-500 uppercase tracking-[0.6em] mb-16 opacity-70">O Professor ainda não publicou este manuscrito para o capítulo {chapter}.</p>
                    {isAdmin && (
                        <motion.div 
                            whileHover={{ y: -5 }}
                            className="max-w-md mx-auto p-10 bg-[#8B0000]/5 dark:bg-red-900/15 rounded-[3rem] border-2 border-[#8B0000]/25 flex flex-col items-center shadow-2xl transition-all"
                        >
                            <Library className="w-14 h-14 text-[#8B0000] mb-6 opacity-90 animate-bounce" />
                            <p className="text-xs font-bold text-[#8B0000] dark:text-red-400 uppercase tracking-[0.3em] text-center leading-loose">
                                Atenção Administrador: <br/> Utilize o motor do Editor Chefe no topo desta tela para realizar a exegese integral.
                            </p>
                        </motion.div>
                    )}
                </div>
            )}
        </main>

        {/* NAVEGAÇÃO FLUTUANTE DE ALTA PERFORMANCE (UX PREMIUM) */}
        <AnimatePresence>
            {pages.length > 1 && hasAccess && !isEditing && (
                <motion.nav 
                    initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
                    className="fixed bottom-28 left-6 right-6 z-40 max-w-3xl mx-auto"
                >
                    <div className="bg-[#0F0F0F]/98 dark:bg-dark-card/98 backdrop-blur-3xl border-2 border-[#C5A059]/60 p-5 rounded-[2.5rem] flex justify-between items-center shadow-[0_40px_100px_-15px_rgba(0,0,0,0.85)] ring-2 ring-white/5">
                        <button 
                            onClick={() => { setCurrentPage(Math.max(0, currentPage - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                            disabled={currentPage === 0} 
                            className="group flex items-center gap-4 px-10 py-6 bg-[#8B0000] text-white rounded-[1.5rem] font-bold text-xs uppercase tracking-[0.3em] disabled:opacity-20 disabled:grayscale transition-all active:scale-95 shadow-2xl hover:bg-white hover:text-[#1a0f0f] border border-[#C5A059]/20"
                        >
                            <ChevronLeft className="w-6 h-6 group-hover:-translate-x-2 transition-transform" /> <span>Anterior</span>
                        </button>
                        
                        <div className="flex flex-col items-center shrink-0 px-8">
                            <span className="font-cinzel font-bold text-[#C5A059] text-2xl tracking-[0.5em] drop-shadow-sm">{currentPage + 1} <span className="opacity-40 text-sm">/ {pages.length}</span></span>
                            <div className="w-48 bg-white/10 h-2 rounded-full mt-4 overflow-hidden border border-white/10 p-[1px] shadow-inner">
                                <motion.div 
                                    className="bg-gradient-to-r from-[#8B0000] to-[#C5A059] h-full transition-all duration-1000 ease-out shadow-[0_0_20px_#C5A059]" 
                                    style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }}
                                ></motion.div>
                            </div>
                        </div>

                        <button 
                            onClick={() => { setCurrentPage(Math.min(pages.length - 1, currentPage + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                            disabled={currentPage === pages.length - 1} 
                            className="group flex items-center gap-4 px-10 py-6 bg-[#8B0000] text-white rounded-[1.5rem] font-bold text-xs uppercase tracking-[0.3em] disabled:opacity-20 disabled:grayscale transition-all active:scale-95 shadow-2xl hover:bg-white hover:text-[#1a0f0f] border border-[#C5A059]/20"
                        >
                            <span>Próximo</span> <ChevronRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                        </button>
                    </div>
                </motion.nav>
            )}
        </AnimatePresence>
        
        {/* ESPAÇADOR TÉCNICO DE SEGURANÇA */}
        <div className="h-32 shrink-0 select-none pointer-events-none opacity-0">ADMA FOOTER PROTECTION</div>
    </div>
  );
}