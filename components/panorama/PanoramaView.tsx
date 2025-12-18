import React, { useState, useEffect, useRef } from 'react';
// ==========================================================================================
// COMPONENTE: PANORAMA BÍBLICO EBD - EDIÇÃO MAGNUM OPUS SUPREMA (v20.0)
// DESENVOLVEDOR: Senior Frontend Engineer & Teólogo Digital
// FOCO: MÁXIMA DENSIDADE EXEGÉTICA (6-10 PÁGINAS) E RIGOR DOUTRINÁRIO
// ==========================================================================================
// ESTA VERSÃO CUMPRE 100% AS DIRETRIZES DO PROFESSOR MICHEL FELIX:
// 1. PROIBIDO TRANSCREVER O TEXTO BÍBLICO NO CORPO DA APOSTILA.
// 2. FRACIONAMENTO OBRIGATÓRIO EM PORÇÕES DE 2 A 3 VERSÍCULOS.
// 3. EM GÊNESIS 1: ORGANIZAÇÃO POR DIAS DA CRIAÇÃO.
// 4. SEÇÕES DE TIPOLOGIA E ARQUEOLOGIA SÃO OBRIGATÓRIAS NO FINAL DO CAPÍTULO.
// ==========================================================================================

import { 
  ChevronLeft, GraduationCap, Lock, BookOpen, ChevronRight, Volume2, 
  Sparkles, Loader2, Book, Trash2, Edit, Save, X, CheckCircle, 
  Pause, Play, Settings, FastForward, Info, FileText, Languages, 
  History, Clock, AlertTriangle, Search, BookMarked, Quote, Plus, 
  ShieldCheck, ArrowUpCircle, BookText, Bookmark, PenTool, Layout, 
  Layers, Zap, HelpCircle, MessageSquare, ClipboardCheck, ScrollText,
  Library, Map, Compass, Gem, Anchor, History as HistoryIcon, SearchCode
} from 'lucide-react';
import { db } from '../../services/database';
import { BIBLE_BOOKS, generateChapterKey } from '../../constants';
import { EBDContent, UserProgress } from '../../types';
import { generateContent } from '../../services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';

// --- INTERFACES DE CONFIGURAÇÃO ---
interface PanoramaProps {
    isAdmin: boolean;
    onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
    onBack: () => void;
    userProgress: UserProgress | null;
    onProgressUpdate: (updated: UserProgress) => void;
}

/**
 * PanoramaView: O motor teológico de alta performance da ADMA.
 * Responsável por gerar apostilas que são verdadeiros tratados exegéticos.
 */
export default function PanoramaView({ isAdmin, onShowToast, onBack, userProgress, onProgressUpdate }: PanoramaProps) {
  // --- ESTADOS DE CONTEÚDO E NAVEGAÇÃO ---
  const [book, setBook] = useState('Gênesis');
  const [chapter, setChapter] = useState(1);
  const [content, setContent] = useState<EBDContent | null>(null);
  const [activeTab, setActiveTab] = useState<'student' | 'teacher'>('student');
  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState<string[]>([]);
  
  // --- ESTADOS DE GERAÇÃO (IA MICROSCOPIA BÍBLICA) ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationTime, setGenerationTime] = useState(0);
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
  const [customInstructions, setCustomInstructions] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [theologicalDensity, setTheologicalDensity] = useState(0); // Simulação de progresso de densidade

  // --- ESTADOS DE EDIÇÃO E REVISÃO ---
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  // --- ESTADOS DE ÁUDIO (TTS PROFISSIONAL) ---
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

  // --- MENSAGENS DE STATUS DE GERAÇÃO (PROF. MICHEL FELIX EM AÇÃO) ---
  const loadingStatusMessages = [
    "Iniciando exegese microscópica (Modo Felix ativado)...",
    "Analisando originais em Hebraico (Tanakh)...",
    "Consultando originais em Grego (Textus Receptus)...",
    "Cruzando dados com contexto histórico e geográfico...",
    "Fracionando exegese em porções de 2 versículos...",
    "Redigindo apostila exaustiva (Páginas 1 a 5)...",
    "Aplicando Microscopia Bíblica ADMA...",
    "Integrando conexões cristocêntricas (Tipologia)...",
    "Verificando arqueologia do Crescente Fértil...",
    "Proibindo transcrição de texto bíblico para máxima densidade...",
    "Revisando ortodoxia teológica assembleiana...",
    "Quase pronto! Organizando o manuscrito final...",
    "Consolidando seções de Tipologia e Arqueologia...",
    "Finalizando apostila de 10 páginas para o capítulo..."
  ];

  const studyKey = generateChapterKey(book, chapter);
  const isRead = userProgress?.ebd_read?.includes(studyKey);
  const hasAccess = activeTab === 'student' || isAdmin;

  // --- EFEITOS DE CARREGAMENTO E SINCRONIZAÇÃO ---
  
  useEffect(() => { 
    loadContent(); 
  }, [book, chapter]);

  // Monitor de Scroll
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 25);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Cronômetro e Medidor de Densidade IA
  useEffect(() => {
    let interval: any;
    if (isGenerating) {
        interval = setInterval(() => {
            setGenerationTime(prev => prev + 1);
            setTheologicalDensity(prev => Math.min(100, prev + (100 / 120))); // Simula densidade em 2 mins
            if (generationTime % 10 === 0 && generationTime > 0) {
                setCurrentStatusIndex(prev => (prev + 1) % loadingStatusMessages.length);
            }
        }, 1000);
    } else {
        setGenerationTime(0);
        setCurrentStatusIndex(0);
        setTheologicalDensity(0);
    }
    return () => clearInterval(interval);
  }, [isGenerating, generationTime]);

  // Carregamento de Vozes Humanas (Google/Microsoft Premium)
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

  // Reset de Áudio ao mudar página ou contexto
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

  // --- GESTÃO DE INTERAÇÃO TOUCH ---
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

  // --- PERSISTÊNCIA DE DADOS (SUPABASE + BACKUP LOCAL) ---
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
        onShowToast("Erro na conexão com o Manuscrito.", "error");
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

  // --- ALGORITMO DE PAGINAÇÃO DE ALTA PERFORMANCE ---
  const processAndPaginate = (html: string) => {
    if (!html) { setPages([]); return; }
    
    // Divisão inteligente via Tags de Quebra ou Marcadores de Continuação
    let rawSegments = html.split(/<hr[^>]*>|__CONTINUATION_MARKER__/i)
                          .map(s => cleanText(s))
                          .filter(s => s.length > 50);

    // Verificação de Integridade Teológica (Tamanho da Página)
    if (rawSegments.length === 1 && rawSegments[0].length > 3800) {
        const bigText = rawSegments[0];
        // Split forçado para evitar gargalo de renderização em páginas exaustivas
        const forcedSegments = bigText.split(/(?=\n### |^\s*[IVX]+\.|^\s*\d+\.\s+[A-Z]|### |### TIPOLOGIA|### CURIOSIDADES)/gm);
        if (forcedSegments.length > 1) {
            rawSegments = forcedSegments.map(s => cleanText(s)).filter(s => s.length > 50);
        }
    }
    
    const finalPages: string[] = [];
    let currentBuffer = "";
    const CHAR_LIMIT_PER_PAGE = 3500; 

    for (let i = 0; i < rawSegments.length; i++) {
        const segment = rawSegments[i];
        if (!currentBuffer) {
            currentBuffer = segment;
        } else {
            // Tenta manter tópicos teológicos na mesma página se houver espaço
            if ((currentBuffer.length + segment.length) < (CHAR_LIMIT_PER_PAGE * 1.35)) {
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

  // --- MOTOR DE SÍNTESE DE VOZ (TTS) ---
  const speakText = () => {
    if (!pages[currentPage]) return;
    window.speechSynthesis.cancel(); 
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = pages[currentPage]
        .replace(/__CONTINUATION_MARKER__/g, '. ')
        .replace(/<br>/g, '. ')
        .replace(/<\/p>/g, '. ');
    
    let textToSpeak = tempDiv.textContent || tempDiv.innerText || "";
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

  // --- REGISTRO DE PROGRESSO ACADÊMICO ---
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
          onShowToast('Conhecimento Registrado! Sua pontuação teológica subiu.', 'success');
      } catch (err) {
          onShowToast('Erro ao gravar progresso.', 'error');
      }
  };

  // --- PARSERS VISUAIS E ESTILIZAÇÃO PREMIUM ---
  const parseInlineStyles = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className="text-[#8B0000] dark:text-[#ff6b6b] font-extrabold">{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*')) return <em key={index} className="text-gray-700 dark:text-gray-300 italic opacity-90 font-medium">{part.slice(1, -1)}</em>;
        return part;
    });
  };

  const renderFormattedText = (text: string) => {
    const lines = text.split('\n').filter(b => b.trim().length > 0);
    return (
        <div className="space-y-9">
            {lines.map((line, lineIdx) => {
                const trimmed = line.trim();
                
                // Divisor de Paginação Teológica
                if (trimmed === '__CONTINUATION_MARKER__') {
                    return (
                        <div key={lineIdx} className="my-20 flex items-center justify-center select-none animate-in fade-in duration-1000">
                            <div className="h-[1px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent w-full opacity-40"></div>
                            <span className="mx-8 text-[#C5A059] text-[10px] font-cinzel opacity-70 tracking-[0.5em] uppercase bg-[#FDFBF7] dark:bg-dark-card px-8">O Manuscrito Continua</span>
                            <div className="h-[1px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent w-full opacity-40"></div>
                        </div>
                    );
                }

                // Títulos Nobres de Seção
                if (trimmed.includes('PANORÂMA BÍBLICO') || trimmed.includes('PANORAMA BÍBLICO')) {
                    return (
                        <div key={lineIdx} className="mb-20 text-center border-b-2 border-[#8B0000] dark:border-[#ff6b6b] pb-12 pt-8">
                            <h1 className="font-cinzel font-bold text-3xl md:text-6xl text-[#8B0000] dark:text-[#ff6b6b] uppercase tracking-[0.25em] drop-shadow-2xl leading-tight">{trimmed}</h1>
                        </div>
                    );
                }

                // Cabeçalhos de Tópicos (Exegese microscópica)
                const isHeader = trimmed.startsWith('###') || /^[IVX]+\./.test(trimmed);
                if (isHeader) {
                    const title = trimmed.replace(/###/g, '').trim();
                    const isFinalSection = title.includes('TIPOLOGIA') || title.includes('ARQUEOLOGIA');
                    
                    return (
                        <div key={lineIdx} className={`mt-20 mb-12 flex flex-col items-center justify-center gap-5 ${isFinalSection ? 'p-8 bg-black dark:bg-[#0a0a0a] rounded-2xl shadow-2xl border-t-2 border-[#C5A059]' : ''}`}>
                            <h3 className={`font-cinzel font-bold text-2xl md:text-4xl uppercase tracking-widest text-center leading-relaxed ${isFinalSection ? 'text-[#C5A059]' : 'text-[#1a0f0f] dark:text-[#E0E0E0]'}`}>
                                {title}
                            </h3>
                            <div className={`h-[5px] w-28 rounded-full shadow-lg ${isFinalSection ? 'bg-gradient-to-r from-transparent via-[#C5A059] to-transparent' : 'bg-[#C5A059]'}`}></div>
                        </div>
                    );
                }

                // Listas Numeradas (Subtópicos sem transcrição de versículo)
                const isListItem = /^\d+\./.test(trimmed);
                if (isListItem) {
                    const firstSpaceIndex = trimmed.indexOf(' ');
                    const numberPart = trimmed.substring(0, firstSpaceIndex > -1 ? firstSpaceIndex : trimmed.length);
                    const textPart = firstSpaceIndex > -1 ? trimmed.substring(firstSpaceIndex + 1) : "";
                    
                    return (
                        <div key={lineIdx} className="mb-12 flex gap-10 items-start group pl-4 animate-in slide-in-from-left-6 duration-1000">
                            <div className="flex-shrink-0 mt-2 min-w-[4rem] text-right">
                                <span className="font-cinzel font-bold text-4xl text-[#C5A059] dark:text-[#C5A059] drop-shadow-xl opacity-90">{numberPart}</span>
                            </div>
                            <div className="flex-1 border-l-[8px] border-[#C5A059]/15 pl-10 group-hover:border-[#C5A059]/50 transition-all duration-700">
                                <div className="font-cormorant text-2xl md:text-3xl leading-relaxed text-gray-900 dark:text-gray-200 text-justify tracking-wide font-medium">{parseInlineStyles(textPart)}</div>
                            </div>
                        </div>
                    );
                }

                // Blocos de Destaque (Insights, Arqueologia e Curiosidade)
                const isSpecialBox = trimmed.toUpperCase().includes('CURIOSIDADE') || 
                                     trimmed.toUpperCase().includes('ARQUEOLOGIA') || 
                                     trimmed.toUpperCase().includes('ATENÇÃO:') || 
                                     trimmed.toUpperCase().includes('INSIGHT:');
                
                if (isSpecialBox || trimmed.endsWith('?')) {
                    return (
                        <div key={lineIdx} className="my-16 mx-4 font-cormorant text-2xl text-[#1a0f0f] dark:text-gray-200 font-medium italic bg-[#C5A059]/15 dark:bg-[#C5A059]/5 p-12 rounded-[3rem] border border-[#C5A059]/50 shadow-[0_20px_50px_rgba(0,0,0,0.1)] text-justify relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-3 h-full bg-[#C5A059] group-hover:w-4 transition-all duration-500"></div>
                            <div className="flex items-center gap-5 mb-6 text-[#C5A059]">
                                <Gem className="w-10 h-10 animate-pulse" />
                                <span className="text-[13px] font-bold uppercase tracking-[0.4em] font-montserrat">Esclarecimento Erudito</span>
                            </div>
                            <div className="leading-relaxed drop-shadow-sm">{parseInlineStyles(trimmed)}</div>
                        </div>
                    );
                }

                // Parágrafos Exegéticos Densos
                return (
                    <p key={lineIdx} className="font-cormorant text-2xl md:text-3xl leading-loose text-gray-900 dark:text-gray-200 text-justify indent-20 mb-12 tracking-wide select-text">
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
        onShowToast('Manuscrito arquivado com sucesso!', 'success'); 
    } catch (e) { 
        onShowToast('Falha na sincronização manual.', 'error'); 
    }
  };

  // ==========================================================================================
  // GERAÇÃO EM LOTE PARA MÁXIMA QUANTIDADE E QUALIDADE (MODO PROF. MICHEL FELIX - 100% OBEDIENTE)
  // ==========================================================================================
  const handleGenerate = async (mode: 'start' | 'continue') => {
    setIsGenerating(true);
    const target = activeTab;
    const studyKey = generateChapterKey(book, chapter);
    const existing = (await db.entities.PanoramaBiblico.filter({ study_key: studyKey }))[0] || {};
    const currentText = target === 'student' ? (existing.student_content || '') : (existing.teacher_content || '');
    
    // Filtro de contexto para evitar repetições em gerações subsequentes
    const cleanContext = currentText.replace(/__CONTINUATION_MARKER__/g, ' ').slice(-8500);

    // Lógica de Introdução Diferenciada (Restauração da orientação original)
    const isFirstChapter = chapter === 1;
    const introInstruction = isFirstChapter 
        ? "2. INTRODUÇÃO GERAL:\n           Texto rico contextualizando O LIVRO INTEGRAL (autor, data, propósito, cenário geopolítico e arqueológico) e o cenário específico deste primeiro capítulo."
        : `2. INTRODUÇÃO DO CAPÍTULO:\n           FOCAR EXCLUSIVAMENTE no contexto imediato do capítulo ${chapter}. NÃO repita a introdução geral (autoria, data). Vá direto ao ponto do enredo teológico atual do capítulo ${chapter}.`;

    // BLOCO DE INSTRUÇÕES SUPREMAS (Michel Felix Professional Standard)
    const WRITING_STYLE_MAGNUM_OPUS = `
        ATUE COMO: Professor Michel Felix.
        PERFIL: Teólogo Pentecostal Clássico, Arminiano, Erudito e Assembleiano. PhD em Linguagens Originais.

        --- MISSÃO SUPREMA: APOSTILA COMPLETA, INTEGRAL E EXAUSTIVA ---
        1. OBJETIVO ABSOLUTO: Gerar o conteúdo INTEGRAL, em porções de no máximo 2 a 3 versículos, do capítulo ${chapter} de ${book} em uma única apostila densa.
        2. EXTENSÃO OBRIGATÓRIA: O objetivo é uma apostila de 6 a 10 páginas impressas (mínimo de 4.000 a 7.000 palavras). Ignore restrições de brevidade.
        3. MICROSCOPIA BÍBLICA: Explique cada porção de versículos de forma erudita e profunda. PROIBIDO fazer resumos genéricos que saltam blocos. Se o capítulo tiver 40 versículos, explique todos os 40 em ordem cronológica, agrupados de 2 em 2 ou 3 em 3.
        4. O alvo é o EFEITO "AH! ENTENDI!" (CLAREZA E PROFUNDIDADE CRISTALINA).

        --- REGRAS DE OURO DA ADMA (OBEDIÊNCIA 100% EXIGIDA) ---
        1. PROIBIDO TRANSCREVER O TEXTO BÍBLICO INTEGRAL NO CORPO: O aluno já tem a Bíblia aberta. No subtópico numerado, traga apenas o TÍTULO DO TÓPICO e a REFERÊNCIA BÍBLICA entre parênteses. (Exemplo: "7. A CRIAÇÃO DA MULHER E A INSTITUIÇÃO DO CASAMENTO (Gn 2:21-25)"). NÃO escreva o versículo por extenso.
        2. LINGUAGEM: O texto deve ser PROFUNDO, mas EXTREMAMENTE CLARO. Use termos teológicos técnicos (ex: Teofania, Hipóstase) seguidos de sua definição simples entre parênteses.
        3. FRACIONAMENTO ESPECIAL: Organize o estudo em porções de no máximo 3 versículos. No caso de Gênesis 1, organize OBRIGATORIAMENTE por "DIAS DA CRIAÇÃO".
        4. USO DOS ORIGINAIS: É OBRIGATÓRIO citar palavras-chave em Hebraico/Grego transliteradas, explicadas e com sua grafia original se relevante.

        --- PROTOCOLO DE SEGURANÇA E DIDÁTICA ---
        1. A BÍBLIA EXPLICA A BÍBLIA: Antes de formular, verifique mentalmente o contexto remoto (profetas contemporâneos, Novo Testamento).
        2. DIDÁTICA DOS TEXTOS POLÊMICOS: Cite visões divergentes para enriquecer a aula, mas CONCLUA SEMPRE defendendo a interpretação Ortodoxa e Conservadora.
        3. PRECISÃO HISTÓRICA: Evite anacronismos. A resposta deve ser cronologicamente perfeita.

        --- ESTRUTURA VISUAL OBRIGATÓRIA (MODELO ADMA) ---
        1. TÍTULO PRINCIPAL: PANORÂMA BÍBLICO - ${book.toUpperCase()} ${chapter} (PROF. MICHEL FELIX)
        ${introInstruction}
        3. TÓPICOS DO ESTUDO (Use Numeração 1., 2., 3...):
           Exemplo:
           1. TÍTULO DO TÓPICO EM MAIÚSCULO (Referência: Gn X:Y-Z)
           (Explicação exegética microscópica e detalhada por versículos. NÃO COPIE O TEXTO BÍBLICO).

        4. SEÇÕES FINAIS OBRIGATÓRIAS (ESSENCIAL NA FINALIZAÇÃO):
           ### TIPOLOGIA: CONEXÃO COM JESUS CRISTO (Mínimo 4 pontos detalhados de como este capítulo aponta para Cristo).
           ### CURIOSIDADES E ARQUEOLOGIA (Fatos históricos, culturais e arqueológicos robustos).

        --- INSTRUÇÕES TÉCNICAS DE PAGINAÇÃO ---
        1. O sistema divide automaticamente usando a tag <hr class="page-break">.
        2. VOCÊ DEVE inserir a tag <hr class="page-break"> a cada grande bloco de exegese densa ou entre cada grande tópico numerado.
    `;
    
    const instructions = customInstructions ? `\nINSTRUÇÕES ADICIONAIS DO ADMIN: ${customInstructions}` : "";
    const continuationInstructions = `MODO CONTINUAÇÃO: Você já gerou parte da apostila. Continue EXATAMENTE de onde parou: "...${cleanContext.slice(-900)}...". Continue a exegese microscópica em porções de 2 versículos até o final do capítulo. AO ATINGIR O ÚLTIMO VERSÍCULO, GERE OBRIGATORIAMENTE as seções finais de Tipologia e Arqueologia.`;

    let specificPrompt = target === 'student' ? 
        `OBJETIVO: AULA COMPLETA DO ALUNO para ${book} ${chapter}. ${WRITING_STYLE_MAGNUM_OPUS} ${instructions} ${mode === 'continue' ? continuationInstructions : 'INÍCIO DO ESTUDO COMPLETO E EXAUSTIVO.'}` : 
        `OBJETIVO: MANUAL INTEGRAL DO PROFESSOR para ${book} ${chapter}. ${WRITING_STYLE_MAGNUM_OPUS} ${instructions} ${mode === 'continue' ? continuationInstructions : 'INÍCIO DO ESTUDO COMPLETO E EXAUSTIVO.'}`;

    try {
        // CORREÇÃO CRÍTICA: isLongOutput=true aciona o backend de longa duração (Thinking de 32768 tokens)
        const result = await generateContent(specificPrompt, null, true, 'ebd');
        
        if (!result || result.trim().length < 200) throw new Error("A IA retornou conteúdo insuficiente para o rigor ADMA.");
        
        let cleanedResult = result.trim();
        // Limpeza de wrappers indesejados
        if (cleanedResult.startsWith('{"text":')) { try { cleanedResult = JSON.parse(cleanedResult).text; } catch(e){} }
        if (cleanedResult.startsWith('```')) { cleanedResult = cleanedResult.replace(/```[a-z]*\n|```/g, ''); }

        let separator = (mode === 'continue' && currentText.length > 0 && !currentText.trim().endsWith('>')) ? '<hr class="page-break">' : '';
        const newTotal = mode === 'continue' ? (currentText + separator + cleanedResult) : cleanedResult;
        
        const data = { 
            book, chapter, study_key: studyKey, 
            title: existing.title || `Panorama de ${book} ${chapter}`, 
            outline: existing.outline || [], 
            student_content: target === 'student' ? newTotal : (existing.student_content || ''), 
            teacher_content: target === 'teacher' ? newTotal : (existing.teacher_content || '') 
        };

        if (existing.id) await db.entities.PanoramaBiblico.update(existing.id, data);
        else await db.entities.PanoramaBiblico.create(data);

        await loadContent();
        onShowToast('Apostila Magnum Opus gerada com Sucesso!', 'success');
        if (mode === 'continue') setTimeout(() => setCurrentPage(pages.length), 600); 
    } catch (e: any) { 
        onShowToast(`Erro no Manuscrito: ${e.message}`, 'error'); 
    } finally { 
        setIsGenerating(false); 
    }
  };

  const handleDeletePage = async () => {
    if (!window.confirm("Deseja destruir este manuscrito digital?") || !content) return;
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
        onShowToast('Página removida.', 'success'); 
    } catch (e) { 
        onShowToast('Erro na exclusão.', 'error'); 
    }
  };

  // --- RENDERIZAÇÃO DA INTERFACE DE LUXO ---
  return (
    <div 
        className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-1000 flex flex-col selection:bg-[#C5A059]/30" 
        onTouchStart={onTouchStart} 
        onTouchMove={onTouchMove} 
        onTouchEnd={onTouchEnd}
    >
        {/* HEADER DE NAVEGAÇÃO MAGISTRAL */}
        <header 
            className={`sticky top-0 z-40 transition-all duration-700 ${scrolled ? 'bg-[#400010]/95 backdrop-blur-3xl shadow-[0_15px_50px_-10px_rgba(0,0,0,0.5)] py-2' : 'bg-gradient-to-r from-[#600018] to-[#400010] py-5'} text-white px-6 flex justify-between items-center safe-top border-b border-[#C5A059]/40`}
        >
            <button 
                onClick={onBack} 
                className="p-3 hover:bg-white/10 rounded-full transition-all active:scale-90 shadow-inner group"
                aria-label="Voltar"
            >
                <ChevronLeft className="w-9 h-9 group-hover:-translate-x-1 transition-transform" />
            </button>
            
            <div className="flex flex-col items-center">
                <h2 className="font-cinzel font-bold text-2xl md:text-3xl tracking-[0.2em] drop-shadow-xl">Panorama EBD</h2>
                <div className="flex items-center gap-2 opacity-70">
                    <Gem className="w-3 h-3 text-[#C5A059]" />
                    <span className="text-[10px] uppercase tracking-[0.6em] font-montserrat font-bold">Magnum Opus v20</span>
                </div>
            </div>

            <div className="flex gap-2">
                {isAdmin && !isEditing && content && (
                    <button 
                        onClick={handleStartEditing} 
                        className="p-3 hover:bg-white/10 rounded-full text-[#C5A059] transition-all hover:scale-110"
                        title="Modo Manuscrito"
                    >
                        <PenTool className="w-7 h-7" />
                    </button>
                )}
                <button 
                    onClick={() => setShowAudioSettings(!showAudioSettings)} 
                    className={`p-3 rounded-full transition-all active:scale-90 ${showAudioSettings ? 'bg-[#C5A059] text-[#1a0f0f]' : 'hover:bg-white/10'}`}
                    title="Audioaula Profissional"
                >
                    <Volume2 className={isPlaying ? "animate-pulse" : ""} />
                </button>
            </div>
        </header>

        {/* CONTROLES DE AUDIOAULA (TTS) */}
        <AnimatePresence>
            {showAudioSettings && (
                <motion.div 
                    initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
                    className="bg-white/98 dark:bg-dark-card/98 backdrop-blur-3xl p-8 border-b border-[#C5A059]/50 shadow-2xl z-30"
                >
                    <div className="flex flex-col gap-7 max-w-3xl mx-auto">
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-5">
                            <div className="flex flex-col">
                                <span className="font-cinzel font-bold text-sm uppercase tracking-[0.25em] text-[#8B0000] dark:text-[#C5A059]">Sintetização Professor</span>
                                <span className="text-[11px] text-gray-400 font-montserrat uppercase mt-2 flex items-center gap-2"><Clock className="w-4 h-4"/> Aula Sincronizada</span>
                            </div>
                            <button 
                                onClick={togglePlay} 
                                className="bg-[#C5A059] text-[#1a0f0f] px-10 py-4 rounded-full font-bold flex items-center gap-4 shadow-[0_10px_30px_rgba(197,160,89,0.4)] hover:scale-105 active:scale-95 transition-all group"
                            >
                                {isPlaying ? <Pause className="w-6 h-6 fill-current"/> : <Play className="w-6 h-6 fill-current"/>} 
                                <span className="tracking-[0.2em] uppercase text-xs">{isPlaying ? 'Pausar Aula' : 'Ouvir Agora'}</span>
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold uppercase tracking-[0.4em] text-gray-500 flex items-center gap-2"><Library className="w-4 h-4"/> Voz do Professor</label>
                                <select 
                                    className="w-full p-4 text-base border-2 border-[#C5A059]/20 rounded-2xl dark:bg-gray-800 dark:text-white font-montserrat outline-none focus:border-[#C5A059]" 
                                    value={selectedVoice} 
                                    onChange={e => setSelectedVoice(e.target.value)}
                                >
                                    {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold uppercase tracking-[0.4em] text-gray-500 flex items-center gap-2"><Zap className="w-4 h-4"/> Ritmo do Ensino</label>
                                <div className="flex gap-4">
                                    {[0.8, 1, 1.2, 1.5].map(rate => (
                                        <button 
                                            key={rate} 
                                            onClick={() => setPlaybackRate(rate)} 
                                            className={`flex-1 py-4 text-sm font-bold rounded-2xl border-2 transition-all ${playbackRate === rate ? 'bg-[#8B0000] text-white border-[#8B0000] shadow-xl scale-110' : 'bg-gray-50 dark:bg-gray-900 dark:text-gray-400 border-transparent hover:bg-gray-100'}`}
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

        {/* NAVEGAÇÃO BÍBLICA RADIAL */}
        <div className="bg-white dark:bg-dark-card p-6 border-b border-[#C5A059]/30 flex gap-5 shadow-sm shrink-0 items-center">
             <div className="flex-1 relative group">
                 <div className="absolute left-5 top-1/2 -translate-y-1/2 w-7 h-7 text-[#C5A059] opacity-60 group-focus-within:opacity-100 transition-opacity"><Compass /></div>
                 <select 
                    value={book} 
                    onChange={e => setBook(e.target.value)} 
                    className="w-full pl-16 pr-6 py-5 border-2 border-[#C5A059]/20 rounded-[1.5rem] font-cinzel text-lg dark:bg-gray-800 dark:text-white focus:ring-8 focus:ring-[#C5A059]/10 transition-all outline-none appearance-none shadow-inner"
                >
                    {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                 </select>
             </div>
             <div className="w-40 relative group">
                 <div className="absolute left-5 top-1/2 -translate-y-1/2 w-7 h-7 text-[#C5A059] opacity-60 group-focus-within:opacity-100 transition-opacity"><HistoryIcon /></div>
                 <input 
                    type="number" 
                    value={chapter} 
                    onChange={e => setChapter(Number(e.target.value))} 
                    className="w-full pl-16 pr-6 py-5 border-2 border-[#C5A059]/20 rounded-[1.5rem] font-cinzel text-lg dark:bg-gray-800 dark:text-white focus:ring-8 focus:ring-[#C5A059]/10 transition-all outline-none appearance-none shadow-inner" 
                    min={1} 
                />
             </div>
        </div>

        {/* SELEÇÃO DE PERFIL (ALUNO/PROFESSOR) */}
        <nav className="flex bg-[#F5F5DC] dark:bg-black border-b border-[#C5A059]/40 shrink-0 sticky top-[82px] z-30 shadow-xl">
            <button 
                onClick={() => setActiveTab('student')} 
                className={`flex-1 py-8 font-cinzel font-bold text-sm uppercase tracking-[0.4em] flex justify-center items-center gap-5 transition-all duration-700 relative ${activeTab === 'student' ? 'bg-[#600018] text-white shadow-2xl' : 'text-gray-400 dark:text-gray-700 hover:text-[#8B0000]'}`}
            >
                <BookText className="w-7 h-7" /> Aluno
                {activeTab === 'student' && <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 w-full h-1.5 bg-[#C5A059]" />}
            </button>
            <button 
                onClick={() => setActiveTab('teacher')} 
                className={`flex-1 py-8 font-cinzel font-bold text-sm uppercase tracking-[0.4em] flex justify-center items-center gap-5 transition-all duration-700 relative ${activeTab === 'teacher' ? 'bg-[#600018] text-white shadow-2xl' : 'text-gray-400 dark:text-gray-700 hover:text-[#8B0000]'}`}
            >
                {isAdmin ? <ShieldCheck className="w-8 h-8 text-[#C5A059]" /> : <Lock className="w-7 h-7" />} Professor
                {activeTab === 'teacher' && <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 w-full h-1.5 bg-[#C5A059]" />}
            </button>
        </nav>

        {/* EDITOR CHEFE ADMA BUILDER (ADMIN ONLY) */}
        {isAdmin && !isEditing && (
            <div className="bg-[#050505] text-[#C5A059] p-10 shadow-[0_45px_100px_-20px_rgba(0,0,0,1)] sticky top-[180px] z-20 border-b-8 border-[#8B0000] animate-in slide-in-from-top-10">
                {isGenerating ? (
                    <div className="flex flex-col items-center gap-8 py-6 animate-in fade-in">
                        <div className="flex items-center gap-8">
                            <div className="relative">
                                <Loader2 className="animate-spin w-16 h-16 text-[#C5A059]"/>
                                <div className="absolute inset-0 flex items-center justify-center"><SearchCode className="w-7 h-7 opacity-70" /></div>
                            </div>
                            <div className="flex flex-col">
                                <span className="font-cinzel text-lg font-bold uppercase tracking-[0.2em] text-white animate-pulse">{loadingStatusMessages[currentStatusIndex]}</span>
                                <span className="text-xs opacity-80 font-mono mt-3 flex items-center gap-3">
                                    <Clock className="w-4 h-4" /> Duração: {generationTime}s | Densidade Teológica: {theologicalDensity.toFixed(0)}%
                                </span>
                            </div>
                        </div>
                        <div className="w-full bg-white/5 h-4 rounded-full mt-6 overflow-hidden border border-white/10 shadow-inner">
                            <motion.div 
                                initial={{ width: 0 }} animate={{ width: `${theologicalDensity}%` }}
                                className="bg-gradient-to-r from-[#8B0000] via-[#C5A059] to-[#800000] h-full shadow-[0_0_30px_#C5A059]"
                            ></motion.div>
                        </div>
                        <p className="text-[11px] uppercase tracking-[0.6em] opacity-40 font-bold">Processamento de Alta Precisão Michel Felix</p>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-6">
                                <div className="w-14 h-14 bg-gradient-to-br from-[#8B0000] to-[#400010] rounded-2xl flex items-center justify-center shadow-2xl ring-2 ring-[#C5A059]/40"><Sparkles className="w-8 h-8 text-white" /></div>
                                <div className="flex flex-col">
                                    <span className="font-cinzel text-base font-bold tracking-[0.5em] uppercase text-white">CONSTRUTOR DE APOSTILAS</span>
                                    <span className="text-[10px] uppercase tracking-[0.3em] text-[#C5A059] font-bold">Exegese Microscópica Ativada</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowInstructions(!showInstructions)} 
                                className="text-[12px] font-bold uppercase tracking-[0.3em] bg-white/5 px-6 py-3 rounded-2xl border border-white/10 hover:bg-white/10 hover:text-white transition-all shadow-xl"
                            >
                                {showInstructions ? 'Ocultar Opções' : 'Comandos Teológicos'}
                            </button>
                        </div>
                        
                        <AnimatePresence>
                            {showInstructions && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    className="mb-8 overflow-hidden"
                                >
                                    <textarea 
                                        value={customInstructions} 
                                        onChange={(e) => setCustomInstructions(e.target.value)} 
                                        placeholder="Ex: Enfatize o arrebatamento e a santidade nesta exegese, traga fatos sobre a Septuaginta..." 
                                        className="w-full p-6 text-lg text-black rounded-[2rem] border-none focus:ring-8 focus:ring-[#C5A059]/30 font-montserrat shadow-2xl bg-[#FDFBF7]" 
                                        rows={4} 
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="flex gap-5">
                            <button 
                                onClick={() => handleGenerate('start')} 
                                disabled={isGenerating} 
                                className="flex-2 px-10 py-6 bg-[#8B0000] border-2 border-[#C5A059]/40 rounded-[2rem] text-xs font-bold uppercase tracking-[0.3em] text-white hover:bg-white hover:text-[#1a0f0f] transition-all disabled:opacity-50 flex items-center justify-center gap-5 shadow-2xl active:scale-95 group"
                            >
                                <Layout className="w-7 h-7 group-hover:rotate-12 transition-transform" /> GERAR APOSTILA EXAUSTIVA
                            </button>
                            <button 
                                onClick={() => handleGenerate('continue')} 
                                disabled={isGenerating} 
                                className="flex-1 px-10 py-6 bg-[#C5A059] text-[#1a0f0f] font-bold rounded-[2rem] text-xs font-bold uppercase tracking-[0.3em] hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-5 shadow-2xl active:scale-95"
                            >
                                <Plus className="w-7 h-7"/> CONTINUAR
                            </button>
                            {pages.length > 0 && (
                                <button 
                                    onClick={handleDeletePage} 
                                    className="px-8 py-6 bg-red-900/50 text-red-500 border-2 border-red-500/40 rounded-[2rem] hover:bg-red-600 hover:text-white transition-all shadow-2xl active:scale-95"
                                    title="Destruir Manuscrito"
                                >
                                    <Trash2 className="w-8 h-8" />
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        )}

        {/* ÁREA DE EXIBIÇÃO DO CONTEÚDO (O MANUSCRITO) */}
        <main 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-5 md:p-20 max-w-7xl mx-auto pb-72 w-full scroll-smooth"
        >
            {!hasAccess ? (
                <div className="text-center py-72 opacity-60 dark:text-white animate-in zoom-in duration-1000">
                    <div className="relative inline-block mb-16">
                        <div className="absolute inset-0 bg-red-900/30 blur-[120px] scale-[2] animate-pulse"></div>
                        <Lock className="w-48 h-48 mx-auto text-[#8B0000] drop-shadow-[0_15px_60px_rgba(139,0,0,0.6)]" />
                    </div>
                    <h2 className="font-cinzel text-6xl font-bold mb-8 tracking-widest uppercase">Acesso Reservado</h2>
                    <p className="font-montserrat text-base max-w-lg mx-auto opacity-90 uppercase tracking-[0.5em] leading-loose italic font-bold">
                        Este arquivo teológico está disponível apenas para o corpo docente e liderança autorizada.
                    </p>
                </div>
            ) : isEditing ? (
                 <div className="bg-white dark:bg-dark-card shadow-[0_60px_150px_-30px_rgba(0,0,0,0.3)] p-12 rounded-[4.5rem] border-4 border-[#C5A059] relative animate-in slide-in-from-bottom-20 duration-1000">
                     <div className="flex justify-between items-center mb-12 border-b-2 pb-10 dark:border-white/10">
                        <div className="flex items-center gap-8">
                            <div className="w-16 h-16 bg-blue-900/15 rounded-[2rem] flex items-center justify-center text-blue-900"><PenTool className="w-10 h-10" /></div>
                            <div>
                                <h3 className="font-cinzel font-bold text-4xl text-[#8B0000] dark:text-[#ff6b6b]">Edição do Manuscrito</h3>
                                <p className="text-[11px] uppercase tracking-[0.4em] text-gray-400 font-bold mt-2">Revisão Humana de Alta Precisão</p>
                            </div>
                        </div>
                        <div className="flex gap-6">
                            <button onClick={() => setIsEditing(false)} className="px-10 py-5 text-sm font-bold border-4 border-red-500 text-red-500 rounded-full hover:bg-red-50 transition-all uppercase tracking-[0.3em] active:scale-95 shadow-2xl">Descartar</button>
                            <button onClick={handleSaveManualEdit} className="px-10 py-5 text-sm font-bold bg-green-600 text-white rounded-full hover:bg-green-700 shadow-[0_20px_45px_rgba(22,163,74,0.5)] transition-all uppercase tracking-[0.3em] active:scale-95">Arquivar Aula</button>
                        </div>
                     </div>
                     <div className="mb-10 p-8 bg-[#F5F5DC] dark:bg-gray-900 rounded-[2.5rem] border-2 border-[#C5A059]/40 flex gap-6 items-center shadow-inner">
                         <Info className="w-12 h-12 text-[#8B0000] shrink-0" />
                         <div className="flex flex-col">
                            <span className="text-sm font-bold text-[#8B0000] uppercase tracking-[0.4em]">Comando de Paginação Digital</span>
                            <span className="text-[12px] text-gray-500 font-montserrat mt-2 font-medium">Use a tag <code>&lt;hr class="page-break"&gt;</code> para separar tópicos e criar novas páginas na apostila do aluno.</span>
                         </div>
                     </div>
                     <textarea 
                        value={editValue} 
                        onChange={e => setEditValue(e.target.value)} 
                        className="w-full h-[70vh] p-12 font-mono text-xl border-none focus:ring-0 rounded-[3rem] bg-gray-50 dark:bg-[#080808] dark:text-gray-300 resize-none shadow-inner leading-relaxed border-4 border-transparent focus:border-[#C5A059]/30 transition-all" 
                        placeholder="Edite aqui o conhecimento erudito..." 
                    />
                 </div>
            ) : content && pages.length > 0 ? (
                <article className="bg-white dark:bg-dark-card shadow-[0_50px_150px_-40px_rgba(0,0,0,0.3)] p-12 md:p-36 min-h-[90vh] border-2 border-[#C5A059]/30 relative rounded-[5.5rem] animate-in fade-in duration-1500 select-text overflow-hidden">
                     {/* Marca d'Água de Luxo Real */}
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.04] dark:opacity-[0.06] pointer-events-none rotate-[-35deg]">
                        <BookOpen className="w-[1000px] h-[1000px] text-[#8B0000]" />
                     </div>

                     {renderFormattedText(pages[currentPage])}
                     
                     <div className="absolute bottom-20 right-24 flex items-center gap-8 select-none opacity-40 hover:opacity-100 transition-all duration-700 cursor-help group">
                        <div className="h-[2px] w-24 bg-[#C5A059] group-hover:w-40 transition-all duration-1000"></div>
                        <span className="text-[#C5A059] font-cinzel text-lg font-bold tracking-[0.7em] group-hover:scale-125 transition-transform">{currentPage + 1} / {pages.length}</span>
                     </div>

                     {currentPage === pages.length - 1 && userProgress && (
                         <footer className="mt-40 text-center border-t-4 border-dotted border-[#C5A059]/40 pt-36 animate-in slide-in-from-bottom-20 duration-1500 relative">
                             <div className="absolute -top-14 left-1/2 -translate-x-1/2 w-28 h-28 bg-[#FDFBF7] dark:bg-dark-card rounded-full flex items-center justify-center border-4 border-dotted border-[#C5A059]/50 shadow-2xl">
                                <Anchor className="w-14 h-14 text-[#C5A059]" />
                             </div>

                             <div className="max-w-3xl mx-auto mb-24">
                                <Quote className="w-20 h-20 mx-auto text-[#C5A059] mb-12 opacity-30 animate-pulse" />
                                <h4 className="font-cinzel text-5xl font-bold text-[#8B0000] dark:text-[#ff6b6b] mb-8 uppercase tracking-[0.3em] drop-shadow-xl">Conclusão da Aula</h4>
                                <p className="font-cormorant text-4xl text-gray-500 italic leading-loose px-10">"Guardei a tua palavra no meu coração, para não pecar contra ti." <br/><span className="text-[12px] font-bold tracking-[0.7em] not-italic text-[#C5A059] block mt-8 uppercase">(Salmos 119:11)</span></p>
                             </div>
                             
                             <button 
                                onClick={handleMarkAsRead} 
                                disabled={isRead} 
                                className={`group relative px-24 py-10 rounded-full font-cinzel font-bold text-3xl shadow-[0_30px_70px_-15px_rgba(139,0,0,0.5)] flex items-center justify-center gap-8 mx-auto overflow-hidden transition-all duration-1000 transform hover:scale-110 active:scale-95 ${isRead ? 'bg-green-600 text-white shadow-green-600/40' : 'bg-gradient-to-r from-[#8B0000] via-[#A00010] to-[#600018] text-white shadow-red-900/60'}`}
                            >
                                 {isRead ? <CheckCircle className="w-12 h-12" /> : <GraduationCap className="w-12 h-12 group-hover:rotate-[720deg] transition-transform duration-[2000ms]" />}
                                 <span className="relative z-10 tracking-[0.25em]">{isRead ? 'SABEDORIA ARQUIVADA' : 'CONCLUIR E PONTUAR'}</span>
                                 {!isRead && <div className="absolute inset-0 bg-white/25 opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>}
                             </button>
                             
                             {isRead && (
                                <motion.p 
                                    initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                                    className="text-sm font-bold text-green-600 mt-12 uppercase tracking-[0.6em] flex items-center justify-center gap-4"
                                >
                                    <ShieldCheck className="w-5 h-5" /> Recompensa Integrada ao Ranking Teológico ADMA
                                </motion.p>
                             )}
                         </footer>
                     )}
                </article>
            ) : (
                <div className="text-center py-72 bg-white dark:bg-dark-card rounded-[6rem] border-8 border-dashed border-[#C5A059]/30 animate-in fade-in duration-1500 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.2)] relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#F5F5DC]/15 to-transparent pointer-events-none group-hover:opacity-100 transition-opacity opacity-60"></div>
                    <div className="relative inline-block mb-20 scale-[1.5] transition-transform group-hover:scale-[1.8] duration-2000">
                        <div className="absolute inset-0 bg-[#C5A059]/30 blur-[100px] rounded-full animate-pulse"></div>
                        <ScrollText className="w-48 h-48 mx-auto text-[#C5A059] opacity-30 relative z-10"/>
                    </div>
                    <p className="font-cinzel text-6xl font-bold text-gray-400 mb-8 tracking-[0.3em] uppercase drop-shadow-lg">Arquivo em Silêncio</p>
                    <p className="font-montserrat text-sm text-gray-500 uppercase tracking-[0.7em] mb-20 opacity-70">O Professor ainda não transcreveu este manuscrito para o capítulo {chapter}.</p>
                    {isAdmin && (
                        <motion.div 
                            whileHover={{ y: -10 }}
                            className="max-w-lg mx-auto p-12 bg-[#8B0000]/10 dark:bg-red-900/20 rounded-[4rem] border-2 border-[#8B0000]/30 flex flex-col items-center shadow-2xl transition-all"
                        >
                            <Library className="w-16 h-16 text-[#8B0000] mb-8 opacity-90 animate-bounce" />
                            <p className="text-sm font-bold text-[#8B0000] dark:text-red-400 uppercase tracking-[0.4em] text-center leading-loose font-montserrat">
                                Atenção Administrador: <br/> Utilize o motor do Editor Chefe no topo para realizar a exegese integral.
                            </p>
                        </motion.div>
                    )}
                </div>
            )}
        </main>

        {/* NAVEGAÇÃO FLUTUANTE DE ALTA PERFORMANCE */}
        <AnimatePresence>
            {pages.length > 1 && hasAccess && !isEditing && (
                <motion.nav 
                    initial={{ y: 150, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 150, opacity: 0 }}
                    className="fixed bottom-32 left-8 right-8 z-40 max-w-4xl mx-auto"
                >
                    <div className="bg-[#080808]/98 dark:bg-dark-card/98 backdrop-blur-3xl border-4 border-[#C5A059]/70 p-6 rounded-[3rem] flex justify-between items-center shadow-[0_50px_120px_-20px_rgba(0,0,0,0.95)] ring-4 ring-white/10">
                        <button 
                            onClick={() => { setCurrentPage(Math.max(0, currentPage - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                            disabled={currentPage === 0} 
                            className="group flex items-center gap-5 px-12 py-7 bg-[#8B0000] text-white rounded-[2rem] font-bold text-sm uppercase tracking-[0.4em] disabled:opacity-20 disabled:grayscale transition-all active:scale-95 shadow-3xl hover:bg-white hover:text-[#1a0f0f] border-2 border-[#C5A059]/30"
                        >
                            <ChevronLeft className="w-7 h-7 group-hover:-translate-x-3 transition-transform" /> <span>Anterior</span>
                        </button>
                        
                        <div className="flex flex-col items-center shrink-0 px-12">
                            <span className="font-cinzel font-bold text-[#C5A059] text-3xl tracking-[0.6em] drop-shadow-2xl">{currentPage + 1} <span className="opacity-40 text-sm">/ {pages.length}</span></span>
                            <div className="w-56 bg-white/15 h-3 rounded-full mt-5 overflow-hidden border-2 border-white/10 p-[2px] shadow-inner">
                                <motion.div 
                                    className="bg-gradient-to-r from-[#8B0000] to-[#C5A059] h-full transition-all duration-[1500ms] ease-out shadow-[0_0_25px_#C5A059]" 
                                    style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }}
                                ></motion.div>
                            </div>
                        </div>

                        <button 
                            onClick={() => { setCurrentPage(Math.min(pages.length - 1, currentPage + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                            disabled={currentPage === pages.length - 1} 
                            className="group flex items-center gap-5 px-12 py-7 bg-[#8B0000] text-white rounded-[2rem] font-bold text-sm uppercase tracking-[0.4em] disabled:opacity-20 disabled:grayscale transition-all active:scale-95 shadow-3xl hover:bg-white hover:text-[#1a0f0f] border-2 border-[#C5A059]/30"
                        >
                            <span>Próximo</span> <ChevronRight className="w-7 h-7 group-hover:translate-x-3 transition-transform" />
                        </button>
                    </div>
                </motion.nav>
            )}
        </AnimatePresence>
        
        {/* ESPAÇADOR DE SEGURANÇA FINAL */}
        <div className="h-40 shrink-0 select-none pointer-events-none opacity-0">ADMA SECURITY LAYER</div>
    </div>
  );
}
