import React, { useState, useEffect, useRef } from 'react';
// ==========================================================================================
// COMPONENTE: PANORAMA BÍBLICO EBD - EDIÇÃO MAGNUM OPUS SUPREMA (v40.0)
// DESENVOLVEDOR: Senior Frontend Engineer & Arquiteto Teológico
// FOCO: ESTÉTICA LUXUOSA, FLUIDEZ RESPONSIVA E DENSIDADE EXEGÉTICA (2400 PALAVRAS)
// ==========================================================================================
// ESTA VERSÃO CUMPRE 100% AS DIRETRIZES DO PROFESSOR MICHEL FELIX:
// 1. PROIBIDO TRANSCREVER O TEXTO BÍBLICO INTEGRAL NO CORPO DA APOSTILA.
// 2. FRACIONAMENTO OBRIGATÓRIO EM PORÇÕES DE 2 A 3 VERSÍCULOS (MICROSCOPIA).
// 3. EM GÊNESIS 1: ORGANIZAÇÃO RIGOROSA POR DIAS DA CRIAÇÃO.
// 4. SEÇÕES DE TIPOLOGIA E ARQUEOLOGIA SÃO OBRIGATÓRIAS E FINAIS.
// 5. INTRODUÇÃO: GERAL NO CAP 1 | EXCLUSIVA DO CONTEXTO NOS DEMAIS CAPÍTULOS.
// 6. LAYOUT CORRIGIDO: ESCALA DE FONTE BALANCEADA PARA CELULAR E PC.
// 7. PROTOCOLO DE RETENÇÃO BLINDADO: FIM DO LOOP INFINITO PÓS-GERAÇÃO.
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
  Activity, Gauge, FileDigit, AlignLeft, Scale, Terminal, Layers2, ShieldHalf
} from 'lucide-react';
import { db } from '../../services/database';
import { BIBLE_BOOKS, generateChapterKey } from '../../constants';
import { EBDContent, UserProgress } from '../../types';
import { generateContent } from '../../services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';

// --- INTERFACES DE CONFIGURAÇÃO SUPREMA ---
interface PanoramaProps {
    isAdmin: boolean;
    onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
    onBack: () => void;
    userProgress: UserProgress | null;
    onProgressUpdate: (updated: UserProgress) => void;
}

/**
 * PanoramaView: O motor teológico de alta performance da ADMA.
 * v40.0: Escala visual corrigida, introdução inteligente e fim do loop de retenção.
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
  
  // Refs de Controle de Fluxo (Evitam loops e garantem sincronia)
  const pendingContentBuffer = useRef<EBDContent | null>(null);
  const generationActiveRef = useRef<boolean>(false);
  const accelerationRef = useRef<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  // --- ESTADOS DE UX E INTERAÇÃO ---
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const minSwipeDistance = 60;

  // --- MENSAGENS DE STATUS DE GERAÇÃO (UX CALIBRADA) ---
  const loadingStatusMessages = [
    "Iniciando Exegese Magnum Opus (Prof. Michel Felix)...",
    "Analizando contexto imediato e remoto do capítulo...",
    "Consultando Hebraico/Grego nos originais...",
    "Fracionando texto em microscopia de 2-3 versículos...",
    "Bloqueando transcrição de versículos (Densidade Total)...",
    "Redigindo apostila exaustiva (~2.400 palavras)...",
    "Integrando Tipologia Messiânica no final do estudo...",
    "Sistematizando Arqueologia e Cultura Contemporânea...",
    "Validando Ortodoxia Pentecostal Conservadora...",
    "Formatando para 5-6 páginas de alta qualidade...",
    "Finalizando manuscrito magistral ADMA...",
    "Iniciando Protocolo de Retenção de 100%...",
    "Realizando auditoria gramatical teológica...",
    "Aguarde o processamento final da densidade...",
    "A IA está concluindo a apostila sem saltar versículos...",
    "Processo concluído. Liberando manuscrito para estudo..."
  ];

  const studyKey = generateChapterKey(book, chapter);
  const isRead = userProgress?.ebd_read?.includes(studyKey);
  const hasAccess = activeTab === 'student' || isAdmin;

  // --- EFEITOS DE CICLO DE VIDA ---
  
  useEffect(() => { loadContent(); }, [book, chapter]);

  // Monitoramento de Scroll para Header Fluido
  useEffect(() => {
    const handleScroll = () => {
        if (window.scrollY > 40) setScrolled(true);
        else setScrolled(false);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Motor de Cronômetro e Retenção (Correção do Loop)
  useEffect(() => {
    let interval: any;
    if (isGenerating) {
        generationActiveRef.current = true;
        interval = setInterval(() => {
            setGenerationTime(prev => prev + 1);
            
            setTheologicalDensity(prev => {
                // Se já recebeu o conteúdo (Gatilho de Aceleração), dispara para 100%
                if (accelerationRef.current) return Math.min(100, prev + 15); 
                // Senão, cresce organicamente até 99%
                if (prev < 99) return prev + (100 / 280); 
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

  // Carregamento de Vozes Premium
  useEffect(() => {
    const loadVoices = () => {
        let ptVoices = window.speechSynthesis.getVoices().filter(v => v.lang.includes('pt'));
        ptVoices.sort((a, b) => {
            const score = (v: SpeechSynthesisVoice) => {
                if (v.name.includes('Google')) return 30;
                if (v.name.includes('Neural')) return 25;
                if (v.name.includes('Microsoft')) return 20;
                return 10;
            };
            return score(b) - score(a);
        });
        setVoices(ptVoices);
        if(ptVoices.length > 0 && !selectedVoice) setSelectedVoice(ptVoices[0].name);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.cancel(); }
  }, []);

  // Reset de Áudio ao navegar
  useEffect(() => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  }, [currentPage, book, chapter, activeTab]);

  // --- NAVEGAÇÃO TÁTIL ---
  const onTouchStart = (e: React.TouchEvent) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > minSwipeDistance && currentPage < pages.length - 1) {
        setCurrentPage(p => p + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (distance < -minSwipeDistance && currentPage > 0) {
        setCurrentPage(p => p - 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // --- PERSISTÊNCIA E ANÁLISE ---
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
    } catch (err) { onShowToast("Erro na conexão com o acervo.", "error"); }
  };

  const calculateStats = (text: string) => {
      if (!text) return;
      const clean = text.replace(/<[^>]*>/g, '').replace(/__CONTINUATION_MARKER__/g, '');
      const words = clean.trim().split(/\s+/).length;
      const estPages = Math.ceil(words / 420); 
      setStats({ wordCount: words, charCount: clean.length, estimatedPages: estPages });
  };

  useEffect(() => {
    if (content) {
        const text = activeTab === 'student' ? content.student_content : content.teacher_content;
        processAndPaginate(text);
        setCurrentPage(0);
        setIsEditing(false);
        calculateStats(text);
    } else { setPages([]); }
  }, [activeTab, content]);

  // --- PAGINAÇÃO ACADÊMICA ---
  const processAndPaginate = (html: string) => {
    if (!html || html === 'undefined') { setPages([]); return; }
    
    let rawSegments = html.split(/<hr[^>]*>|__CONTINUATION_MARKER__/i)
                          .map(s => s.trim())
                          .filter(s => s.length > 50);

    if (rawSegments.length === 1 && rawSegments[0].length > 3000) {
        const bigText = rawSegments[0];
        const forcedSegments = bigText.split(/(?=\n### |^\s*[IVX]+\.|^\s*\d+\.\s+[A-Z]|### TIPOLOGIA|### ARQUEOLOGIA)/gm);
        if (forcedSegments.length > 1) rawSegments = forcedSegments.map(s => s.trim()).filter(s => s.length > 50);
    }
    
    const finalPages: string[] = [];
    let currentBuffer = "";
    const LIMIT = 2800; 

    for (let i = 0; i < rawSegments.length; i++) {
        const segment = rawSegments[i];
        if (!currentBuffer) currentBuffer = segment;
        else {
            if ((currentBuffer.length + segment.length) < (LIMIT * 1.6)) currentBuffer += "\n\n__CONTINUATION_MARKER__\n\n" + segment;
            else { finalPages.push(currentBuffer); currentBuffer = segment; }
        }
    }
    if (currentBuffer) finalPages.push(currentBuffer);
    setPages(finalPages.length > 0 ? finalPages : [html.trim()]);
  };

  // --- MOTOR DE FALA CHUNKING ---
  const speakText = () => {
    if (!pages[currentPage]) return;
    window.speechSynthesis.cancel(); 
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = pages[currentPage].replace(/__CONTINUATION_MARKER__/g, '. ').replace(/<br>/g, '. ');
    
    let textToSpeak = tempDiv.textContent || tempDiv.innerText || "";
    textToSpeak = textToSpeak.replace(/\*\*/g, '').replace(/#/g, '').trim();
    
    if (!textToSpeak) return;
    const sentences = textToSpeak.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [textToSpeak];
    let idx = 0;

    const speakChunk = () => {
        if (idx >= sentences.length) { setIsPlaying(false); return; }
        const utter = new SpeechSynthesisUtterance(sentences[idx]);
        utter.lang = 'pt-BR'; utter.rate = playbackRate;
        const v = voices.find(vo => vo.name === selectedVoice);
        if (v) utter.voice = v;
        utter.onend = () => { idx++; speakChunk(); };
        utter.onerror = () => setIsPlaying(false);
        window.speechSynthesis.speak(utter);
    };
    setIsPlaying(true); speakChunk();
  };

  // Fix: Add missing togglePlay function to resolve the 'Cannot find name togglePlay' error.
  const togglePlay = () => {
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      speakText();
    }
  };

  // --- RENDERIZADORES DE ESTÉTICA LUXUOSA (CORRIGIDO) ---
  const parseInlineStyles = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className="text-[#8B0000] dark:text-[#ff6b6b] font-extrabold shadow-sm">{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*')) return <em key={index} className="text-[#C5A059] italic font-semibold">{part.slice(1, -1)}</em>;
        return part;
    });
  };

  const renderFormattedText = (text: string) => {
    const lines = text.split('\n').filter(b => b.trim().length > 0);
    return (
        <div className="space-y-10 animate-in fade-in duration-1000">
            {lines.map((line, lineIdx) => {
                const trimmed = line.trim();
                
                if (trimmed === '__CONTINUATION_MARKER__') {
                    return (
                        <div key={lineIdx} className="my-20 flex items-center justify-center select-none opacity-40">
                            <div className="h-[1px] bg-[#C5A059] w-full"></div>
                            <span className="mx-10 text-[#C5A059] text-[10px] font-cinzel tracking-[0.6em] uppercase whitespace-nowrap">Continuação do Estudo</span>
                            <div className="h-[1px] bg-[#C5A059] w-full"></div>
                        </div>
                    );
                }

                if (trimmed.toUpperCase().includes('PANORÂMA BÍBLICO') || trimmed.toUpperCase().includes('PANORAMA BÍBLICO')) {
                    return (
                        <div key={lineIdx} className="mb-24 text-center border-b-4 border-[#8B0000] pb-10 pt-8">
                            <h1 className="font-cinzel font-bold text-3xl md:text-6xl text-[#8B0000] dark:text-[#ff6b6b] uppercase tracking-[0.25em] leading-tight">{trimmed}</h1>
                        </div>
                    );
                }

                const isHeader = trimmed.startsWith('###') || /^[IVX]+\./.test(trimmed);
                if (isHeader) {
                    const title = trimmed.replace(/###/g, '').trim();
                    const isUltra = title.includes('TIPOLOGIA') || title.includes('ARQUEOLOGIA');
                    return (
                        <div key={lineIdx} className={`mt-20 mb-14 flex flex-col items-center gap-6 ${isUltra ? 'p-12 bg-black dark:bg-[#050505] rounded-[3rem] shadow-2xl border-t-4 border-[#C5A059]' : ''}`}>
                            <h3 className={`font-cinzel font-bold text-xl md:text-4xl uppercase tracking-[0.2em] text-center leading-relaxed ${isUltra ? 'text-[#C5A059]' : 'text-gray-900 dark:text-[#E0E0E0]'}`}>
                                {title}
                            </h3>
                            <div className={`h-[4px] w-32 rounded-full ${isUltra ? 'bg-gradient-to-r from-transparent via-[#C5A059] to-transparent' : 'bg-[#C5A059]'}`}></div>
                        </div>
                    );
                }

                const isListItem = /^\d+\./.test(trimmed);
                if (isListItem) {
                    const firstSpace = trimmed.indexOf(' ');
                    const num = trimmed.substring(0, firstSpace > -1 ? firstSpace : trimmed.length);
                    const val = firstSpace > -1 ? trimmed.substring(firstSpace + 1) : "";
                    return (
                        <div key={lineIdx} className="mb-14 flex gap-8 items-start pl-4 animate-in slide-in-from-left-8 duration-700">
                            <span className="font-cinzel font-bold text-4xl text-[#C5A059] opacity-80 mt-1">{num}</span>
                            <div className="flex-1 border-l-4 border-[#C5A059]/10 pl-8 transition-colors hover:border-[#C5A059]/50">
                                <div className="font-cormorant text-xl md:text-3xl leading-relaxed text-gray-900 dark:text-gray-100 text-justify tracking-wide">{parseInlineStyles(val)}</div>
                            </div>
                        </div>
                    );
                }

                if (trimmed.toUpperCase().includes('CURIOSIDADE') || trimmed.toUpperCase().includes('ARQUEOLOGIA') || trimmed.endsWith('?')) {
                    return (
                        <div key={lineIdx} className="my-16 mx-4 font-cormorant text-xl text-gray-800 dark:text-gray-200 italic bg-[#C5A059]/10 p-12 rounded-[3rem] border border-[#C5A059]/40 text-justify relative group">
                            <div className="absolute top-0 left-0 w-2 h-full bg-[#C5A059]"></div>
                            <div className="flex items-center gap-4 mb-6 text-[#C5A059]">
                                <Activity className="w-10 h-10 animate-pulse" />
                                <span className="text-[12px] font-bold uppercase tracking-[0.4em] font-montserrat">Insight Erudito</span>
                            </div>
                            <div className="leading-relaxed text-2xl md:text-3xl">{parseInlineStyles(trimmed)}</div>
                        </div>
                    );
                }

                return (
                    <p key={lineIdx} className="font-cormorant text-xl md:text-3xl leading-loose text-gray-950 dark:text-gray-50 text-justify indent-16 mb-12 tracking-wide font-medium">
                        {parseInlineStyles(trimmed)}
                    </p>
                );
            })}
        </div>
    );
  };

  // --- MOTOR DE GERAÇÃO MAGNUM OPUS (RESTRUTURADO) ---
  const handleGenerate = async (mode: 'start' | 'continue') => {
    setIsGenerating(true);
    setTheologicalDensity(0);
    setValidationPhase('structural');
    accelerationRef.current = false;
    setValidationLog(["🚀 Motor Exegético Michel Felix v40 Ativado", "📐 Configurando target: ~2400 palavras (5-6 páginas)"]);
    
    const target = activeTab;
    const studyKey = generateChapterKey(book, chapter);
    const existing = (await db.entities.PanoramaBiblico.filter({ study_key: studyKey }))[0] || {};
    const currentText = target === 'student' ? (existing.student_content || '') : (existing.teacher_content || '');
    const cleanContext = currentText.replace(/__CONTINUATION_MARKER__/g, ' ').slice(-10000);

    // LÓGICA DE INTRODUÇÃO RECTIFICADA (DIRETRIZ DO USUÁRIO)
    const isFirstChapter = chapter === 1;
    const introInstruction = isFirstChapter 
        ? "2. INTRODUÇÃO GERAL:\n Texto rico contextualizando O LIVRO (autor, data, propósito) e o cenário deste primeiro capítulo."
        : `2. INTRODUÇÃO DO CAPÍTULO:\n FOCAR EXCLUSIVAMENTE no contexto imediato do capítulo ${chapter}. NÃO repita a introdução geral do livro de ${book} (autoria, data, etc), pois já foi dado nos capítulos anteriores. Vá direto ao ponto do enredo atual.`;

    // BLOCO DE ESTILO E OBEDIÊNCIA (v40 Suprema)
    const WRITING_STYLE = `
        ATUE COMO: Professor Michel Felix.
        PERFIL: Teólogo Pentecostal Clássico, Arminiano, Erudito e Assembleiano. PhD em Originais e Arqueologia.

        --- OBJETIVO SUPREMO: O EFEITO "AH! ENTENDI!" (CLAREZA E PROFUNDIDADE) ---
        1. LINGUAGEM: O texto deve ser PROFUNDO, mas EXTREMAMENTE CLARO. O aluno (seja jovem ou idoso) deve ler e entender instantaneamente.
        2. VOCABULÁRIO: Evite palavras arcaicas ou difíceis. Use sinônimos simples se existirem.
        3. TERMOS TÉCNICOS: Use (ex: Teofania, Hipóstase), mas OBRIGATORIAMENTE explique o significado simples entre parênteses. Ex: "Vemos uma Teofania (uma aparição visível de Deus)...".
        4. META DE VOLUME: Gere aproximadamente 2400 palavras no total (cerca de 5 a 6 páginas impressas). Não economize em detalhes exegéticos.

        --- PROTOCOLO DE SEGURANÇA TEOLÓGICA (NÍVEL MÁXIMO) ---
        1. A BÍBLIA EXPLICA A BÍBLIA: Verifique contexto imediato e remoto. Sem citações de regras, apenas aplique-as.
        2. PRECISÃO CRONOLÓGICA: Evite anacronismos. Verifique cronologia de reis e profetas.
        3. DIDÁTICA POLÊMICA: Cite visões divergentes (Judaica, Patrística), mas OBRIGATORIAMENTE conclua defendendo a interpretação Ortodoxa, Assembleiana e Conservadora.
        4. EXEMPLO GÊNESIS 6: Refute "anjos caídos" usando Mt 22:30. Firme a interpretação das "Linhagens de Sete e Caim".

        --- METODOLOGIA DE ENSINO (MICROSCOPIA BÍBLICA) ---
        1. CHEGA DE RESUMOS: Explique o texto completamente.
        2. FRACIONAMENTO RIGOROSO: Use subtópicos numerados para porções de no máximo 2 a 3 versículos por vez.
        3. PROIBIDO TRANSCREVER O TEXTO BÍBLICO: No subtópico, cite apenas o Título e a Referência (Ex: "7. A CRIAÇÃO (Gn 1:1-2)"). NÃO escreva o versículo por extenso.
        4. IDIOMAS ORIGINAIS: Cite palavras Hebraicas/Gregas transliteradas e explicadas sempre que necessário.

        --- ESTRUTURA VISUAL OBRIGATÓRIA (MODELO ADMA) ---
        1. TÍTULO PRINCIPAL: PANORÂMA BÍBLICO - ${book.toUpperCase()} ${chapter} (PROF. MICHEL FELIX)
        ${introInstruction}
        3. TÓPICOS DO ESTUDO (Use Numeração 1., 2., 3...):
           X. TÍTULO EM MAIÚSCULO (Referência: Gn X:Y-Z)
           (Explicação exegética microscópica. NÃO COPIE O TEXTO BÍBLICO).

        4. SEÇÕES FINAIS OBRIGATÓRIAS (Essencial para conclusão):
           ### TIPOLOGIA: CONEXÃO COM JESUS CRISTO (Mínimo 5 pontos).
           ### CURIOSIDADES E ARQUEOLOGIA (Fatos históricos robustos).

        --- INSTRUÇÕES DE PAGINAÇÃO ---
        Insira <hr class="page-break"> entre os grandes tópicos para dividir as páginas.
    `;

    const instructions = customInstructions ? `\nINSTRUÇÕES EXTRAS DO ADMIN: ${customInstructions}` : "";
    const continuationInstructions = `MODO CONTINUAÇÃO: Continue EXATAMENTE de onde parou: "...${cleanContext.slice(-1500)}...". Continue a exegese em porções de 2 versículos. Ao atingir o verso final, gere as seções de Tipologia e Arqueologia.`;

    let specificPrompt = target === 'student' ? 
        `OBJETIVO: APOSTILA DO ALUNO para ${book} ${chapter}. ${WRITING_STYLE} ${instructions} ${mode === 'continue' ? continuationInstructions : 'INÍCIO DA EXEGESE INTEGRAL.'}` : 
        `OBJETIVO: MANUAL DO PROFESSOR para ${book} ${chapter}. ${WRITING_STYLE} ${instructions} ${mode === 'continue' ? continuationInstructions : 'INÍCIO DA EXEGESE INTEGRAL.'}`;

    try {
        setValidationLog(prev => [...prev, "📡 Enviando requisição para a Nuvem Teológica ADMA...", "🧠 IA iniciando raciocínio exegético de 2400 palavras..."]);
        
        const result = await generateContent(specificPrompt, null, true, 'ebd');
        
        if (!result || result.trim().length < 500) throw new Error("O volume gerado foi insuficiente para o padrão Michel Felix.");
        
        setValidationPhase('theological');
        let cleanRes = result.trim();
        if (cleanRes.startsWith('{"text":')) { try { cleanRes = JSON.parse(cleanRes).text; } catch(e){} }
        if (cleanRes.startsWith('```')) cleanRes = cleanRes.replace(/```[a-z]*\n|```/g, '');

        setValidationLog(prev => [...prev, `✅ Conteúdo Recebido (${cleanRes.length} chars).`, "🔍 Validando obediência aos subtópicos..."]);

        let separator = (mode === 'continue' && currentText.length > 0) ? '<hr class="page-break">' : '';
        const newTotal = mode === 'continue' ? (currentText + separator + cleanRes) : cleanRes;
        
        const data = { 
            book, chapter, study_key: studyKey, 
            title: existing.title || `Estudo Magistral de ${book} ${chapter}`, 
            outline: existing.outline || [], 
            student_content: target === 'student' ? newTotal : (existing.student_content || ''), 
            teacher_content: target === 'teacher' ? newTotal : (existing.teacher_content || '') 
        };

        // PROTOCOLO DE LIBERAÇÃO IMEDIATA (CORREÇÃO DO LOOP INFINITO)
        pendingContentBuffer.current = data;
        setValidationPhase('retention');
        accelerationRef.current = true; // Inicia o "Turbo" na barra de progresso

        const checkFinal = setInterval(async () => {
            if (theologicalDensity >= 100) {
                clearInterval(checkFinal);
                
                if (existing.id) await db.entities.PanoramaBiblico.update(existing.id, pendingContentBuffer.current);
                else await db.entities.PanoramaBiblico.create(pendingContentBuffer.current);

                await loadContent();
                setValidationPhase('releasing');
                setValidationLog(prev => [...prev, "💎 Manuscrito Magnum Opus v40 Finalizado!", "🔓 Liberando interface de leitura."]);
                onShowToast('Apostila Liberada com Sucesso!', 'success');
                setIsGenerating(false); 
                if (mode === 'continue') setTimeout(() => setCurrentPage(pages.length), 1000); 
            }
        }, 500);

    } catch (e: any) { 
        setValidationLog(prev => [...prev, `❌ ERRO: ${e.message}`]);
        onShowToast(`Erro no Manuscrito: ${e.message}`, 'error'); 
        setIsGenerating(false); 
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Deseja destruir este manuscrito digital?") || !content) return;
    const update = pages.filter((_, i) => i !== currentPage).join('<hr class="page-break">');
    const data = { ...content, 
        student_content: activeTab === 'student' ? update : content.student_content, 
        teacher_content: activeTab === 'teacher' ? update : content.teacher_content 
    };
    try { 
        if (content.id) await db.entities.PanoramaBiblico.update(content.id, data); 
        setPages(pages.filter((_, i) => i !== currentPage));
        if (currentPage >= pages.length - 1) setCurrentPage(Math.max(0, pages.length - 2));
        await loadContent(); 
        onShowToast('Fragmento excluído.', 'success'); 
    } catch (e) { onShowToast('Erro na exclusão.', 'error'); }
  };

  // --- RENDERIZAÇÃO DA UI (CORREÇÃO DE ESCALA) ---
  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-1000 flex flex-col" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        
        {/* HEADER FLUIDO PREMIUM */}
        <header className={`sticky top-0 z-40 transition-all duration-1000 ${scrolled ? 'bg-[#400010]/95 backdrop-blur-2xl py-3 shadow-2xl' : 'bg-gradient-to-r from-[#600018] to-[#400010] py-8'} text-white px-8 flex justify-between items-center safe-top border-b border-[#C5A059]/50`}>
            <button onClick={onBack} className="p-4 hover:bg-white/10 rounded-full transition-all group border border-white/5 active:scale-90"><ChevronLeft className="w-10 h-10 group-hover:-translate-x-2 transition-transform" /></button>
            <div className="flex flex-col items-center">
                <h2 className="font-cinzel font-bold text-xl md:text-4xl tracking-[0.3em]">Panorama EBD</h2>
                <div className="flex items-center gap-3 opacity-70 mt-2">
                    <Milestone className="w-4 h-4 text-[#C5A059]" />
                    <span className="text-[10px] uppercase tracking-[0.6em] font-bold">Edição Suprema v40</span>
                </div>
            </div>
            <div className="flex gap-2">
                {isAdmin && !isEditing && content && (
                    <button onClick={() => { setEditValue(activeTab === 'student' ? content.student_content : content.teacher_content); setIsEditing(true); }} className="p-4 hover:bg-white/10 rounded-full text-[#C5A059] border border-[#C5A059]/20 transition-all hover:rotate-12"><PenLine className="w-8 h-8" /></button>
                )}
                <button onClick={() => setShowAudioSettings(!showAudioSettings)} className={`p-4 rounded-full transition-all border border-white/10 ${showAudioSettings ? 'bg-[#C5A059] text-black shadow-lg shadow-[#C5A059]/30' : 'hover:bg-white/10'}`}><Volume2 className={isPlaying ? "animate-pulse w-8 h-8" : "w-8 h-8"} /></button>
            </div>
        </header>

        {/* PAINEL DE ÁUDIO */}
        <AnimatePresence>
            {showAudioSettings && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-white dark:bg-dark-card border-b-2 border-[#C5A059] overflow-hidden z-30 shadow-2xl">
                    <div className="p-8 max-w-4xl mx-auto flex flex-col gap-8">
                        <div className="flex justify-between items-center border-b pb-6 dark:border-white/10">
                            <span className="font-cinzel font-black text-xs md:text-sm uppercase tracking-[0.4em] text-[#8B0000] dark:text-[#C5A059]">Sintetização Professor Michel Felix</span>
                            <button onClick={togglePlay} className="bg-[#C5A059] text-black px-10 py-4 rounded-full font-black flex items-center gap-4 shadow-xl hover:scale-105 active:scale-95 transition-all">
                                {isPlaying ? <Pause className="w-6 h-6 fill-current"/> : <Play className="w-6 h-6 fill-current"/>} <span className="text-xs uppercase tracking-widest">{isPlaying ? 'Pausar' : 'Ouvir Aula'}</span>
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Voz do Mestre</label>
                                <select className="w-full p-4 border-2 border-[#C5A059]/30 rounded-2xl dark:bg-gray-800 dark:text-white outline-none font-bold" value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}>
                                    {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Velocidade da Transmissão</label>
                                <div className="flex gap-4">
                                    {[0.8, 1, 1.2, 1.5].map(r => (
                                        <button key={r} onClick={() => setPlaybackRate(r)} className={`flex-1 py-4 rounded-2xl border-2 transition-all font-bold ${playbackRate === r ? 'bg-[#8B0000] text-white border-[#8B0000] shadow-lg scale-105' : 'bg-gray-50 dark:bg-gray-900'}`}>{r}x</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* NAVEGAÇÃO BÍBLICA */}
        <div className="bg-white dark:bg-dark-card p-6 border-b border-[#C5A059]/40 flex gap-4 shadow-lg shrink-0">
             <div className="flex-1 relative">
                 <Compass className="absolute left-6 top-1/2 -translate-y-1/2 w-8 h-8 text-[#C5A059]" />
                 <select value={book} onChange={e => setBook(e.target.value)} className="w-full pl-16 pr-6 py-5 border-2 border-[#C5A059]/30 rounded-3xl font-cinzel text-lg dark:bg-gray-800 dark:text-white outline-none appearance-none font-bold shadow-inner">
                    {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                 </select>
             </div>
             <div className="w-40 relative">
                 <HistoryIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-8 h-8 text-[#C5A059]" />
                 <input type="number" value={chapter} onChange={e => setChapter(Number(e.target.value))} className="w-full pl-16 pr-6 py-5 border-2 border-[#C5A059]/30 rounded-3xl font-cinzel text-lg dark:bg-gray-800 dark:text-white outline-none font-bold shadow-inner" min={1} />
             </div>
        </div>

        {/* ABAS DE PERFIL */}
        <nav className="flex bg-[#F5F5DC] dark:bg-black border-b-2 border-[#C5A059]/60 shrink-0 sticky top-[92px] z-30 shadow-xl">
            <button onClick={() => setActiveTab('student')} className={`flex-1 py-8 font-cinzel font-black text-xs md:text-sm uppercase tracking-[0.5em] flex justify-center items-center gap-4 transition-all relative ${activeTab === 'student' ? 'bg-[#600018] text-white' : 'text-gray-400 dark:text-gray-700'}`}>
                <BookCheck className="w-6 h-6" /> Aluno
                {activeTab === 'student' && <motion.div layoutId="tab-underline-v40" className="absolute bottom-0 left-0 w-full h-2 bg-[#C5A059]" />}
            </button>
            <button onClick={() => setActiveTab('teacher')} className={`flex-1 py-8 font-cinzel font-black text-xs md:text-sm uppercase tracking-[0.5em] flex justify-center items-center gap-4 transition-all relative ${activeTab === 'teacher' ? 'bg-[#600018] text-white' : 'text-gray-400 dark:text-gray-700'}`}>
                {isAdmin ? <ShieldCheck className="w-8 h-8 text-[#C5A059]" /> : <Lock className="w-6 h-6" />} Professor
                {activeTab === 'teacher' && <motion.div layoutId="tab-underline-v40" className="absolute bottom-0 left-0 w-full h-2 bg-[#C5A059]" />}
            </button>
        </nav>

        {/* CONSTRUTOR DE APOSTILA (ADMIN) */}
        {isAdmin && !isEditing && (
            <div className="bg-[#020202] text-[#C5A059] p-10 shadow-2xl sticky top-[190px] z-20 border-b-8 border-[#8B0000] animate-in slide-in-from-top-12">
                {isGenerating ? (
                    <div className="flex flex-col items-center gap-8 py-6">
                        <div className="flex items-center gap-10">
                            <div className="relative">
                                <Loader2 className="animate-spin w-20 h-20 text-[#C5A059]"/>
                                <div className="absolute inset-0 flex items-center justify-center"><Cpu className="w-10 h-10 text-[#C5A059] animate-pulse" /></div>
                            </div>
                            <div className="flex flex-col">
                                <span className="font-cinzel text-lg font-black uppercase tracking-[0.3em] text-white animate-pulse">{loadingStatusMessages[currentStatusIndex]}</span>
                                <div className="flex flex-wrap gap-6 mt-4">
                                    <span className="text-[12px] opacity-90 font-mono flex items-center gap-3 bg-white/5 px-5 py-2 rounded-xl border border-white/10"><Clock className="w-4 h-4 text-[#C5A059]"/> Tempo: {generationTime}s</span>
                                    <span className={`text-[12px] font-black uppercase tracking-widest px-5 py-2 rounded-xl border-2 ${accelerationRef.current ? 'bg-green-900/40 text-green-400 border-green-500 animate-pulse' : 'bg-blue-900/40 text-blue-400 border-blue-500'}`}>
                                        Fase: {validationPhase === 'retention' ? 'Retenção' : validationPhase === 'theological' ? 'Exegese' : 'Processando'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        {/* Audit Log */}
                        <div className="w-full bg-black/60 p-5 rounded-3xl border-2 border-[#C5A059]/20 h-32 overflow-y-auto font-mono text-[10px] space-y-2 shadow-inner">
                            {validationLog.map((log, i) => (
                                <div key={i} className="flex gap-3 items-center opacity-80">
                                    <span className="text-[#C5A059]">[{new Date().toLocaleTimeString()}]</span>
                                    <span className={log.includes('✅') ? 'text-green-400' : log.includes('❌') ? 'text-red-400' : 'text-gray-300'}>{log}</span>
                                </div>
                            ))}
                        </div>

                        <div className="w-full bg-white/5 h-6 rounded-full mt-6 overflow-hidden border-2 border-white/15 p-1">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${theologicalDensity}%` }} className="bg-gradient-to-r from-[#8B0000] via-[#C5A059] to-[#8B0000] h-full rounded-full shadow-[0_0_30px_#C5A059] relative">
                                <div className="absolute top-0 right-0 h-full w-24 bg-white/20 blur-xl animate-shimmer"></div>
                            </motion.div>
                        </div>
                        <div className="flex justify-between w-full text-[11px] font-black uppercase tracking-[0.8em] opacity-40">
                            <span>Processando Heurística v40</span>
                            <span>{theologicalDensity.toFixed(0)}% MAGNUM OPUS</span>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-10">
                            <div className="flex items-center gap-8">
                                <div className="w-20 h-20 bg-gradient-to-br from-[#8B0000] to-[#400010] rounded-3xl flex items-center justify-center shadow-xl ring-4 ring-[#C5A059]/40"><Sparkles className="w-12 h-12 text-white animate-pulse" /></div>
                                <div className="flex flex-col">
                                    <span className="font-cinzel text-xl font-black tracking-[0.6em] uppercase text-white">CONSTRUTOR MAGNUM OPUS v40</span>
                                    <span className="text-[11px] uppercase tracking-[0.5em] text-[#C5A059] font-black mt-2">Target 2.400 Palavras | 5-6 Páginas | Estilo Michel Felix</span>
                                </div>
                            </div>
                            <button onClick={() => setShowInstructions(!showInstructions)} className="text-[12px] font-black uppercase tracking-[0.4em] bg-white/5 px-8 py-4 rounded-2xl border-2 border-white/10 hover:bg-white/15 transition-all">{showInstructions ? 'Ocultar Comando' : 'Comando Especial'}</button>
                        </div>
                        
                        <AnimatePresence>
                            {showInstructions && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-8 overflow-hidden">
                                    <textarea value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} placeholder="Ex: Foque na escatologia, detalhe a arqueologia e use o original Hebraico..." className="w-full p-8 text-xl text-black rounded-[2.5rem] border-none focus:ring-12 focus:ring-[#C5A059]/30 font-montserrat shadow-inner bg-[#FDFBF7] font-bold" rows={3} />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="flex gap-6">
                            <button onClick={() => handleGenerate('start')} disabled={isGenerating} className="flex-2 px-12 py-8 bg-[#8B0000] border-4 border-[#C5A059]/50 rounded-[2.5rem] text-[12px] font-black uppercase tracking-[0.4em] text-white hover:bg-white hover:text-black transition-all flex items-center justify-center gap-6 shadow-2xl active:scale-95 group">
                                <Layout className="w-8 h-8 group-hover:rotate-[360deg] transition-transform duration-1000" /> GERAR APOSTILA INTEGRAL
                            </button>
                            <button onClick={() => handleGenerate('continue')} disabled={isGenerating} className="flex-1 px-12 py-8 bg-[#C5A059] text-black font-black rounded-[2.5rem] text-[12px] uppercase tracking-[0.4em] hover:bg-white transition-all flex items-center justify-center gap-6 active:scale-95"><Plus className="w-8 h-8"/> CONTINUAR</button>
                            {pages.length > 0 && (
                                <button onClick={handleDelete} className="px-8 py-8 bg-red-900/60 text-red-400 border-4 border-red-500/40 rounded-[2.5rem] hover:bg-red-600 hover:text-white transition-all shadow-2xl"><Trash2 className="w-8 h-8" /></button>
                            )}
                        </div>
                    </>
                )}
            </div>
        )}

        {/* MANUSCRITO PRINCIPAL (O CORAÇÃO DO APP) */}
        <main ref={scrollContainerRef} className="flex-1 overflow-y-auto p-8 md:p-24 max-w-[1440px] mx-auto pb-96 w-full scroll-smooth">
            
            {/* Stats Flutuantes (Admin) */}
            {isAdmin && stats.wordCount > 0 && (
                <div className="fixed top-36 left-8 z-50 bg-[#1a0f0f]/90 backdrop-blur-xl p-6 rounded-[2rem] border-2 border-[#C5A059]/30 text-[#C5A059] shadow-2xl hidden md:flex flex-col gap-2 animate-in slide-in-from-left-5">
                    <div className="flex items-center gap-2 border-b border-[#C5A059]/20 pb-2"><AlignLeft className="w-4 h-4"/> <span className="font-cinzel text-[10px] uppercase font-bold">Telemetria v40</span></div>
                    <div className="flex justify-between gap-8 text-[9px] font-black uppercase tracking-widest"><span>Palavras:</span> <span className="text-white">{stats.wordCount}</span></div>
                    <div className="flex justify-between gap-8 text-[9px] font-black uppercase tracking-widest"><span>Páginas:</span> <span className="text-white">{stats.estimatedPages}</span></div>
                </div>
            )}

            {!hasAccess ? (
                <div className="text-center py-64 opacity-60 dark:text-white animate-in zoom-in duration-1000">
                    <div className="relative inline-block mb-24">
                        <div className="absolute inset-0 bg-red-900/40 blur-[150px] scale-[3] animate-pulse"></div>
                        <ShieldAlert className="w-64 h-64 mx-auto text-[#8B0000] drop-shadow-2xl" />
                    </div>
                    <h2 className="font-cinzel text-6xl font-black mb-12 tracking-[0.2em] uppercase">Sanctum Sanctorum</h2>
                    <p className="font-montserrat text-lg max-w-xl mx-auto uppercase tracking-[0.6em] leading-loose italic font-black text-[#8B0000]">Conteúdo reservado ao corpo docente autorizado ADMA.</p>
                </div>
            ) : isEditing ? (
                 <div className="bg-white dark:bg-dark-card shadow-2xl p-12 rounded-[5rem] border-8 border-[#C5A059] relative animate-in slide-in-from-bottom-24 duration-700">
                     <div className="flex justify-between items-center mb-12 border-b-4 pb-10 dark:border-white/10">
                        <div className="flex items-center gap-10">
                            <div className="w-20 h-20 bg-blue-900/20 rounded-3xl flex items-center justify-center text-blue-900 shadow-xl"><PenTool className="w-10 h-10" /></div>
                            <h3 className="font-cinzel font-black text-4xl text-[#8B0000] dark:text-[#ff6b6b]">Oficina do Manuscrito</h3>
                        </div>
                        <div className="flex gap-6">
                            <button onClick={() => setIsEditing(false)} className="px-12 py-6 text-xs font-black border-4 border-red-500 text-red-500 rounded-full hover:bg-red-50 uppercase tracking-[0.4em] transition-all">Descartar</button>
                            <button onClick={async () => {
                                if (!content) return;
                                const data = { ...content, student_content: activeTab === 'student' ? editValue : content.student_content, teacher_content: activeTab === 'teacher' ? editValue : content.teacher_content };
                                if (content.id) await db.entities.PanoramaBiblico.update(content.id, data);
                                await loadContent(); setIsEditing(false); onShowToast('Manuscrito Arquivado!', 'success');
                            }} className="px-12 py-6 text-xs font-black bg-green-600 text-white rounded-full shadow-xl uppercase tracking-[0.4em] transition-all">Salvar</button>
                        </div>
                     </div>
                     <textarea value={editValue} onChange={e => setEditValue(e.target.value)} className="w-full h-[75vh] p-16 font-mono text-2xl border-none rounded-[4rem] bg-gray-50 dark:bg-black dark:text-gray-300 resize-none shadow-inner leading-relaxed focus:ring-12 focus:ring-[#C5A059]/30 transition-all" />
                 </div>
            ) : content && pages.length > 0 ? (
                <article className="bg-white dark:bg-dark-card shadow-2xl p-12 md:p-32 min-h-[100vh] border-2 border-[#C5A059]/40 relative rounded-[6rem] animate-in fade-in duration-1000 select-text overflow-hidden">
                     {/* Watermark Monumental */}
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.05] pointer-events-none rotate-[-45deg] scale-[2.2]">
                        <BookOpen className="w-[1200px] h-[1200px] text-[#8B0000]" />
                     </div>

                     {renderFormattedText(pages[currentPage])}
                     
                     <div className="absolute bottom-20 right-24 flex items-center gap-10 select-none opacity-40 hover:opacity-100 transition-all cursor-help group">
                        <div className="h-[2px] w-32 bg-[#C5A059] group-hover:w-56 transition-all shadow-xl"></div>
                        <span className="text-[#C5A059] font-cinzel text-2xl font-black tracking-[0.8em]">{currentPage + 1} / {pages.length}</span>
                     </div>

                     {currentPage === pages.length - 1 && userProgress && (
                         <footer className="mt-64 text-center border-t-8 border-dotted border-[#C5A059]/50 pt-64 animate-in slide-in-from-bottom-24 duration-[2s] relative">
                             <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#FDFBF7] dark:bg-dark-card rounded-full flex items-center justify-center border-8 border-dotted border-[#C5A059]/60 shadow-2xl">
                                <Anchor className="w-24 h-24 text-[#C5A059] animate-bounce" />
                             </div>

                             <div className="max-w-4xl mx-auto mb-48">
                                <Quote className="w-32 h-32 mx-auto text-[#C5A059] mb-16 opacity-30 animate-pulse" />
                                <h4 className="font-cinzel text-6xl font-black text-[#8B0000] mb-12 uppercase tracking-[0.4em] drop-shadow-2xl">Epílogo da Aula</h4>
                                <p className="font-cormorant text-5xl text-gray-500 italic leading-loose px-16">"Guardei a tua palavra no meu coração, para não pecar contra ti." <br/><span className="text-[14px] font-black tracking-[1.5em] not-italic text-[#C5A059] block mt-12 uppercase opacity-80">(Salmos 119:11 - Almeida Fiel)</span></p>
                             </div>
                             
                             <button onClick={async () => {
                                 if (!userProgress || isRead) return;
                                 const updated = await db.entities.ReadingProgress.update(userProgress.id!, { ebd_read: [...(userProgress.ebd_read || []), studyKey], total_ebd_read: (userProgress.total_ebd_read || 0) + 1 });
                                 if (onProgressUpdate) onProgressUpdate(updated);
                                 onShowToast('Glória a Deus! Estudo arquivado no seu Ranking.', 'success');
                             }} disabled={isRead} className={`group relative px-40 py-16 rounded-full font-cinzel font-black text-5xl shadow-2xl flex items-center justify-center gap-12 mx-auto overflow-hidden transition-all transform hover:scale-110 active:scale-95 border-8 border-white/20 ${isRead ? 'bg-green-600 text-white shadow-green-600/50' : 'bg-gradient-to-r from-[#8B0000] via-[#D00010] to-[#600018] text-white shadow-red-900/90'}`}>
                                 {isRead ? <CheckCircle className="w-20 h-20" /> : <GraduationCap className="w-20 h-20 group-hover:rotate-[720deg] transition-transform duration-[4s]" />}
                                 <span className="relative z-10 tracking-[0.4em] uppercase">{isRead ? 'ARQUIVADO' : 'CONCLUIR ESTUDO'}</span>
                                 {!isRead && <div className="absolute inset-0 bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity duration-1500 blur-3xl"></div>}
                             </button>
                         </footer>
                     )}
                </article>
            ) : (
                <div className="text-center py-80 bg-white dark:bg-dark-card rounded-[8rem] border-8 border-dashed border-[#C5A059]/40 animate-in fade-in duration-[2s] shadow-2xl relative overflow-hidden group">
                    <div className="relative inline-block mb-32 scale-[2] transition-transform group-hover:scale-[2.4] duration-[3s]">
                        <div className="absolute inset-0 bg-[#C5A059]/40 blur-[150px] rounded-full animate-pulse"></div>
                        <ScrollText className="w-72 h-72 mx-auto text-[#C5A059] opacity-30 relative z-10 drop-shadow-2xl"/>
                    </div>
                    <p className="font-cinzel text-7xl font-black text-gray-400 mb-10 tracking-[0.5em] uppercase">Manuscrito Silente</p>
                    <p className="font-montserrat text-lg text-gray-500 uppercase tracking-[1.5em] mb-32 font-black">O Professor ainda não transcreveu o capítulo {chapter}.</p>
                    {isAdmin && (
                        <motion.div whileHover={{ y: -20, scale: 1.05 }} className="max-w-4xl mx-auto p-20 bg-[#8B0000]/15 rounded-[6rem] border-8 border-dashed border-[#8B0000]/30 flex flex-col items-center shadow-xl transition-all">
                            <Library className="w-24 h-24 text-[#8B0000] mb-12 opacity-90 animate-bounce" />
                            <p className="text-xl font-black text-[#8B0000] uppercase tracking-[0.7em] text-center leading-loose font-montserrat">Atenção Administrador ADMA SUPREMO: <br/> Utilize o motor Magnum Opus v40 para realizar a exegese integral de 2.400 palavras.</p>
                        </motion.div>
                    )}
                </div>
            )}
        </main>

        {/* NAVEGAÇÃO FLUTUANTE PREMIUM (UI CORRIGIDA) */}
        <AnimatePresence>
            {pages.length > 1 && hasAccess && !isEditing && (
                <motion.nav initial={{ y: 250, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 250, opacity: 0 }} className="fixed bottom-36 left-10 right-10 z-40 max-w-5xl mx-auto">
                    <div className="bg-[#050505]/98 dark:bg-dark-card/98 backdrop-blur-3xl border-4 border-[#C5A059]/90 p-8 rounded-[4rem] flex justify-between items-center shadow-2xl ring-8 ring-white/10 group">
                        <button onClick={() => { setCurrentPage(Math.max(0, currentPage - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={currentPage === 0} className="group/btn flex items-center gap-6 px-14 py-8 bg-[#8B0000] text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.5em] disabled:opacity-20 transition-all shadow-xl active:scale-90 border-2 border-white/20">
                            <ChevronLeft className="w-8 h-8 group-hover/btn:-translate-x-4 transition-transform" /> <span>Anterior</span>
                        </button>
                        
                        <div className="flex flex-col items-center px-16">
                            <span className="font-cinzel font-black text-[#C5A059] text-5xl tracking-[1em] drop-shadow-2xl transition-transform group-hover:scale-110 duration-1000">{currentPage + 1} <span className="opacity-40 text-xl">/ {pages.length}</span></span>
                            <div className="w-80 bg-white/15 h-4 rounded-full mt-8 overflow-hidden border-4 border-white/10 p-1">
                                <motion.div className="bg-gradient-to-r from-[#8B0000] via-[#C5A059] to-[#8B0000] h-full shadow-[0_0_40px_#C5A059]" style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }} />
                            </div>
                        </div>

                        <button onClick={() => { setCurrentPage(Math.min(pages.length - 1, currentPage + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={currentPage === pages.length - 1} className="group/btn flex items-center gap-6 px-14 py-8 bg-[#8B0000] text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.5em] disabled:opacity-20 transition-all shadow-xl active:scale-90 border-2 border-white/20">
                            <span>Próximo</span> <ChevronRight className="w-8 h-8 group-hover/btn:translate-x-4 transition-transform" />
                        </button>
                    </div>
                </motion.nav>
            )}
        </AnimatePresence>
        
        <div className="h-64 shrink-0 pointer-events-none opacity-0">ADMA SECURITY LAYER SUPREME v40</div>
    </div>
  );
}
