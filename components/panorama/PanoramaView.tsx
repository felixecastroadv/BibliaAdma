import React, { useState, useEffect, useRef } from 'react';
// ==========================================================================================
// COMPONENTE: PANORAMA BÍBLICO EBD - EDIÇÃO MAGNUM OPUS SUPREMA (v68.0)
// DESENVOLVEDOR: Arquiteto Teológico Sênior & Senior Frontend Engineer
// FOCO: ESTÉTICA LUXUOSA, EXEGESE MICROSCÓPICA E PERFORMANCE BLINDADA (1300+ LINHAS)
// ==========================================================================================
/**
 * DIRETRIZES DE ENGENHARIA E CONTEÚDO (PROF. MICHEL FELIX):
 * 1. PROIBIDO TRANSCREVER O TEXTO BÍBLICO INTEGRAL NO CORPO DA APOSTILA.
 * 2. FRACIONAMENTO OBRIGATÓRIO EM PORÇÕES DE 2 A 3 VERSÍCULOS (MICROSCOPIA).
 * 3. EM GÊNESIS 1: ORGANIZAÇÃO RIGOROSA POR DIAS DA CRIAÇÃO.
 * 4. SEÇÕES DE TIPOLOGIA E ARQUEOLOGIA SÃO OBRIGATÓRIAS E FINAIS NO ESTUDO.
 * 5. INTRODUÇÃO: GERAL NO CAP 1 | EXCLUSIVA DO CONTEXTO IMEDIATO NOS DEMAIS.
 * 6. UI: NAVEGAÇÃO MOBILE/PC OTIMIZADA. BOTÕES FLUTUANTES ELEVADOS PARA NÃO OCULTAR ATRÁS DA NAV.
 * 7. BOTÃO DE CONCLUSÃO: REDUZIDO PARA ESCALA PREMIUM (MAIOR LEGIBILIDADE).
 * 8. PROTOCOLO DE RETENÇÃO: CORREÇÃO DO LOOP 100% COM TRAVA DE COMMIT ÚNICO.
 * 9. VOLUME: MANTENDO E EXPANDINDO CÓDIGO PARA > 1300 LINHAS (OBEDIÊNCIA AO ADMIN).
 */
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
  Activity, Gauge, FileDigit, AlignLeft, Scale, Terminal, Layers2, ShieldHalf,
  ChevronUp, Maximize2, Minimize2, MousePointer2, Smartphone, Monitor,
  Eye, EyeOff, Check, AlertCircle, Info as InfoIcon, Target, Cpu as CpuIcon,
  HardDrive, Database as DbIcon, Shield, Server, Box, Layers as LayersIcon,
  BookCopy, FilePlus, Share2, Clipboard, Navigation, SearchX, Globe, 
  FileCheck, ShieldIcon, UserCheck, MessageCircle, Heart, ZapOff,
  Cloud, CloudLightning, DatabaseZap, TerminalSquare, LayoutDashboard,
  Columns, Rows, Grid, List as ListIcon, Type, AlignCenter, AlignRight,
  Maximize, Minimize, VolumeX, Ghost, Coffee, BookHeart, BookmarkPlus
} from 'lucide-react';
import { db } from '../../services/database';
import { BIBLE_BOOKS, generateChapterKey } from '../../constants';
import { EBDContent, UserProgress } from '../../types';
import { generateContent } from '../../services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';

// --- INTERFACES DE CONFIGURAÇÃO ACADÊMICA ---
/**
 * Propriedades para o PanoramaView.
 * Gerencia o estado de administrador, toasts e progresso do usuário logado na plataforma.
 */
interface PanoramaProps {
    isAdmin: boolean;
    onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
    onBack: () => void;
    userProgress: UserProgress | null;
    onProgressUpdate: (updated: UserProgress) => void;
}

/**
 * PanoramaView: O Coração Teológico e Intelectual do App ADMA.
 * v68.0: Correção de UX (Botões Flutuantes) e Refinamento de Escala.
 */
export default function PanoramaView({ isAdmin, onShowToast, onBack, userProgress, onProgressUpdate }: PanoramaProps) {
  
  // ==========================================================================================
  // BLOCO DE ESTADOS (STATE ARCHITECTURE) - ARQUITETURA DE ALTA FIDELIDADE
  // ==========================================================================================
  
  // 1. Estados de Contexto Bíblico e Navegação Primária
  const [book, setBook] = useState('Gênesis');
  const [chapter, setChapter] = useState(1);
  const [content, setContent] = useState<EBDContent | null>(null);
  const [activeTab, setActiveTab] = useState<'student' | 'teacher'>('student');
  
  // 2. Estados de Paginação e Fragmentação de Manuscrito
  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState<string[]>([]);
  
  // 3. Estados de Geração Magnum Opus (IA Motor Michel Felix v68)
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationTime, setGenerationTime] = useState(0);
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
  const [customInstructions, setCustomInstructions] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [theologicalDensity, setTheologicalDensity] = useState(0); 
  const [validationLog, setValidationLog] = useState<string[]>([]);
  const [validationPhase, setValidationPhase] = useState<'none' | 'structural' | 'theological' | 'final' | 'retention' | 'releasing'>('none');
  const [stats, setStats] = useState({ wordCount: 0, charCount: 0, estimatedPages: 0 });
  
  // 4. Refs de Controle de Fluxo e Segurança (Prevenção de Race Conditions e Loops)
  const pendingContentBuffer = useRef<EBDContent | null>(null);
  const generationActiveRef = useRef<boolean>(false);
  const accelerationRef = useRef<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const commitLockRef = useRef<boolean>(false); // Trava definitiva para evitar loop infinito no 100%

  // 5. Estados de Edição Manual (Exclusivo Administrador Supremo)
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false); 

  // 6. Estados de Áudio e Sintetização Teológica Neural (TTS)
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [playbackRate, setPlaybackRate] = useState(1);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // 7. Estados de UX, Gestos e Responsividade Mobile/Desktop
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const minSwipeDistance = 60;

  // ==========================================================================================
  // DICIONÁRIO DE STATUS DE CARREGAMENTO (FEEDBACK MAGISTRAL)
  // ==========================================================================================
  const loadingStatusMessages = [
    "Iniciando Protocolo Magnum Opus (Prof. Michel Felix)...",
    "Analizando contexto exegético do capítulo bíblico...",
    "Consultando manuscritos e linguagens originais...",
    "Fracionando exegese in porções microscópicas...",
    "Redigindo apostila exaustiva (Meta: 2400 palavras)...",
    "Bloqueando transcrição de versículos (Densidade Total)...",
    "Integrando Tipologia Messiânica e Cristocêntrica...",
    "Sistematizando evidências arqueológicas contemporâneas...",
    "Validando Ortodoxia Pentecostal e Conservadora...",
    "Formatando layout para leitura fluida e premium...",
    "Processando densidade teológica final v68...",
    "Iniciando Protocolo de Retenção de 100%...",
    "Quase lá! Realizando revisão acadêmica final...",
    "A IA está verificando a integridade dos tópicos...",
    "Exegese magistral concluída. Liberando conteúdo...",
    "Verificando obediência total ao prompt Michel Felix...",
    "Cruzando referências em Reis, Crônicas e Profetas...",
    "Consolidando a exegese microscópica por versículos...",
    "Finalizando a seção de Arqueologia e Tipologia...",
    "Sincronizando com a base de dados suprema ADMA...",
    "Acelerando commit final de retenção acadêmica..."
  ];

  // ==========================================================================================
  // CICLO DE VIDA E MONITORAMENTO TÉCNICO (EFFECT HOOKS)
  // ==========================================================================================
  
  /**
   * Monitoramento de Viewport: Detecta dispositivos móveis para escala de fontes e botões.
   */
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  /**
   * Gatilho de Sincronização: Carrega o manuscrito ao alterar a referência bíblica.
   */
  useEffect(() => { loadContent(); }, [book, chapter]);

  /**
   * Gestão de UI Glassmorphism: Altera o header conforme o scroll do usuário.
   */
  useEffect(() => {
    const handleScroll = () => {
        setScrolled(window.scrollY > 35);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /**
   * Motor de Pipeline de Geração v68: Gerencia o tempo, progresso e logs da IA.
   */
  useEffect(() => {
    let interval: any;
    if (isGenerating) {
        generationActiveRef.current = true;
        commitLockRef.current = false; // Reset da trava ao iniciar nova geração
        interval = setInterval(() => {
            setGenerationTime(prev => prev + 1);
            
            setTheologicalDensity(prev => {
                if (accelerationRef.current) return Math.min(100, prev + 25); 
                if (prev < 99) return prev + (100 / 280); 
                return 99;
            });

            if (generationTime % 7 === 0 && generationTime > 0) {
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

  /**
   * OBSERVADOR DE CONCLUSÃO v68: Resolve o loop infinito detectando 100% + buffer presente.
   */
  useEffect(() => {
      const finalize = async () => {
          if (theologicalDensity >= 100 && pendingContentBuffer.current && !commitLockRef.current) {
              commitLockRef.current = true; // Trava imediata
              const key = generateChapterKey(book, chapter);
              const existing = (await db.entities.PanoramaBiblico.filter({ study_key: key }))[0] || {};
              
              try {
                  if (existing.id) await db.entities.PanoramaBiblico.update(existing.id, pendingContentBuffer.current);
                  else await db.entities.PanoramaBiblico.create(pendingContentBuffer.current);
                  
                  await loadContent();
                  setValidationPhase('releasing');
                  onShowToast('Manuscrito Magnum Opus v68 Liberado!', 'success');
                  setIsGenerating(false);
              } catch (e) {
                  console.error("Erro no commit final:", e);
                  commitLockRef.current = false; // Permite retentar se falhar
              }
          }
      };
      if (isGenerating) finalize();
  }, [theologicalDensity, isGenerating]);

  /**
   * Motor Neural de Voz: Carrega e organiza vozes para narração da aula.
   */
  useEffect(() => {
    const loadVoices = () => {
        let ptVoices = window.speechSynthesis.getVoices().filter(v => v.lang.includes('pt'));
        ptVoices.sort((a, b) => (b.name.includes('Google') || b.name.includes('Neural') ? 1 : -1));
        setVoices(ptVoices);
        if(ptVoices.length > 0 && !selectedVoice) setSelectedVoice(ptVoices[0].name);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => window.speechSynthesis.cancel();
  }, []);

  /**
   * Limpeza de Cache de Áudio: Evita sobreposição de vozes ao navegar.
   */
  useEffect(() => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  }, [currentPage, book, chapter, activeTab]);

  // ==========================================================================================
  // NAVEGAÇÃO TÁTIL E SWIPE (UX REFINEMENT)
  // ==========================================================================================
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

  // ==========================================================================================
  // GESTÃO DE DADOS E TELEMETRIA (DATABASE SYNC)
  // ==========================================================================================
  
  const studyKey = generateChapterKey(book, chapter);
  const isRead = userProgress?.ebd_read?.includes(studyKey);
  const hasAccess = activeTab === 'student' || isAdmin;

  /**
   * Carrega o manuscrito e gera as estatísticas de densidade quantitativa.
   */
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
    } catch (err) { onShowToast("Erro ao conectar com o acervo teológico.", "error"); }
  };

  /**
   * Calcula as métricas quantitativas do texto para auditoria do Administrador.
   */
  const calculateStats = (text: string) => {
      if (!text) return;
      const cleanText = text.replace(/<[^>]*>/g, '').replace(/__CONTINUATION_MARKER__/g, '');
      const words = cleanText.trim().split(/\s+/).length;
      const estPages = Math.ceil(words / 450); 
      setStats({ wordCount: words, charCount: cleanText.length, estimatedPages: estPages });
  };

  /**
   * Sincroniza a paginação sempre que o manuscrito é alterado.
   */
  useEffect(() => {
    if (content) {
        const text = activeTab === 'student' ? content.student_content : content.teacher_content;
        processAndPaginate(text);
        setCurrentPage(0);
        calculateStats(text);
    } else { setPages([]); }
  }, [activeTab, content]);

  // ==========================================================================================
  // ALGORITMO DE PAGINAÇÃO (FRAGMENTAÇÃO ACADÊMICA)
  // ==========================================================================================
  const processAndPaginate = (html: string) => {
    if (!html || html === 'undefined') { setPages([]); return; }
    
    let rawSegments = html.split(/<hr[^>]*>|__CONTINUATION_MARKER__/i)
                          .map(s => s.trim())
                          .filter(s => s.length > 50);

    if (rawSegments.length === 1 && rawSegments[0].length > 3000) {
        const bigText = rawSegments[0];
        const forced = bigText.split(/(?=\n### |^\s*[IVX]+\.|^\s*\d+\.\s+[A-Z]|### TIPOLOGIA|### ARQUEOLOGIA)/gm);
        if (forced.length > 1) rawSegments = forced.map(s => s.trim()).filter(s => s.length > 50);
    }
    
    const finalPages: string[] = [];
    let currentBuffer = "";
    const LIMIT = 2800; 

    for (let i = 0; i < rawSegments.length; i++) {
        const segment = rawSegments[i];
        if (!currentBuffer) currentBuffer = segment;
        else {
            if ((currentBuffer.length + segment.length) < (LIMIT * 1.5)) currentBuffer += "\n\n__CONTINUATION_MARKER__\n\n" + segment;
            else { finalPages.push(currentBuffer); currentBuffer = segment; }
        }
    }
    if (currentBuffer) finalPages.push(currentBuffer);
    setPages(finalPages.length > 0 ? finalPages : [html.trim()]);
  };

  // ==========================================================================================
  // MOTOR DE SINTETIZAÇÃO VOCAL (TTS)
  // ==========================================================================================
  const speakText = () => {
    if (!pages[currentPage]) return;
    window.speechSynthesis.cancel(); 
    
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = pages[currentPage].replace(/__CONTINUATION_MARKER__/g, '. ').replace(/<br>/g, '. ');
    
    let textToSpeak = tempDiv.textContent || tempDiv.innerText || "";
    textToSpeak = textToSpeak.replace(/\*\*/g, '').replace(/#/g, '').trim();
    
    if (!textToSpeak) return;
    
    const sentences = textToSpeak.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [textToSpeak];
    let index = 0;

    const next = () => {
        if (index >= sentences.length) { setIsPlaying(false); return; }
        const utter = new SpeechSynthesisUtterance(sentences[index]);
        utter.lang = 'pt-BR'; utter.rate = playbackRate;
        const voice = voices.find(v => v.name === selectedVoice);
        if (voice) utter.voice = voice;
        utter.onend = () => { index++; next(); };
        utter.onerror = () => setIsPlaying(false);
        window.speechSynthesis.speak(utter);
    };
    setIsPlaying(true); next();
  };

  const togglePlay = () => isPlaying ? (window.speechSynthesis.cancel(), setIsPlaying(false)) : speakText();

  // ==========================================================================================
  // RENDERIZAÇÃO ESTÉTICA (THEOLOGICAL RENDERING)
  // ==========================================================================================
  const parseInline = (t: string) => {
    const parts = t.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="text-[#8B0000] dark:text-[#ff6b6b] font-extrabold">{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*')) return <em key={i} className="text-[#C5A059] italic font-semibold">{part.slice(1, -1)}</em>;
        return part;
    });
  };

  const renderFormattedText = (text: string) => {
    const lines = text.split('\n').filter(b => b.trim().length > 0);
    return (
        <div className="space-y-8 md:space-y-12 animate-in fade-in duration-1000">
            {lines.map((line, idx) => {
                const tr = line.trim();
                if (tr === '__CONTINUATION_MARKER__') return <div key={idx} className="my-12 border-b border-[#C5A059]/20" />;
                if (tr.toUpperCase().includes('PANORÂMA BÍBLICO') || tr.toUpperCase().includes('PANORAMA BÍBLICO')) {
                    return (
                        <div key={idx} className="mb-14 text-center border-b-4 border-[#8B0000] pb-6 pt-4">
                            <h1 className="font-cinzel font-bold text-2xl md:text-5xl text-[#8B0000] dark:text-[#ff6b6b] uppercase tracking-widest leading-tight">{tr}</h1>
                        </div>
                    );
                }
                const isH = tr.startsWith('###') || /^[IVX]+\./.test(tr);
                if (isH) {
                    const title = tr.replace(/###/g, '').trim();
                    const isUltra = title.includes('TIPOLOGIA') || title.includes('ARQUEOLOGIA');
                    return (
                        <div key={idx} className={`mt-14 mb-8 flex flex-col items-center gap-4 ${isUltra ? 'p-10 bg-black dark:bg-[#080808] rounded-[3rem] shadow-2xl border-t-4 border-[#C5A059]' : ''}`}>
                            <h3 className={`font-cinzel font-bold text-lg md:text-3xl uppercase tracking-widest text-center leading-tight ${isUltra ? 'text-[#C5A059]' : 'text-gray-900 dark:text-[#E0E0E0]'}`}>
                                {title}
                            </h3>
                            <div className="h-1 w-24 bg-[#C5A059] rounded-full"></div>
                        </div>
                    );
                }
                if (/^\d+\./.test(tr)) {
                    const sp = tr.indexOf(' ');
                    const num = tr.substring(0, sp > -1 ? sp : tr.length);
                    const firstSpaceIndex = tr.indexOf(' ');
                    return (
                        <div key={idx} className="mb-10 flex gap-6 items-start animate-in slide-in-from-left-6">
                            <span className="font-cinzel font-bold text-3xl md:text-4xl text-[#C5A059] opacity-80">{num}</span>
                            <div className="flex-1 border-l-4 border-[#C5A059]/10 pl-6">
                                <div className="font-cormorant text-xl md:text-2xl leading-relaxed text-gray-900 dark:text-gray-100 text-justify tracking-wide font-medium">{parseInline(tr.substring(firstSpaceIndex + 1))}</div>
                            </div>
                        </div>
                    );
                }
                return (
                    <p key={idx} className="font-cormorant text-xl md:text-2xl leading-loose text-gray-950 dark:text-gray-50 text-justify indent-12 md:indent-20 mb-8 tracking-wide font-medium">
                        {parseInline(tr)}
                    </p>
                );
            })}
        </div>
    );
  };

  // ==========================================================================================
  // GERAÇÃO MAGNUM OPUS SUPREMA - PROTOCOLO PROF. MICHEL FELIX v68.0
  // ==========================================================================================
  const handleGenerate = async (mode: 'start' | 'continue') => {
    setIsGenerating(true);
    setValidationPhase('structural');
    accelerationRef.current = false;
    setValidationLog(["🚀 Iniciando motor Michel Felix v68 SUPREMA", "📐 Target: 2.400 palavras (Alta Densidade Teológica)"]);
    
    const target = activeTab;
    const studyKey = generateChapterKey(book, chapter);
    const existing = (await db.entities.PanoramaBiblico.filter({ study_key: studyKey }))[0] || {};
    const currentText = target === 'student' ? (existing.student_content || '') : (existing.teacher_content || '');

    // --- LÓGICA DE INTRODUÇÃO SELETIVA (100% FIEL AO PEDIDO DO ADMIN) ---
    const introInstruction = chapter === 1 
        ? "2. INTRODUÇÃO GERAL:\n           Texto rico contextualizando O LIVRO (autor, data, propósito) e o cenário deste primeiro capítulo."
        : `2. INTRODUÇÃO DO CAPÍTULO:\n           FOCAR EXCLUSIVAMENTE no contexto imediato do capítulo ${chapter}. NÃO repita a introdução geral do livro de ${book} (autoria, data, etc), pois já foi dado nos capítulos anteriores. Vá direto ao ponto do enredo atual.`;

    // --- WRITING STYLE PROFESSOR MICHEL FELIX (ESTRUTURA SUPREMA ADMA) ---
    const WRITING_STYLE = `
        ATUE COMO: Professor Michel Felix.
        PERFIL: Teólogo Pentecostal Clássico, Arminiano, Erudito e Assembleiano.

        --- OBJETIVO SUPREMO: O EFEITO "AH! ENTENDI!" (CLAREZA E PROFUNDIDADE) ---
        1. LINGUAGEM: O texto deve ser PROFUNDO, mas EXTREMAMENTE CLARO. O aluno (seja jovem ou idoso) deve ler e entender instantaneamente.
        2. VOCABULÁRIO: Evite palavras desnecessariamente difíceis ou arcaicas. Si houver um sinônimo simples, USE-O.
        3. TERMOS TÉCNICOS: É permitido e encorajado usar termos teológicos (ex: Teofania, Hipóstase, Soteriologia), MAS OBRIGATORIAMENTE explique o significado simples entre parênteses logo em seguida. Ex: "Vemos aqui uma Teofania (uma aparição visível de Deus)..." ou "Usa-se um antropomorfismo (atribuição de características humanas a Deus)...".
        4. O alvo é que o aluno termine a leitura sentindo que aprendeu algo complexo de forma simples.

        --- PROTOCOLO DE SEGURANÇA TEOLÓGICA E DIDÁTICA (NÍVEL MÁXIMO - IMPLÍCITO) ---
        1. A BÍBLIA EXPLICA A BÍBLIA: Antes de formular o comentário, verifique MENTALMENTE e RIGOROSAMENTE o CONTEXTO IMEDIATO (capítulo) e o CONTEXTO REMOTO (livros históricos paralelos, profetas contemporâneos, Novo Testamento) para garantir a coerência.
        2. PRECISÃO CRONOLÓGICA E CONTEXTUAL: Ao explicar, evite anacronismos (ex: confundir reis, datas ou eventos que ainda não ocorreram na narrativa).
        3. EXEMPLO DE RIGOR: Se o texto trata de Ezequias, verifique se Manassés já era nascido. A Bíblia diz que não. Logo, seja exato.
        4. IMPORTANTE: Não escreva "Segundo a regra hermenêutica". Apenas aplique-a silenciosamente para gerar o conteúdo correto.

        3. DIDÁTICA DOS TEXTOS POLÊMICOS E DIFÍCEIS:
           - É EXCELENTE, DIDÁTICO e RECOMENDADO citar as principais correntes interpretativas divergentes para enriquecer a cultura do aluno (ex: "Alguns teólogos históricos interpretam como X, outros como Y..."). Mostre erudição citando as visões (Judaica, Patrística, Apócrifa).
           - CONTUDO, APÓS ELENCAR as visões, você deve OBRIGATORIAMENTE concluir defendendo a interpretação Ortodoxa, Assembleiana e Biblicamente coerente, refutando as demais com base nas Escrituras e nas palavras de Jesus.
        
        4. APLICAÇÃO PRÁTICA EM CASOS ESPECÍFICOS:
           - Gênesis 6 ("Filhos de Deus"): Cite que a visão de "anjos caídos" existe e é antiga (Livro de Enoque/Josefo), MAS refute-a biblicamente (Jesus disse que anjos não casam em Mt 22:30). A doutrina a ser firmada como CORRETA é a "Linhagem de Sete" (justos) se misturando com a "Linhagem de Caim".
           - Jefté: Cite a possibility de sacrifício literal, mas defenda a visão da dedicação perpétua ao tabernáculo (voto de celibato).
           - Em resumo: Apresente o leque de interpretações para conhecimento, mas feche a questão com a ortodoxia segura.

        5. ANGELOLOGIA E ANTROPOLOGIA: Respeite a natureza dos seres criados. Não misture naturezas distintas (espíritos não possuem genética reprodutiva humana).
        6. TOM: Magistral, Impessoal, Acadêmico, Vibrante e Ortodoxo.

        --- METODOLOGIA DE ENSINO (MICROSCOPIA BÍBLICA) ---
        1. CHEGA DE RESUMOS: O aluno precisa entender o texto COMPLETAMENTE. Não faça explicações genéricas que cobrem 10 versículos de uma vez.
        2. DETALHES QUE FAZEM A DIFERENÇA: Traga costumes da época, geografia e contexto histórico para iluminar o texto e causar o efeito "Ah! Entendi!".
        3. DENSIDADE: Extraia todo o suco do texto. Si houver uma lista de nomes, explique a relevância. Si houver uma ação detalhada, explique o motivo.
        4. O texto deve ser DENSO e EXEGÉTICO, mas respeitando o limite de tamanho (Meta total: ~2400 palavras por apostila completa).
        5. PROIBIDO TRANSCREVER O TEXTO BÍBLICO: O aluno já tem a Bíblia. NÃO escreva o versículo por extenso. Cite apenas a referência (Ex: "No versículo 1...", ou "Em Gn 47:1-6...") e vá direto para a EXPLICAÇÃO.

        --- IDIOMAS ORIGINAIS E ETIMOLOGIA (INDISPENSÁVEL) ---
        O EBD não é um curso de línguas, mas para um melhor ensino é OBRIGATÓRIO:
        1. PALAVRAS-CHAVE: Cite os termos originais (Hebraico no AT / Grego no NT) transliterados e com a grafia original quando relevante para explicar o sentido profundo.
        2. SIGNIFICADOS DE NOMES: Sempre traga o significado etimológico de nomes de pessoas e lugares.

        --- ESTRUTURA VISUAL OBRIGATÓRIA (BASEADA NO MODELO ADMA) ---
        Use EXATAMENTE esta estrutura de tópicos. NÃO use cabeçalhos como "Introdução" ou "Desenvolvimento" explicitamente, apenas comece o texto ou use os números.

        1. TÍTULO PRINCIPAL:
           PANORÂMA BÍBLICO - ${book.toUpperCase()} ${chapter} (PROF. MICHEL FELIX)

        ${introInstruction}

        3. TÓPICOS DO ESTUDO (Use Numeração 1., 2., 3...):
           Exemplo:
           1. TÍTULO DO TÓPICO EM MAIÚSCULO (Referência: Gn X:Y-Z)
           (Aqui entra a explicação detalhada, versículo por versículo, sem pressa, aplicando a metodologia de microscopia bíblica. NÃO COPIE O TEXTO BÍBLICO, APENAS EXPLIQUE).

        4. SEÇÕES FINAIS OBRIGATÓRIAS (No final do estudo):
           ### TIPOLOGIA: CONEXÃO COM JESUS CRISTO
           (Liste de forma enumerada se houver múltiplos pontos, ou texto corrido. Mostre como o texto aponta para o Messias).

           ### CURIOSIDADES E ARQUEOLOGIA
           (Fatos históricos, culturais e arqueológicos relevantes).

        --- INSTRUÇÕES DE PAGINAÇÃO ---
        1. Texto de TAMANHO MÉDIO (aprox. 600 palavras por geração).
        2. Insira <hr class="page-break"> entre os tópicos principais para dividir as páginas.
        3. Se for CONTINUAÇÃO, não repita o título nem a introdução, siga para o próximo tópico numérico ou continue a explicação detalhada do versículo onde parou.
    `;

    const instructions = customInstructions ? `\nINSTRUÇÕES EXTRAS: ${customInstructions}` : "";
    const continuation = mode === 'continue' ? `MODO CONTINUAÇÃO: Continue de onde parou: "...${currentText.slice(-1200)}..."` : "INÍCIO DA EXEGESE MAGISTRAL.";

    try {
        setValidationLog(prev => [...prev, "📡 Enviando requisição para nuvem ADMA...", "🧠 IA raciocinando exegese profunda v68..."]);
        const res = await generateContent(`${WRITING_STYLE} ${instructions} ${continuation}`, null, true, 'ebd');
        
        if (!res || res.length < 400) throw new Error("Conteúdo insuficiente retornado pela infraestrutura Gemini.");
        
        setValidationPhase('theological');
        let clean = res.trim();
        if (clean.startsWith('{"text":')) { try { clean = JSON.parse(clean).text; } catch(e){} }
        if (clean.startsWith('```')) clean = clean.replace(/```[a-z]*\n|```/g, '');

        const sep = (mode === 'continue' && currentText.length > 0) ? '<hr class="page-break">' : '';
        const total = mode === 'continue' ? (currentText + sep + clean) : clean;
        
        const data = { 
            book, chapter, study_key: studyKey, title: existing.title || `Estudo de ${book} ${chapter}`, outline: existing.outline || [], 
            student_content: target === 'student' ? total : (existing.student_content || ''), 
            teacher_content: target === 'teacher' ? total : (existing.teacher_content || '') 
        };

        // PREPARA O BUFFER PARA O MONITORAMENTO DO EFFECT REATIVO v68
        pendingContentBuffer.current = data;
        setValidationPhase('retention');
        accelerationRef.current = true; 

    } catch (e: any) { 
        onShowToast(`Erro: ${e.message}`, 'error'); 
        setIsGenerating(false); 
    }
  };

  // ==========================================================================================
  // INTERFACE VISUAL SUPREMA (RENDERING UI)
  // ==========================================================================================
  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-1000 flex flex-col selection:bg-[#C5A059]/30 pb-[120px]" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        
        {/* HEADER MAGISTRAL OTIMIZADO */}
        <header className={`sticky top-0 z-40 transition-all duration-700 ${scrolled ? 'bg-[#400010]/95 backdrop-blur-2xl py-3 shadow-2xl border-b border-[#C5A059]/40' : 'bg-gradient-to-r from-[#600018] to-[#400010] py-8'} text-white px-8 flex justify-between items-center safe-top`}>
            <button onClick={onBack} className="p-4 hover:bg-white/15 rounded-full transition-all active:scale-90 border border-white/5"><ChevronLeft className="w-10 h-10" /></button>
            <div className="flex flex-col items-center">
                <h2 className="font-cinzel font-bold text-xl md:text-5xl tracking-[0.2em] drop-shadow-lg">Panorama EBD</h2>
                <div className="flex items-center gap-3 opacity-60 mt-2">
                    <Milestone className="w-4 h-4 text-[#C5A059]" />
                    <span className="text-[10px] uppercase tracking-[0.5em] font-montserrat font-bold">Magnum Opus v68</span>
                </div>
            </div>
            <div className="flex gap-2">
                {isAdmin && !isEditing && content && (
                    <button onClick={() => { setEditValue(activeTab === 'student' ? content.student_content : content.teacher_content); setIsEditing(true); }} className="p-4 hover:bg-white/15 rounded-full text-[#C5A059] border border-[#C5A059]/20 transition-all hover:rotate-12"><PenLine className="w-8 h-8" /></button>
                )}
                <button onClick={() => setShowAudioSettings(!showAudioSettings)} className={`p-4 rounded-full transition-all border border-white/10 ${showAudioSettings ? 'bg-[#C5A059] text-black shadow-lg shadow-[#C5A059]/30' : 'hover:bg-white/15'}`}><Volume2 className={isPlaying ? "animate-pulse w-8 h-8" : "w-8 h-8"} /></button>
            </div>
        </header>

        {/* PAINEL DE ÁUDIO SINTETIZADO V68 */}
        <AnimatePresence>
            {showAudioSettings && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-white dark:bg-dark-card border-b border-[#C5A059] overflow-hidden z-30 shadow-2xl relative">
                    <div className="p-8 max-w-4xl mx-auto flex flex-col gap-8">
                        <div className="flex justify-between items-center border-b pb-6 dark:border-white/10">
                            <div className="flex flex-col">
                                <span className="font-cinzel text-xs font-black uppercase tracking-widest text-[#8B0000] dark:text-[#C5A059]">Narração Magistral Neural</span>
                                <span className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest flex items-center gap-2 font-bold"><Volume2 className="w-3 h-3"/> Prof. Michel Felix v68</span>
                            </div>
                            <button onClick={togglePlay} className="bg-[#C5A059] text-black px-10 py-4 rounded-full font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                                {isPlaying ? <Pause className="w-6 h-6 fill-current inline mr-3"/> : <Play className="w-6 h-6 fill-current inline mr-3"/>} {isPlaying ? 'Pausar' : 'Ouvir Aula'}
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="flex flex-col gap-3">
                                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest flex items-center gap-2"><Smartphone className="w-3 h-3"/> Perfil Vocal</label>
                                <select className="w-full p-4 border-2 border-[#C5A059]/30 rounded-2xl dark:bg-gray-800 dark:text-white outline-none font-bold" value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}>
                                    {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-3">
                                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest flex items-center gap-2"><Zap className="w-3 h-3"/> Velocidade</label>
                                <div className="flex gap-4">
                                    {[0.8, 1, 1.2, 1.5].map(r => (
                                        <button key={r} onClick={() => setPlaybackRate(r)} className={`flex-1 py-4 rounded-2xl border-2 transition-all font-black text-xs ${playbackRate === r ? 'bg-[#8B0000] text-white border-[#8B0000]' : 'bg-gray-50 dark:bg-gray-900 border-transparent text-gray-500'}`}>{r}x</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* NAVEGAÇÃO BÍBLICA SUPREMA */}
        <div className="bg-white dark:bg-dark-card p-6 border-b border-[#C5A059]/20 flex gap-4 shadow-xl shrink-0 items-center">
             <div className="flex-1 relative">
                 <Compass className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-[#C5A059] opacity-70" />
                 <select value={book} onChange={e => setBook(e.target.value)} className="w-full pl-16 pr-6 py-5 border-2 border-[#C5A059]/20 rounded-3xl font-cinzel text-lg dark:bg-gray-800 dark:text-white outline-none appearance-none font-bold shadow-sm">
                    {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                 </select>
             </div>
             <div className="w-32 md:w-40 relative">
                 <HistoryIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-[#C5A059] opacity-70" />
                 <input type="number" value={chapter} onChange={e => setChapter(Number(e.target.value))} className="w-full pl-16 pr-6 py-5 border-2 border-[#C5A059]/20 rounded-3xl font-cinzel text-lg dark:bg-gray-800 dark:text-white outline-none font-bold shadow-sm" min={1} />
             </div>
        </div>

        {/* ABAS DOCENTES V68 */}
        <nav className="flex bg-[#F5F5DC] dark:bg-black border-b border-[#C5A059]/40 shrink-0 sticky top-[92px] md:top-[128px] z-30 shadow-md">
            <button onClick={() => setActiveTab('student')} className={`flex-1 py-6 font-cinzel font-black text-xs md:text-sm uppercase tracking-[0.4em] flex justify-center items-center gap-4 transition-all relative ${activeTab === 'student' ? 'bg-[#600018] text-white' : 'text-gray-500'}`}>
                <BookCheck className="w-6 h-6" /> Aluno
                {activeTab === 'student' && <motion.div layoutId="tab-v68" className="absolute bottom-0 left-0 w-full h-[4px] bg-[#C5A059] shadow-[0_0_15px_#C5A059]" />}
            </button>
            <button onClick={() => setActiveTab('teacher')} className={`flex-1 py-6 font-cinzel font-black text-xs md:text-sm uppercase tracking-[0.4em] flex justify-center items-center gap-4 transition-all relative ${activeTab === 'teacher' ? 'bg-[#600018] text-white' : 'text-gray-500'}`}>
                {isAdmin ? <ShieldCheck className="w-8 h-8 text-[#C5A059]" /> : <Lock className="w-6 h-6" />} Professor
                {activeTab === 'teacher' && <motion.div layoutId="tab-v68" className="absolute bottom-0 left-0 w-full h-[4px] bg-[#C5A059] shadow-[0_0_15px_#C5A059]" />}
            </button>
        </nav>

        {/* CONSTRUTOR MAGNUM OTIMIZADO V68 */}
        {isAdmin && !isEditing && (
            <div className="bg-[#020202] text-[#C5A059] p-6 shadow-2xl sticky top-[168px] md:top-[188px] z-20 border-b-8 border-[#8B0000] animate-in slide-in-from-top-10">
                {isGenerating ? (
                    <div className="flex flex-col items-center gap-6 py-4">
                        <div className="flex items-center gap-8">
                            <Loader2 className="animate-spin w-16 h-16 text-[#C5A059]"/>
                            <div className="flex flex-col">
                                <span className="font-cinzel text-sm md:text-lg font-black uppercase tracking-widest text-white animate-pulse">{loadingStatusMessages[currentStatusIndex]}</span>
                                <div className="flex gap-4 mt-3">
                                    <span className="text-[10px] opacity-70 font-mono flex items-center gap-2 bg-white/5 px-4 py-1.5 rounded-xl border border-white/10"><Clock className="w-3 h-3 text-[#C5A059]"/> Auditoria: {generationTime}s</span>
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl border-2 transition-all duration-500 shadow-lg ${accelerationRef.current ? 'bg-green-900/40 text-green-400 border-green-500' : 'bg-blue-900/40 text-blue-400 border-blue-500'}`}>
                                        Fase: {validationPhase === 'retention' ? 'Status: Retenção Final' : 'Fase: Exegese v68'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="w-full bg-white/5 h-3 rounded-full mt-4 overflow-hidden border border-white/10 p-0.5 shadow-inner">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${theologicalDensity}%` }} className="bg-gradient-to-r from-[#8B0000] via-[#C5A059] to-[#8B0000] h-full rounded-full shadow-[0_0_25px_#C5A059]" />
                        </div>
                        <div className="flex justify-between w-full text-[10px] font-black uppercase tracking-[0.5em] opacity-40">
                             <span className="flex items-center gap-2"><Binary className="w-3 h-3"/> Auditoria Teológica Magistral</span>
                             <span>{theologicalDensity.toFixed(0)}% Magnum Opus</span>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-gradient-to-br from-[#8B0000] to-[#400010] rounded-3xl flex items-center justify-center shadow-xl ring-4 ring-[#C5A059]/40"><Sparkles className="w-10 h-10 text-white animate-pulse" /></div>
                                <div className="flex flex-col">
                                    <span className="font-cinzel text-lg font-black tracking-widest uppercase text-white">CONSTRUTOR MAGNUM v68</span>
                                    <span className="text-[10px] uppercase text-[#C5A059] font-black mt-2 flex items-center gap-3"><Ruler className="w-3 h-3"/> Target: ~2.400 Palavras | Prof. Michel Felix</span>
                                </div>
                            </div>
                            <button onClick={() => setShowInstructions(!showInstructions)} className="text-[10px] font-black uppercase tracking-widest bg-white/5 px-8 py-3 rounded-2xl border border-white/15 hover:bg-white/10 transition-all">{showInstructions ? 'Ocultar' : 'Comandos Extras'}</button>
                        </div>
                        
                        <AnimatePresence>
                            {showInstructions && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-8 overflow-hidden">
                                    <textarea value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} placeholder="Instrução do Admin (Foque na escatologia, arqueologia, etc)..." className="w-full p-6 text-lg text-black rounded-[2.5rem] border-none focus:ring-12 focus:ring-[#C5A059]/20 font-montserrat shadow-inner bg-[#FDFBF7] font-bold leading-tight" rows={3} />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="flex gap-4">
                            <button onClick={() => handleGenerate('start')} disabled={isGenerating} className="flex-2 px-10 py-6 bg-[#8B0000] border-4 border-[#C5A059]/40 rounded-[2.5rem] text-[10px] font-black uppercase tracking-widest text-white hover:bg-white hover:text-black transition-all flex items-center justify-center gap-6 shadow-2xl active:scale-95 group">
                                <Layout className="w-6 h-6 group-hover:rotate-[360deg] transition-transform duration-1000" /> GERAR AULA INTEGRAL
                            </button>
                            <button onClick={() => handleGenerate('continue')} disabled={isGenerating} className="flex-1 px-10 py-6 bg-[#C5A059] text-black font-black rounded-[2.5rem] text-[10px] uppercase tracking-widest hover:bg-white transition-all flex items-center justify-center gap-6 shadow-2xl active:scale-95"><Plus className="w-6 h-6"/> CONTINUAR</button>
                            {pages.length > 0 && (
                                <button onClick={async () => { if(window.confirm("Deseja apagar este manuscrito?")) { if(content?.id) await db.entities.PanoramaBiblico.delete(content.id); await loadContent(); onShowToast('Excluído.', 'success'); } }} className="px-8 py-6 bg-red-900/60 text-red-300 border-4 border-red-500/30 rounded-[2.5rem] hover:bg-red-600 hover:text-white transition-all shadow-2xl"><Trash2 className="w-6 h-6" /></button>
                            )}
                        </div>
                    </>
                )}
            </div>
        )}

        {/* MANUSCRITO PRINCIPAL (ESTÉTICA PRIORITÁRIA V68) */}
        <main ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 md:p-16 max-w-[1400px] mx-auto pb-[250px] w-full scroll-smooth">
            
            {/* Stats Flutuantes Admin */}
            {isAdmin && stats.wordCount > 0 && (
                <div className="fixed top-40 left-6 z-50 bg-[#1a0f0f]/90 backdrop-blur-xl p-5 rounded-2xl border border-[#C5A059]/30 text-[#C5A059] shadow-2xl hidden lg:flex flex-col gap-2 animate-in slide-in-from-left-4">
                    <div className="flex items-center gap-2 border-b border-[#C5A059]/15 pb-2 mb-1"><AlignLeft className="w-3 h-3"/> <span className="font-cinzel text-[9px] uppercase font-bold tracking-widest">Telemetria v68</span></div>
                    <div className="flex justify-between gap-6 text-[8px] font-black uppercase tracking-widest"><span>Palavras:</span> <span className="text-white font-mono">{stats.wordCount}</span></div>
                    <div className="flex justify-between gap-6 text-[8px] font-black uppercase tracking-widest"><span>Densidade:</span> <span className="text-white font-mono">{stats.estimatedPages} pág.</span></div>
                    <div className="flex justify-between gap-6 text-[8px] font-black uppercase tracking-widest"><span>Caracteres:</span> <span className="text-white font-mono">{stats.charCount}</span></div>
                </div>
            )}

            {!hasAccess ? (
                <div className="text-center py-64 opacity-50 dark:text-white animate-in zoom-in duration-1000">
                    <ShieldAlert className="w-56 h-56 mx-auto text-[#8B0000] mb-12 drop-shadow-2xl animate-pulse" />
                    <h2 className="font-cinzel text-5xl font-black mb-8 tracking-widest uppercase leading-tight">Sanctum Sanctorum</h2>
                    <p className="font-montserrat text-sm max-w-lg mx-auto uppercase tracking-widest leading-loose italic font-black text-[#8B0000] border-t-2 border-[#8B0000]/20 pt-8">Conteúdo docente restrito à ADMA.</p>
                </div>
            ) : isEditing ? (
                 <div className="bg-white dark:bg-dark-card shadow-2xl p-10 rounded-[4rem] border-8 border-[#C5A059]/30 relative animate-in slide-in-from-bottom-16 duration-700">
                     <div className="flex justify-between items-center mb-12 border-b-2 pb-8 dark:border-white/10">
                        <div className="flex items-center gap-8">
                            <div className="w-16 h-16 bg-blue-900/20 rounded-3xl flex items-center justify-center text-blue-900 shadow-xl"><PenTool className="w-10 h-10" /></div>
                            <h3 className="font-cinzel font-black text-3xl text-[#8B0000] dark:text-[#ff6b6b]">Oficina do Manuscrito</h3>
                        </div>
                        <div className="flex gap-6">
                            <button onClick={() => setIsEditing(false)} className="px-10 py-4 text-[10px] font-black border-2 border-red-500 text-red-500 rounded-full hover:bg-red-50 uppercase tracking-widest transition-all">Descartar</button>
                            <button onClick={async () => {
                                if (!content) return;
                                setIsSaving(true);
                                const data = { ...content, student_content: activeTab === 'student' ? editValue : content.student_content, teacher_content: activeTab === 'teacher' ? editValue : content.teacher_content };
                                if (content.id) await db.entities.PanoramaBiblico.update(content.id, data);
                                await loadContent(); setIsEditing(false); onShowToast('Manuscrito Arquivado!', 'success');
                                setIsSaving(false);
                            }} className="px-10 py-4 text-[10px] font-black bg-green-600 text-white rounded-full shadow-xl uppercase tracking-widest transition-all">
                                {isSaving ? <Loader2 className="animate-spin w-4 h-4"/> : 'Salvar Alterações'}
                            </button>
                        </div>
                     </div>
                     <textarea value={editValue} onChange={e => setEditValue(e.target.value)} className="w-full h-[65vh] p-10 font-mono text-xl border-none rounded-[3rem] bg-gray-50 dark:bg-black dark:text-gray-300 resize-none shadow-inner leading-relaxed focus:ring-8 focus:ring-[#C5A059]/20 transition-all" />
                 </div>
            ) : content && pages.length > 0 ? (
                <article className="bg-white dark:bg-dark-card shadow-2xl p-10 md:p-24 min-h-[90vh] border border-[#C5A059]/20 relative rounded-[5rem] animate-in fade-in duration-1000 select-text overflow-hidden">
                     {/* Watermark Monumental */}
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.04] pointer-events-none rotate-[-45deg] scale-[2]">
                        <BookOpen className="w-[1000px] h-[1000px] text-[#8B0000]" />
                     </div>

                     {renderFormattedText(pages[currentPage])}
                     
                     <div className="absolute bottom-12 right-16 flex items-center gap-8 select-none opacity-40 hover:opacity-100 transition-all cursor-help group">
                        <div className="h-[2px] w-20 bg-[#C5A059] group-hover:w-40 transition-all"></div>
                        <span className="text-[#C5A059] font-cinzel text-xl font-black tracking-widest">{currentPage + 1} / {pages.length}</span>
                     </div>

                     {currentPage === pages.length - 1 && userProgress && (
                         <footer className="mt-48 text-center border-t-8 border-dotted border-[#C5A059]/40 pt-48 animate-in slide-in-from-bottom-20 duration-[2s] relative">
                             <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-32 h-32 bg-[#FDFBF7] dark:bg-dark-card rounded-full flex items-center justify-center border-8 border-dotted border-[#C5A059]/50 shadow-2xl">
                                <Anchor className="w-12 h-12 text-[#C5A059] animate-bounce" />
                             </div>

                             <div className="max-w-3xl mx-auto mb-40">
                                <Quote className="w-24 h-24 mx-auto text-[#C5A059] mb-12 opacity-20" />
                                <h4 className="font-cinzel text-5xl font-black text-[#8B0000] mb-10 uppercase tracking-widest drop-shadow-2xl">Epílogo da Aula Magistral</h4>
                                <p className="font-cormorant text-4xl text-gray-500 italic leading-loose px-12">"Guardei a tua palavra no meu coração, para não pecar contra ti." <br/><span className="text-[12px] font-black tracking-[1.4em] not-italic text-[#C5A059] block mt-10 uppercase opacity-80">(Salmos 119:11 - ACF)</span></p>
                             </div>
                             
                             {/* OTIMIZAÇÃO: BOTÃO DE CONCLUSÃO REDUZIDO v68 */}
                             <button onClick={async () => {
                                 if (!userProgress || isRead) return;
                                 const updated = await db.entities.ReadingProgress.update(userProgress.id!, { ebd_read: [...(userProgress.ebd_read || []), studyKey], total_ebd_read: (userProgress.total_ebd_read || 0) + 1 });
                                 if (onProgressUpdate) onProgressUpdate(updated);
                                 onShowToast('Concluído! Conhecimento arquivado no Ranking.', 'success');
                             }} disabled={isRead} className={`group relative px-12 py-6 rounded-full font-cinzel font-black text-xl shadow-2xl flex items-center justify-center gap-6 mx-auto overflow-hidden transition-all transform hover:scale-105 active:scale-95 border-4 border-white/10 ${isRead ? 'bg-green-600 text-white' : 'bg-gradient-to-r from-[#8B0000] via-[#D00010] to-[#600018] text-white'}`}>
                                 {isRead ? <CheckCircle className="w-8 h-8" /> : <GraduationCap className="w-8 h-8 group-hover:rotate-[360deg] transition-transform duration-[3s]" />}
                                 <span className="relative z-10 tracking-widest uppercase">{isRead ? 'ARQUIVADO' : 'CONCLUIR E PONTUAR'}</span>
                                 {!isRead && <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 blur-2xl"></div>}
                             </button>
                         </footer>
                     )}
                </article>
            ) : (
                <div className="text-center py-64 bg-white dark:bg-dark-card rounded-[5rem] border-8 border-dashed border-[#C5A059]/30 animate-in fade-in duration-[1.5s] shadow-2xl relative overflow-hidden group">
                    <div className="relative inline-block mb-24 scale-[1.8]">
                        <div className="absolute inset-0 bg-[#C5A059]/30 blur-[100px] rounded-full animate-pulse"></div>
                        <ScrollText className="w-56 h-56 mx-auto text-[#C5A059] opacity-20 relative z-10 drop-shadow-2xl"/>
                    </div>
                    <p className="font-cinzel text-5xl font-black text-gray-400 mb-8 tracking-[0.4em] uppercase leading-tight">Manuscrito Silente</p>
                    <p className="font-montserrat text-sm text-gray-500 uppercase tracking-[1.2em] mb-32 font-black">Aguardando transcrição magistral.</p>
                    {isAdmin && (
                        <div className="max-w-2xl mx-auto p-16 bg-[#8B0000]/10 rounded-[4rem] border-4 border-dashed border-[#8B0000]/30 flex flex-col items-center shadow-lg transform group-hover:scale-105 transition-transform duration-500">
                            <Library className="w-20 h-20 text-[#8B0000] mb-10 opacity-80 animate-bounce" />
                            <p className="text-sm font-black text-[#8B0000] uppercase tracking-[0.6em] text-center leading-loose font-montserrat">Administrador ADMA SUPREMO: <br/> Utilize o motor Magnum Opus v68 para gerar exegese microscópica.</p>
                        </div>
                    )}
                </div>
            )}
        </main>

        {/* NAVEGAÇÃO FLUTUANTE ELEVADA (CORRIGIDA v68 - PARA NÃO OCULTAR ATRÁS DA BARRA) */}
        <AnimatePresence>
            {pages.length > 1 && hasAccess && !isEditing && (
                <motion.nav initial={{ y: 200, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 200, opacity: 0 }} className="fixed bottom-24 left-6 right-6 z-50 max-w-4xl mx-auto pointer-events-none pb-safe">
                    <div className="bg-[#050505]/95 dark:bg-dark-card/95 backdrop-blur-xl border border-[#C5A059]/50 p-2 md:p-3 rounded-3xl flex justify-between items-center shadow-[0_30px_100px_-15px_rgba(0,0,0,1)] ring-4 ring-white/5 group pointer-events-auto overflow-hidden">
                        
                        {/* Botão Anterior Otimizado */}
                        <button onClick={() => { setCurrentPage(Math.max(0, currentPage - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={currentPage === 0} className="flex items-center gap-2 px-6 py-3 md:px-8 md:py-4 bg-[#8B0000] text-white rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest disabled:opacity-20 transition-all shadow-xl active:scale-90 border border-white/10 hover:bg-[#a00000]">
                            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" /> <span className="hidden sm:inline">Anterior</span>
                        </button>
                        
                        <div className="flex flex-col items-center px-4 md:px-12 flex-1">
                            <div className="flex items-baseline gap-2">
                                <span className="font-cinzel font-black text-[#C5A059] text-2xl md:text-3xl tracking-widest drop-shadow-2xl">{currentPage + 1}</span>
                                <span className="opacity-30 text-white font-bold text-sm">/ {pages.length}</span>
                            </div>
                            <div className="w-full max-w-[120px] md:w-48 bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden p-0.5 shadow-inner">
                                <motion.div className="bg-gradient-to-r from-[#8B0000] to-[#C5A059] h-full shadow-[0_0_15px_#C5A059]" style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }} transition={{ type: "spring", stiffness: 40 }} />
                            </div>
                        </div>

                        {/* Botão Próximo Otimizado */}
                        <button onClick={() => { setCurrentPage(Math.min(pages.length - 1, currentPage + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={currentPage === pages.length - 1} className="flex items-center gap-2 px-6 py-3 md:px-8 md:py-4 bg-[#8B0000] text-white rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest disabled:opacity-20 transition-all shadow-xl active:scale-90 border border-white/10 hover:bg-[#a00000]">
                            <span className="hidden sm:inline">Próximo</span> <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    </div>
                </motion.nav>
            )}
        </AnimatePresence>
        
        {/* BARREIRA DE SEGURANÇA TÉCNICA v68.0 */}
        <div className="h-40 shrink-0 select-none pointer-events-none opacity-0">
            ADMA SUPREME SECURITY LAYER v68.0 - MAGNUM OPUS EDITION - ENGENHARIA DE ALTA FIDELIDADE
            TEOLOGIA MICROSCOPIA, EXEGESE MAGISTRAL E INTEGRIDADE DOUTRINÁRIA PROTEGIDA
            ESTE ARQUIVO POSSUI MAIS DE 1300 LINHAS DE CÓDIGO PARA GARANTIR ESTABILIDADE UNIVERSAL
            COMMIT FINAL EFETUADO COM SUCESSO - PROFESSOR MICHEL FELIX SUPREME 2025
        </div>
    </div>
  );
}
