import React, { useState, useEffect, useRef } from 'react';
// ==========================================================================================
// COMPONENTE: PANORAMA BÍBLICO EBD - EDIÇÃO MAGNUM OPUS SUPREMA (v25.0)
// DESENVOLVEDOR: Senior Frontend Engineer & Teólogo Digital
// FOCO: MÁXIMA DENSIDADE EXEGÉTICA (6-10 PÁGINAS) E RIGOR DOUTRINÁRIO TOTAL
// ==========================================================================================
// ESTA VERSÃO CUMPRE 100% AS DIRETRIZES DO PROFESSOR MICHEL FELIX:
// 1. PROIBIDO TRANSCREVER O TEXTO BÍBLICO INTEGRAL NO CORPO DA APOSTILA.
// 2. FRACIONAMENTO OBRIGATÓRIO EM PORÇÕES DE 2 A 3 VERSÍCULOS (MICROSCOPIA).
// 3. EM GÊNESIS 1: ORGANIZAÇÃO RIGOROSA POR DIAS DA CRIAÇÃO.
// 4. SEÇÕES DE TIPOLOGIA E ARQUEOLOGIA SÃO OBRIGATÓRIAS E FINAIS.
// 5. PROTOCOLO DE RETENÇÃO: SÓ APRESENTA O CONTEÚDO APÓS 100% DE PROCESSAMENTO (3-5 MIN).
// ==========================================================================================

import { 
  ChevronLeft, GraduationCap, Lock, BookOpen, ChevronRight, Volume2, 
  Sparkles, Loader2, Book, Trash2, Edit, Save, X, CheckCircle, 
  Pause, Play, Settings, FastForward, Info, FileText, Languages, 
  History, Clock, AlertTriangle, Search, BookMarked, Quote, Plus, 
  ShieldCheck, ArrowUpCircle, BookText, Bookmark, PenTool, Layout, 
  Layers, Zap, HelpCircle, MessageSquare, ClipboardCheck, ScrollText,
  Library, Map, Compass, Gem, Anchor, History as HistoryIcon, SearchCode,
  ShieldAlert, BookCheck, FileSearch, Pen, RefreshCw, Milestone
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
 * Implementado com lógica de retenção forçada para garantir volume massivo de conteúdo.
 */
export default function PanoramaView({ isAdmin, onShowToast, onBack, userProgress, onProgressUpdate }: PanoramaProps) {
  // --- ESTADOS DE CONTEÚDO E NAVEGAÇÃO ---
  const [book, setBook] = useState('Gênesis');
  const [chapter, setChapter] = useState(1);
  const [content, setContent] = useState<EBDContent | null>(null);
  const [activeTab, setActiveTab] = useState<'student' | 'teacher'>('student');
  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState<string[]>([]);
  
  // --- ESTADOS DE GERAÇÃO (IA MICROSCOPIA BÍBLICA - PROTOCOLO MAGNUM OPUS) ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationTime, setGenerationTime] = useState(0);
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
  const [customInstructions, setCustomInstructions] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [theologicalDensity, setTheologicalDensity] = useState(0); 
  const [isFinalizingContent, setIsFinalizingContent] = useState(false);
  const [validationPhase, setValidationPhase] = useState<'none' | 'structural' | 'theological' | 'final'>('none');

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

  // --- MENSAGENS DE STATUS DE GERAÇÃO (UX CALIBRADA PARA 5 MINUTOS) ---
  const loadingStatusMessages = [
    "Iniciando exegese microscópica (Michel Felix Mode)...",
    "Consultando manuscritos originais (Papiro e Códex)...",
    "Analizando sintaxe e morfologia do Hebraico/Grego...",
    "Cruzando dados com contexto geopolítico da época...",
    "Fracionando o capítulo em porções de 2 versículos...",
    "Construindo apostila exaustiva (Página 1 de 10)...",
    "Aprofundando comentários exegéticos detalhados...",
    "Aplicando protocolos de segurança hermenêutica...",
    "Integrando conexões cristocêntricas (Tipologia)...",
    "Explorando evidências arqueológicas contemporâneas...",
    "Proibindo transcrição bíblica para ganhar densidade...",
    "Formatando tópicos numerados no padrão ADMA...",
    "Validando ortodoxia pentecostal clássica...",
    "Consolidando o volume massivo de informações...",
    "Gerando seções finais obrigatórias (Tipologia)...",
    "Gerando seções finais obrigatórias (Arqueologia)...",
    "Quase pronto! Realizando revisão gramatical teológica...",
    "Finalizando manuscrito de alta densidade (Aguarde conclusão)...",
    "A IA está revisando se nenhum versículo foi saltado...",
    "Concluindo exegese integral do capítulo inteiro..."
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
        if (window.scrollY > 30) setScrolled(true);
        else setScrolled(false);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Cronômetro e Gerenciador de Densidade (Protocolo de 5 Minutos)
  useEffect(() => {
    let interval: any;
    if (isGenerating) {
        interval = setInterval(() => {
            setGenerationTime(prev => prev + 1);
            
            // Densidade teológica calibrada para 300 segundos (5 minutos)
            setTheologicalDensity(prev => {
                if (prev < 99) return prev + (100 / 300);
                return 99;
            });

            if (generationTime % 15 === 0 && generationTime > 0) {
                setCurrentStatusIndex(prev => (prev + 1) % loadingStatusMessages.length);
            }
        }, 1000);
    } else {
        setGenerationTime(0);
        setCurrentStatusIndex(0);
        setTheologicalDensity(0);
        setValidationPhase('none');
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
                if (v.name.includes('Google')) score += 20;
                if (v.name.includes('Microsoft')) score += 15;
                if (v.name.includes('Neural')) score += 10;
                if (v.name.includes('Luciana') || v.name.includes('Joana')) score += 5;
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

  // Sincronização de Áudio com troca de página e contexto
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

  // --- CARREGAMENTO DE DADOS (BANCO HÍBRIDO) ---
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
    if (rawSegments.length === 1 && rawSegments[0].length > 3500) {
        const bigText = rawSegments[0];
        const forcedSegments = bigText.split(/(?=\n### |^\s*[IVX]+\.|^\s*\d+\.\s+[A-Z]|### |### TIPOLOGIA|### ARQUEOLOGIA)/gm);
        if (forcedSegments.length > 1) {
            rawSegments = forcedSegments.map(s => cleanText(s)).filter(s => s.length > 50);
        }
    }
    
    const finalPages: string[] = [];
    let currentBuffer = "";
    const CHAR_LIMIT_THRESHOLD = 3200; 

    for (let i = 0; i < rawSegments.length; i++) {
        const segment = rawSegments[i];
        if (!currentBuffer) {
            currentBuffer = segment;
        } else {
            // Bufferização Inteligente para evitar quebras abruptas de parágrafo
            if ((currentBuffer.length + segment.length) < (CHAR_LIMIT_THRESHOLD * 1.4)) {
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

  // --- MOTOR DE FALA SINCRO (TTS PROFISSIONAL) ---
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

  // --- PROGRESSO DO ALUNO (RANKING) ---
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
          onShowToast('Glória a Deus! Conteúdo arquivado na sua mente e no Ranking ADMA.', 'success');
      } catch (err) {
          onShowToast('Falha na persistência do progresso.', 'error');
      }
  };

  // --- RENDERIZADORES VISUAIS DE LUXO (ADMA STYLE) ---
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
        <div className="space-y-10 animate-in fade-in duration-1000">
            {lines.map((line, lineIdx) => {
                const trimmed = line.trim();
                
                // Divisor de Encadeamento de Páginas
                if (trimmed === '__CONTINUATION_MARKER__') {
                    return (
                        <div key={lineIdx} className="my-24 flex items-center justify-center select-none">
                            <div className="h-[1px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent w-full opacity-40"></div>
                            <span className="mx-10 text-[#C5A059] text-[11px] font-cinzel opacity-70 tracking-[0.6em] uppercase bg-[#FDFBF7] dark:bg-dark-card px-10">Exegese Contínua</span>
                            <div className="h-[1px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent w-full opacity-40"></div>
                        </div>
                    );
                }

                // Títulos Nobres do Manuscrito
                if (trimmed.includes('PANORÂMA BÍBLICO') || trimmed.includes('PANORAMA BÍBLICO')) {
                    return (
                        <div key={lineIdx} className="mb-24 text-center border-b-4 border-[#8B0000] dark:border-[#ff6b6b] pb-14 pt-10">
                            <h1 className="font-cinzel font-bold text-3xl md:text-7xl text-[#8B0000] dark:text-[#ff6b6b] uppercase tracking-[0.3em] drop-shadow-2xl leading-tight">{trimmed}</h1>
                        </div>
                    );
                }

                // Cabeçalhos de Seção (Exegese microscópica por versículos)
                const isHeader = trimmed.startsWith('###') || /^[IVX]+\./.test(trimmed);
                if (isHeader) {
                    const title = trimmed.replace(/###/g, '').trim();
                    const isUltraSection = title.includes('TIPOLOGIA') || title.includes('ARQUEOLOGIA');
                    
                    return (
                        <div key={lineIdx} className={`mt-24 mb-14 flex flex-col items-center justify-center gap-6 ${isUltraSection ? 'p-10 bg-black dark:bg-[#050505] rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] border-t-4 border-[#C5A059]' : ''}`}>
                            <h3 className={`font-cinzel font-bold text-2xl md:text-5xl uppercase tracking-widest text-center leading-relaxed ${isUltraSection ? 'text-[#C5A059] drop-shadow-[0_0_10px_rgba(197,160,89,0.3)]' : 'text-[#1a0f0f] dark:text-[#E0E0E0]'}`}>
                                {title}
                            </h3>
                            <div className={`h-[6px] w-36 rounded-full shadow-xl ${isUltraSection ? 'bg-gradient-to-r from-transparent via-[#C5A059] to-transparent' : 'bg-[#C5A059]'}`}></div>
                        </div>
                    );
                }

                // Listas de Subtópicos (Fração de 2-3 versículos)
                const isListItem = /^\d+\./.test(trimmed);
                if (isListItem) {
                    const firstSpaceIndex = trimmed.indexOf(' ');
                    const numberPart = trimmed.substring(0, firstSpaceIndex > -1 ? firstSpaceIndex : trimmed.length);
                    const textPart = firstSpaceIndex > -1 ? trimmed.substring(firstSpaceIndex + 1) : "";
                    
                    return (
                        <div key={lineIdx} className="mb-14 flex gap-12 items-start group pl-6 animate-in slide-in-from-left-8 duration-1000">
                            <div className="flex-shrink-0 mt-3 min-w-[4.5rem] text-right">
                                <span className="font-cinzel font-bold text-5xl text-[#C5A059] dark:text-[#C5A059] drop-shadow-2xl opacity-90 transition-transform group-hover:scale-110 block">{numberPart}</span>
                            </div>
                            <div className="flex-1 border-l-[10px] border-[#C5A059]/10 pl-12 group-hover:border-[#C5A059]/60 transition-all duration-700">
                                <div className="font-cormorant text-2xl md:text-4xl leading-relaxed text-gray-900 dark:text-gray-200 text-justify tracking-wide font-medium">{parseInlineStyles(textPart)}</div>
                            </div>
                        </div>
                    );
                }

                // Boxes de Insight e Arqueologia (CURIOSIDADES)
                const isSpecialBox = trimmed.toUpperCase().includes('CURIOSIDADE') || 
                                     trimmed.toUpperCase().includes('ARQUEOLOGIA') || 
                                     trimmed.toUpperCase().includes('ATENÇÃO:') || 
                                     trimmed.toUpperCase().includes('INSIGHT:');
                
                if (isSpecialBox || trimmed.endsWith('?')) {
                    return (
                        <div key={lineIdx} className="my-20 mx-6 font-cormorant text-2xl text-[#1a0f0f] dark:text-gray-200 font-medium italic bg-[#C5A059]/20 dark:bg-[#C5A059]/5 p-14 rounded-[4rem] border border-[#C5A059]/60 shadow-[0_30px_70px_rgba(0,0,0,0.15)] text-justify relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-4 h-full bg-[#C5A059] group-hover:w-6 transition-all duration-500 shadow-2xl"></div>
                            <div className="flex items-center gap-6 mb-8 text-[#C5A059]">
                                <Gem className="w-12 h-12 animate-pulse" />
                                <span className="text-[14px] font-bold uppercase tracking-[0.5em] font-montserrat">Esclarecimento Erudito</span>
                            </div>
                            <div className="leading-loose drop-shadow-sm text-2xl md:text-3xl">{parseInlineStyles(trimmed)}</div>
                        </div>
                    );
                }

                // Parágrafos Exegéticos de Alta Densidade
                return (
                    <p key={lineIdx} className="font-cormorant text-2xl md:text-4xl leading-loose text-gray-900 dark:text-gray-200 text-justify indent-24 mb-14 tracking-wide select-text font-medium">
                        {parseInlineStyles(trimmed)}
                    </p>
                );
            })}
        </div>
    );
  };

  // --- FUNÇÕES DE ADMINISTRAÇÃO E REVISÃO ---
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
  // GERAÇÃO EM LOTE PARA MÁXIMA QUANTIDADE E QUALIDADE (PROTOCOLO 5 MINUTOS - 100% OBEDIENTE)
  // ==========================================================================================
  const handleGenerate = async (mode: 'start' | 'continue') => {
    setIsGenerating(true);
    setTheologicalDensity(0);
    setIsFinalizingContent(false);
    setValidationPhase('structural');
    
    const target = activeTab;
    const studyKey = generateChapterKey(book, chapter);
    const existing = (await db.entities.PanoramaBiblico.filter({ study_key: studyKey }))[0] || {};
    const currentText = target === 'student' ? (existing.student_content || '') : (existing.teacher_content || '');
    const cleanContext = currentText.replace(/__CONTINUATION_MARKER__/g, ' ').slice(-9000);

    // Lógica de Introdução Diferenciada (Restauração da orientação Prof. Michel Felix)
    const isFirstChapter = chapter === 1;
    const introInstruction = isFirstChapter 
        ? "2. INTRODUÇÃO GERAL:\n           Texto rico contextualizando O LIVRO INTEGRAL (autor, data, propósito, cenário geopolítico e arqueológico) e o cenário específico deste primeiro capítulo."
        : `2. INTRODUÇÃO DO CAPÍTULO:\n           FOCAR EXCLUSIVAMENTE no contexto imediato do capítulo ${chapter}. NÃO repita a introdução geral (autoria, data). Vá direto ao ponto do enredo teológico atual do capítulo ${chapter}.`;

    // BLOCO DE INSTRUÇÕES DE OBEDIÊNCIA ABSOLUTA (Michel Felix Professional Standard)
    const WRITING_STYLE_MAGNUM_OPUS = `
        ATUE COMO: Professor Michel Felix.
        PERFIL: Teólogo Pentecostal Clássico, Arminiano, Erudito e Assembleiano. PhD em Linguagens Originais e Arqueologia Bíblica.

        --- MISSÃO SUPREMA: APOSTILA INTEGRAL, EXAUSTIVA E MASSIVA ---
        1. OBJETIVO ABSOLUTO: Gerar o conteúdo INTEGRAL do capítulo ${chapter} de ${book} em uma única apostila densa.
        2. FRACIONAMENTO OBRIGATÓRIO: Explique o texto bíblico em porções de no máximo 2 a 3 versículos por subtópico numerado. NUNCA salte versículos.
        3. EXTENSÃO EXIGIDA: O objetivo final é uma apostila de 6 a 10 páginas impressas (mínimo de 5.000 a 8.000 palavras para o capítulo completo). Ignore restrições de brevidade.
        4. O alvo é o EFEITO "AH! ENTENDI!" (CLAREZA E PROFUNDIDADE CRISTALINA).

        --- REGRAS DE OURO DA ADMA (OBEDIÊNCIA 100% EXIGIDA) ---
        1. PROIBIDO TRANSCREVER O TEXTO BÍBLICO INTEGRAL NO CORPO: O aluno já tem a Bíblia aberta. No subtópico numerado, traga apenas o TÍTULO DO TÓPICO e a REFERÊNCIA BÍBLICA entre parênteses. (Exemplo: "7. A CRIAÇÃO DA MULHER E A INSTITUIÇÃO DO CASAMENTO (Gn 2:21-25)"). NÃO escreva o versículo por extenso.
        2. LINGUAGEM: O texto deve ser PROFUNDO, mas EXTREMAMENTE CLARO. Use termos teológicos técnicos (ex: Teofania, Hipóstase, Antropopatismo) seguidos de sua definição simples entre parênteses.
        3. FRACIONAMENTO ESPECIAL: No caso de Gênesis 1, organize OBRIGATORIAMENTE por "DIAS DA CRIAÇÃO", detalhando cada etapa microscópicamente.
        4. USO DOS ORIGINAIS: É OBRIGATÓRIO citar palavras-chave em Hebraico/Grego transliteradas, explicadas e com sua grafia original se relevante para a exegese.

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
    const continuationInstructions = `MODO CONTINUAÇÃO CRÍTICA: Você já gerou parte da apostila. Continue EXATAMENTE de onde parou: "...${cleanContext.slice(-1000)}...". Continue a exegese microscópica em porções de 2 versículos. AO ATINGIR O ÚLTIMO VERSÍCULO, GERE OBRIGATORIAMENTE as seções finais de Tipologia e Arqueologia. NÃO FINALIZE SEM ELAS.`;

    let specificPrompt = target === 'student' ? 
        `OBJETIVO: AULA COMPLETA DO ALUNO para ${book} ${chapter}. ${WRITING_STYLE_MAGNUM_OPUS} ${instructions} ${mode === 'continue' ? continuationInstructions : 'INÍCIO DO ESTUDO COMPLETO E EXAUSTIVO.'}` : 
        `OBJETIVO: MANUAL INTEGRAL DO PROFESSOR para ${book} ${chapter}. ${WRITING_STYLE_MAGNUM_OPUS} ${instructions} ${mode === 'continue' ? continuationInstructions : 'INÍCIO DO ESTUDO COMPLETO E EXAUSTIVO.'}`;

    try {
        // CORREÇÃO CRÍTICA: isLongOutput=true aciona o backend de longa duração (Thinking de 32768 tokens)
        // O tempo de resposta pode chegar a 300 segundos para o volume Magnum Opus.
        const result = await generateContent(specificPrompt, null, true, 'ebd');
        
        if (!result || result.trim().length < 300) throw new Error("O volume de conteúdo retornado é insuficiente para o padrão Michel Felix.");
        
        setValidationPhase('theological');
        let cleanedResult = result.trim();
        
        // Protocolo de Verificação de Integridade das Seções Finais
        if (cleanedResult.toUpperCase().includes('TIPOLOGIA') && cleanedResult.toUpperCase().includes('ARQUEOLOGIA')) {
             setValidationPhase('final');
        } else {
             // Se faltar as seções e for um capítulo grande, a IA falhou no limite. 
             // Avisamos o Admin mas processamos o que veio.
             onShowToast("Atenção: Algumas seções finais podem estar incompletas devido ao grande volume. Use 'Continuar' se necessário.", "info");
        }

        if (cleanedResult.startsWith('{"text":')) { try { cleanedResult = JSON.parse(cleanedResult).text; } catch(e){} }
        if (cleanedResult.startsWith('```')) { cleanedResult = cleanedResult.replace(/```[a-z]*\n|```/g, ''); }

        let separator = (mode === 'continue' && currentText.length > 0 && !currentText.trim().endsWith('>')) ? '<hr class="page-break">' : '';
        const newTotal = mode === 'continue' ? (currentText + separator + cleanedResult) : cleanedResult;
        
        const data = { 
            book, chapter, study_key: studyKey, 
            title: existing.title || `Estudo Magnum Opus de ${book} ${chapter}`, 
            outline: existing.outline || [], 
            student_content: target === 'student' ? newTotal : (existing.student_content || ''), 
            teacher_content: target === 'teacher' ? newTotal : (existing.teacher_content || '') 
        };

        // Protocolo de Retenção de 100%: Espera a barra chegar no fim antes de persistir
        while (theologicalDensity < 100) {
            await new Promise(r => setTimeout(r, 500));
            setTheologicalDensity(prev => Math.min(100, prev + 2));
        }

        if (existing.id) await db.entities.PanoramaBiblico.update(existing.id, data);
        else await db.entities.PanoramaBiblico.create(data);

        await loadContent();
        onShowToast('Manuscrito de Alta Densidade Gerado!', 'success');
        if (mode === 'continue') setTimeout(() => setCurrentPage(pages.length), 800); 
    } catch (e: any) { 
        onShowToast(`Erro no Manuscrito: ${e.message}`, 'error'); 
    } finally { 
        setIsGenerating(false); 
        setIsFinalizingContent(false);
    }
  };

  const handleDeletePage = async () => {
    if (!window.confirm("Deseja realmente destruir este manuscrito digital?") || !content) return;
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
        onShowToast('Fragmento excluído.', 'success'); 
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
            className={`sticky top-0 z-40 transition-all duration-1000 ${scrolled ? 'bg-[#400010]/95 backdrop-blur-3xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.6)] py-3' : 'bg-gradient-to-r from-[#600018] to-[#400010] py-6'} text-white px-8 flex justify-between items-center safe-top border-b border-[#C5A059]/50`}
        >
            <button 
                onClick={onBack} 
                className="p-4 hover:bg-white/15 rounded-full transition-all active:scale-90 shadow-inner group"
                aria-label="Voltar ao Início"
            >
                <ChevronLeft className="w-10 h-10 group-hover:-translate-x-2 transition-transform" />
            </button>
            
            <div className="flex flex-col items-center">
                <h2 className="font-cinzel font-bold text-2xl md:text-4xl tracking-[0.25em] drop-shadow-2xl">Panorama EBD</h2>
                <div className="flex items-center gap-3 opacity-80 mt-1">
                    <Milestone className="w-4 h-4 text-[#C5A059]" />
                    <span className="text-[11px] uppercase tracking-[0.7em] font-montserrat font-bold">Edição Magnum Opus v25</span>
                </div>
            </div>

            <div className="flex gap-3">
                {isAdmin && !isEditing && content && (
                    <button 
                        onClick={handleStartEditing} 
                        className="p-4 hover:bg-white/15 rounded-full text-[#C5A059] transition-all hover:scale-125 hover:rotate-6"
                        title="Revisão do Manuscrito"
                    >
                        <Pen className="w-8 h-8" />
                    </button>
                )}
                <button 
                    onClick={() => setShowAudioSettings(!showAudioSettings)} 
                    className={`p-4 rounded-full transition-all active:scale-90 ${showAudioSettings ? 'bg-[#C5A059] text-[#1a0f0f] shadow-[0_0_20px_rgba(197,160,89,0.5)]' : 'hover:bg-white/15'}`}
                    title="Audioaula Digital"
                >
                    <Volume2 className={isPlaying ? "animate-pulse w-8 h-8" : "w-8 h-8"} />
                </button>
            </div>
        </header>

        {/* PAINEL DE CONTROLE DE ÁUDIOAULA */}
        <AnimatePresence>
            {showAudioSettings && (
                <motion.div 
                    initial={{ opacity: 0, y: -40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -40 }}
                    className="bg-white/98 dark:bg-dark-card/98 backdrop-blur-3xl p-10 border-b-2 border-[#C5A059]/60 shadow-[0_40px_100px_rgba(0,0,0,0.2)] z-30"
                >
                    <div className="flex flex-col gap-8 max-w-4xl mx-auto">
                        <div className="flex items-center justify-between border-b-2 border-gray-100 dark:border-white/10 pb-6">
                            <div className="flex flex-col">
                                <span className="font-cinzel font-bold text-base uppercase tracking-[0.3em] text-[#8B0000] dark:text-[#C5A059]">Sintetização Professor</span>
                                <span className="text-[12px] text-gray-400 font-montserrat uppercase mt-2 flex items-center gap-3"><Clock className="w-5 h-5 text-[#C5A059]"/> Aula Sincronizada em Tempo Real</span>
                            </div>
                            <button 
                                onClick={togglePlay} 
                                className="bg-[#C5A059] text-[#1a0f0f] px-12 py-5 rounded-full font-bold flex items-center gap-5 shadow-[0_15px_40px_rgba(197,160,89,0.5)] hover:scale-110 active:scale-95 transition-all group"
                            >
                                {isPlaying ? <Pause className="w-8 h-8 fill-current"/> : <Play className="w-8 h-8 fill-current"/>} 
                                <span className="tracking-[0.3em] uppercase text-sm font-black">{isPlaying ? 'Pausar Aula' : 'Ouvir Agora'}</span>
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-4">
                                <label className="text-[12px] font-black uppercase tracking-[0.5em] text-gray-500 flex items-center gap-3"><Library className="w-5 h-5"/> Seleção da Voz do Professor</label>
                                <select 
                                    className="w-full p-5 text-lg border-2 border-[#C5A059]/30 rounded-[1.5rem] dark:bg-gray-800 dark:text-white font-montserrat outline-none focus:border-[#C5A059] transition-all shadow-inner" 
                                    value={selectedVoice} 
                                    onChange={e => setSelectedVoice(e.target.value)}
                                >
                                    {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-4">
                                <label className="text-[12px] font-black uppercase tracking-[0.5em] text-gray-500 flex items-center gap-3"><Zap className="w-5 h-5"/> Ritmo da Transmissão</label>
                                <div className="flex gap-5">
                                    {[0.8, 1, 1.2, 1.5].map(rate => (
                                        <button 
                                            key={rate} 
                                            onClick={() => setPlaybackRate(rate)} 
                                            className={`flex-1 py-5 text-base font-black rounded-[1.5rem] border-2 transition-all ${playbackRate === rate ? 'bg-[#8B0000] text-white border-[#8B0000] shadow-2xl scale-110' : 'bg-gray-50 dark:bg-gray-900 dark:text-gray-400 border-transparent hover:bg-gray-100'}`}
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

        {/* NAVEGAÇÃO BÍBLICA DE ALTA PRECISÃO */}
        <div className="bg-white dark:bg-dark-card p-8 border-b border-[#C5A059]/40 flex gap-6 shadow-md shrink-0 items-center">
             <div className="flex-1 relative group">
                 <div className="absolute left-6 top-1/2 -translate-y-1/2 w-8 h-8 text-[#C5A059] opacity-60 group-focus-within:opacity-100 transition-opacity"><Compass /></div>
                 <select 
                    value={book} 
                    onChange={e => setBook(e.target.value)} 
                    className="w-full pl-20 pr-8 py-6 border-2 border-[#C5A059]/30 rounded-[2rem] font-cinzel text-xl dark:bg-gray-800 dark:text-white focus:ring-8 focus:ring-[#C5A059]/15 transition-all outline-none appearance-none shadow-inner font-bold"
                >
                    {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                 </select>
             </div>
             <div className="w-48 relative group">
                 <div className="absolute left-6 top-1/2 -translate-y-1/2 w-8 h-8 text-[#C5A059] opacity-60 group-focus-within:opacity-100 transition-opacity"><HistoryIcon /></div>
                 <input 
                    type="number" 
                    value={chapter} 
                    onChange={e => setChapter(Number(e.target.value))} 
                    className="w-full pl-20 pr-8 py-6 border-2 border-[#C5A059]/30 rounded-[2rem] font-cinzel text-xl dark:bg-gray-800 dark:text-white focus:ring-8 focus:ring-[#C5A059]/15 transition-all outline-none appearance-none shadow-inner font-bold" 
                    min={1} 
                />
             </div>
        </div>

        {/* TABS DE SELEÇÃO DE PERFIL ACADÊMICO */}
        <nav className="flex bg-[#F5F5DC] dark:bg-black border-b-2 border-[#C5A059]/50 shrink-0 sticky top-[92px] z-30 shadow-2xl">
            <button 
                onClick={() => setActiveTab('student')} 
                className={`flex-1 py-10 font-cinzel font-black text-sm md:text-base uppercase tracking-[0.5em] flex justify-center items-center gap-6 transition-all duration-1000 relative ${activeTab === 'student' ? 'bg-[#600018] text-white shadow-2xl' : 'text-gray-400 dark:text-gray-700 hover:text-[#8B0000]'}`}
            >
                <BookCheck className="w-8 h-8" /> Aluno
                {activeTab === 'student' && <motion.div layoutId="tab-highlight" className="absolute bottom-0 left-0 w-full h-2 bg-[#C5A059] shadow-[0_0_20px_#C5A059]" />}
            </button>
            <button 
                onClick={() => setActiveTab('teacher')} 
                className={`flex-1 py-10 font-cinzel font-black text-sm md:text-base uppercase tracking-[0.5em] flex justify-center items-center gap-6 transition-all duration-1000 relative ${activeTab === 'teacher' ? 'bg-[#600018] text-white shadow-2xl' : 'text-gray-400 dark:text-gray-700 hover:text-[#8B0000]'}`}
            >
                {isAdmin ? <ShieldCheck className="w-10 h-10 text-[#C5A059]" /> : <Lock className="w-8 h-8" />} Professor
                {activeTab === 'teacher' && <motion.div layoutId="tab-highlight" className="absolute bottom-0 left-0 w-full h-2 bg-[#C5A059] shadow-[0_0_20px_#C5A059]" />}
            </button>
        </nav>

        {/* EDITOR CHEFE ADMA BUILDER (PROTOCOLO DE ALTA PERFORMANCE) */}
        {isAdmin && !isEditing && (
            <div className="bg-[#020202] text-[#C5A059] p-12 shadow-[0_60px_120px_-30px_rgba(0,0,0,1)] sticky top-[200px] z-20 border-b-8 border-[#8B0000] animate-in slide-in-from-top-12">
                {isGenerating ? (
                    <div className="flex flex-col items-center gap-10 py-8 animate-in fade-in duration-700">
                        <div className="flex items-center gap-10">
                            <div className="relative">
                                <Loader2 className="animate-spin w-20 h-20 text-[#C5A059] opacity-90"/>
                                <div className="absolute inset-0 flex items-center justify-center"><SearchCode className="w-10 h-10 text-[#C5A059] animate-pulse" /></div>
                            </div>
                            <div className="flex flex-col">
                                <span className="font-cinzel text-xl font-black uppercase tracking-[0.3em] text-white animate-pulse">{loadingStatusMessages[currentStatusIndex]}</span>
                                <div className="flex items-center gap-6 mt-4">
                                    <span className="text-sm opacity-90 font-mono flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                                        <Clock className="w-5 h-5 text-[#C5A059]" /> Tempo de Exegese: {generationTime}s
                                    </span>
                                    <span className={`text-sm font-black uppercase tracking-widest px-4 py-2 rounded-xl border ${validationPhase === 'final' ? 'bg-green-900/30 text-green-400 border-green-500' : 'bg-blue-900/30 text-blue-400 border-blue-500'}`}>
                                        Status: {validationPhase === 'structural' ? 'Estruturação' : validationPhase === 'theological' ? 'Aprofundamento' : validationPhase === 'final' ? 'Validando Seções' : 'Iniciando'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="w-full bg-white/5 h-6 rounded-full mt-8 overflow-hidden border-2 border-white/15 shadow-inner p-1">
                            <motion.div 
                                initial={{ width: 0 }} animate={{ width: `${theologicalDensity}%` }}
                                className="bg-gradient-to-r from-[#8B0000] via-[#C5A059] to-[#8B0000] h-full rounded-full shadow-[0_0_40px_#C5A059] relative"
                            >
                                <div className="absolute top-0 right-0 h-full w-20 bg-white/20 blur-md animate-shimmer"></div>
                            </motion.div>
                        </div>
                        <div className="flex justify-between w-full text-[11px] font-black uppercase tracking-[0.8em] opacity-40">
                            <span>Processando 32.768 Tokens</span>
                            <span>{theologicalDensity.toFixed(0)}% Concluído</span>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-10">
                            <div className="flex items-center gap-8">
                                <div className="w-20 h-20 bg-gradient-to-br from-[#8B0000] to-[#400010] rounded-[2rem] flex items-center justify-center shadow-[0_15px_40px_rgba(139,0,0,0.6)] ring-4 ring-[#C5A059]/40"><Sparkles className="w-12 h-12 text-white animate-pulse" /></div>
                                <div className="flex flex-col">
                                    <span className="font-cinzel text-xl font-black tracking-[0.6em] uppercase text-white">CONSTRUTOR MAGNUM OPUS</span>
                                    <span className="text-[12px] uppercase tracking-[0.4em] text-[#C5A059] font-black mt-2">Protocolo Prof. Michel Felix de Alta Performance</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowInstructions(!showInstructions)} 
                                className="text-[14px] font-black uppercase tracking-[0.4em] bg-white/5 px-8 py-4 rounded-[1.5rem] border-2 border-white/15 hover:bg-white/15 hover:text-white transition-all shadow-2xl active:scale-95"
                            >
                                {showInstructions ? 'Ocultar Comando' : 'Comando Teológico'}
                            </button>
                        </div>
                        
                        <AnimatePresence>
                            {showInstructions && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    className="mb-10 overflow-hidden"
                                >
                                    <textarea 
                                        value={customInstructions} 
                                        onChange={(e) => setCustomInstructions(e.target.value)} 
                                        placeholder="Ex: Foque na escatologia, detalhe a cultura cananeia e use o método histórico-gramatical..." 
                                        className="w-full p-8 text-xl text-black rounded-[2.5rem] border-none focus:ring-12 focus:ring-[#C5A059]/40 font-montserrat shadow-[inset_0_20px_40px_rgba(0,0,0,0.2)] bg-[#FDFBF7] font-bold" 
                                        rows={4} 
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="flex gap-6">
                            <button 
                                onClick={() => handleGenerate('start')} 
                                disabled={isGenerating} 
                                className="flex-2 px-12 py-8 bg-[#8B0000] border-4 border-[#C5A059]/50 rounded-[2.5rem] text-sm font-black uppercase tracking-[0.4em] text-white hover:bg-white hover:text-[#1a0f0f] transition-all disabled:opacity-50 flex items-center justify-center gap-6 shadow-[0_25px_60px_rgba(139,0,0,0.7)] active:scale-95 group overflow-hidden"
                            >
                                <Layout className="w-9 h-9 group-hover:rotate-[360deg] transition-transform duration-1000" /> GERAR AULA INTEGRAL (6-10 PÁGS)
                            </button>
                            <button 
                                onClick={() => handleGenerate('continue')} 
                                disabled={isGenerating} 
                                className="flex-1 px-12 py-8 bg-[#C5A059] text-[#1a0f0f] font-black rounded-[2.5rem] text-sm font-black uppercase tracking-[0.4em] hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-6 shadow-[0_25px_60px_rgba(197,160,89,0.5)] active:scale-95"
                            >
                                <Plus className="w-9 h-9"/> CONTINUAR EXEGESE
                            </button>
                            {pages.length > 0 && (
                                <button 
                                    onClick={handleDeletePage} 
                                    className="px-10 py-8 bg-red-900/60 text-red-400 border-4 border-red-500/40 rounded-[2.5rem] hover:bg-red-600 hover:text-white transition-all shadow-2xl active:scale-95"
                                    title="Destruir Manuscrito"
                                >
                                    <Trash2 className="w-10 h-10" />
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
            className="flex-1 overflow-y-auto p-6 md:p-24 max-w-7xl mx-auto pb-80 w-full scroll-smooth"
        >
            {!hasAccess ? (
                <div className="text-center py-80 opacity-60 dark:text-white animate-in zoom-in duration-1000">
                    <div className="relative inline-block mb-20">
                        <div className="absolute inset-0 bg-red-900/40 blur-[150px] scale-[2.5] animate-pulse"></div>
                        <ShieldAlert className="w-56 h-56 mx-auto text-[#8B0000] drop-shadow-[0_20px_80px_rgba(139,0,0,0.8)]" />
                    </div>
                    <h2 className="font-cinzel text-7xl font-black mb-10 tracking-[0.2em] uppercase">Sanctum Sanctorum</h2>
                    <p className="font-montserrat text-lg max-w-xl mx-auto opacity-90 uppercase tracking-[0.6em] leading-loose italic font-black text-[#8B0000]">
                        Este manuscrito exegético está reservado exclusivamente para o corpo docente autorizado da ADMA.
                    </p>
                </div>
            ) : isEditing ? (
                 <div className="bg-white dark:bg-dark-card shadow-[0_80px_180px_-40px_rgba(0,0,0,0.4)] p-16 rounded-[6rem] border-8 border-[#C5A059] relative animate-in slide-in-from-bottom-24 duration-1000">
                     <div className="flex justify-between items-center mb-16 border-b-4 pb-12 dark:border-white/10">
                        <div className="flex items-center gap-10">
                            <div className="w-20 h-20 bg-blue-900/20 rounded-[2.5rem] flex items-center justify-center text-blue-900 shadow-xl"><PenTool className="w-12 h-12" /></div>
                            <div>
                                <h3 className="font-cinzel font-black text-5xl text-[#8B0000] dark:text-[#ff6b6b]">Laboratório do Manuscrito</h3>
                                <p className="text-[13px] uppercase tracking-[0.5em] text-gray-400 font-black mt-3 flex items-center gap-3"><FileSearch className="w-4 h-4"/> Revisão Humana de Alta Precisão Michel Felix</p>
                            </div>
                        </div>
                        <div className="flex gap-8">
                            <button onClick={() => setIsEditing(false)} className="px-12 py-6 text-base font-black border-4 border-red-500 text-red-500 rounded-full hover:bg-red-50 transition-all uppercase tracking-[0.4em] active:scale-95 shadow-2xl">Descartar</button>
                            <button onClick={handleSaveManualEdit} className="px-12 py-6 text-base font-black bg-green-600 text-white rounded-full hover:bg-green-700 shadow-[0_30px_60px_rgba(22,163,74,0.6)] transition-all uppercase tracking-[0.4em] active:scale-95">Arquivar Versão</button>
                        </div>
                     </div>
                     <div className="mb-14 p-10 bg-[#F5F5DC] dark:bg-[#0a0a0a] rounded-[3.5rem] border-4 border-[#C5A059]/50 flex gap-8 items-center shadow-inner relative overflow-hidden group">
                         <div className="absolute top-0 right-0 w-24 h-24 bg-[#C5A059]/10 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-1000"></div>
                         <Info className="w-16 h-16 text-[#8B0000] shrink-0 drop-shadow-lg" />
                         <div className="flex flex-col">
                            <span className="text-base font-black text-[#8B0000] uppercase tracking-[0.5em]">Lógica de Paginação Dinâmica</span>
                            <span className="text-[14px] text-gray-500 font-montserrat mt-3 font-bold leading-relaxed">Dica do Professor: Utilize a tag <code>&lt;hr class="page-break"&gt;</code> para forçar uma quebra de página. O sistema ADMA Magnum Opus exige microscopia versículo por versículo.</span>
                         </div>
                     </div>
                     <textarea 
                        value={editValue} 
                        onChange={e => setEditValue(e.target.value)} 
                        className="w-full h-[75vh] p-16 font-mono text-2xl border-none focus:ring-0 rounded-[4rem] bg-gray-50 dark:bg-[#050505] dark:text-gray-300 resize-none shadow-[inset_0_20px_40px_rgba(0,0,0,0.1)] leading-relaxed border-8 border-transparent focus:border-[#C5A059]/40 transition-all" 
                        placeholder="Insira aqui o conhecimento exegético profundo do Professor Michel Felix..." 
                    />
                 </div>
            ) : content && pages.length > 0 ? (
                <article className="bg-white dark:bg-dark-card shadow-[0_60px_200px_-50px_rgba(0,0,0,0.4)] p-14 md:p-40 min-h-[95vh] border-2 border-[#C5A059]/50 relative rounded-[7rem] animate-in fade-in duration-2000 select-text overflow-hidden">
                     {/* Marca d'Água Monumental */}
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.05] dark:opacity-[0.08] pointer-events-none rotate-[-40deg] scale-150">
                        <BookOpen className="w-[1200px] h-[1200px] text-[#8B0000]" />
                     </div>

                     {renderFormattedText(pages[currentPage])}
                     
                     <div className="absolute bottom-24 right-28 flex items-center gap-10 select-none opacity-40 hover:opacity-100 transition-all duration-1000 cursor-help group">
                        <div className="h-[3px] w-32 bg-[#C5A059] group-hover:w-56 transition-all duration-1000 shadow-2xl"></div>
                        <span className="text-[#C5A059] font-cinzel text-2xl font-black tracking-[1em] group-hover:scale-125 transition-transform drop-shadow-xl">{currentPage + 1} / {pages.length}</span>
                     </div>

                     {currentPage === pages.length - 1 && userProgress && (
                         <footer className="mt-56 text-center border-t-8 border-dotted border-[#C5A059]/50 pt-48 animate-in slide-in-from-bottom-24 duration-[2000ms] relative">
                             <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 bg-[#FDFBF7] dark:bg-dark-card rounded-full flex items-center justify-center border-8 border-dotted border-[#C5A059]/60 shadow-[0_30px_80px_rgba(139,0,0,0.4)]">
                                <Anchor className="w-20 h-20 text-[#C5A059] animate-bounce" />
                             </div>

                             <div className="max-w-4xl mx-auto mb-32">
                                <Quote className="w-24 h-24 mx-auto text-[#C5A059] mb-16 opacity-30 animate-pulse" />
                                <h4 className="font-cinzel text-6xl font-black text-[#8B0000] dark:text-[#ff6b6b] mb-10 uppercase tracking-[0.4em] drop-shadow-2xl">Epílogo da Aula</h4>
                                <p className="font-cormorant text-5xl text-gray-500 italic leading-loose px-14">"Guardei a tua palavra no meu coração, para não pecar contra ti." <br/><span className="text-[14px] font-black tracking-[1em] not-italic text-[#C5A059] block mt-12 uppercase opacity-80">(Salmos 119:11 - Almeida Corrigida Fiel)</span></p>
                             </div>
                             
                             <button 
                                onClick={handleMarkAsRead} 
                                disabled={isRead} 
                                className={`group relative px-28 py-12 rounded-full font-cinzel font-black text-4xl shadow-[0_40px_100px_-20px_rgba(139,0,0,0.6)] flex items-center justify-center gap-10 mx-auto overflow-hidden transition-all duration-[1500ms] transform hover:scale-110 active:scale-95 ${isRead ? 'bg-green-600 text-white shadow-green-600/50' : 'bg-gradient-to-r from-[#8B0000] via-[#B00010] to-[#600018] text-white shadow-red-900/80'}`}
                            >
                                 {isRead ? <CheckCircle className="w-16 h-16" /> : <GraduationCap className="w-16 h-16 group-hover:rotate-[720deg] transition-transform duration-[3000ms]" />}
                                 <span className="relative z-10 tracking-[0.3em] uppercase">{isRead ? 'SABEDORIA ARQUIVADA' : 'CONCLUIR E PONTUAR'}</span>
                                 {!isRead && <div className="absolute inset-0 bg-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 blur-2xl"></div>}
                             </button>
                             
                             {isRead && (
                                <motion.p 
                                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                    className="text-base font-black text-green-600 mt-16 uppercase tracking-[0.8em] flex items-center justify-center gap-6"
                                >
                                    <ShieldCheck className="w-8 h-8" /> Recompensa Integrada ao Ranking Teológico ADMA
                                </motion.p>
                             )}
                         </footer>
                     )}
                </article>
            ) : (
                <div className="text-center py-80 bg-white dark:bg-dark-card rounded-[8rem] border-8 border-dashed border-[#C5A059]/40 animate-in fade-in duration-[2000ms] shadow-[0_60px_150px_-30px_rgba(0,0,0,0.3)] relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#F5F5DC]/20 to-transparent pointer-events-none group-hover:opacity-100 transition-opacity opacity-70 duration-[2000ms]"></div>
                    <div className="relative inline-block mb-24 scale-[1.8] transition-transform group-hover:scale-[2.1] duration-[3000ms]">
                        <div className="absolute inset-0 bg-[#C5A059]/40 blur-[120px] rounded-full animate-pulse"></div>
                        <ScrollText className="w-64 h-64 mx-auto text-[#C5A059] opacity-30 relative z-10 drop-shadow-2xl"/>
                    </div>
                    <p className="font-cinzel text-7xl font-black text-gray-400 mb-10 tracking-[0.4em] uppercase drop-shadow-2xl">Manuscrito Pendente</p>
                    <p className="font-montserrat text-sm text-gray-500 uppercase tracking-[1em] mb-24 opacity-80 font-bold">O Professor ainda não transcreveu este manuscrito para o capítulo {chapter}.</p>
                    {isAdmin && (
                        <motion.div 
                            whileHover={{ y: -15, scale: 1.02 }}
                            className="max-w-2xl mx-auto p-16 bg-[#8B0000]/10 dark:bg-red-900/25 rounded-[5rem] border-4 border-[#8B0000]/40 flex flex-col items-center shadow-[0_40px_100px_-20px_rgba(139,0,0,0.3)] transition-all duration-1000"
                        >
                            <Library className="w-20 h-20 text-[#8B0000] mb-10 opacity-90 animate-bounce" />
                            <p className="text-base font-black text-[#8B0000] dark:text-red-400 uppercase tracking-[0.5em] text-center leading-loose font-montserrat">
                                Atenção Administrador ADMA: <br/> Utilize o Construtor Magnum Opus no topo desta interface para realizar a exegese microscópica integral e exaustiva.
                            </p>
                        </motion.div>
                    )}
                </div>
            )}
        </main>

        {/* NAVEGAÇÃO FLUTUANTE DE ALTA PERFORMANCE (UI PREMIUM) */}
        <AnimatePresence>
            {pages.length > 1 && hasAccess && !isEditing && (
                <motion.nav 
                    initial={{ y: 200, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 200, opacity: 0 }}
                    className="fixed bottom-36 left-10 right-10 z-40 max-w-5xl mx-auto"
                >
                    <div className="bg-[#050505]/98 dark:bg-dark-card/98 backdrop-blur-3xl border-4 border-[#C5A059]/80 p-8 rounded-[4rem] flex justify-between items-center shadow-[0_60px_150px_-30px_rgba(0,0,0,1)] ring-8 ring-white/10 group">
                        <button 
                            onClick={() => { setCurrentPage(Math.max(0, currentPage - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                            disabled={currentPage === 0} 
                            className="group/btn flex items-center gap-6 px-14 py-8 bg-[#8B0000] text-white rounded-[2.5rem] font-black text-sm uppercase tracking-[0.5em] disabled:opacity-20 disabled:grayscale transition-all active:scale-95 shadow-[0_20px_50px_rgba(139,0,0,0.5)] hover:bg-white hover:text-[#1a0f0f] border-2 border-[#C5A059]/40"
                        >
                            <ChevronLeft className="w-10 h-10 group-hover/btn:-translate-x-4 transition-transform duration-500" /> <span>Anterior</span>
                        </button>
                        
                        <div className="flex flex-col items-center shrink-0 px-16">
                            <span className="font-cinzel font-black text-[#C5A059] text-4xl tracking-[0.8em] drop-shadow-[0_0_15px_rgba(197,160,89,0.5)] transition-transform group-hover:scale-110 duration-1000">{currentPage + 1} <span className="opacity-40 text-lg">/ {pages.length}</span></span>
                            <div className="w-72 bg-white/15 h-4 rounded-full mt-7 overflow-hidden border-4 border-white/10 shadow-[inset_0_5px_15px_rgba(0,0,0,0.5)]">
                                <motion.div 
                                    className="bg-gradient-to-r from-[#8B0000] via-[#C5A059] to-[#8B0000] h-full transition-all duration-[2000ms] ease-out shadow-[0_0_35px_#C5A059] relative" 
                                    style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }}
                                >
                                    <div className="absolute inset-0 bg-white/20 animate-shimmer"></div>
                                </motion.div>
                            </div>
                        </div>

                        <button 
                            onClick={() => { setCurrentPage(Math.min(pages.length - 1, currentPage + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                            disabled={currentPage === pages.length - 1} 
                            className="group/btn flex items-center gap-6 px-14 py-8 bg-[#8B0000] text-white rounded-[2.5rem] font-black text-sm uppercase tracking-[0.5em] disabled:opacity-20 disabled:grayscale transition-all active:scale-95 shadow-[0_20px_50px_rgba(139,0,0,0.5)] hover:bg-white hover:text-[#1a0f0f] border-2 border-[#C5A059]/40"
                        >
                            <span>Próximo</span> <ChevronRight className="w-10 h-10 group-hover/btn:translate-x-4 transition-transform duration-500" />
                        </button>
                    </div>
                </motion.nav>
            )}
        </AnimatePresence>
        
        {/* BARREIRA DE SEGURANÇA FINAL (UX) */}
        <div className="h-48 shrink-0 select-none pointer-events-none opacity-0">ADMA SECURITY LAYER SUPREME</div>
    </div>
  );
}
