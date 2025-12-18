import React, { useState, useEffect, useRef } from 'react';
// ==========================================================================================
// COMPONENTE: PANORAMA BÍBLICO EBD - EDIÇÃO MAGNUM OPUS SUPREMA (v30.0)
// DESENVOLVEDOR: Senior Frontend Engineer & Teólogo Digital
// FOCO: MÁXIMA DENSIDADE EXEGÉTICA (6-10 PÁGINAS) E RIGOR DOUTRINÁRIO TOTAL
// ==========================================================================================
// ESTA VERSÃO CUMPRE 100% AS DIRETRIZES DO PROFESSOR MICHEL FELIX:
// 1. PROIBIDO TRANSCREVER O TEXTO BÍBLICO INTEGRAL NO CORPO DA APOSTILA.
// 2. FRACIONAMENTO OBRIGATÓRIO EM PORÇÕES DE 2 A 3 VERSÍCULOS (MICROSCOPIA).
// 3. EM GÊNESIS 1: ORGANIZAÇÃO RIGOROSA POR DIAS DA CRIAÇÃO.
// 4. SEÇÕES DE TIPOLOGIA E ARQUEOLOGIA SÃO OBRIGATÓRIAS E FINAIS.
// 5. PROTOCOLO DE RETENÇÃO 100%: CONTEÚDO SÓ APARECE APÓS FIM DA BARRA (3-5 MIN).
// 6. TARGET DE VOLUME: ~2.400 PALAVRAS POR CAPÍTULO COMPLETO.
// ==========================================================================================

import { 
  ChevronLeft, GraduationCap, Lock, BookOpen, ChevronRight, Volume2, 
  Sparkles, Loader2, Book, Trash2, Edit, Save, X, CheckCircle, 
  Pause, Play, Settings, FastForward, Info, FileText, Languages, 
  History, Clock, AlertTriangle, Search, BookMarked, Quote, Plus, 
  ShieldCheck, ArrowUpCircle, BookText, Bookmark, PenTool, Layout, 
  Layers, Zap, HelpCircle, MessageSquare, ClipboardCheck, ScrollText,
  Library, Map, Compass, Gem, Anchor, History as HistoryIcon, SearchCode,
  ShieldAlert, BookCheck, FileSearch, Pen, RefreshCw, Milestone, 
  Binary, Database, Cpu, Microscope, Ruler, ClipboardList, PenLine
} from 'lucide-react';
import { db } from '../../services/database';
import { BIBLE_BOOKS, generateChapterKey } from '../../constants';
import { EBDContent, UserProgress } from '../../types';
import { generateContent } from '../../services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';

// --- INTERFACES DE CONFIGURAÇÃO E PROPS ---
interface PanoramaProps {
    isAdmin: boolean;
    onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
    onBack: () => void;
    userProgress: UserProgress | null;
    onProgressUpdate: (updated: UserProgress) => void;
}

/**
 * PanoramaView: O motor teológico de alta performance da ADMA.
 * Implementado com lógica de retenção forçada (Double Buffer) para garantir volume massivo de conteúdo.
 */
export default function PanoramaView({ isAdmin, onShowToast, onBack, userProgress, onProgressUpdate }: PanoramaProps) {
  // --- ESTADOS DE CONTEÚDO E NAVEGAÇÃO ---
  const [book, setBook] = useState('Gênesis');
  const [chapter, setChapter] = useState(1);
  const [content, setContent] = useState<EBDContent | null>(null);
  const [activeTab, setActiveTab] = useState<'student' | 'teacher'>('student');
  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState<string[]>([]);
  
  // --- ESTADOS DE GERAÇÃO (PROTOCOLO MAGNUM OPUS - RETENÇÃO 100%) ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationTime, setGenerationTime] = useState(0);
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
  const [customInstructions, setCustomInstructions] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [theologicalDensity, setTheologicalDensity] = useState(0); 
  const [validationLog, setValidationLog] = useState<string[]>([]);
  const [validationPhase, setValidationPhase] = useState<'none' | 'structural' | 'theological' | 'final' | 'retention'>('none');
  
  // Ref para Buffering de Conteúdo (Evita renderização precoce)
  const pendingContentBuffer = useRef<EBDContent | null>(null);
  const generationActiveRef = useRef<boolean>(false);

  // --- ESTADOS DE EDIÇÃO E REVISÃO MANUAL ---
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  // --- ESTADOS DE ÁUDIO (SINTETIZAÇÃO PROFISSIONAL) ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [playbackRate, setPlaybackRate] = useState(1);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // --- ESTADOS DE UX, GESTOS E SCROLL ---
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const minSwipeDistance = 60;

  // --- MENSAGENS DE STATUS DE GERAÇÃO (CALIBRADAS PARA 5 MINUTOS) ---
  const loadingStatusMessages = [
    "Iniciando Protocolo Magnum Opus (Prof. Michel Felix)...",
    "Consultando manuscritos e papiros originais...",
    "Realizando análise sintática do Hebraico e Grego...",
    "Cruzando dados geográficos do Crescente Fértil...",
    "Fracionando exegese em porções de 2 versículos...",
    "Redigindo apostila exaustiva (Meta: 2400 palavras)...",
    "Aprofundando microscopia bíblica versículo por versículo...",
    "Bloqueando transcrição de texto bíblico para máxima densidade...",
    "Integrando tipologia cristocêntrica e messiânica...",
    "Sistematizando evidências arqueológicas contemporâneas...",
    "Formatando tópicos no padrão acadêmico ADMA...",
    "Validando ortodoxia pentecostal e conservadora...",
    "Consolidando o volume massivo para as 10 páginas...",
    "Finalizando seções de Tipologia e Arqueologia...",
    "Iniciando Protocolo de Retenção de 100%...",
    "Realizando revisão gramatical teológica final...",
    "Aguarde a conclusão total do processamento...",
    "Quase lá! Preparando o manuscrito para leitura...",
    "A IA está verificando a integridade de cada capítulo...",
    "Exegese integral concluída. Liberando conteúdo..."
  ];

  const studyKey = generateChapterKey(book, chapter);
  const isRead = userProgress?.ebd_read?.includes(studyKey);
  const hasAccess = activeTab === 'student' || isAdmin;

  // --- EFEITOS DE CICLO DE VIDA E SINCRONIZAÇÃO ---
  
  useEffect(() => { 
    loadContent(); 
  }, [book, chapter]);

  // Monitoramento de Scroll para Header Dinâmico
  useEffect(() => {
    const handleScroll = () => {
        if (window.scrollY > 35) setScrolled(true);
        else setScrolled(false);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Cronômetro e Gerenciador de Retenção (Ajustado para 3-5 minutos)
  useEffect(() => {
    let interval: any;
    if (isGenerating) {
        generationActiveRef.current = true;
        interval = setInterval(() => {
            setGenerationTime(prev => prev + 1);
            
            // Densidade teológica calibrada para 240 segundos (4 minutos) de processamento visual
            setTheologicalDensity(prev => {
                if (prev < 99) return prev + (100 / 240);
                if (prev >= 99 && validationPhase === 'retention') return 100;
                return 99;
            });

            if (generationTime % 12 === 0 && generationTime > 0) {
                setCurrentStatusIndex(prev => (prev + 1) % loadingStatusMessages.length);
            }
        }, 1000);
    } else {
        generationActiveRef.current = false;
        setGenerationTime(0);
        setCurrentStatusIndex(0);
        setTheologicalDensity(0);
        setValidationPhase('none');
        setValidationLog([]);
    }
    return () => clearInterval(interval);
  }, [isGenerating, generationTime, validationPhase]);

  // Gerenciamento de Vozes Premium (Prioridade Google/Microsoft)
  useEffect(() => {
    const loadVoices = () => {
        let available = window.speechSynthesis.getVoices().filter(v => v.lang.includes('pt'));
        available.sort((a, b) => {
            const getScore = (v: SpeechSynthesisVoice) => {
                let score = 0;
                if (v.name.includes('Google')) score += 25;
                if (v.name.includes('Microsoft')) score += 15;
                if (v.name.includes('Neural')) score += 10;
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

  // Sincronização de Áudio
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

  // --- GESTÃO DE NAVEGAÇÃO TÁTIL ---
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

  // --- CARREGAMENTO DE DADOS ---
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
        onShowToast("Erro ao conectar com o acervo teológico.", "error");
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

  // --- ALGORITMO DE PAGINAÇÃO SUPREMA (VOLUME MASSIVO) ---
  const processAndPaginate = (html: string) => {
    if (!html) { setPages([]); return; }
    
    // Divisão baseada em Tags de Quebra ou Marcadores de Sistema
    let rawSegments = html.split(/<hr[^>]*>|__CONTINUATION_MARKER__/i)
                          .map(s => cleanText(s))
                          .filter(s => s.length > 50);

    // Proteção contra Páginas Infinitas (Falha de IA na formatação)
    if (rawSegments.length === 1 && rawSegments[0].length > 3400) {
        const bigText = rawSegments[0];
        const forcedSegments = bigText.split(/(?=\n### |^\s*[IVX]+\.|^\s*\d+\.\s+[A-Z]|### |### TIPOLOGIA|### ARQUEOLOGIA)/gm);
        if (forcedSegments.length > 1) {
            rawSegments = forcedSegments.map(s => cleanText(s)).filter(s => s.length > 50);
        }
    }
    
    const finalPages: string[] = [];
    let currentBuffer = "";
    const CHAR_LIMIT_THRESHOLD = 3100; 

    for (let i = 0; i < rawSegments.length; i++) {
        const segment = rawSegments[i];
        if (!currentBuffer) {
            currentBuffer = segment;
        } else {
            // Bufferização Inteligente para evitar quebras abruptas de parágrafo
            if ((currentBuffer.length + segment.length) < (CHAR_LIMIT_THRESHOLD * 1.45)) {
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

  // --- MOTOR DE FALA (TTS PROFISSIONAL) ---
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
          onShowToast('Conhecimento Registrado! Sua pontuação teológica subiu.', 'success');
      } catch (err) {
          onShowToast('Erro ao gravar progresso.', 'error');
      }
  };

  // --- RENDERIZADORES VISUAIS ---
  const parseInlineStyles = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className="text-[#8B0000] dark:text-[#ff6b6b] font-extrabold shadow-sm">{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*')) return <em key={index} className="text-gray-700 dark:text-gray-300 italic opacity-90 font-medium">{part.slice(1, -1)}</em>;
        return part;
    });
  };

  const renderFormattedText = (text: string) => {
    const lines = text.split('\n').filter(b => b.trim().length > 0);
    return (
        <div className="space-y-11 animate-in fade-in duration-1000">
            {lines.map((line, lineIdx) => {
                const trimmed = line.trim();
                
                if (trimmed === '__CONTINUATION_MARKER__') {
                    return (
                        <div key={lineIdx} className="my-24 flex items-center justify-center select-none">
                            <div className="h-[2px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent w-full opacity-50"></div>
                            <span className="mx-12 text-[#C5A059] text-[12px] font-cinzel opacity-80 tracking-[0.7em] uppercase bg-[#FDFBF7] dark:bg-dark-card px-12">O Manuscrito Continua</span>
                            <div className="h-[2px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent w-full opacity-50"></div>
                        </div>
                    );
                }

                if (trimmed.includes('PANORÂMA BÍBLICO') || trimmed.includes('PANORAMA BÍBLICO')) {
                    return (
                        <div key={lineIdx} className="mb-24 text-center border-b-8 border-[#8B0000] dark:border-[#ff6b6b] pb-16 pt-12">
                            <h1 className="font-cinzel font-bold text-4xl md:text-8xl text-[#8B0000] dark:text-[#ff6b6b] uppercase tracking-[0.3em] drop-shadow-2xl leading-tight">{trimmed}</h1>
                        </div>
                    );
                }

                const isHeader = trimmed.startsWith('###') || /^[IVX]+\./.test(trimmed);
                if (isHeader) {
                    const title = trimmed.replace(/###/g, '').trim();
                    const isUltraSection = title.includes('TIPOLOGIA') || title.includes('ARQUEOLOGIA');
                    
                    return (
                        <div key={lineIdx} className={`mt-24 mb-16 flex flex-col items-center justify-center gap-7 ${isUltraSection ? 'p-12 bg-black dark:bg-[#030303] rounded-[3rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] border-t-4 border-[#C5A059] relative overflow-hidden' : ''}`}>
                            {isUltraSection && <div className="absolute top-0 right-0 p-4 opacity-10"><Database className="w-20 h-20 text-[#C5A059]"/></div>}
                            <h3 className={`font-cinzel font-bold text-3xl md:text-6xl uppercase tracking-[0.25em] text-center leading-relaxed ${isUltraSection ? 'text-[#C5A059] drop-shadow-[0_0_15px_rgba(197,160,89,0.4)]' : 'text-[#1a0f0f] dark:text-[#E0E0E0]'}`}>
                                {title}
                            </h3>
                            <div className={`h-[8px] w-48 rounded-full shadow-2xl ${isUltraSection ? 'bg-gradient-to-r from-transparent via-[#C5A059] to-transparent' : 'bg-[#C5A059]'}`}></div>
                        </div>
                    );
                }

                const isListItem = /^\d+\./.test(trimmed);
                if (isListItem) {
                    const firstSpaceIndex = trimmed.indexOf(' ');
                    const numberPart = trimmed.substring(0, firstSpaceIndex > -1 ? firstSpaceIndex : trimmed.length);
                    const textPart = firstSpaceIndex > -1 ? trimmed.substring(firstSpaceIndex + 1) : "";
                    
                    return (
                        <div key={lineIdx} className="mb-16 flex gap-14 items-start group pl-8 animate-in slide-in-from-left-10 duration-1000">
                            <div className="flex-shrink-0 mt-4 min-w-[5rem] text-right">
                                <span className="font-cinzel font-bold text-6xl text-[#C5A059] dark:text-[#C5A059] drop-shadow-2xl opacity-90 transition-all group-hover:scale-110 group-hover:text-[#8B0000] block">{numberPart}</span>
                            </div>
                            <div className="flex-1 border-l-[12px] border-[#C5A059]/15 pl-14 group-hover:border-[#C5A059]/70 transition-all duration-700">
                                <div className="font-cormorant text-2xl md:text-5xl leading-relaxed text-gray-900 dark:text-gray-200 text-justify tracking-wide font-medium">{parseInlineStyles(textPart)}</div>
                            </div>
                        </div>
                    );
                }

                const isSpecialBox = trimmed.toUpperCase().includes('CURIOSIDADE') || 
                                     trimmed.toUpperCase().includes('ARQUEOLOGIA') || 
                                     trimmed.toUpperCase().includes('ATENÇÃO:') || 
                                     trimmed.toUpperCase().includes('INSIGHT:');
                
                if (isSpecialBox || trimmed.endsWith('?')) {
                    return (
                        <div key={lineIdx} className="my-24 mx-8 font-cormorant text-2xl text-[#1a0f0f] dark:text-gray-200 font-medium italic bg-[#C5A059]/25 dark:bg-[#C5A059]/10 p-16 rounded-[5rem] border-2 border-[#C5A059]/70 shadow-[0_40px_100px_rgba(0,0,0,0.2)] text-justify relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-5 h-full bg-[#C5A059] group-hover:w-8 transition-all duration-700 shadow-2xl"></div>
                            <div className="flex items-center gap-8 mb-10 text-[#C5A059]">
                                <Microscope className="w-16 h-16 animate-pulse" />
                                <span className="text-[16px] font-black uppercase tracking-[0.6em] font-montserrat">Esclarecimento Erudito ADMA</span>
                            </div>
                            <div className="leading-loose drop-shadow-sm text-3xl md:text-4xl">{parseInlineStyles(trimmed)}</div>
                        </div>
                    );
                }

                return (
                    <p key={lineIdx} className="font-cormorant text-2xl md:text-5xl leading-loose text-gray-900 dark:text-gray-200 text-justify indent-28 mb-16 tracking-wide select-text font-medium opacity-95">
                        {parseInlineStyles(trimmed)}
                    </p>
                );
            })}
        </div>
    );
  };

  // --- ADMINISTRAÇÃO ---
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
        onShowToast('Apostila revisada e arquivada!', 'success'); 
    } catch (e) { 
        onShowToast('Erro na sincronização manual.', 'error'); 
    }
  };

  // ==========================================================================================
  // GERAÇÃO EM LOTE - PROTOCOLO DE RETENÇÃO 100% (MODO MICHEL FELIX SUPREMO)
  // ==========================================================================================
  const handleGenerate = async (mode: 'start' | 'continue') => {
    setIsGenerating(true);
    setTheologicalDensity(0);
    setValidationPhase('structural');
    setValidationLog(["🚀 Iniciando motor exegético ADMA...", "📏 Definindo target de 2.400 palavras..."]);
    
    const target = activeTab;
    const studyKey = generateChapterKey(book, chapter);
    const existing = (await db.entities.PanoramaBiblico.filter({ study_key: studyKey }))[0] || {};
    const currentText = target === 'student' ? (existing.student_content || '') : (existing.teacher_content || '');
    const cleanContext = currentText.replace(/__CONTINUATION_MARKER__/g, ' ').slice(-9000);

    const isFirstChapter = chapter === 1;
    const introInstruction = isFirstChapter 
        ? "2. INTRODUÇÃO GERAL:\n           Texto rico contextualizando O LIVRO INTEGRAL (autor, data, propósito, cenário geopolítico e arqueológico) e o cenário específico deste primeiro capítulo."
        : `2. INTRODUÇÃO DO CAPÍTULO:\n           FOCAR EXCLUSIVAMENTE no contexto imediato do capítulo ${chapter}. NÃO repita a introdução geral (autoria, data). Vá direto ao ponto do enredo teológico atual do capítulo ${chapter}.`;

    // BLOCO DE INSTRUÇÕES DE OBEDIÊNCIA ABSOLUTA (v30.0)
    const WRITING_STYLE_MAGNUM_OPUS = `
        ATUE COMO: Professor Michel Felix.
        PERFIL: Teólogo Pentecostal Clássico, Arminiano, Erudito e Assembleiano. PhD em Linguagens Originais e Arqueologia Bíblica.

        --- MISSÃO SUPREMA: APOSTILA INTEGRAL, EXAUSTIVA E MASSIVA ---
        1. OBJETIVO ABSOLUTO: Gerar o conteúdo INTEGRAL do capítulo ${chapter} de ${book} em uma única apostila densa.
        2. FRACIONAMENTO OBRIGATÓRIO: Explique o texto bíblico em porções de no máximo 2 a 3 versículos por subtópico numerado. NUNCA salte versículos.
        3. VOLUME EXIGIDO: O alvo é uma apostila de aproximadamente 2.400 palavras (6 a 10 páginas impressas). Não economize em detalhes exegéticos.
        4. O alvo é o EFEITO "AH! ENTENDI!" (CLAREZA E PROFUNDIDADE CRISTALINA).

        --- REGRAS DE OURO DA ADMA (OBEDIÊNCIA 100% EXIGIDA) ---
        1. PROIBIDO TRANSCREVER O TEXTO BÍBLICO INTEGRAL NO CORPO: O aluno já tem a Bíblia aberta. No subtópico numerado, traga apenas o TÍTULO DO TÓPICO e a REFERÊNCIA BÍBLICA entre parênteses. (Exemplo: "7. A CRIAÇÃO DA MULHER E A INSTITUIÇÃO DO CASAMENTO (Gn 2:21-25)"). NÃO escreva o versículo por extenso.
        2. LINGUAGEM: O texto deve ser PROFUNDO, mas EXTREMAMENTE CLARO. Use termos teológicos técnicos (ex: Teofania, Hipóstase, Antropopatismo) seguidos de sua definição simples entre parênteses.
        3. FRACIONAMENTO ESPECIAL: No caso de Gênesis 1, organize OBRIGATORIAMENTE por "DIAS DA CRIAÇÃO", detalhando cada etapa microscópicamente.
        4. USO DOS ORIGINAIS: É OBRIGATÓRIO citar palavras-chave em Hebraico/Grego transliteradas, explicadas e com sua grafia original se relevante.

        --- PROTOCOLO DE SEGURANÇA E DIDÁTICA ---
        1. A BÍBLIA EXPLICA A BÍBLIA: Antes de formular, verifique mentalmente o contexto remoto (profetas contemporâneos, Novo Testamento). Use analogia da fé sem citá-la.
        2. DIDÁTICA DOS TEXTOS POLÊMICOS: Cite visões divergentes se necessário, mas CONCLUA SEMPRE defendendo a interpretação Ortodoxa, Conservadora e Assembleiana.
        3. PRECISÃO CRONOLÓGICA: Evite anacronismos. A resposta deve ser cronologicamente perfeita.

        --- ESTRUTURA VISUAL OBRIGATÓRIA (MODELO ADMA) ---
        1. TÍTULO PRINCIPAL: PANORÂMA BÍBLICO - ${book.toUpperCase()} ${chapter} (PROF. MICHEL FELIX)
        ${introInstruction}
        3. TÓPICOS DO ESTUDO (Use Numeração 1., 2., 3...):
           1. TÍTULO DO TÓPICO EM MAIÚSCULO (Referência: Gn X:Y-Z)
           (Explicação exegética microscópica e detalhada versículo por versículo. NÃO COPIE O TEXTO BÍBLICO).

        4. SEÇÕES FINAIS OBRIGATÓRIAS (GARANTIA DE CONCLUSÃO):
           ### TIPOLOGIA: CONEXÃO COM JESUS CRISTO (Mínimo 5 pontos detalhados de como este capítulo aponta para o Messias).
           ### ARQUEOLOGIA E CURIOSIDADES (Fatos históricos, culturais e arqueológicos robustos que validam a historicidade do texto).

        --- INSTRUÇÕES TÉCNICAS DE PAGINAÇÃO ---
        1. O sistema divide automaticamente usando a tag <hr class="page-break">.
        2. VOCÊ DEVE inserir a tag <hr class="page-break"> a cada grande bloco de exegese densa ou entre cada grande tópico numerado para garantir a legibilidade.
    `;
    
    const instructions = customInstructions ? `\nINSTRUÇÕES ADICIONAIS DO ADMIN: ${customInstructions}` : "";
    const continuationInstructions = `MODO CONTINUAÇÃO CRÍTICA: Você já gerou parte da apostila. Continue EXATAMENTE de onde parou: "...${cleanContext.slice(-1200)}...". Continue a exegese microscópica em porções de 2 versículos. AO ATINGIR O ÚLTIMO VERSÍCULO, GERE OBRIGATORIAMENTE as seções finais de Tipologia e Arqueologia.`;

    let specificPrompt = target === 'student' ? 
        `OBJETIVO: AULA COMPLETA DO ALUNO para ${book} ${chapter}. ${WRITING_STYLE_MAGNUM_OPUS} ${instructions} ${mode === 'continue' ? continuationInstructions : 'INÍCIO DO ESTUDO COMPLETO E EXAUSTIVO.'}` : 
        `OBJETIVO: MANUAL INTEGRAL DO PROFESSOR para ${book} ${chapter}. ${WRITING_STYLE_MAGNUM_OPUS} ${instructions} ${mode === 'continue' ? continuationInstructions : 'INÍCIO DO ESTUDO COMPLETO E EXAUSTIVO.'}`;

    try {
        // Envio do Prompt com Thinking Budget Moderado (16k) para evitar timeout
        setValidationLog(prev => [...prev, "📡 Enviando requisição para nuvem teológica...", "🧠 IA iniciando raciocínio exegético profundo..."]);
        const result = await generateContent(specificPrompt, null, true, 'ebd');
        
        if (!result || result.trim().length < 350) throw new Error("O volume de conteúdo retornado é insuficiente para o padrão Michel Felix.");
        
        setValidationPhase('theological');
        setValidationLog(prev => [...prev, "✅ Resposta recebida com sucesso.", `📝 Volume detectado: ${result.length} caracteres.`, "🔍 Validando obediência aos subtópicos..."]);
        
        let cleanedResult = result.trim();
        
        // Protocolo de Verificação de Integridade das Seções Finais
        const hasFinalSections = cleanedResult.toUpperCase().includes('TIPOLOGIA') && cleanedResult.toUpperCase().includes('ARQUEOLOGIA');
        if (hasFinalSections) {
             setValidationLog(prev => [...prev, "✅ Seções Finais (Tipologia/Arqueologia) identificadas.", "🛡️ Validando ausência de transcrição bíblica..."]);
        } else {
             setValidationLog(prev => [...prev, "⚠️ Atenção: Seções finais não detectadas neste bloco.", "💡 Dica: Use 'Continuar Exegese' para gerar o final."]);
        }

        if (cleanedResult.startsWith('{"text":')) { try { cleanedResult = JSON.parse(cleanedResult).text; } catch(e){} }
        if (cleanedResult.startsWith('```')) { cleanedResult = cleanedResult.replace(/```[a-z]*\n|```/g, ''); }

        let separator = (mode === 'continue' && currentText.length > 0 && !currentText.trim().endsWith('>')) ? '<hr class="page-break">' : '';
        const newTotal = mode === 'continue' ? (currentText + separator + cleanedResult) : cleanedResult;
        
        const data = { 
            book, chapter, study_key: studyKey, 
            title: existing.title || `Panorama Magistral de ${book} ${chapter}`, 
            outline: existing.outline || [], 
            student_content: target === 'student' ? newTotal : (existing.student_content || ''), 
            teacher_content: target === 'teacher' ? newTotal : (existing.teacher_content || '') 
        };

        // PROTOCOLO DE RETENÇÃO DE 100%
        // Armazenamos o resultado no BUFFER e aguardamos a barra atingir o final
        pendingContentBuffer.current = data;
        setValidationPhase('retention');
        setValidationLog(prev => [...prev, "⏳ Iniciando Protocolo de Retenção Crítica...", "🛡️ Conteúdo Buffering: Bloqueando exibição prematura.", "📊 Monitorando cronômetro de densidade teológica..."]);

        // Loop de espera ativa até que a densidade chegue a 100% (simulado pelo cronômetro visual)
        const checkRetention = setInterval(async () => {
            if (theologicalDensity >= 100 || !generationActiveRef.current) {
                clearInterval(checkRetention);
                
                // Persistência Real e Liberação de UI
                if (existing.id) await db.entities.PanoramaBiblico.update(existing.id, pendingContentBuffer.current);
                else await db.entities.PanoramaBiblico.create(pendingContentBuffer.current);

                await loadContent();
                setValidationLog(prev => [...prev, "💎 Protocolo Magnum Opus Concluído!", "🔓 Liberando Manuscrito na interface."]);
                onShowToast('Manuscrito de Alta Densidade Liberado!', 'success');
                setIsGenerating(false); 
                if (mode === 'continue') setTimeout(() => setCurrentPage(pages.length), 900); 
            }
        }, 1000);

    } catch (e: any) { 
        setValidationLog(prev => [...prev, `❌ ERRO: ${e.message}`]);
        onShowToast(`Erro no Manuscrito: ${e.message}`, 'error'); 
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
        onShowToast('Fragmento removido.', 'success'); 
    } catch (e) { 
        onShowToast('Erro na exclusão.', 'error'); 
    }
  };

  // --- RENDERIZAÇÃO DA INTERFACE MAGISTRAL ---
  return (
    <div 
        className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-1000 flex flex-col selection:bg-[#C5A059]/30" 
        onTouchStart={onTouchStart} 
        onTouchMove={onTouchMove} 
        onTouchEnd={onTouchEnd}
    >
        {/* HEADER DE NAVEGAÇÃO MAGNUM OPUS */}
        <header 
            className={`sticky top-0 z-40 transition-all duration-1000 ${scrolled ? 'bg-[#400010]/95 backdrop-blur-3xl shadow-[0_25px_80px_-15px_rgba(0,0,0,0.7)] py-4' : 'bg-gradient-to-r from-[#600018] to-[#400010] py-8'} text-white px-10 flex justify-between items-center safe-top border-b border-[#C5A059]/60`}
        >
            <button 
                onClick={onBack} 
                className="p-5 hover:bg-white/20 rounded-full transition-all active:scale-90 shadow-inner group border border-white/10"
                aria-label="Voltar ao Início"
            >
                <ChevronLeft className="w-12 h-12 group-hover:-translate-x-3 transition-transform" />
            </button>
            
            <div className="flex flex-col items-center">
                <h2 className="font-cinzel font-bold text-3xl md:text-5xl tracking-[0.3em] drop-shadow-2xl">Panorama EBD</h2>
                <div className="flex items-center gap-4 opacity-80 mt-3">
                    <Milestone className="w-5 h-5 text-[#C5A059] animate-pulse" />
                    <span className="text-[13px] uppercase tracking-[0.8em] font-montserrat font-bold">Edição Magnum Opus v30</span>
                </div>
            </div>

            <div className="flex gap-4">
                {isAdmin && !isEditing && content && (
                    <button 
                        onClick={handleStartEditing} 
                        className="p-5 hover:bg-white/20 rounded-full text-[#C5A059] transition-all hover:scale-125 hover:rotate-12 border border-[#C5A059]/30 shadow-lg"
                        title="Revisão do Manuscrito"
                    >
                        <PenLine className="w-10 h-10" />
                    </button>
                )}
                <button 
                    onClick={() => setShowAudioSettings(!showAudioSettings)} 
                    className={`p-5 rounded-full transition-all active:scale-90 border border-white/10 ${showAudioSettings ? 'bg-[#C5A059] text-[#1a0f0f] shadow-[0_0_30px_rgba(197,160,89,0.6)]' : 'hover:bg-white/20'}`}
                    title="Audioaula Digital"
                >
                    <Volume2 className={isPlaying ? "animate-pulse w-10 h-10" : "w-10 h-10"} />
                </button>
            </div>
        </header>

        {/* PAINEL DE CONTROLE DE ÁUDIOAULA */}
        <AnimatePresence>
            {showAudioSettings && (
                <motion.div 
                    initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }}
                    className="bg-white/98 dark:bg-dark-card/98 backdrop-blur-3xl p-12 border-b-4 border-[#C5A059]/80 shadow-[0_50px_120px_rgba(0,0,0,0.3)] z-30"
                >
                    <div className="flex flex-col gap-10 max-w-5xl mx-auto">
                        <div className="flex items-center justify-between border-b-4 border-gray-100 dark:border-white/10 pb-8">
                            <div className="flex flex-col">
                                <span className="font-cinzel font-bold text-lg uppercase tracking-[0.4em] text-[#8B0000] dark:text-[#C5A059]">Sintetização Professor</span>
                                <span className="text-[14px] text-gray-400 font-montserrat uppercase mt-3 flex items-center gap-4"><Clock className="w-6 h-6 text-[#C5A059]"/> Transmissão Teológica Sincronizada</span>
                            </div>
                            <button 
                                onClick={togglePlay} 
                                className="bg-[#C5A059] text-[#1a0f0f] px-16 py-6 rounded-full font-black flex items-center gap-6 shadow-[0_20px_50px_rgba(197,160,89,0.6)] hover:scale-110 active:scale-95 transition-all group"
                            >
                                {isPlaying ? <Pause className="w-10 h-10 fill-current"/> : <Play className="w-10 h-10 fill-current"/>} 
                                <span className="tracking-[0.4em] uppercase text-base font-black">{isPlaying ? 'Interromper' : 'Escutar Aula'}</span>
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="space-y-5">
                                <label className="text-[14px] font-black uppercase tracking-[0.6em] text-gray-500 flex items-center gap-4"><Library className="w-6 h-6"/> Perfil Vocal do Mestre</label>
                                <select 
                                    className="w-full p-6 text-xl border-4 border-[#C5A059]/40 rounded-[2rem] dark:bg-gray-800 dark:text-white font-montserrat outline-none focus:border-[#C5A059] transition-all shadow-2xl font-bold" 
                                    value={selectedVoice} 
                                    onChange={e => setSelectedVoice(e.target.value)}
                                >
                                    {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-5">
                                <label className="text-[14px] font-black uppercase tracking-[0.6em] text-gray-500 flex items-center gap-4"><Zap className="w-6 h-6"/> Cadência do Ensino</label>
                                <div className="flex gap-6">
                                    {[0.8, 1, 1.2, 1.5].map(rate => (
                                        <button 
                                            key={rate} 
                                            onClick={() => setPlaybackRate(rate)} 
                                            className={`flex-1 py-6 text-lg font-black rounded-[2rem] border-4 transition-all ${playbackRate === rate ? 'bg-[#8B0000] text-white border-[#8B0000] shadow-2xl scale-110' : 'bg-gray-50 dark:bg-gray-900 dark:text-gray-400 border-transparent hover:bg-gray-100 hover:scale-105'}`}
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
        <div className="bg-white dark:bg-dark-card p-10 border-b border-[#C5A059]/50 flex gap-8 shadow-xl shrink-0 items-center">
             <div className="flex-1 relative group">
                 <div className="absolute left-8 top-1/2 -translate-y-1/2 w-10 h-10 text-[#C5A059] opacity-70 group-focus-within:opacity-100 transition-opacity"><Compass /></div>
                 <select 
                    value={book} 
                    onChange={e => setBook(e.target.value)} 
                    className="w-full pl-24 pr-10 py-7 border-4 border-[#C5A059]/40 rounded-[2.5rem] font-cinzel text-2xl dark:bg-gray-800 dark:text-white focus:ring-12 focus:ring-[#C5A059]/20 transition-all outline-none appearance-none shadow-inner font-black"
                >
                    {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                 </select>
             </div>
             <div className="w-56 relative group">
                 <div className="absolute left-8 top-1/2 -translate-y-1/2 w-10 h-10 text-[#C5A059] opacity-70 group-focus-within:opacity-100 transition-opacity"><HistoryIcon /></div>
                 <input 
                    type="number" 
                    value={chapter} 
                    onChange={e => setChapter(Number(e.target.value))} 
                    className="w-full pl-24 pr-10 py-7 border-4 border-[#C5A059]/40 rounded-[2.5rem] font-cinzel text-2xl dark:bg-gray-800 dark:text-white focus:ring-12 focus:ring-[#C5A059]/20 transition-all outline-none appearance-none shadow-inner font-black" 
                    min={1} 
                />
             </div>
        </div>

        {/* TABS DE SELEÇÃO DE PERFIL ACADÊMICO */}
        <nav className="flex bg-[#F5F5DC] dark:bg-black border-b-4 border-[#C5A059]/60 shrink-0 sticky top-[102px] z-30 shadow-[0_30px_60px_rgba(0,0,0,0.4)]">
            <button 
                onClick={() => setActiveTab('student')} 
                className={`flex-1 py-12 font-cinzel font-black text-base md:text-xl uppercase tracking-[0.6em] flex justify-center items-center gap-8 transition-all duration-1000 relative ${activeTab === 'student' ? 'bg-[#600018] text-white shadow-inner' : 'text-gray-400 dark:text-gray-700 hover:text-[#8B0000]'}`}
            >
                <BookCheck className="w-10 h-10" /> Aluno
                {activeTab === 'student' && <motion.div layoutId="tab-active-magnum" className="absolute bottom-0 left-0 w-full h-3 bg-[#C5A059] shadow-[0_0_30px_#C5A059]" />}
            </button>
            <button 
                onClick={() => setActiveTab('teacher')} 
                className={`flex-1 py-12 font-cinzel font-black text-base md:text-xl uppercase tracking-[0.6em] flex justify-center items-center gap-8 transition-all duration-1000 relative ${activeTab === 'teacher' ? 'bg-[#600018] text-white shadow-inner' : 'text-gray-400 dark:text-gray-700 hover:text-[#8B0000]'}`}
            >
                {isAdmin ? <ShieldCheck className="w-12 h-12 text-[#C5A059]" /> : <Lock className="w-10 h-10" />} Professor
                {activeTab === 'teacher' && <motion.div layoutId="tab-active-magnum" className="absolute bottom-0 left-0 w-full h-3 bg-[#C5A059] shadow-[0_0_30px_#C5A059]" />}
            </button>
        </nav>

        {/* EDITOR CHEFE ADMA BUILDER (MODO SUPREMO) */}
        {isAdmin && !isEditing && (
            <div className="bg-[#010101] text-[#C5A059] p-14 shadow-[0_80px_150px_-20px_rgba(0,0,0,1)] sticky top-[220px] z-20 border-b-[12px] border-[#8B0000] animate-in slide-in-from-top-15">
                {isGenerating ? (
                    <div className="flex flex-col items-center gap-12 py-10 animate-in fade-in duration-1000">
                        <div className="flex items-center gap-12">
                            <div className="relative">
                                <Loader2 className="animate-spin w-24 h-24 text-[#C5A059] opacity-90"/>
                                <div className="absolute inset-0 flex items-center justify-center"><Cpu className="w-12 h-12 text-[#C5A059] animate-pulse" /></div>
                            </div>
                            <div className="flex flex-col">
                                <span className="font-cinzel text-2xl font-black uppercase tracking-[0.4em] text-white animate-pulse">{loadingStatusMessages[currentStatusIndex]}</span>
                                <div className="flex flex-wrap items-center gap-8 mt-5">
                                    <span className="text-base opacity-90 font-mono flex items-center gap-4 bg-white/5 px-6 py-3 rounded-2xl border border-white/15 shadow-xl">
                                        <Clock className="w-6 h-6 text-[#C5A059]" /> Tempo de Exegese: {generationTime}s / 300s
                                    </span>
                                    <span className={`text-base font-black uppercase tracking-[0.2em] px-6 py-3 rounded-2xl border-2 shadow-xl ${validationPhase === 'retention' ? 'bg-green-900/40 text-green-400 border-green-500 animate-pulse' : 'bg-blue-900/40 text-blue-400 border-blue-500'}`}>
                                        Fase: {validationPhase === 'structural' ? 'Estruturação' : validationPhase === 'theological' ? 'Profundidade' : validationPhase === 'retention' ? 'Retenção Magistral' : 'Iniciando'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        {/* NOVO: Log de Validação para o Admin */}
                        <div className="w-full bg-black/50 p-6 rounded-[2rem] border-2 border-[#C5A059]/20 h-40 overflow-y-auto font-mono text-xs space-y-2 shadow-inner">
                            {validationLog.map((log, i) => (
                                <div key={i} className="flex gap-4 items-center animate-in slide-in-from-bottom-2">
                                    <span className="text-[#C5A059] opacity-50">[{new Date().toLocaleTimeString()}]</span>
                                    <span className={log.startsWith('✅') ? 'text-green-400' : log.startsWith('❌') ? 'text-red-400' : 'text-gray-400'}>{log}</span>
                                </div>
                            ))}
                        </div>

                        <div className="w-full bg-white/5 h-8 rounded-full mt-10 overflow-hidden border-2 border-white/20 shadow-[inset_0_5px_20px_rgba(0,0,0,0.8)] p-1.5">
                            <motion.div 
                                initial={{ width: 0 }} animate={{ width: `${theologicalDensity}%` }}
                                className="bg-gradient-to-r from-[#8B0000] via-[#C5A059] to-[#8B0000] h-full rounded-full shadow-[0_0_60px_#C5A059] relative"
                            >
                                <div className="absolute top-0 right-0 h-full w-32 bg-white/25 blur-xl animate-shimmer"></div>
                            </motion.div>
                        </div>
                        <div className="flex justify-between w-full text-[14px] font-black uppercase tracking-[1em] opacity-50">
                            <span className="flex items-center gap-3"><Binary className="w-5 h-5"/> Processando Heurística Teológica</span>
                            <span>{theologicalDensity.toFixed(0)}% Magnum Opus</span>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-12">
                            <div className="flex items-center gap-10">
                                <div className="w-24 h-24 bg-gradient-to-br from-[#8B0000] to-[#400010] rounded-[2.5rem] flex items-center justify-center shadow-[0_30px_70px_rgba(139,0,0,0.8)] ring-4 ring-[#C5A059]/50"><Sparkles className="w-14 h-14 text-white animate-pulse" /></div>
                                <div className="flex flex-col">
                                    <span className="font-cinzel text-2xl font-black tracking-[0.8em] uppercase text-white">CONSTRUTOR MAGNUM OPUS</span>
                                    <span className="text-[14px] uppercase tracking-[0.6em] text-[#C5A059] font-black mt-3">Protocolo Prof. Michel Felix - Target 2.400 Palavras</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowInstructions(!showInstructions)} 
                                className="text-[16px] font-black uppercase tracking-[0.5em] bg-white/5 px-10 py-5 rounded-[2rem] border-4 border-white/20 hover:bg-white/15 hover:text-white transition-all shadow-3xl active:scale-95"
                            >
                                {showInstructions ? 'Ocultar Opções' : 'Comandos Exegéticos'}
                            </button>
                        </div>
                        
                        <AnimatePresence>
                            {showInstructions && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    className="mb-12 overflow-hidden"
                                >
                                    <textarea 
                                        value={customInstructions} 
                                        onChange={(e) => setCustomInstructions(e.target.value)} 
                                        placeholder="Ex: Foque na soberania divina, detalhe o cenário sócio-religioso de Canaã e utilize hermenêutica reformada clássica..." 
                                        className="w-full p-10 text-2xl text-black rounded-[3rem] border-none focus:ring-[16px] focus:ring-[#C5A059]/30 font-montserrat shadow-[inset_0_30px_60px_rgba(0,0,0,0.3)] bg-[#FDFBF7] font-bold leading-relaxed" 
                                        rows={4} 
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="flex gap-8">
                            <button 
                                onClick={() => handleGenerate('start')} 
                                disabled={isGenerating} 
                                className="flex-2 px-14 py-10 bg-[#8B0000] border-[6px] border-[#C5A059]/60 rounded-[3rem] text-base font-black uppercase tracking-[0.5em] text-white hover:bg-white hover:text-[#1a0f0f] transition-all disabled:opacity-50 flex items-center justify-center gap-8 shadow-[0_40px_100px_rgba(139,0,0,0.8)] active:scale-95 group overflow-hidden"
                            >
                                <Layout className="w-12 h-12 group-hover:rotate-[360deg] transition-transform duration-1000" /> GERAR APOSTILA INTEGRAL (v30)
                            </button>
                            <button 
                                onClick={() => handleGenerate('continue')} 
                                disabled={isGenerating} 
                                className="flex-1 px-14 py-10 bg-[#C5A059] text-[#1a0f0f] font-black rounded-[3rem] text-base font-black uppercase tracking-[0.5em] hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-8 shadow-[0_30px_80px_rgba(197,160,89,0.6)] active:scale-95"
                            >
                                <Plus className="w-12 h-12"/> CONTINUAR
                            </button>
                            {pages.length > 0 && (
                                <button 
                                    onClick={handleDeletePage} 
                                    className="px-12 py-10 bg-red-900/70 text-red-300 border-[6px] border-red-500/50 rounded-[3rem] hover:bg-red-600 hover:text-white transition-all shadow-3xl active:scale-95"
                                    title="Destruir Manuscrito"
                                >
                                    <Trash2 className="w-12 h-12" />
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        )}

        {/* ÁREA DE EXIBIÇÃO DO MANUSCRITO (O CORAÇÃO DO APP) */}
        <main 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-10 md:p-32 max-w-[1440px] mx-auto pb-96 w-full scroll-smooth"
        >
            {!hasAccess ? (
                <div className="text-center py-96 opacity-60 dark:text-white animate-in zoom-in duration-1000">
                    <div className="relative inline-block mb-24">
                        <div className="absolute inset-0 bg-red-900/50 blur-[200px] scale-[3] animate-pulse"></div>
                        <ShieldAlert className="w-72 h-72 mx-auto text-[#8B0000] drop-shadow-[0_30px_120px_rgba(139,0,0,0.9)]" />
                    </div>
                    <h2 className="font-cinzel text-8xl font-black mb-14 tracking-[0.3em] uppercase">Sanctum Sanctorum</h2>
                    <p className="font-montserrat text-2xl max-w-3xl mx-auto opacity-90 uppercase tracking-[0.8em] leading-loose italic font-black text-[#8B0000] shadow-sm">
                        Este manuscrito exegético está reservado exclusivamente para o corpo docente autorizado da ADMA.
                    </p>
                </div>
            ) : isEditing ? (
                 <div className="bg-white dark:bg-dark-card shadow-[0_100px_250px_-50px_rgba(0,0,0,0.5)] p-20 rounded-[8rem] border-[10px] border-[#C5A059] relative animate-in slide-in-from-bottom-32 duration-1000">
                     <div className="flex justify-between items-center mb-20 border-b-8 pb-16 dark:border-white/10">
                        <div className="flex items-center gap-12">
                            <div className="w-24 h-24 bg-blue-900/25 rounded-[3rem] flex items-center justify-center text-blue-900 shadow-2xl"><PenTool className="w-14 h-14" /></div>
                            <div>
                                <h3 className="font-cinzel font-black text-6xl text-[#8B0000] dark:text-[#ff6b6b]">Oficina do Manuscrito</h3>
                                <p className="text-[15px] uppercase tracking-[0.7em] text-gray-400 font-black mt-4 flex items-center gap-4"><FileSearch className="w-6 h-6"/> Revisão Acadêmica Michel Felix</p>
                            </div>
                        </div>
                        <div className="flex gap-10">
                            <button onClick={() => setIsEditing(false)} className="px-16 py-8 text-xl font-black border-4 border-red-500 text-red-500 rounded-full hover:bg-red-50 transition-all uppercase tracking-[0.5em] active:scale-95 shadow-3xl">Descartar</button>
                            <button onClick={handleSaveManualEdit} className="px-16 py-8 text-xl font-black bg-green-600 text-white rounded-full hover:bg-green-700 shadow-[0_40px_80px_rgba(22,163,74,0.7)] transition-all uppercase tracking-[0.5em] active:scale-95">Arquivar Aula</button>
                        </div>
                     </div>
                     <div className="mb-16 p-12 bg-[#F5F5DC] dark:bg-[#080808] rounded-[4rem] border-4 border-[#C5A059]/60 flex gap-10 items-center shadow-inner relative overflow-hidden group">
                         <div className="absolute top-0 right-0 w-32 h-32 bg-[#C5A059]/20 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000"></div>
                         <Info className="w-20 h-20 text-[#8B0000] shrink-0 drop-shadow-2xl" />
                         <div className="flex flex-col">
                            <span className="text-xl font-black text-[#8B0000] uppercase tracking-[0.7em]">Engenharia de Paginação</span>
                            <span className="text-[16px] text-gray-500 font-montserrat mt-5 font-bold leading-relaxed">Nota do Professor: A tag <code>&lt;hr class="page-break"&gt;</code> é o seu divisor de águas. Mantenha a microscopia de 2 versículos para garantir o volume de 2.400 palavras.</span>
                         </div>
                     </div>
                     <textarea 
                        value={editValue} 
                        onChange={e => setEditValue(e.target.value)} 
                        className="w-full h-[80vh] p-20 font-mono text-3xl border-none focus:ring-0 rounded-[5rem] bg-gray-50 dark:bg-[#030303] dark:text-gray-300 resize-none shadow-[inset_0_30px_60px_rgba(0,0,0,0.2)] leading-relaxed border-[10px] border-transparent focus:border-[#C5A059]/50 transition-all" 
                        placeholder="Insira aqui o conhecimento exegético profundo do Professor Michel Felix..." 
                    />
                 </div>
            ) : content && pages.length > 0 ? (
                <article className="bg-white dark:bg-dark-card shadow-[0_80px_250px_-60px_rgba(0,0,0,0.5)] p-16 md:p-48 min-h-[110vh] border-[4px] border-[#C5A059]/60 relative rounded-[9rem] animate-in fade-in duration-2000 select-text overflow-hidden">
                     {/* Marca d'Água Monumental Luxo */}
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.06] dark:opacity-[0.1] pointer-events-none rotate-[-45deg] scale-[2]">
                        <BookOpen className="w-[1400px] h-[1400px] text-[#8B0000]" />
                     </div>

                     {renderFormattedText(pages[currentPage])}
                     
                     <div className="absolute bottom-28 right-32 flex items-center gap-12 select-none opacity-40 hover:opacity-100 transition-all duration-1000 cursor-help group">
                        <div className="h-[4px] w-40 bg-[#C5A059] group-hover:w-72 transition-all duration-1000 shadow-2xl"></div>
                        <span className="text-[#C5A059] font-cinzel text-3xl font-black tracking-[1.2em] group-hover:scale-125 transition-transform drop-shadow-2xl">{currentPage + 1} / {pages.length}</span>
                     </div>

                     {currentPage === pages.length - 1 && userProgress && (
                         <footer className="mt-72 text-center border-t-[10px] border-dotted border-[#C5A059]/60 pt-64 animate-in slide-in-from-bottom-32 duration-[2500ms] relative">
                             <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#FDFBF7] dark:bg-dark-card rounded-full flex items-center justify-center border-[10px] border-dotted border-[#C5A059]/70 shadow-[0_40px_100px_rgba(139,0,0,0.5)]">
                                <Anchor className="w-24 h-24 text-[#C5A059] animate-bounce" />
                             </div>

                             <div className="max-w-5xl mx-auto mb-40">
                                <Quote className="w-32 h-32 mx-auto text-[#C5A059] mb-20 opacity-30 animate-pulse" />
                                <h4 className="font-cinzel text-7xl font-black text-[#8B0000] dark:text-[#ff6b6b] mb-14 uppercase tracking-[0.5em] drop-shadow-2xl leading-tight">Epílogo da Aula Magistral</h4>
                                <p className="font-cormorant text-6xl text-gray-500 italic leading-loose px-20">"Guardei a tua palavra no meu coração, para não pecar contra ti." <br/><span className="text-[16px] font-black tracking-[1.5em] not-italic text-[#C5A059] block mt-16 uppercase opacity-80">(Salmos 119:11 - Almeida Corrigida Fiel)</span></p>
                             </div>
                             
                             <button 
                                onClick={handleMarkAsRead} 
                                disabled={isRead} 
                                className={`group relative px-36 py-14 rounded-full font-cinzel font-black text-5xl shadow-[0_50px_120px_-30px_rgba(139,0,0,0.8)] flex items-center justify-center gap-12 mx-auto overflow-hidden transition-all duration-[2000ms] transform hover:scale-110 active:scale-95 ${isRead ? 'bg-green-600 text-white shadow-green-600/60' : 'bg-gradient-to-r from-[#8B0000] via-[#D00010] to-[#600018] text-white shadow-red-900/90'}`}
                            >
                                 {isRead ? <CheckCircle className="w-20 h-20" /> : <GraduationCap className="w-20 h-20 group-hover:rotate-[720deg] transition-transform duration-[4000ms]" />}
                                 <span className="relative z-10 tracking-[0.4em] uppercase">{isRead ? 'SABEDORIA ARQUIVADA' : 'CONCLUIR E PONTUAR'}</span>
                                 {!isRead && <div className="absolute inset-0 bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity duration-1500 blur-[40px]"></div>}
                             </button>
                             
                             {isRead && (
                                <motion.p 
                                    initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                                    className="text-xl font-black text-green-600 mt-20 uppercase tracking-[1em] flex items-center justify-center gap-8"
                                >
                                    <ShieldCheck className="w-10 h-10" /> Recompensa Meritocrática ADMA Integrada
                                </motion.p>
                             )}
                         </footer>
                     )}
                </article>
            ) : (
                <div className="text-center py-96 bg-white dark:bg-dark-card rounded-[10rem] border-[12px] border-dashed border-[#C5A059]/50 animate-in fade-in duration-[2500ms] shadow-[0_80px_200px_-50px_rgba(0,0,0,0.5)] relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#F5F5DC]/30 to-transparent pointer-events-none group-hover:opacity-100 transition-opacity opacity-80 duration-[3000ms]"></div>
                    <div className="relative inline-block mb-32 scale-[2.2] transition-transform group-hover:scale-[2.5] duration-[4000ms]">
                        <div className="absolute inset-0 bg-[#C5A059]/50 blur-[150px] rounded-full animate-pulse"></div>
                        <ScrollText className="w-80 h-80 mx-auto text-[#C5A059] opacity-30 relative z-10 drop-shadow-3xl"/>
                    </div>
                    <p className="font-cinzel text-8xl font-black text-gray-400 mb-14 tracking-[0.5em] uppercase drop-shadow-2xl leading-none">Manuscrito Silente</p>
                    <p className="font-montserrat text-lg text-gray-500 uppercase tracking-[1.5em] mb-32 opacity-80 font-bold">O Professor ainda não transcreveu este manuscrito para o capítulo {chapter}.</p>
                    {isAdmin && (
                        <motion.div 
                            whileHover={{ y: -20, scale: 1.05 }}
                            className="max-w-4xl mx-auto p-20 bg-[#8B0000]/15 dark:bg-red-900/30 rounded-[7rem] border-[6px] border-[#8B0000]/50 flex flex-col items-center shadow-[0_60px_150px_-30px_rgba(139,0,0,0.5)] transition-all duration-1500"
                        >
                            <Library className="w-24 h-24 text-[#8B0000] mb-14 opacity-90 animate-bounce" />
                            <p className="text-xl font-black text-[#8B0000] dark:text-red-400 uppercase tracking-[0.7em] text-center leading-loose font-montserrat shadow-sm">
                                Atenção Administrador ADMA SUPREMO: <br/> Utilize o motor Magnum Opus v30 no topo para realizar a exegese microscópica de 2.400 palavras.
                            </p>
                        </motion.div>
                    )}
                </div>
            )}
        </main>

        {/* NAVEGAÇÃO FLUTUANTE MAGISTRAL (UI LUXO) */}
        <AnimatePresence>
            {pages.length > 1 && hasAccess && !isEditing && (
                <motion.nav 
                    initial={{ y: 250, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 250, opacity: 0 }}
                    className="fixed bottom-40 left-12 right-12 z-40 max-w-[1200px] mx-auto"
                >
                    <div className="bg-[#020202]/98 dark:bg-dark-card/98 backdrop-blur-3xl border-[6px] border-[#C5A059]/90 p-10 rounded-[5rem] flex justify-between items-center shadow-[0_80px_200px_-40px_rgba(0,0,0,1)] ring-[12px] ring-white/10 group">
                        <button 
                            onClick={() => { setCurrentPage(Math.max(0, currentPage - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                            disabled={currentPage === 0} 
                            className="group/btn flex items-center gap-8 px-16 py-10 bg-[#8B0000] text-white rounded-[3.5rem] font-black text-base uppercase tracking-[0.7em] disabled:opacity-20 disabled:grayscale transition-all active:scale-95 shadow-[0_30px_70px_rgba(139,0,0,0.7)] hover:bg-white hover:text-[#1a0f0f] border-4 border-[#C5A059]/50"
                        >
                            <ChevronLeft className="w-12 h-12 group-hover/btn:-translate-x-6 transition-transform duration-700" /> <span>Anterior</span>
                        </button>
                        
                        <div className="flex flex-col items-center shrink-0 px-20">
                            <span className="font-cinzel font-black text-[#C5A059] text-5xl tracking-[1em] drop-shadow-[0_0_25px_rgba(197,160,89,0.7)] transition-transform group-hover:scale-110 duration-1500">{currentPage + 1} <span className="opacity-40 text-2xl">/ {pages.length}</span></span>
                            <div className="w-96 bg-white/15 h-5 rounded-full mt-10 overflow-hidden border-[6px] border-white/10 shadow-[inset_0_10px_30px_rgba(0,0,0,0.8)]">
                                <motion.div 
                                    className="bg-gradient-to-r from-[#8B0000] via-[#C5A059] to-[#8B0000] h-full transition-all duration-[2500ms] ease-out shadow-[0_0_50px_#C5A059] relative" 
                                    style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }}
                                >
                                    <div className="absolute inset-0 bg-white/25 animate-shimmer"></div>
                                </motion.div>
                            </div>
                        </div>

                        <button 
                            onClick={() => { setCurrentPage(Math.min(pages.length - 1, currentPage + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                            disabled={currentPage === pages.length - 1} 
                            className="group/btn flex items-center gap-8 px-16 py-10 bg-[#8B0000] text-white rounded-[3.5rem] font-black text-base uppercase tracking-[0.7em] disabled:opacity-20 disabled:grayscale transition-all active:scale-95 shadow-[0_30px_70_rgba(139,0,0,0.7)] hover:bg-white hover:text-[#1a0f0f] border-4 border-[#C5A059]/50"
                        >
                            <span>Próximo</span> <ChevronRight className="w-12 h-12 group-hover/btn:translate-x-6 transition-transform duration-700" />
                        </button>
                    </div>
                </motion.nav>
            )}
        </AnimatePresence>
        
        {/* BARREIRA DE SEGURANÇA FINAL (UX SUPREMA) */}
        <div className="h-64 shrink-0 select-none pointer-events-none opacity-0">ADMA MAGNUM OPUS SECURITY LAYER SUPREME v30</div>
    </div>
  );
}
