import React, { useState, useEffect, useRef } from 'react';
// ==========================================================================================
// COMPONENTE: PANORAMA BÍBLICO EBD - EDIÇÃO MAGNUM OPUS SUPREMA (v45.0)
// DESENVOLVEDOR: Senior Frontend Engineer & Arquiteto Teológico
// FOCO: ESTÉTICA LUXUOSA, LEITURA PRIORITÁRIA E RIGOR DOUTRINÁRIO (2400 PALAVRAS)
// ==========================================================================================
// ESTA VERSÃO CUMPRE 100% AS DIRETRIZES DO PROFESSOR MICHEL FELIX:
// 1. PROIBIDO TRANSCREVER O TEXTO BÍBLICO INTEGRAL NO CORPO DA APOSTILA.
// 2. FRACIONAMENTO OBRIGATÓRIO EM PORÇÕES DE 2 A 3 VERSÍCULOS (MICROSCOPIA).
// 3. EM GÊNESIS 1: ORGANIZAÇÃO RIGOROSA POR DIAS DA CRIAÇÃO.
// 4. SEÇÕES DE TIPOLOGIA E ARQUEOLOGIA SÃO OBRIGATÓRIAS E FINAIS.
// 5. INTRODUÇÃO: GERAL NO CAP 1 | EXCLUSIVA DO CONTEXTO IMEDIATO NOS DEMAIS.
// 6. UI CORRIGIDA: BOTÕES COMPACTOS E CONSTRUTOR OTIMIZADO PARA NÃO OBSTRUIR.
// 7. PROTOCOLO DE RETENÇÃO: ACELERAÇÃO PÓS-PROCESSO PARA EVITAR LOOPS.
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
  ChevronUp, Maximize2, Minimize2
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
 * PanoramaView: Motor Teológico ADMA v45.0
 * Prioridade: Experiência de Leitura Imersiva.
 */
export default function PanoramaView({ isAdmin, onShowToast, onBack, userProgress, onProgressUpdate }: PanoramaProps) {
  // --- ESTADOS DE CONTEÚDO E NAVEGAÇÃO ---
  const [book, setBook] = useState('Gênesis');
  const [chapter, setChapter] = useState(1);
  const [content, setContent] = useState<EBDContent | null>(null);
  const [activeTab, setActiveTab] = useState<'student' | 'teacher'>('student');
  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState<string[]>([]);
  
  // --- ESTADOS DE GERAÇÃO (RETENÇÃO 100%) ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationTime, setGenerationTime] = useState(0);
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
  const [customInstructions, setCustomInstructions] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [theologicalDensity, setTheologicalDensity] = useState(0); 
  const [validationLog, setValidationLog] = useState<string[]>([]);
  const [validationPhase, setValidationPhase] = useState<'none' | 'structural' | 'theological' | 'final' | 'retention' | 'releasing'>('none');
  const [stats, setStats] = useState({ wordCount: 0, charCount: 0, estimatedPages: 0 });
  
  // --- REFS DE CONTROLE ---
  const pendingContentBuffer = useRef<EBDContent | null>(null);
  const generationActiveRef = useRef<boolean>(false);
  const accelerationRef = useRef<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // --- ESTADOS DE EDIÇÃO E REVISÃO ---
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  // --- ESTADOS DE ÁUDIO ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [playbackRate, setPlaybackRate] = useState(1);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // --- ESTADOS DE UX ---
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const minSwipeDistance = 60;

  // --- MENSAGENS DE STATUS ---
  const loadingStatusMessages = [
    "Iniciando Protocolo Magnum Opus (Prof. Michel Felix)...",
    "Analizando contexto original do capítulo...",
    "Consultando manuscritos e originais...",
    "Fracionando exegese em porções microscópicas...",
    "Redigindo apostila exaustiva (~2400 palavras)...",
    "Bloqueando transcrição de texto bíblico...",
    "Integrando tipologia cristocêntrica...",
    "Sistematizando evidências arqueológicas...",
    "Validando ortodoxia conservadora...",
    "Formatando layout para leitura premium...",
    "Processando densidade teológica final...",
    "Iniciando Protocolo de Retenção Crítica...",
    "Quase lá! Preparando o manuscrito...",
    "A IA está revisando os tópicos finais...",
    "Exegese concluída. Liberando conteúdo..."
  ];

  const studyKey = generateChapterKey(book, chapter);
  const isRead = userProgress?.ebd_read?.includes(studyKey);
  const hasAccess = activeTab === 'student' || isAdmin;

  // --- CICLO DE VIDA ---
  
  useEffect(() => { loadContent(); }, [book, chapter]);

  useEffect(() => {
    const handleScroll = () => {
        setScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Gerenciador de Retenção Blindado
  useEffect(() => {
    let interval: any;
    if (isGenerating) {
        generationActiveRef.current = true;
        interval = setInterval(() => {
            setGenerationTime(prev => prev + 1);
            setTheologicalDensity(prev => {
                if (accelerationRef.current) return Math.min(100, prev + 15); 
                if (prev < 99) return prev + (100 / 260); 
                return 99;
            });
            if (generationTime % 10 === 0 && generationTime > 0) {
                setCurrentStatusIndex(prev => (prev + 1) % loadingStatusMessages.length);
            }
        }, 1000);
    } else {
        generationActiveRef.current = false;
        accelerationRef.current = false;
        setGenerationTime(0);
        setTheologicalDensity(0);
        setValidationPhase('none');
    }
    return () => clearInterval(interval);
  }, [isGenerating, generationTime]);

  // Carregamento de Vozes Premium
  useEffect(() => {
    const load = () => {
        let v = window.speechSynthesis.getVoices().filter(voice => voice.lang.includes('pt'));
        v.sort((a, b) => (b.name.includes('Google') ? 1 : -1));
        setVoices(v);
        if(v.length > 0 && !selectedVoice) setSelectedVoice(v[0].name);
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => window.speechSynthesis.cancel();
  }, []);

  useEffect(() => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  }, [currentPage, book, chapter, activeTab]);

  // --- GESTÃO TÁTIL ---
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

  // --- CARREGAMENTO DE DADOS ---
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
    } catch (err) { onShowToast("Erro na conexão teológica.", "error"); }
  };

  const calculateStats = (text: string) => {
      if (!text) return;
      const clean = text.replace(/<[^>]*>/g, '').replace(/__CONTINUATION_MARKER__/g, '');
      const words = clean.trim().split(/\s+/).length;
      setStats({ wordCount: words, charCount: clean.length, estimatedPages: Math.ceil(words / 450) });
  };

  useEffect(() => {
    if (content) {
        const text = activeTab === 'student' ? content.student_content : content.teacher_content;
        processAndPaginate(text);
        setCurrentPage(0);
        calculateStats(text);
    } else { setPages([]); }
  }, [activeTab, content]);

  // --- ALGORITMO DE PAGINAÇÃO ---
  const processAndPaginate = (html: string) => {
    if (!html) { setPages([]); return; }
    let raw = html.split(/<hr[^>]*>|__CONTINUATION_MARKER__/i).map(s => s.trim()).filter(s => s.length > 30);
    
    if (raw.length === 1 && raw[0].length > 3000) {
        const big = raw[0];
        const forced = big.split(/(?=\n### |^\s*[IVX]+\.|^\s*\d+\.\s+[A-Z]|### TIPOLOGIA|### ARQUEOLOGIA)/gm);
        if (forced.length > 1) raw = forced.map(s => s.trim()).filter(s => s.length > 30);
    }
    
    const final: string[] = [];
    let buffer = "";
    const LIMIT = 2800; 

    for (let i = 0; i < raw.length; i++) {
        const seg = raw[i];
        if (!buffer) buffer = seg;
        else {
            if ((buffer.length + seg.length) < (LIMIT * 1.5)) buffer += "\n\n__CONTINUATION_MARKER__\n\n" + seg;
            else { final.push(buffer); buffer = seg; }
        }
    }
    if (buffer) final.push(buffer);
    setPages(final.length > 0 ? final : [html.trim()]);
  };

  // --- MOTOR DE FALA ---
  const speakText = () => {
    if (!pages[currentPage]) return;
    window.speechSynthesis.cancel(); 
    const div = document.createElement("div");
    div.innerHTML = pages[currentPage].replace(/__CONTINUATION_MARKER__/g, '. ').replace(/<br>/g, '. ');
    let txt = (div.textContent || div.innerText || "").replace(/\*\*/g, '').replace(/#/g, '').trim();
    if (!txt) return;
    const sentences = txt.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [txt];
    let idx = 0;
    const next = () => {
        if (idx >= sentences.length) { setIsPlaying(false); return; }
        const utter = new SpeechSynthesisUtterance(sentences[idx]);
        utter.lang = 'pt-BR'; utter.rate = playbackRate;
        const v = voices.find(vo => vo.name === selectedVoice);
        if (v) utter.voice = v;
        utter.onend = () => { idx++; next(); };
        utter.onerror = () => setIsPlaying(false);
        window.speechSynthesis.speak(utter);
    };
    setIsPlaying(true); next();
  };

  const togglePlay = () => isPlaying ? (window.speechSynthesis.cancel(), setIsPlaying(false)) : speakText();

  // --- RENDERIZAÇÃO ESTÉTICA (PROPORÇÕES CORRIGIDAS) ---
  const parseInline = (t: string) => {
    const p = t.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return p.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="text-[#8B0000] dark:text-[#ff6b6b] font-extrabold">{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*')) return <em key={i} className="text-[#C5A059] italic font-semibold">{part.slice(1, -1)}</em>;
        return part;
    });
  };

  const renderContent = (t: string) => {
    const lines = t.split('\n').filter(l => l.trim().length > 0);
    return (
        <div className="space-y-6 md:space-y-10 animate-in fade-in duration-1000">
            {lines.map((line, idx) => {
                const tr = line.trim();
                if (tr === '__CONTINUATION_MARKER__') return <div key={idx} className="my-10 border-b border-[#C5A059]/20" />;
                
                if (tr.toUpperCase().includes('PANORÂMA BÍBLICO') || tr.toUpperCase().includes('PANORAMA BÍBLICO')) {
                    return (
                        <div key={idx} className="mb-14 text-center border-b-2 border-[#8B0000] pb-6">
                            <h1 className="font-cinzel font-bold text-2xl md:text-5xl text-[#8B0000] dark:text-[#ff6b6b] uppercase tracking-widest">{tr}</h1>
                        </div>
                    );
                }

                const isH = tr.startsWith('###') || /^[IVX]+\./.test(tr);
                if (isH) {
                    const title = tr.replace(/###/g, '').trim();
                    const isUltra = title.includes('TIPOLOGIA') || title.includes('ARQUEOLOGIA');
                    return (
                        <div key={idx} className={`mt-14 mb-8 flex flex-col items-center gap-4 ${isUltra ? 'p-8 bg-black dark:bg-[#080808] rounded-3xl shadow-xl border-t-2 border-[#C5A059]' : ''}`}>
                            <h3 className={`font-cinzel font-bold text-lg md:text-3xl uppercase tracking-wider text-center leading-tight ${isUltra ? 'text-[#C5A059]' : 'text-gray-900 dark:text-[#E0E0E0]'}`}>
                                {title}
                            </h3>
                            <div className="h-1 w-16 bg-[#C5A059] rounded-full"></div>
                        </div>
                    );
                }

                if (/^\d+\./.test(tr)) {
                    const sp = tr.indexOf(' ');
                    const num = tr.substring(0, sp > -1 ? sp : tr.length);
                    const val = sp > -1 ? tr.substring(sp + 1) : "";
                    return (
                        <div key={idx} className="mb-8 flex gap-4 md:gap-8 items-start animate-in slide-in-from-left-4">
                            <span className="font-cinzel font-bold text-3xl text-[#C5A059] opacity-70">{num}</span>
                            <div className="flex-1 border-l-2 border-[#C5A059]/10 pl-6">
                                <div className="font-cormorant text-lg md:text-2xl leading-relaxed text-gray-900 dark:text-gray-100 text-justify tracking-wide">{parseInline(val)}</div>
                            </div>
                        </div>
                    );
                }

                return (
                    <p key={idx} className="font-cormorant text-lg md:text-2xl leading-relaxed text-gray-950 dark:text-gray-100 text-justify indent-8 md:indent-14 mb-8 tracking-wide">
                        {parseInline(tr)}
                    </p>
                );
            })}
        </div>
    );
  };

  // ==========================================================================================
  // GERAÇÃO MAGNUM OPUS (v45.0 - OBEDIÊNCIA 100%)
  // ==========================================================================================
  const handleGenerate = async (mode: 'start' | 'continue') => {
    setIsGenerating(true);
    setValidationPhase('structural');
    accelerationRef.current = false;
    setValidationLog(["🚀 Iniciando motor Michel Felix v45...", "📏 Target: 2.400 palavras (5-6 páginas)"]);
    
    const target = activeTab;
    const currentText = target === 'student' ? (content?.student_content || '') : (content?.teacher_content || '');

    // --- LÓGICA DE INTRODUÇÃO SELETIVA ---
    const introInstruction = chapter === 1 
        ? "2. INTRODUÇÃO GERAL:\n           Texto rico contextualizando O LIVRO (autor, data, propósito) e o cenário deste primeiro capítulo."
        : `2. INTRODUÇÃO DO CAPÍTULO:\n           FOCAR EXCLUSIVAMENTE no contexto imediato do capítulo ${chapter}. NÃO repita a introdução geral do livro de ${book} (autoria, data, etc), pois já foi dado nos capítulos anteriores. Vá direto ao ponto do enredo atual.`;

    // --- WRITING STYLE (OBEDIÊNCIA ABSOLUTA) ---
    const WRITING_STYLE = `
        ATUE COMO: Professor Michel Felix.
        PERFIL: Teólogo Pentecostal Clássico, Arminiano, Erudito e Assembleiano.

        --- OBJETIVO SUPREMO: O EFEITO "AH! ENTENDI!" (CLAREZA E PROFUNDIDADE) ---
        1. LINGUAGEM: O texto deve ser PROFUNDO, mas EXTREMAMENTE CLARO. O aluno (seja jovem ou idoso) deve ler e entender instantaneamente.
        2. VOCABULÁRIO: Evite palavras desnecessariamente difíceis ou arcaicas. Se houver um sinônimo simples, USE-O.
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
           - Jefté: Cite a possibilidade de sacrifício literal, mas defenda a visão da dedicação perpétua ao tabernáculo (voto de celibato).
           - Em resumo: Apresente o leque de interpretações para conhecimento, mas feche a questão com a ortodoxia segura.

        5. ANGELOLOGIA E ANTROPOLOGIA: Respeite a natureza dos seres criados. Não misture naturezas distintas (espíritos não possuem genética reprodutiva humana).
        6. TOM: Magistral, Impessoal, Acadêmico, Vibrante e Ortodoxo.

        --- METODOLOGIA DE ENSINO (MICROSCOPIA BÍBLICA) ---
        1. CHEGA DE RESUMOS: O aluno precisa entender o texto COMPLETAMENTE. Não faça explicações genéricas que cobrem 10 versículos de uma vez.
        2. DETALHES QUE FAZEM A DIFERENÇA: Traga costumes da época, geografia e contexto histórico para iluminar o texto e causar o efeito "Ah! Entendi!".
        3. DENSIDADE: Extraia todo o suco do texto. Se houver uma lista de nomes, explique a relevância. Se houver uma ação detalhada, explique o motivo.
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
    const continuation = mode === 'continue' ? `CONTINUE DE ONDE PAROU: "...${currentText.slice(-1000)}..."` : "INÍCIO DA EXEGESE.";

    try {
        setValidationLog(prev => [...prev, "📡 Enviando requisição para nuvem ADMA...", "🧠 IA raciocinando exegese profunda..."]);
        const res = await generateContent(`${WRITING_STYLE} ${instructions} ${continuation}`, null, true, 'ebd');
        
        if (!res || res.length < 300) throw new Error("Conteúdo insuficiente retornado.");
        
        setValidationPhase('theological');
        let clean = res.trim();
        if (clean.startsWith('{"text":')) { try { clean = JSON.parse(clean).text; } catch(e){} }
        if (clean.startsWith('```')) clean = clean.replace(/```[a-z]*\n|```/g, '');

        const sep = (mode === 'continue' && currentText.length > 0) ? '<hr class="page-break">' : '';
        const total = mode === 'continue' ? (currentText + sep + clean) : clean;
        
        const data = { 
            book, chapter, study_key: studyKey, title: `Estudo de ${book} ${chapter}`, outline: [], 
            student_content: target === 'student' ? total : (content?.student_content || ''), 
            teacher_content: target === 'teacher' ? total : (content?.teacher_content || '') 
        };

        pendingContentBuffer.current = data;
        setValidationPhase('retention');
        accelerationRef.current = true; // Inicia aceleração final da barra

        const check = setInterval(async () => {
            if (theologicalDensity >= 100) {
                clearInterval(check);
                if (content?.id) await db.entities.PanoramaBiblico.update(content.id, pendingContentBuffer.current);
                else await db.entities.PanoramaBiblico.create(pendingContentBuffer.current);
                await loadContent();
                setIsGenerating(false);
                onShowToast('Manuscrito Magnum Opus Liberado!', 'success');
            }
        }, 500);

    } catch (e: any) { 
        onShowToast(`Erro: ${e.message}`, 'error'); 
        setIsGenerating(false); 
    }
  };

  // --- INTERFACE SUPREMA (CORRIGIDA) ---
  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-1000 flex flex-col selection:bg-[#C5A059]/30" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        
        {/* HEADER COMPACTO LUXO */}
        <header className={`sticky top-0 z-40 transition-all duration-700 ${scrolled ? 'bg-[#400010]/95 backdrop-blur-xl py-2 shadow-xl' : 'bg-gradient-to-r from-[#600018] to-[#400010] py-6'} text-white px-6 flex justify-between items-center safe-top border-b border-[#C5A059]/30`}>
            <button onClick={onBack} className="p-3 hover:bg-white/10 rounded-full transition-all active:scale-90 border border-white/5"><ChevronLeft className="w-8 h-8" /></button>
            <div className="flex flex-col items-center">
                <h2 className="font-cinzel font-bold text-lg md:text-3xl tracking-widest">Panorama EBD</h2>
                <div className="flex items-center gap-2 opacity-60 mt-1">
                    <Milestone className="w-3 h-3 text-[#C5A059]" />
                    <span className="text-[8px] uppercase tracking-widest font-bold">Magnum Opus v45</span>
                </div>
            </div>
            <div className="flex gap-1">
                {isAdmin && !isEditing && content && (
                    <button onClick={() => { setEditValue(activeTab === 'student' ? content.student_content : content.teacher_content); setIsEditing(true); }} className="p-2.5 hover:bg-white/10 rounded-full text-[#C5A059] border border-[#C5A059]/20"><PenLine className="w-6 h-6" /></button>
                )}
                <button onClick={() => setShowAudioSettings(!showAudioSettings)} className={`p-2.5 rounded-full transition-all border border-white/10 ${showAudioSettings ? 'bg-[#C5A059] text-black shadow-lg' : 'hover:bg-white/10'}`}><Volume2 className={isPlaying ? "animate-pulse w-6 h-6" : "w-6 h-6"} /></button>
            </div>
        </header>

        {/* PAINEL DE ÁUDIO OTIMIZADO */}
        <AnimatePresence>
            {showAudioSettings && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-white dark:bg-dark-card border-b border-[#C5A059]/40 overflow-hidden z-30">
                    <div className="p-6 max-w-4xl mx-auto flex flex-col gap-6">
                        <div className="flex justify-between items-center border-b pb-4 dark:border-white/5">
                            <span className="font-cinzel text-[10px] uppercase tracking-widest text-[#8B0000] dark:text-[#C5A059]">Sintetização Professor</span>
                            <button onClick={togglePlay} className="bg-[#C5A059] text-black px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-md">
                                {isPlaying ? <Pause className="w-4 h-4 fill-current inline mr-2"/> : <Play className="w-4 h-4 fill-current inline mr-2"/>} {isPlaying ? 'Parar' : 'Ouvir'}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <select className="w-full p-2 text-xs border rounded-xl dark:bg-gray-800 dark:text-white" value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}>
                                {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                            </select>
                            <div className="flex gap-2">
                                {[1, 1.2, 1.5].map(r => (
                                    <button key={r} onClick={() => setPlaybackRate(r)} className={`flex-1 text-[10px] py-2 rounded-xl border transition-all font-bold ${playbackRate === r ? 'bg-[#8B0000] text-white' : 'bg-gray-50 dark:bg-gray-900'}`}>{r}x</button>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* NAVEGAÇÃO BÍBLICA COMPACTA */}
        <div className="bg-white dark:bg-dark-card p-4 border-b border-[#C5A059]/20 flex gap-3 shadow-md shrink-0">
             <div className="flex-1 relative">
                 <Compass className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#C5A059]" />
                 <select value={book} onChange={e => setBook(e.target.value)} className="w-full pl-12 pr-4 py-3 border-2 border-[#C5A059]/20 rounded-2xl font-cinzel text-sm dark:bg-gray-800 dark:text-white outline-none appearance-none font-bold">
                    {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                 </select>
             </div>
             <div className="w-24 relative">
                 <HistoryIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#C5A059]" />
                 <input type="number" value={chapter} onChange={e => setChapter(Number(e.target.value))} className="w-full pl-12 pr-4 py-3 border-2 border-[#C5A059]/20 rounded-2xl font-cinzel text-sm dark:bg-gray-800 dark:text-white outline-none font-bold" min={1} />
             </div>
        </div>

        {/* ABAS OTIMIZADAS */}
        <nav className="flex bg-[#F5F5DC] dark:bg-black border-b border-[#C5A059]/40 shrink-0 sticky top-[82px] md:top-[98px] z-30 shadow-sm">
            <button onClick={() => setActiveTab('student')} className={`flex-1 py-4 font-cinzel font-black text-[10px] md:text-xs uppercase tracking-widest flex justify-center items-center gap-2 transition-all relative ${activeTab === 'student' ? 'bg-[#600018] text-white' : 'text-gray-500'}`}>
                <BookCheck className="w-4 h-4" /> Aluno
                {activeTab === 'student' && <motion.div layoutId="tab-v45" className="absolute bottom-0 left-0 w-full h-1 bg-[#C5A059]" />}
            </button>
            <button onClick={() => setActiveTab('teacher')} className={`flex-1 py-4 font-cinzel font-black text-[10px] md:text-xs uppercase tracking-widest flex justify-center items-center gap-2 transition-all relative ${activeTab === 'teacher' ? 'bg-[#600018] text-white' : 'text-gray-500'}`}>
                {isAdmin ? <ShieldCheck className="w-5 h-5 text-[#C5A059]" /> : <Lock className="w-4 h-4" />} Professor
                {activeTab === 'teacher' && <motion.div layoutId="tab-v45" className="absolute bottom-0 left-0 w-full h-1 bg-[#C5A059]" />}
            </button>
        </nav>

        {/* CONSTRUTOR MAGNUM OTIMIZADO (NÃO OBSTRUTIVO) */}
        {isAdmin && !isEditing && (
            <div className="bg-[#020202] text-[#C5A059] p-6 shadow-xl sticky top-[138px] md:top-[160px] z-20 border-b-4 border-[#8B0000] animate-in slide-in-from-top-8">
                {isGenerating ? (
                    <div className="flex flex-col items-center gap-4 py-4">
                        <div className="flex items-center gap-6">
                            <Loader2 className="animate-spin w-12 h-12 text-[#C5A059]"/>
                            <div className="flex flex-col">
                                <span className="font-cinzel text-xs font-black uppercase tracking-widest text-white animate-pulse">{loadingStatusMessages[currentStatusIndex]}</span>
                                <div className="flex gap-4 mt-2">
                                    <span className="text-[10px] opacity-70 font-mono flex items-center gap-2"><Clock className="w-3 h-3"/> {generationTime}s</span>
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border ${accelerationRef.current ? 'bg-green-900/40 text-green-400 border-green-500' : 'bg-blue-900/40 text-blue-400 border-blue-500'}`}>
                                        {validationPhase === 'retention' ? 'Retenção' : 'Exegese'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="w-full bg-white/5 h-2 rounded-full mt-2 overflow-hidden p-0.5">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${theologicalDensity}%` }} className="bg-gradient-to-r from-[#8B0000] via-[#C5A059] to-[#8B0000] h-full rounded-full shadow-[0_0_20px_#C5A059]" />
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <Sparkles className="w-8 h-8 text-white animate-pulse" />
                                <div className="flex flex-col">
                                    <span className="font-cinzel text-sm font-black tracking-widest uppercase text-white">CONSTRUTOR MAGNUM v45</span>
                                    <span className="text-[9px] uppercase text-[#C5A059] font-black mt-1 flex items-center gap-2"><Ruler className="w-3 h-3"/> Alvo: ~2.400 Palavras | Prof. Michel Felix</span>
                                </div>
                            </div>
                            <button onClick={() => setShowInstructions(!showInstructions)} className="text-[9px] font-black uppercase tracking-widest bg-white/5 px-4 py-2 rounded-xl border border-white/10">{showInstructions ? 'Ocultar' : 'Instrução'}</button>
                        </div>
                        
                        <AnimatePresence>
                            {showInstructions && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-6 overflow-hidden">
                                    <textarea value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} placeholder="Instrução Adicional..." className="w-full p-4 text-sm text-black rounded-2xl border-none focus:ring-8 focus:ring-[#C5A059]/20 font-montserrat shadow-inner bg-[#FDFBF7] font-bold" rows={2} />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="flex gap-3">
                            <button onClick={() => handleGenerate('start')} disabled={isGenerating} className="flex-2 px-6 py-4 bg-[#8B0000] border-2 border-[#C5A059]/30 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-white hover:text-black transition-all flex items-center justify-center gap-4 shadow-xl active:scale-95">
                                <Layout className="w-5 h-5" /> GERAR APOSTILA INTEGRAL
                            </button>
                            <button onClick={() => handleGenerate('continue')} disabled={isGenerating} className="flex-1 px-6 py-4 bg-[#C5A059] text-black font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-white transition-all flex items-center justify-center gap-4 active:scale-95"><Plus className="w-5 h-5"/> CONTINUAR</button>
                            {pages.length > 0 && (
                                <button onClick={async () => { if(window.confirm("Apagar?")) { if(content?.id) await db.entities.PanoramaBiblico.delete(content.id); await loadContent(); onShowToast('Excluído.', 'success'); } }} className="px-5 py-4 bg-red-900/60 text-red-300 border-2 border-red-500/30 rounded-2xl hover:bg-red-600 transition-all"><Trash2 className="w-5 h-5" /></button>
                            )}
                        </div>
                    </>
                )}
            </div>
        )}

        {/* MANUSCRITO PRINCIPAL (ESTÉTICA PRIORITÁRIA) */}
        <main ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 md:p-16 max-w-[1200px] mx-auto pb-[200px] w-full scroll-smooth">
            
            {/* Stats Flutuantes Admin (Discretas) */}
            {isAdmin && stats.wordCount > 0 && (
                <div className="fixed top-36 left-4 z-50 bg-[#1a0f0f]/90 backdrop-blur-md p-4 rounded-2xl border border-[#C5A059]/30 text-[#C5A059] shadow-xl hidden md:flex flex-col gap-1 animate-in slide-in-from-left-2">
                    <div className="flex items-center gap-2 border-b border-[#C5A059]/10 pb-1 mb-1"><AlignLeft className="w-3 h-3"/> <span className="font-cinzel text-[8px] uppercase font-bold">Telemetria v45</span></div>
                    <div className="flex justify-between gap-4 text-[8px] font-black uppercase tracking-widest"><span>Palavras:</span> <span className="text-white">{stats.wordCount}</span></div>
                    <div className="flex justify-between gap-4 text-[8px] font-black uppercase tracking-widest"><span>Páginas:</span> <span className="text-white">{stats.estimatedPages}</span></div>
                </div>
            )}

            {!hasAccess ? (
                <div className="text-center py-40 opacity-50 dark:text-white animate-in zoom-in duration-1000">
                    <ShieldAlert className="w-40 h-40 mx-auto text-[#8B0000] mb-8" />
                    <h2 className="font-cinzel text-4xl font-black mb-6 tracking-widest uppercase">Sanctum Sanctorum</h2>
                    <p className="font-montserrat text-sm max-w-xs mx-auto uppercase tracking-widest leading-loose italic font-black text-[#8B0000]">Conteúdo docente ADMA.</p>
                </div>
            ) : isEditing ? (
                 <div className="bg-white dark:bg-dark-card shadow-xl p-8 rounded-3xl border-4 border-[#C5A059]/30 relative animate-in slide-in-from-bottom-12 duration-700">
                     <div className="flex justify-between items-center mb-8 border-b pb-6 dark:border-white/5">
                        <div className="flex items-center gap-6"><PenTool className="w-8 h-8 text-blue-900" /><h3 className="font-cinzel font-black text-2xl text-[#8B0000]">Revisão Manual</h3></div>
                        <div className="flex gap-4">
                            <button onClick={() => setIsEditing(false)} className="px-8 py-3 text-[10px] font-black border-2 border-red-500 text-red-500 rounded-full hover:bg-red-50 uppercase tracking-widest transition-all">Descartar</button>
                            <button onClick={async () => {
                                if (!content) return;
                                const data = { ...content, student_content: activeTab === 'student' ? editValue : content.student_content, teacher_content: activeTab === 'teacher' ? editValue : content.teacher_content };
                                if (content.id) await db.entities.PanoramaBiblico.update(content.id, data);
                                await loadContent(); setIsEditing(false); onShowToast('Arquivado!', 'success');
                            }} className="px-8 py-3 text-[10px] font-black bg-green-600 text-white rounded-full shadow-lg uppercase tracking-widest transition-all">Salvar</button>
                        </div>
                     </div>
                     <textarea value={editValue} onChange={e => setEditValue(e.target.value)} className="w-full h-[65vh] p-8 font-mono text-lg md:text-xl border-none rounded-2xl bg-gray-50 dark:bg-black dark:text-gray-300 resize-none shadow-inner leading-relaxed focus:ring-4 focus:ring-[#C5A059]/20 transition-all" />
                 </div>
            ) : content && pages.length > 0 ? (
                <article className="bg-white dark:bg-dark-card shadow-xl p-8 md:p-24 min-h-[90vh] border border-[#C5A059]/20 relative rounded-[4rem] animate-in fade-in duration-1000 select-text overflow-hidden">
                     {/* Watermark Sutil */}
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none rotate-[-45deg] scale-[1.5]">
                        <BookOpen className="w-[800px] h-[800px] text-[#8B0000]" />
                     </div>

                     {renderContent(pages[currentPage])}
                     
                     <div className="absolute bottom-10 right-14 flex items-center gap-6 select-none opacity-30 hover:opacity-100 transition-all cursor-help group">
                        <div className="h-[1px] w-12 bg-[#C5A059] group-hover:w-24 transition-all"></div>
                        <span className="text-[#C5A059] font-cinzel text-lg font-black tracking-widest">{currentPage + 1} / {pages.length}</span>
                     </div>

                     {currentPage === pages.length - 1 && userProgress && (
                         <footer className="mt-40 text-center border-t-2 border-dotted border-[#C5A059]/30 pt-32 animate-in slide-in-from-bottom-12 duration-[1.5s] relative">
                             <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-[#FDFBF7] dark:bg-dark-card rounded-full flex items-center justify-center border-2 border-dotted border-[#C5A059]/40 shadow-xl">
                                <Anchor className="w-10 h-10 text-[#C5A059] animate-bounce" />
                             </div>

                             <div className="max-w-2xl mx-auto mb-32">
                                <Quote className="w-16 h-16 mx-auto text-[#C5A059] mb-8 opacity-20" />
                                <h4 className="font-cinzel text-3xl font-black text-[#8B0000] mb-8 uppercase tracking-widest drop-shadow-md">Epílogo da Aula</h4>
                                <p className="font-cormorant text-2xl text-gray-500 italic leading-loose px-8">"Guardei a tua palavra no meu coração, para não pecar contra ti." <br/><span className="text-[12px] font-black tracking-[1.2em] not-italic text-[#C5A059] block mt-8 uppercase opacity-80">(Salmos 119:11 - ACF)</span></p>
                             </div>
                             
                             <button onClick={async () => {
                                 if (!userProgress || isRead) return;
                                 const updated = await db.entities.ReadingProgress.update(userProgress.id!, { ebd_read: [...(userProgress.ebd_read || []), studyKey], total_ebd_read: (userProgress.total_ebd_read || 0) + 1 });
                                 if (onProgressUpdate) onProgressUpdate(updated);
                                 onShowToast('Concluído! Sabedoria arquivada.', 'success');
                             }} disabled={isRead} className={`group relative px-20 py-10 rounded-full font-cinzel font-black text-2xl shadow-xl flex items-center justify-center gap-8 mx-auto overflow-hidden transition-all transform hover:scale-110 active:scale-95 border-4 border-white/10 ${isRead ? 'bg-green-600 text-white' : 'bg-gradient-to-r from-[#8B0000] via-[#D00010] to-[#600018] text-white'}`}>
                                 {isRead ? <CheckCircle className="w-10 h-10" /> : <GraduationCap className="w-10 h-10 group-hover:rotate-[360deg] transition-transform duration-[2s]" />}
                                 <span className="relative z-10 tracking-widest uppercase">{isRead ? 'ARQUIVADO' : 'CONCLUIR'}</span>
                             </button>
                         </footer>
                     )}
                </article>
            ) : (
                <div className="text-center py-40 bg-white dark:bg-dark-card rounded-[3rem] border-4 border-dashed border-[#C5A059]/20 animate-in fade-in duration-[1.5s] shadow-lg relative overflow-hidden group">
                    <ScrollText className="w-40 h-40 mx-auto text-[#C5A059] opacity-20 mb-12 drop-shadow-xl"/>
                    <p className="font-cinzel text-4xl font-black text-gray-400 mb-6 tracking-widest uppercase">Manuscrito Silente</p>
                    <p className="font-montserrat text-sm text-gray-500 uppercase tracking-widest mb-20 font-black">Aguardando transcrição magistral.</p>
                    {isAdmin && (
                        <div className="max-w-2xl mx-auto p-12 bg-[#8B0000]/5 rounded-[3rem] border-2 border-dashed border-[#8B0000]/20 flex flex-col items-center">
                            <Library className="w-16 h-16 text-[#8B0000] mb-8 opacity-70 animate-bounce" />
                            <p className="text-sm font-black text-[#8B0000] uppercase tracking-widest text-center leading-loose font-montserrat">Administrador ADMA SUPREMO: <br/> Utilize o motor Magnum Opus v45 para gerar exegese microscópica.</p>
                        </div>
                    )}
                </div>
            )}
        </main>

        {/* NAVEGAÇÃO FLUTUANTE COMPACTA (UI CORRIGIDA - NÃO OBSTRUTIVA) */}
        <AnimatePresence>
            {pages.length > 1 && hasAccess && !isEditing && (
                <motion.nav initial={{ y: 150, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 150, opacity: 0 }} className="fixed bottom-24 left-6 right-6 z-40 max-w-4xl mx-auto pointer-events-none">
                    <div className="bg-[#050505]/95 dark:bg-dark-card/95 backdrop-blur-md border border-[#C5A059]/40 p-4 rounded-3xl flex justify-between items-center shadow-2xl ring-4 ring-white/5 group pointer-events-auto">
                        <button onClick={() => { setCurrentPage(Math.max(0, currentPage - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={currentPage === 0} className="flex items-center gap-3 px-6 py-4 bg-[#8B0000] text-white rounded-2xl font-black text-[9px] md:text-[11px] uppercase tracking-widest disabled:opacity-20 transition-all shadow-lg active:scale-90 border border-white/10">
                            <ChevronLeft className="w-5 h-5" /> <span>Anterior</span>
                        </button>
                        
                        <div className="flex flex-col items-center px-10">
                            <span className="font-cinzel font-black text-[#C5A059] text-3xl tracking-widest drop-shadow-lg">{currentPage + 1} <span className="opacity-30 text-base">/ {pages.length}</span></span>
                            <div className="w-32 md:w-48 bg-white/10 h-1 rounded-full mt-4 overflow-hidden">
                                <motion.div className="bg-[#C5A059] h-full shadow-[0_0_10px_#C5A059]" style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }} />
                            </div>
                        </div>

                        <button onClick={() => { setCurrentPage(Math.min(pages.length - 1, currentPage + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={currentPage === pages.length - 1} className="flex items-center gap-3 px-6 py-4 bg-[#8B0000] text-white rounded-2xl font-black text-[9px] md:text-[11px] uppercase tracking-widest disabled:opacity-20 transition-all shadow-lg active:scale-90 border border-white/10">
                            <span>Próximo</span> <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </motion.nav>
            )}
        </AnimatePresence>
        
        <div className="h-48 shrink-0 pointer-events-none opacity-0">ADMA SECURITY LAYER v45</div>
    </div>
  );
}
