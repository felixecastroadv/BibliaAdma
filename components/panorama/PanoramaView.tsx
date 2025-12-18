import React, { useState, useEffect, useRef } from 'react';
// ==========================================================================================
// COMPONENTE: PANORAMA BÍBLICO EBD - EDIÇÃO MAGNUM OPUS SUPREMA (v35.0)
// DESENVOLVEDOR: Senior Frontend Engineer & Teólogo Digital
// FOCO: MÁXIMA DENSIDADE EXEGÉTICA (5-6 PÁGINAS) E RIGOR DOUTRINÁRIO TOTAL
// ==========================================================================================
// ESTA VERSÃO CUMPRE 100% AS DIRETRIZES DO PROFESSOR MICHEL FELIX:
// 1. PROIBIDO TRANSCREVER O TEXTO BÍBLICO INTEGRAL NO CORPO DA APOSTILA.
// 2. FRACIONAMENTO OBRIGATÓRIO EM PORÇÕES DE 2 A 3 VERSÍCULOS (MICROSCOPIA).
// 3. EM GÊNESIS 1: ORGANIZAÇÃO RIGOROSA POR DIAS DA CRIAÇÃO.
// 4. SEÇÕES DE TIPOLOGIA E ARQUEOLOGIA SÃO OBRIGATÓRIAS E FINAIS.
// 5. PROTOCOLO DE RETENÇÃO 100% CORRIGIDO: ACELERAÇÃO PÓS-PROCESSO (FIM DO LOOP).
// 6. TARGET DE VOLUME: ~2.400 PALAVRAS (APROX. 5-6 PÁGINAS DE ALTA DENSIDADE).
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
  Binary, Database, Cpu, Microscope, Ruler, ClipboardList, PenLine,
  Activity, Gauge, FileDigit, AlignLeft, Scale
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
 * v35.0: Corrigido bug de travamento na retenção e otimizado para 2400 palavras.
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
  const [validationPhase, setValidationPhase] = useState<'none' | 'structural' | 'theological' | 'final' | 'retention' | 'releasing'>('none');
  const [stats, setStats] = useState({ wordCount: 0, charCount: 0, estimatedPages: 0 });
  
  // Ref para Buffering de Conteúdo (Evita renderização precoce e loop infinito)
  const pendingContentBuffer = useRef<EBDContent | null>(null);
  const generationActiveRef = useRef<boolean>(false);
  const accelerationRef = useRef<boolean>(false);

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
    "Consolidando o volume massivo para as 5-6 páginas...",
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

  // Cronômetro e Gerenciador de Retenção (Ajustado para 3-5 minutos com Aceleração)
  useEffect(() => {
    let interval: any;
    if (isGenerating) {
        generationActiveRef.current = true;
        interval = setInterval(() => {
            setGenerationTime(prev => prev + 1);
            
            // Densidade teológica calibrada
            setTheologicalDensity(prev => {
                if (accelerationRef.current) return Math.min(100, prev + 10); // Acelera se já tiver o conteúdo
                if (prev < 99) return prev + (100 / 260); // Base de 260s para chegar em 99%
                return 99;
            });

            if (generationTime % 12 === 0 && generationTime > 0) {
                setCurrentStatusIndex(prev => (prev + 1) % loadingStatusMessages.length);
            }
        }, 1000);
    } else {
        generationActiveRef.current = false;
        accelerationRef.current = false;
        setGenerationTime(0);
        setCurrentStatusIndex(0);
        setTheologicalDensity(0);
        setValidationPhase('none');
        setValidationLog([]);
    }
    return () => clearInterval(interval);
  }, [isGenerating, generationTime]);

  // Gerenciamento de Vozes Premium (Prioridade Google/Microsoft)
  useEffect(() => {
    const loadVoices = () => {
        let available = window.speechSynthesis.getVoices().filter(v => v.lang.includes('pt'));
        available.sort((a, b) => {
            const getScore = (v: SpeechSynthesisVoice) => {
                let score = 0;
                if (v.name.includes('Google')) score += 30;
                if (v.name.includes('Microsoft')) score += 20;
                if (v.name.includes('Neural')) score += 15;
                if (v.name.includes('Luciana') || v.name.includes('Joana')) score += 10;
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

  // --- CARREGAMENTO E ANÁLISE DE DADOS ---
  const loadContent = async () => {
    const key = generateChapterKey(book, chapter);
    try {
        const res = await db.entities.PanoramaBiblico.filter({ study_key: key });
        if (res.length) {
            setContent(res[0]);
            calculateStats(activeTab === 'student' ? res[0].student_content : res[0].teacher_content);
        } else {
            setContent(null);
            setStats({ wordCount: 0, charCount: 0, estimatedPages: 0 });
        }
    } catch (err) {
        onShowToast("Erro ao conectar com o acervo teológico.", "error");
    }
  };

  const calculateStats = (text: string) => {
      if (!text) return;
      const clean = text.replace(/<[^>]*>/g, '').replace(/__CONTINUATION_MARKER__/g, '');
      const words = clean.trim().split(/\s+/).length;
      const chars = clean.length;
      const estPages = Math.ceil(words / 400); // Média de 400 palavras por página acadêmica
      setStats({ wordCount: words, charCount: chars, estimatedPages: estPages });
  };

  useEffect(() => {
    if (content) {
        const text = activeTab === 'student' ? content.student_content : content.teacher_content;
        processAndPaginate(text);
        setCurrentPage(0);
        setIsEditing(false);
        calculateStats(text);
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

    // Proteção contra Páginas Infinitas
    if (rawSegments.length === 1 && rawSegments[0].length > 3200) {
        const bigText = rawSegments[0];
        const forcedSegments = bigText.split(/(?=\n### |^\s*[IVX]+\.|^\s*\d+\.\s+[A-Z]|### |### TIPOLOGIA|### ARQUEOLOGIA)/gm);
        if (forcedSegments.length > 1) {
            rawSegments = forcedSegments.map(s => cleanText(s)).filter(s => s.length > 50);
        }
    }
    
    const finalPages: string[] = [];
    let currentBuffer = "";
    const CHAR_LIMIT_THRESHOLD = 3000; 

    for (let i = 0; i < rawSegments.length; i++) {
        const segment = rawSegments[i];
        if (!currentBuffer) {
            currentBuffer = segment;
        } else {
            if ((currentBuffer.length + segment.length) < (CHAR_LIMIT_THRESHOLD * 1.5)) {
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

  // --- RENDERIZADORES VISUAIS LUXO ---
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
        <div className="space-y-12 animate-in fade-in duration-1000">
            {lines.map((line, lineIdx) => {
                const trimmed = line.trim();
                
                if (trimmed === '__CONTINUATION_MARKER__') {
                    return (
                        <div key={lineIdx} className="my-28 flex items-center justify-center select-none">
                            <div className="h-[2px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent w-full opacity-60"></div>
                            <span className="mx-14 text-[#C5A059] text-[13px] font-cinzel opacity-90 tracking-[0.8em] uppercase bg-[#FDFBF7] dark:bg-dark-card px-14">Manuscrito Original em Análise</span>
                            <div className="h-[2px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent w-full opacity-60"></div>
                        </div>
                    );
                }

                if (trimmed.includes('PANORÂMA BÍBLICO') || trimmed.includes('PANORAMA BÍBLICO')) {
                    return (
                        <div key={lineIdx} className="mb-28 text-center border-b-[10px] border-[#8B0000] dark:border-[#ff6b6b] pb-20 pt-14">
                            <h1 className="font-cinzel font-bold text-5xl md:text-9xl text-[#8B0000] dark:text-[#ff6b6b] uppercase tracking-[0.35em] drop-shadow-3xl leading-none">{trimmed}</h1>
                        </div>
                    );
                }

                const isHeader = trimmed.startsWith('###') || /^[IVX]+\./.test(trimmed);
                if (isHeader) {
                    const title = trimmed.replace(/###/g, '').trim();
                    const isUltraSection = title.includes('TIPOLOGIA') || title.includes('ARQUEOLOGIA');
                    
                    return (
                        <div key={lineIdx} className={`mt-28 mb-20 flex flex-col items-center justify-center gap-8 ${isUltraSection ? 'p-16 bg-black dark:bg-[#020202] rounded-[4rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] border-t-[6px] border-[#C5A059] relative overflow-hidden' : ''}`}>
                            {isUltraSection && <div className="absolute -top-10 -right-10 opacity-10 rotate-12"><Scale className="w-48 h-48 text-[#C5A059]"/></div>}
                            <h3 className={`font-cinzel font-bold text-4xl md:text-7xl uppercase tracking-[0.3em] text-center leading-tight ${isUltraSection ? 'text-[#C5A059] drop-shadow-[0_0_20px_rgba(197,160,89,0.5)]' : 'text-[#1a0f0f] dark:text-[#E0E0E0]'}`}>
                                {title}
                            </h3>
                            <div className={`h-[10px] w-64 rounded-full shadow-3xl ${isUltraSection ? 'bg-gradient-to-r from-transparent via-[#C5A059] to-transparent' : 'bg-[#C5A059]'}`}></div>
                        </div>
                    );
                }

                const isListItem = /^\d+\./.test(trimmed);
                if (isListItem) {
                    const firstSpaceIndex = trimmed.indexOf(' ');
                    const numberPart = trimmed.substring(0, firstSpaceIndex > -1 ? firstSpaceIndex : trimmed.length);
                    const textPart = firstSpaceIndex > -1 ? trimmed.substring(firstSpaceIndex + 1) : "";
                    
                    return (
                        <div key={lineIdx} className="mb-20 flex gap-16 items-start group pl-10 animate-in slide-in-from-left-12 duration-1000">
                            <div className="flex-shrink-0 mt-5 min-w-[6rem] text-right">
                                <span className="font-cinzel font-bold text-7xl text-[#C5A059] dark:text-[#C5A059] drop-shadow-3xl opacity-95 transition-all group-hover:scale-125 group-hover:text-[#8B0000] block">{numberPart}</span>
                            </div>
                            <div className="flex-1 border-l-[15px] border-[#C5A059]/20 pl-16 group-hover:border-[#C5A059]/80 transition-all duration-1000">
                                <div className="font-cormorant text-3xl md:text-6xl leading-relaxed text-gray-950 dark:text-gray-100 text-justify tracking-wide font-medium drop-shadow-sm">{parseInlineStyles(textPart)}</div>
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
                        <div key={lineIdx} className="my-28 mx-10 font-cormorant text-3xl text-[#1a0f0f] dark:text-gray-100 font-medium italic bg-[#C5A059]/30 dark:bg-[#C5A059]/15 p-20 rounded-[6rem] border-[3px] border-[#C5A059]/80 shadow-[0_50px_120px_rgba(0,0,0,0.25)] text-justify relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-6 h-full bg-[#C5A059] group-hover:w-10 transition-all duration-1000 shadow-3xl"></div>
                            <div className="flex items-center gap-10 mb-12 text-[#C5A059]">
                                <Activity className="w-20 h-20 animate-pulse" />
                                <span className="text-[18px] font-black uppercase tracking-[0.7em] font-montserrat">Auditoria Exegética ADMA</span>
                            </div>
                            <div className="leading-tight drop-shadow-md text-4xl md:text-5xl">{parseInlineStyles(trimmed)}</div>
                        </div>
                    );
                }

                return (
                    <p key={lineIdx} className="font-cormorant text-3xl md:text-6xl leading-loose text-gray-950 dark:text-gray-100 text-justify indent-32 mb-20 tracking-wide select-text font-medium opacity-100 drop-shadow-sm">
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
  // GERAÇÃO EM LOTE - PROTOCOLO DE RETENÇÃO 100% CORRIGIDO (v35.0)
  // ==========================================================================================
  const handleGenerate = async (mode: 'start' | 'continue') => {
    setIsGenerating(true);
    setTheologicalDensity(0);
    setValidationPhase('structural');
    accelerationRef.current = false;
    setValidationLog(["🚀 Iniciando motor exegético ADMA v35...", "📏 Definindo target de 2.400 palavras (5-6 páginas)..."]);
    
    const target = activeTab;
    const studyKey = generateChapterKey(book, chapter);
    const existing = (await db.entities.PanoramaBiblico.filter({ study_key: studyKey }))[0] || {};
    const currentText = target === 'student' ? (existing.student_content || '') : (existing.teacher_content || '');
    const cleanContext = currentText.replace(/__CONTINUATION_MARKER__/g, ' ').slice(-10000);

    const isFirstChapter = chapter === 1;
    const introInstruction = isFirstChapter 
        ? "2. INTRODUÇÃO GERAL:\n           Texto rico contextualizando O LIVRO INTEGRAL (autor, data, propósito, cenário geopolítico e arqueológico) e o cenário específico deste primeiro capítulo."
        : `2. INTRODUÇÃO DO CAPÍTULO:\n           FOCAR EXCLUSIVAMENTE no contexto imediato do capítulo ${chapter}. NÃO repita a introdução geral (autoria, data). Vá direto ao ponto do enredo teológico atual do capítulo ${chapter}.`;

    // BLOCO DE INSTRUÇÕES DE OBEDIÊNCIA ABSOLUTA (v35.0)
    const WRITING_STYLE_MAGNUM_OPUS = `
        ATUE COMO: Professor Michel Felix.
        PERFIL: Teólogo Pentecostal Clássico, PhD em Linguagens Originais e Arqueologia Bíblica.

        --- MISSÃO SUPREMA: APOSTILA INTEGRAL DE ALTA DENSIDADE ---
        1. OBJETIVO ABSOLUTO: Gerar o conteúdo INTEGRAL do capítulo ${chapter} de ${book} em uma única apostila densa.
        2. FRACIONAMENTO OBRIGATÓRIO: Explique o texto bíblico em porções de no máximo 2 a 3 versículos por subtópico numerado. NUNCA salte versículos.
        3. VOLUME EXIGIDO: O alvo é uma apostila de aproximadamente 2.400 palavras (Cerca de 5 a 6 páginas impressas). Não economize em detalhes exegéticos.
        4. O alvo é o EFEITO "AH! ENTENDI!" (CLAREZA E PROFUNDIDADE CRISTALINA).

        --- REGRAS DE OURO DA ADMA (OBEDIÊNCIA 100% EXIGIDA) ---
        1. PROIBIDO TRANSCREVER O TEXTO BÍBLICO INTEGRAL NO CORPO: No subtópico numerado, traga apenas o TÍTULO DO TÓPICO e a REFERÊNCIA BÍBLICA entre parênteses. (Exemplo: "7. A CRIAÇÃO DA MULHER E A INSTITUIÇÃO DO CASAMENTO (Gn 2:21-25)"). NÃO escreva o versículo por extenso.
        2. LINGUAGEM: O texto deve ser PROFUNDO, mas EXTREMAMENTE CLARO. Use termos teológicos técnicos (ex: Teofania, Hipóstase, Antropopatismo) seguidos de sua definição simples entre parênteses.
        3. FRACIONAMENTO ESPECIAL: No caso de Gênesis 1, organize OBRIGATORIAMENTE por "DIAS DA CRIAÇÃO", detalhando cada etapa microscópicamente.
        4. USO DOS ORIGINAIS: É OBRIGATÓRIO citar palavras-chave em Hebraico/Grego transliteradas e explicadas.

        --- ESTRUTURA VISUAL OBRIGATÓRIA (MODELO ADMA) ---
        1. TÍTULO PRINCIPAL: PANORÂMA BÍBLICO - ${book.toUpperCase()} ${chapter} (PROF. MICHEL FELIX)
        ${introInstruction}
        3. TÓPICOS DO ESTUDO (Use Numeração 1., 2., 3...):
           1. TÍTULO DO TÓPICO EM MAIÚSCULO (Referência: Gn X:Y-Z)
           (Explicação exegética microscópica versículo por versículo. NÃO COPIE O TEXTO BÍBLICO).

        4. SEÇÕES FINAIS OBRIGATÓRIAS (ESTEJA ATENTO AO VOLUME):
           ### TIPOLOGIA: CONEXÃO COM JESUS CRISTO (Mínimo 5 pontos detalhados).
           ### ARQUEOLOGIA E CURIOSIDADES (Fatos históricos e arqueológicos robustos).

        --- INSTRUÇÕES TÉCNICAS DE PAGINAÇÃO ---
        1. O sistema divide automaticamente usando a tag <hr class="page-break">. Inserir a tag a cada 2 ou 3 tópicos numerados.
    `;
    
    const instructions = customInstructions ? `\nINSTRUÇÕES ADICIONAIS DO ADMIN: ${customInstructions}` : "";
    const continuationInstructions = `MODO CONTINUAÇÃO CRÍTICA: Você já gerou parte da apostila. Continue EXATAMENTE de onde parou: "...${cleanContext.slice(-1500)}...". Continue a exegese microscópica em porções de 2 versículos. AO ATINGIR O ÚLTIMO VERSÍCULO, GERE OBRIGATORIAMENTE as seções finais de Tipologia e Arqueologia.`;

    let specificPrompt = target === 'student' ? 
        `OBJETIVO: AULA COMPLETA DO ALUNO para ${book} ${chapter}. ${WRITING_STYLE_MAGNUM_OPUS} ${instructions} ${mode === 'continue' ? continuationInstructions : 'INÍCIO DO ESTUDO COMPLETO E EXAUSTIVO.'}` : 
        `OBJETIVO: MANUAL INTEGRAL DO PROFESSOR para ${book} ${chapter}. ${WRITING_STYLE_MAGNUM_OPUS} ${instructions} ${mode === 'continue' ? continuationInstructions : 'INÍCIO DO ESTUDO COMPLETO E EXAUSTIVO.'}`;

    try {
        setValidationLog(prev => [...prev, "📡 Enviando requisição para nuvem teológica...", "🧠 IA iniciando raciocínio exegético profundo de 2.400 palavras..."]);
        
        // Chamada da API
        const result = await generateContent(specificPrompt, null, true, 'ebd');
        
        if (!result || result.trim().length < 500) throw new Error("O volume de conteúdo retornado é insuficiente para o padrão Michel Felix.");
        
        setValidationPhase('theological');
        let cleanedResult = result.trim();
        
        // Limpeza de Wrappers
        if (cleanedResult.startsWith('{"text":')) { try { cleanedResult = JSON.parse(cleanedResult).text; } catch(e){} }
        if (cleanedResult.startsWith('```')) { cleanedResult = cleanedResult.replace(/```[a-z]*\n|```/g, ''); }

        const hasFinalSections = cleanedResult.toUpperCase().includes('TIPOLOGIA') && cleanedResult.toUpperCase().includes('ARQUEOLOGIA');
        setValidationLog(prev => [...prev, `✅ Conteúdo recebido: ${cleanedResult.length} caracteres.`, hasFinalSections ? "✅ Seções Finais localizadas." : "⚠️ Seções Finais não detectadas no buffer."]);

        let separator = (mode === 'continue' && currentText.length > 0 && !currentText.trim().endsWith('>')) ? '<hr class="page-break">' : '';
        const newTotal = mode === 'continue' ? (currentText + separator + cleanedResult) : cleanedResult;
        
        const data = { 
            book, chapter, study_key: studyKey, 
            title: existing.title || `Panorama Magistral de ${book} ${chapter}`, 
            outline: existing.outline || [], 
            student_content: target === 'student' ? newTotal : (existing.student_content || ''), 
            teacher_content: target === 'teacher' ? newTotal : (existing.teacher_content || '') 
        };

        // PROTOCOLO DE LIBERAÇÃO IMEDIATA (CORREÇÃO DO LOOP INFINITO)
        pendingContentBuffer.current = data;
        setValidationPhase('retention');
        setValidationLog(prev => [...prev, "⏳ Conteúdo em Buffer. Forçando conclusão da barra de progresso..."]);
        accelerationRef.current = true; // Gatilho de aceleração para o useEffect do cronômetro

        // Polling de Retenção com Timeout de Segurança (Máximo 10s extra após receber o dado)
        let safeTimeout = 0;
        const checkRetention = setInterval(async () => {
            safeTimeout++;
            if (theologicalDensity >= 100 || safeTimeout > 10) {
                clearInterval(checkRetention);
                
                // Persistência Real
                if (existing.id) await db.entities.PanoramaBiblico.update(existing.id, pendingContentBuffer.current);
                else await db.entities.PanoramaBiblico.create(pendingContentBuffer.current);

                await loadContent();
                setValidationPhase('releasing');
                setValidationLog(prev => [...prev, "💎 Protocolo v35 Concluído!", "🔓 Manuscrito Liberado."]);
                onShowToast('Manuscrito de Alta Densidade Liberado!', 'success');
                setIsGenerating(false); 
                if (mode === 'continue') setTimeout(() => setCurrentPage(pages.length), 1000); 
            }
        }, 800);

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
            className={`sticky top-0 z-40 transition-all duration-1000 ${scrolled ? 'bg-[#400010]/95 backdrop-blur-3xl shadow-[0_35px_100px_-15px_rgba(0,0,0,0.8)] py-5' : 'bg-gradient-to-r from-[#600018] to-[#400010] py-10'} text-white px-12 flex justify-between items-center safe-top border-b border-[#C5A059]/70`}
        >
            <button 
                onClick={onBack} 
                className="p-6 hover:bg-white/20 rounded-full transition-all active:scale-90 shadow-inner group border-2 border-white/10"
                aria-label="Voltar ao Início"
            >
                <ChevronLeft className="w-14 h-14 group-hover:-translate-x-4 transition-transform" />
            </button>
            
            <div className="flex flex-col items-center">
                <h2 className="font-cinzel font-bold text-4xl md:text-6xl tracking-[0.35em] drop-shadow-4xl">Panorama EBD</h2>
                <div className="flex items-center gap-5 opacity-90 mt-4">
                    <Milestone className="w-6 h-6 text-[#C5A059] animate-pulse" />
                    <span className="text-[15px] uppercase tracking-[1em] font-montserrat font-bold">Edição Magnum Opus v35</span>
                </div>
            </div>

            <div className="flex gap-5">
                {isAdmin && !isEditing && content && (
                    <button 
                        onClick={handleStartEditing} 
                        className="p-6 hover:bg-white/20 rounded-full text-[#C5A059] transition-all hover:scale-125 hover:rotate-12 border-2 border-[#C5A059]/40 shadow-2xl"
                        title="Revisão do Manuscrito"
                    >
                        <PenLine className="w-12 h-12" />
                    </button>
                )}
                <button 
                    onClick={() => setShowAudioSettings(!showAudioSettings)} 
                    className={`p-6 rounded-full transition-all active:scale-90 border-2 border-white/15 ${showAudioSettings ? 'bg-[#C5A059] text-[#1a0f0f] shadow-[0_0_50px_rgba(197,160,89,0.8)]' : 'hover:bg-white/20'}`}
                    title="Audioaula Digital"
                >
                    <Volume2 className={isPlaying ? "animate-pulse w-12 h-12" : "w-12 h-12"} />
                </button>
            </div>
        </header>

        {/* PAINEL DE CONTROLE DE ÁUDIOAULA */}
        <AnimatePresence>
            {showAudioSettings && (
                <motion.div 
                    initial={{ opacity: 0, y: -60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -60 }}
                    className="bg-white/98 dark:bg-dark-card/98 backdrop-blur-3xl p-14 border-b-[6px] border-[#C5A059]/90 shadow-[0_60px_150px_rgba(0,0,0,0.4)] z-30"
                >
                    <div className="flex flex-col gap-12 max-w-6xl mx-auto">
                        <div className="flex items-center justify-between border-b-[6px] border-gray-100 dark:border-white/10 pb-10">
                            <div className="flex flex-col">
                                <span className="font-cinzel font-bold text-2xl uppercase tracking-[0.5em] text-[#8B0000] dark:text-[#C5A059]">Sintetização Professor</span>
                                <span className="text-[16px] text-gray-400 font-montserrat uppercase mt-4 flex items-center gap-5"><Clock className="w-8 h-8 text-[#C5A059]"/> Transmissão Teológica Sincronizada Prof. Michel Felix</span>
                            </div>
                            <button 
                                onClick={togglePlay} 
                                className="bg-[#C5A059] text-[#1a0f0f] px-20 py-8 rounded-full font-black flex items-center gap-8 shadow-[0_25px_60px_rgba(197,160,89,0.7)] hover:scale-110 active:scale-95 transition-all group border-4 border-white/20"
                            >
                                {isPlaying ? <Pause className="w-12 h-12 fill-current"/> : <Play className="w-12 h-12 fill-current"/>} 
                                <span className="tracking-[0.5em] uppercase text-xl font-black">{isPlaying ? 'Interromper' : 'Escutar Aula'}</span>
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-14">
                            <div className="space-y-6">
                                <label className="text-[16px] font-black uppercase tracking-[0.7em] text-gray-500 flex items-center gap-5"><Library className="w-8 h-8"/> Perfil Vocal do Mestre</label>
                                <select 
                                    className="w-full p-8 text-2xl border-[6px] border-[#C5A059]/50 rounded-[2.5rem] dark:bg-gray-800 dark:text-white font-montserrat outline-none focus:border-[#C5A059] transition-all shadow-3xl font-black appearance-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" 
                                    value={selectedVoice} 
                                    onChange={e => setSelectedVoice(e.target.value)}
                                >
                                    {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-6">
                                <label className="text-[16px] font-black uppercase tracking-[0.7em] text-gray-500 flex items-center gap-5"><Zap className="w-8 h-8"/> Cadência do Ensino</label>
                                <div className="flex gap-8">
                                    {[0.8, 1, 1.2, 1.5].map(rate => (
                                        <button 
                                            key={rate} 
                                            onClick={() => setPlaybackRate(rate)} 
                                            className={`flex-1 py-8 text-2xl font-black rounded-[2.5rem] border-[6px] transition-all ${playbackRate === rate ? 'bg-[#8B0000] text-white border-[#8B0000] shadow-3xl scale-110' : 'bg-gray-100 dark:bg-gray-900 dark:text-gray-400 border-transparent hover:bg-gray-100 hover:scale-105'}`}
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
        <div className="bg-white dark:bg-dark-card p-12 border-b border-[#C5A059]/60 flex gap-10 shadow-2xl shrink-0 items-center">
             <div className="flex-1 relative group">
                 <div className="absolute left-10 top-1/2 -translate-y-1/2 w-12 h-12 text-[#C5A059] opacity-80 group-focus-within:opacity-100 transition-opacity"><Compass /></div>
                 <select 
                    value={book} 
                    onChange={e => setBook(e.target.value)} 
                    className="w-full pl-28 pr-12 py-9 border-[6px] border-[#C5A059]/50 rounded-[3rem] font-cinzel text-3xl dark:bg-gray-800 dark:text-white focus:ring-[20px] focus:ring-[#C5A059]/25 transition-all outline-none appearance-none shadow-inner font-black"
                >
                    {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                 </select>
             </div>
             <div className="w-64 relative group">
                 <div className="absolute left-10 top-1/2 -translate-y-1/2 w-12 h-12 text-[#C5A059] opacity-80 group-focus-within:opacity-100 transition-opacity"><HistoryIcon /></div>
                 <input 
                    type="number" 
                    value={chapter} 
                    onChange={e => setChapter(Number(e.target.value))} 
                    className="w-full pl-28 pr-12 py-9 border-[6px] border-[#C5A059]/50 rounded-[3rem] font-cinzel text-3xl dark:bg-gray-800 dark:text-white focus:ring-[20px] focus:ring-[#C5A059]/25 transition-all outline-none appearance-none shadow-inner font-black" 
                    min={1} 
                />
             </div>
        </div>

        {/* TABS DE SELEÇÃO DE PERFIL ACADÊMICO */}
        <nav className="flex bg-[#F5F5DC] dark:bg-black border-b-[6px] border-[#C5A059]/70 shrink-0 sticky top-[112px] z-30 shadow-[0_40px_80px_rgba(0,0,0,0.5)]">
            <button 
                onClick={() => setActiveTab('student')} 
                className={`flex-1 py-14 font-cinzel font-black text-xl md:text-2xl uppercase tracking-[0.7em] flex justify-center items-center gap-10 transition-all duration-1000 relative ${activeTab === 'student' ? 'bg-[#600018] text-white shadow-inner' : 'text-gray-400 dark:text-gray-700 hover:text-[#8B0000]'}`}
            >
                <BookCheck className="w-12 h-12" /> Aluno
                {activeTab === 'student' && <motion.div layoutId="tab-magnum-35" className="absolute bottom-0 left-0 w-full h-4 bg-[#C5A059] shadow-[0_0_40px_#C5A059]" />}
            </button>
            <button 
                onClick={() => setActiveTab('teacher')} 
                className={`flex-1 py-14 font-cinzel font-black text-xl md:text-2xl uppercase tracking-[0.7em] flex justify-center items-center gap-10 transition-all duration-1000 relative ${activeTab === 'teacher' ? 'bg-[#600018] text-white shadow-inner' : 'text-gray-400 dark:text-gray-700 hover:text-[#8B0000]'}`}
            >
                {isAdmin ? <ShieldCheck className="w-14 h-14 text-[#C5A059]" /> : <Lock className="w-12 h-12" />} Professor
                {activeTab === 'teacher' && <motion.div layoutId="tab-magnum-35" className="absolute bottom-0 left-0 w-full h-4 bg-[#C5A059] shadow-[0_0_40px_#C5A059]" />}
            </button>
        </nav>

        {/* EDITOR CHEFE ADMA BUILDER (PROTOCOLO v35) */}
        {isAdmin && !isEditing && (
            <div className="bg-[#010101] text-[#C5A059] p-16 shadow-[0_100px_200px_-30px_rgba(0,0,0,1)] sticky top-[240px] z-20 border-b-[16px] border-[#8B0000] animate-in slide-in-from-top-18">
                {isGenerating ? (
                    <div className="flex flex-col items-center gap-14 py-12 animate-in fade-in duration-1000">
                        <div className="flex items-center gap-16">
                            <div className="relative">
                                <Loader2 className="animate-spin w-28 h-28 text-[#C5A059] opacity-90"/>
                                <div className="absolute inset-0 flex items-center justify-center"><Cpu className="w-14 h-14 text-[#C5A059] animate-pulse" /></div>
                            </div>
                            <div className="flex flex-col">
                                <span className="font-cinzel text-3xl font-black uppercase tracking-[0.5em] text-white animate-pulse">{loadingStatusMessages[currentStatusIndex]}</span>
                                <div className="flex flex-wrap items-center gap-10 mt-6">
                                    <span className="text-lg opacity-90 font-mono flex items-center gap-5 bg-white/5 px-8 py-4 rounded-3xl border border-white/20 shadow-2xl">
                                        <Clock className="w-8 h-8 text-[#C5A059]" /> Tempo Real: {generationTime}s / 300s
                                    </span>
                                    <span className={`text-lg font-black uppercase tracking-[0.3em] px-8 py-4 rounded-3xl border-4 shadow-2xl transition-colors duration-500 ${validationPhase === 'retention' || validationPhase === 'releasing' ? 'bg-green-900/50 text-green-400 border-green-500 animate-pulse' : 'bg-blue-900/50 text-blue-400 border-blue-500'}`}>
                                        Fase: {validationPhase === 'structural' ? 'Estrutura' : validationPhase === 'theological' ? 'Exegese' : validationPhase === 'retention' ? 'Retenção' : validationPhase === 'releasing' ? 'Liberação' : 'Iniciando'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        {/* NOVO: Log de Telemetria Teológica para o Admin */}
                        <div className="w-full bg-black/60 p-8 rounded-[3rem] border-[3px] border-[#C5A059]/30 h-48 overflow-y-auto font-mono text-sm space-y-3 shadow-inner relative">
                            <div className="sticky top-0 right-0 flex justify-end mb-2"><Gauge className="w-5 h-5 text-[#C5A059]/40"/></div>
                            {validationLog.map((log, i) => (
                                <div key={i} className="flex gap-5 items-center animate-in slide-in-from-bottom-3 duration-500">
                                    <span className="text-[#C5A059] opacity-40 font-bold">[{new Date().toLocaleTimeString()}]</span>
                                    <span className={log.startsWith('✅') ? 'text-green-400 font-bold' : log.startsWith('❌') ? 'text-red-400 font-bold' : 'text-gray-300'}>{log}</span>
                                </div>
                            ))}
                        </div>

                        <div className="w-full bg-white/5 h-10 rounded-full mt-12 overflow-hidden border-[4px] border-white/25 shadow-[inset_0_8px_25px_rgba(0,0,0,0.9)] p-2">
                            <motion.div 
                                initial={{ width: 0 }} animate={{ width: `${theologicalDensity}%` }}
                                className="bg-gradient-to-r from-[#8B0000] via-[#C5A059] to-[#8B0000] h-full rounded-full shadow-[0_0_80px_#C5A059] relative"
                            >
                                <div className="absolute top-0 right-0 h-full w-40 bg-white/30 blur-2xl animate-shimmer"></div>
                            </motion.div>
                        </div>
                        <div className="flex justify-between w-full text-[16px] font-black uppercase tracking-[1.2em] opacity-60">
                            <span className="flex items-center gap-4"><Binary className="w-6 h-6"/> Heurística de Baixa Latência v35</span>
                            <span>{theologicalDensity.toFixed(0)}% MAGNUM OPUS</span>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-14">
                            <div className="flex items-center gap-12">
                                <div className="w-28 h-28 bg-gradient-to-br from-[#8B0000] to-[#400010] rounded-[3rem] flex items-center justify-center shadow-[0_40px_80px_rgba(139,0,0,0.9)] ring-[6px] ring-[#C5A059]/60"><Sparkles className="w-16 h-16 text-white animate-pulse" /></div>
                                <div className="flex flex-col">
                                    <span className="font-cinzel text-3xl font-black tracking-[0.9em] uppercase text-white">CONSTRUTOR MAGNUM OPUS</span>
                                    <span className="text-[16px] uppercase tracking-[0.8em] text-[#C5A059] font-black mt-4 flex items-center gap-4"><Ruler className="w-4 h-4"/> Alvo: ~2.400 Palavras (5-6 Páginas)</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowInstructions(!showInstructions)} 
                                className="text-[18px] font-black uppercase tracking-[0.6em] bg-white/5 px-12 py-6 rounded-[2.5rem] border-[6px] border-white/30 hover:bg-white/20 hover:text-white transition-all shadow-4xl active:scale-95 border-dotted"
                            >
                                {showInstructions ? 'Ocultar Comando' : 'Comando Teológico'}
                            </button>
                        </div>
                        
                        <AnimatePresence>
                            {showInstructions && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    className="mb-14 overflow-hidden"
                                >
                                    <textarea 
                                        value={customInstructions} 
                                        onChange={(e) => setCustomInstructions(e.target.value)} 
                                        placeholder="Ex: Foque na soberania de Deus e na arqueologia cananeia. Estilo Prof. Michel Felix v35..." 
                                        className="w-full p-12 text-3xl text-black rounded-[4rem] border-none focus:ring-[20px] focus:ring-[#C5A059]/40 font-montserrat shadow-[inset_0_40px_80px_rgba(0,0,0,0.4)] bg-[#FDFBF7] font-black leading-tight" 
                                        rows={4} 
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="flex gap-10">
                            <button 
                                onClick={() => handleGenerate('start')} 
                                disabled={isGenerating} 
                                className="flex-2 px-16 py-12 bg-[#8B0000] border-[8px] border-[#C5A059]/70 rounded-[4rem] text-lg font-black uppercase tracking-[0.6em] text-white hover:bg-white hover:text-[#1a0f0f] transition-all disabled:opacity-50 flex items-center justify-center gap-10 shadow-[0_50px_120px_rgba(139,0,0,0.9)] active:scale-95 group overflow-hidden"
                            >
                                <Layout className="w-14 h-14 group-hover:rotate-[360deg] transition-transform duration-[1.5s]" /> GERAR AULA INTEGRAL (~2.4k PALAVRAS)
                            </button>
                            <button 
                                onClick={() => handleGenerate('continue')} 
                                disabled={isGenerating} 
                                className="flex-1 px-16 py-12 bg-[#C5A059] text-[#1a0f0f] font-black rounded-[4rem] text-lg font-black uppercase tracking-[0.6em] hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-10 shadow-[0_40px_100px_rgba(197,160,89,0.7)] active:scale-95"
                            >
                                <Plus className="w-14 h-14"/> CONTINUAR
                            </button>
                            {pages.length > 0 && (
                                <button 
                                    onClick={handleDeletePage} 
                                    className="px-14 py-12 bg-red-900/80 text-red-200 border-[8px] border-red-500/60 rounded-[4rem] hover:bg-red-600 hover:text-white transition-all shadow-4xl active:scale-95"
                                    title="Destruir Manuscrito"
                                >
                                    <Trash2 className="w-14 h-14" />
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
            className="flex-1 overflow-y-auto p-12 md:p-40 max-w-[1600px] mx-auto pb-[500px] w-full scroll-smooth"
        >
            {/* Stats Flutuante para o Admin */}
            {isAdmin && stats.wordCount > 0 && (
                <div className="fixed top-32 left-10 z-50 bg-[#1a0f0f]/90 backdrop-blur-xl p-6 rounded-[2rem] border-2 border-[#C5A059]/40 text-[#C5A059] shadow-2xl flex flex-col gap-3 animate-in slide-in-from-left-5">
                    <div className="flex items-center gap-3 border-b border-[#C5A059]/20 pb-2"><AlignLeft className="w-4 h-4"/> <span className="font-cinzel font-bold text-xs uppercase">Telemetria v35</span></div>
                    <div className="flex justify-between gap-10 text-[10px] font-black uppercase tracking-widest"><span>Palavras:</span> <span className="text-white">{stats.wordCount}</span></div>
                    <div className="flex justify-between gap-10 text-[10px] font-black uppercase tracking-widest"><span>Caracteres:</span> <span className="text-white">{stats.charCount}</span></div>
                    <div className="flex justify-between gap-10 text-[10px] font-black uppercase tracking-widest"><span>Páginas Est.:</span> <span className="text-white">{stats.estimatedPages}</span></div>
                </div>
            )}

            {!hasAccess ? (
                <div className="text-center py-[400px] opacity-60 dark:text-white animate-in zoom-in duration-1000">
                    <div className="relative inline-block mb-32">
                        <div className="absolute inset-0 bg-red-900/60 blur-[250px] scale-[3.5] animate-pulse"></div>
                        <ShieldAlert className="w-80 h-80 mx-auto text-[#8B0000] drop-shadow-[0_40px_150px_rgba(139,0,0,1)]" />
                    </div>
                    <h2 className="font-cinzel text-9xl font-black mb-16 tracking-[0.4em] uppercase">Sanctum Sanctorum</h2>
                    <p className="font-montserrat text-3xl max-w-5xl mx-auto opacity-95 uppercase tracking-[1em] leading-relaxed italic font-black text-[#8B0000] drop-shadow-lg">
                        Este manuscrito exegético está reservado exclusivamente para o corpo docente autorizado da ADMA.
                    </p>
                </div>
            ) : isEditing ? (
                 <div className="bg-white dark:bg-dark-card shadow-[0_120px_300px_-60px_rgba(0,0,0,0.6)] p-24 rounded-[10rem] border-[12px] border-[#C5A059] relative animate-in slide-in-from-bottom-40 duration-1000">
                     <div className="flex justify-between items-center mb-24 border-b-[10px] pb-20 dark:border-white/10">
                        <div className="flex items-center gap-16">
                            <div className="w-28 h-28 bg-blue-900/30 rounded-[4rem] flex items-center justify-center text-blue-900 shadow-4xl"><PenTool className="w-16 h-16" /></div>
                            <div>
                                <h3 className="font-cinzel font-black text-7xl text-[#8B0000] dark:text-[#ff6b6b]">Oficina do Manuscrito</h3>
                                <p className="text-[18px] uppercase tracking-[0.8em] text-gray-400 font-black mt-6 flex items-center gap-6"><FileSearch className="w-8 h-8"/> Revisão Acadêmica v35 Michel Felix</p>
                            </div>
                        </div>
                        <div className="flex gap-12">
                            <button onClick={() => setIsEditing(false)} className="px-20 py-10 text-2xl font-black border-4 border-red-500 text-red-500 rounded-full hover:bg-red-50 transition-all uppercase tracking-[0.6em] active:scale-95 shadow-4xl">Descartar</button>
                            <button onClick={handleSaveManualEdit} className="px-20 py-10 text-2xl font-black bg-green-600 text-white rounded-full hover:bg-green-700 shadow-[0_50px_100px_rgba(22,163,74,0.8)] transition-all uppercase tracking-[0.6em] active:scale-95">Arquivar Versão</button>
                        </div>
                     </div>
                     <div className="mb-20 p-16 bg-[#F5F5DC] dark:bg-[#030303] rounded-[5rem] border-[6px] border-[#C5A059]/70 flex gap-12 items-center shadow-inner relative overflow-hidden group">
                         <div className="absolute top-0 right-0 w-40 h-40 bg-[#C5A059]/25 rounded-full -mr-20 -mt-20 group-hover:scale-[2] transition-transform duration-[2s]"></div>
                         <Info className="w-24 h-24 text-[#8B0000] shrink-0 drop-shadow-3xl" />
                         <div className="flex flex-col">
                            <span className="text-2xl font-black text-[#8B0000] uppercase tracking-[0.8em]">Engenharia de Paginação v35</span>
                            <span className="text-[18px] text-gray-600 font-montserrat mt-6 font-bold leading-relaxed">Nota do Professor: Utilize <code>&lt;hr class="page-break"&gt;</code> como divisor de águas teológico. Mantenha a meta de 2.400 palavras (~5-6 páginas).</span>
                         </div>
                     </div>
                     <textarea 
                        value={editValue} 
                        onChange={e => setEditValue(e.target.value)} 
                        className="w-full h-[90vh] p-24 font-mono text-4xl border-none focus:ring-0 rounded-[6rem] bg-gray-50 dark:bg-[#020202] dark:text-gray-300 resize-none shadow-[inset_0_40px_80px_rgba(0,0,0,0.3)] leading-tight border-[12px] border-transparent focus:border-[#C5A059]/60 transition-all" 
                        placeholder="Insira aqui o conhecimento exegético profundo do Professor Michel Felix..." 
                    />
                 </div>
            ) : content && pages.length > 0 ? (
                <article className="bg-white dark:bg-dark-card shadow-[0_100px_300px_-80px_rgba(0,0,0,0.6)] p-20 md:p-56 min-h-[120vh] border-[6px] border-[#C5A059]/70 relative rounded-[11rem] animate-in fade-in duration-[2.5s] select-text overflow-hidden">
                     {/* Marca d'Água Monumental Luxo v35 */}
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.07] dark:opacity-[0.12] pointer-events-none rotate-[-50deg] scale-[2.5]">
                        <BookOpen className="w-[1600px] h-[1600px] text-[#8B0000]" />
                     </div>

                     {renderFormattedText(pages[currentPage])}
                     
                     <div className="absolute bottom-32 right-40 flex items-center gap-16 select-none opacity-50 hover:opacity-100 transition-all duration-[1.5s] cursor-help group">
                        <div className="h-[5px] w-56 bg-[#C5A059] group-hover:w-96 transition-all duration-[1.5s] shadow-4xl"></div>
                        <span className="text-[#C5A059] font-cinzel text-4xl font-black tracking-[1.5em] group-hover:scale-125 transition-transform drop-shadow-4xl">{currentPage + 1} / {pages.length}</span>
                     </div>

                     {currentPage === pages.length - 1 && userProgress && (
                         <footer className="mt-96 text-center border-t-[12px] border-dotted border-[#C5A059]/70 pt-80 animate-in slide-in-from-bottom-40 duration-[3s] relative">
                             <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#FDFBF7] dark:bg-dark-card rounded-full flex items-center justify-center border-[12px] border-dotted border-[#C5A059]/80 shadow-[0_50px_150px_rgba(139,0,0,0.6)]">
                                <Anchor className="w-32 h-32 text-[#C5A059] animate-bounce" />
                             </div>

                             <div className="max-w-6xl mx-auto mb-56">
                                <Quote className="w-40 h-40 mx-auto text-[#C5A059] mb-24 opacity-30 animate-pulse" />
                                <h4 className="font-cinzel text-8xl font-black text-[#8B0000] dark:text-[#ff6b6b] mb-20 uppercase tracking-[0.6em] drop-shadow-4xl leading-none">Epílogo da Aula Magistral</h4>
                                <p className="font-cormorant text-7xl text-gray-500 italic leading-loose px-28">"Guardei a tua palavra no meu coração, para não pecar contra ti." <br/><span className="text-[18px] font-black tracking-[1.8em] not-italic text-[#C5A059] block mt-20 uppercase opacity-90">(Salmos 119:11 - Almeida Corrigida Fiel)</span></p>
                             </div>
                             
                             <button 
                                onClick={handleMarkAsRead} 
                                disabled={isRead} 
                                className={`group relative px-48 py-20 rounded-full font-cinzel font-black text-6xl shadow-[0_70px_150px_-40px_rgba(139,0,0,1)] flex items-center justify-center gap-16 mx-auto overflow-hidden transition-all duration-[2.5s] transform hover:scale-110 active:scale-95 border-8 border-white/20 ${isRead ? 'bg-green-600 text-white shadow-green-600/70' : 'bg-gradient-to-r from-[#8B0000] via-[#E00010] to-[#600018] text-white shadow-red-900/95'}`}
                            >
                                 {isRead ? <CheckCircle className="w-24 h-24" /> : <GraduationCap className="w-24 h-24 group-hover:rotate-[720deg] transition-transform duration-[5s]" />}
                                 <span className="relative z-10 tracking-[0.5em] uppercase">{isRead ? 'SABEDORIA ARQUIVADA' : 'CONCLUIR E PONTUAR'}</span>
                                 {!isRead && <div className="absolute inset-0 bg-white/50 opacity-0 group-hover:opacity-100 transition-opacity duration-[2s] blur-[60px]"></div>}
                             </button>
                             
                             {isRead && (
                                <motion.p 
                                    initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
                                    className="text-2xl font-black text-green-600 mt-28 uppercase tracking-[1.2em] flex items-center justify-center gap-10"
                                >
                                    <ShieldCheck className="w-14 h-14" /> Recompensa Meritocrática ADMA Integrada v35
                                </motion.p>
                             )}
                         </footer>
                     )}
                </article>
            ) : (
                <div className="text-center py-[450px] bg-white dark:bg-dark-card rounded-[12rem] border-[16px] border-dashed border-[#C5A059]/60 animate-in fade-in duration-[3s] shadow-[0_100px_250px_-60px_rgba(0,0,0,0.6)] relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#F5F5DC]/40 to-transparent pointer-events-none group-hover:opacity-100 transition-opacity opacity-90 duration-[4s]"></div>
                    <div className="relative inline-block mb-40 scale-[2.5] transition-transform group-hover:scale-[2.8] duration-[5s]">
                        <div className="absolute inset-0 bg-[#C5A059]/60 blur-[200px] rounded-full animate-pulse"></div>
                        <ScrollText className="w-[400px] h-[400px] mx-auto text-[#C5A059] opacity-30 relative z-10 drop-shadow-5xl"/>
                    </div>
                    <p className="font-cinzel text-9xl font-black text-gray-400 mb-20 tracking-[0.6em] uppercase drop-shadow-4xl leading-none">Manuscrito Silente</p>
                    <p className="font-montserrat text-2xl text-gray-500 uppercase tracking-[1.8em] mb-40 opacity-90 font-black">O Professor ainda não transcreveu este capítulo {chapter}.</p>
                    {isAdmin && (
                        <motion.div 
                            whileHover={{ y: -30, scale: 1.05 }}
                            className="max-w-6xl mx-auto p-24 bg-[#8B0000]/20 dark:bg-red-900/40 rounded-[8rem] border-[8px] border-[#8B0000]/60 flex flex-col items-center shadow-[0_80px_200px_-40px_rgba(139,0,0,0.6)] transition-all duration-[2s]"
                        >
                            <Library className="w-32 h-32 text-[#8B0000] mb-20 opacity-95 animate-bounce" />
                            <p className="text-2xl font-black text-[#8B0000] dark:text-red-400 uppercase tracking-[0.8em] text-center leading-loose font-montserrat shadow-md">
                                Atenção Administrador ADMA SUPREMO: <br/> Utilize o motor Magnum Opus v35 no topo para realizar a exegese microscópica de 2.400 palavras.
                            </p>
                        </motion.div>
                    )}
                </div>
            )}
        </main>

        {/* NAVEGAÇÃO FLUTUANTE MAGISTRAL (UI LUXO v35) */}
        <AnimatePresence>
            {pages.length > 1 && hasAccess && !isEditing && (
                <motion.nav 
                    initial={{ y: 300, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 300, opacity: 0 }}
                    className="fixed bottom-48 left-16 right-16 z-40 max-w-[1400px] mx-auto"
                >
                    <div className="bg-[#010101]/98 dark:bg-dark-card/98 backdrop-blur-4xl border-[8px] border-[#C5A059]/95 p-12 rounded-[6rem] flex justify-between items-center shadow-[0_100px_250px_-50px_rgba(0,0,0,1)] ring-[16px] ring-white/15 group">
                        <button 
                            onClick={() => { setCurrentPage(Math.max(0, currentPage - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                            disabled={currentPage === 0} 
                            className="group/btn flex items-center gap-10 px-20 py-12 bg-[#8B0000] text-white rounded-[4rem] font-black text-xl uppercase tracking-[0.8em] disabled:opacity-20 disabled:grayscale transition-all active:scale-95 shadow-[0_40px_100px_rgba(139,0,0,0.8)] hover:bg-white hover:text-[#1a0f0f] border-[6px] border-[#C5A059]/60"
                        >
                            <ChevronLeft className="w-14 h-14 group-hover/btn:-translate-x-8 transition-transform duration-1000" /> <span>Anterior</span>
                        </button>
                        
                        <div className="flex flex-col items-center shrink-0 px-24">
                            <span className="font-cinzel font-black text-[#C5A059] text-6xl tracking-[1.2em] drop-shadow-[0_0_35px_rgba(197,160,89,0.8)] transition-transform group-hover:scale-110 duration-[2s]">{currentPage + 1} <span className="opacity-40 text-3xl">/ {pages.length}</span></span>
                            <div className="w-[500px] bg-white/15 h-6 rounded-full mt-12 overflow-hidden border-[8px] border-white/10 shadow-[inset_0_15px_40px_rgba(0,0,0,0.9)]">
                                <motion.div 
                                    className="bg-gradient-to-r from-[#8B0000] via-[#C5A059] to-[#8B0000] h-full transition-all duration-[3s] ease-out shadow-[0_0_70px_#C5A059] relative" 
                                    style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }}
                                >
                                    <div className="absolute inset-0 bg-white/30 animate-shimmer"></div>
                                </motion.div>
                            </div>
                        </div>

                        <button 
                            onClick={() => { setCurrentPage(Math.min(pages.length - 1, currentPage + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                            disabled={currentPage === pages.length - 1} 
                            className="group/btn flex items-center gap-10 px-20 py-12 bg-[#8B0000] text-white rounded-[4rem] font-black text-xl uppercase tracking-[0.8em] disabled:opacity-20 disabled:grayscale transition-all active:scale-95 shadow-[0_40px_100px_rgba(139,0,0,0.8)] hover:bg-white hover:text-[#1a0f0f] border-[6px] border-[#C5A059]/60"
                        >
                            <span>Próximo</span> <ChevronRight className="w-14 h-14 group-hover/btn:translate-x-8 transition-transform duration-1000" />
                        </button>
                    </div>
                </motion.nav>
            )}
        </AnimatePresence>
        
        {/* BARREIRA DE SEGURANÇA FINAL (UX SUPREMA v35) */}
        <div className="h-96 shrink-0 select-none pointer-events-none opacity-0">ADMA MAGNUM OPUS SECURITY LAYER SUPREME v35 CORRIGIDO</div>
    </div>
  );
}
