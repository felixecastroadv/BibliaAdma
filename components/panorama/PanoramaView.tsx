import React, { useState, useEffect, useRef } from 'react';
// ==========================================================================================
// COMPONENTE DE VISUALIZAÇÃO DO PANORAMA BÍBLICO - EDIÇÃO "MAGNUM OPUS" SUPREMA
// Focado em: Quantidade Massiva (Apostila Integral), Exegese Profunda e Rigor Ortodoxo
// Perfil: Professor Michel Felix (Teólogo PhD, Assembleiano, Arminiano, Erudito)
// ==========================================================================================
import { 
  ChevronLeft, GraduationCap, Lock, BookOpen, ChevronRight, Volume2, 
  Sparkles, Loader2, Book, Trash2, Edit, Save, X, CheckCircle, 
  Pause, Play, Settings, FastForward, Info, FileText, Languages, 
  History, Clock, AlertTriangle, Search, BookMarked, Quote, Plus, ShieldCheck
} from 'lucide-react';
import { db } from '../../services/database';
import { BIBLE_BOOKS, generateChapterKey } from '../../constants';
import { EBDContent, UserProgress } from '../../types';
import { generateContent } from '../../services/geminiService';

// Props do Componente PanoramaView
interface PanoramaProps {
    isAdmin: boolean;
    onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
    onBack: () => void;
    userProgress: UserProgress | null;
    onProgressUpdate: (updated: UserProgress) => void;
}

/**
 * PanoramaView: O motor principal de ensino da ADMA.
 * Este componente gerencia a leitura, navegação e geração por IA de apostilas teológicas
 * de alta densidade, respeitando o padrão pedagógico do Professor Michel Felix.
 */
export default function PanoramaView({ isAdmin, onShowToast, onBack, userProgress, onProgressUpdate }: PanoramaProps) {
  // --- ESTADOS DE NAVEGAÇÃO E CONTEÚDO ---
  const [book, setBook] = useState('Gênesis');
  const [chapter, setChapter] = useState(1);
  const [content, setContent] = useState<EBDContent | null>(null);
  const [activeTab, setActiveTab] = useState<'student' | 'teacher'>('student');
  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState<string[]>([]);
  
  // --- ESTADOS DE GERAÇÃO PELA IA ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationTime, setGenerationTime] = useState(0);
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
  const [customInstructions, setCustomInstructions] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);

  // --- ESTADOS DE EDIÇÃO MANUAL ---
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  // --- ESTADOS DE ÁUDIO (TEXT-TO-SPEECH) ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [playbackRate, setPlaybackRate] = useState(1);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // --- ESTADOS DE INTERAÇÃO (SWIPE/GESTORA) ---
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  // --- MENSAGENS DE STATUS PARA GERAÇÕES LONGAS (> 2 MINUTOS) ---
  // Sistema dinâmico para manter o Admin informado durante o processo de "Pensamento" da IA
  const loadingStatusMessages = [
    "Iniciando exegese microscópica de Michel Felix...",
    "Consultando originais (Hebraico/Grego)...",
    "Analisando contexto histórico e geográfico detalhado...",
    "Construindo tópicos doutrinários de alta densidade...",
    "Redigindo apostila exaustiva (Páginas 1 a 4)...",
    "Aprofundando comentários versículo por versículo...",
    "Integrando tipologia bíblica e conexões cristocêntricas...",
    "Verificando fatos arqueológicos e curiosidades...",
    "Aplicando protocolos de segurança teológica ADMA...",
    "Finalizando formatação no Padrão Prof. Michel Felix...",
    "Quase pronto! Organizando apostila de 6 a 10 páginas...",
    "A IA está finalizando a 'Arqueologia' e 'Tipologia', aguarde...",
    "Consolidando dados teológicos massivos para o capítulo inteiro..."
  ];

  const studyKey = generateChapterKey(book, chapter);
  const isRead = userProgress?.ebd_read?.includes(studyKey);

  // --- EFEITOS DE CARREGAMENTO INICIAL ---
  useEffect(() => { 
    loadContent(); 
  }, [book, chapter]);

  // Cronômetro de Geração: Monitora o tempo real de resposta da IA
  useEffect(() => {
    let interval: any;
    if (isGenerating) {
        interval = setInterval(() => {
            setGenerationTime(prev => prev + 1);
            if (generationTime % 12 === 0 && generationTime > 0) {
                setCurrentStatusIndex(prev => (prev + 1) % loadingStatusMessages.length);
            }
        }, 1000);
    } else {
        setGenerationTime(0);
        setCurrentStatusIndex(0);
    }
    return () => clearInterval(interval);
  }, [isGenerating, generationTime]);

  // Sistema de Gerenciamento de Vozes: Prioriza motores neurais para leitura humanizada
  useEffect(() => {
    const loadVoices = () => {
        let available = window.speechSynthesis.getVoices().filter(v => v.lang.includes('pt'));
        
        // Prioridade para vozes Humanizadas (Google, Microsoft, iOS)
        available.sort((a, b) => {
            const getScore = (v: SpeechSynthesisVoice) => {
                let score = 0;
                if (v.name.includes('Google')) score += 10;
                if (v.name.includes('Microsoft')) score += 8;
                if (v.name.includes('Luciana') || v.name.includes('Joana')) score += 5;
                if (v.name.includes('Daniela')) score += 3;
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

  // Monitoramento de Mudança de Página para Áudio: Previne leitura sobreposta
  useEffect(() => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  }, [currentPage, book, chapter, activeTab]);

  // Atualização em tempo real de voz/velocidade durante a audição
  useEffect(() => {
    if (isPlaying) {
        window.speechSynthesis.cancel();
        speakText();
    }
  }, [playbackRate, selectedVoice]);

  // --- HANDLERS DE INTERAÇÃO TÁTIL (SWIPE) ---
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

    if (isLeftSwipe && currentPage < pages.length - 1) setCurrentPage(p => p + 1);
    if (isRightSwipe && currentPage > 0) setCurrentPage(p => p - 1);
  };

  // --- LÓGICA DE PERSISTÊNCIA DE DADOS ---
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
        console.error("Erro ao carregar panorama:", err);
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

  // --- ALGORITMO DE PAGINAÇÃO DE ALTA DENSIDADE (PARA APOSTILAS LONGAS DE 6-10 PÁGINAS) ---
  const processAndPaginate = (html: string) => {
    if (!html) { setPages([]); return; }
    
    // Divide o texto por marcadores de quebra ou continuação injetados pela IA
    let rawSegments = html.split(/<hr[^>]*>|__CONTINUATION_MARKER__/i)
                          .map(s => cleanText(s))
                          .filter(s => s.length > 50);

    // Proteção contra Blocos Gigantes: Se a IA não inseriu tags <hr>, forçamos divisão por tópicos
    if (rawSegments.length === 1 && rawSegments[0].length > 4000) {
        const bigText = rawSegments[0];
        const forcedSegments = bigText.split(/(?=\n### |^\s*[IVX]+\.|^\s*\d+\.\s+[A-Z]|### )/gm);
        if (forcedSegments.length > 1) {
            rawSegments = forcedSegments.map(s => cleanText(s)).filter(s => s.length > 100);
        }
    }
    
    const finalPages: string[] = [];
    let currentBuffer = "";
    // Configurações de Tamanho de Página Confortável (Mobile First)
    const CHAR_LIMIT_TARGET = 3600; 

    for (let i = 0; i < rawSegments.length; i++) {
        const segment = rawSegments[i];
        if (!currentBuffer) {
            currentBuffer = segment;
        } else {
            // Bufferização inteligente: tenta manter tópicos juntos até o limite de leitura confortável
            if ((currentBuffer.length + segment.length) < (CHAR_LIMIT_TARGET * 1.5)) {
                currentBuffer += "\n\n__CONTINUATION_MARKER__\n\n" + segment;
            } else {
                if (currentBuffer.length > 1800) {
                    finalPages.push(currentBuffer);
                    currentBuffer = segment;
                } else {
                    currentBuffer += "\n\n__CONTINUATION_MARKER__\n\n" + segment;
                }
            }
        }
    }
    
    if (currentBuffer) finalPages.push(currentBuffer);
    setPages(finalPages.length > 0 ? finalPages : [cleanText(html)]);
  };

  const hasAccess = isAdmin || activeTab === 'student'; 

  // --- SISTEMA DE ÁUDIO ROBUSTO (CHUNKING & QUEUE) ---
  const speakText = () => {
    if (!pages[currentPage]) return;
    window.speechSynthesis.cancel(); 

    // Limpeza profunda para fala clara, ignorando tags de sistema
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = pages[currentPage]
        .replace(/__CONTINUATION_MARKER__/g, '. ')
        .replace(/<br>/g, '. ')
        .replace(/<\/p>/g, '. '); 
    
    let textToSpeak = tempDiv.textContent || tempDiv.innerText || "";
    textToSpeak = textToSpeak.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '').replace(/_/g, '').trim();

    if (!textToSpeak) return;

    // Divisão em sentenças para evitar que o motor de síntese congele em apostilas muito densas
    const sentences = textToSpeak.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [textToSpeak];
    let index = 0;

    const speakNextChunk = () => {
        if (index >= sentences.length) {
            setIsPlaying(false);
            return;
        }

        const chunk = sentences[index];
        if (!chunk.trim()) {
            index++;
            speakNextChunk();
            return;
        }

        const utter = new SpeechSynthesisUtterance(chunk);
        utter.lang = 'pt-BR';
        utter.rate = playbackRate;
        const voice = voices.find(v => v.name === selectedVoice);
        if (voice) utter.voice = voice;

        utter.onend = () => {
            index++;
            speakNextChunk();
        };

        utter.onerror = (e) => {
            console.error("Falha na síntese de voz:", e);
            setIsPlaying(false);
        };

        speechRef.current = utter;
        window.speechSynthesis.speak(utter);
    };

    setIsPlaying(true);
    speakNextChunk();
  };

  const togglePlay = () => {
    if (isPlaying) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
    } else {
        speakText();
    }
  };

  // --- AÇÕES DO ALUNO (PROGRESSO E RANKING) ---
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
          onShowToast('Parabéns! Estudo registrado no seu Ranking EBD.', 'success');
      } catch (err) {
          onShowToast('Erro ao salvar progresso.', 'error');
      }
  };

  // --- RENDERIZADORES DE ESTILO VISUAL ADMA ---
  const parseInlineStyles = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} className="text-[#8B0000] dark:text-[#ff6b6b] font-bold">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
            return <em key={index} className="text-gray-700 dark:text-gray-300 font-medium italic opacity-90">{part.slice(1, -1)}</em>;
        }
        return part;
    });
  };

  const renderFormattedText = (text: string) => {
    const lines = text.split('\n').filter(b => b.trim().length > 0);
    
    return (
        <div className="space-y-6">
            {lines.map((line, lineIdx) => {
                const trimmed = line.trim();

                // Divisor Visual de Continuação (Pagination Breadcrumb)
                if (trimmed === '__CONTINUATION_MARKER__') {
                    return (
                        <div key={lineIdx} className="my-14 flex items-center justify-center select-none animate-in fade-in duration-700">
                            <div className="h-[1px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent w-full opacity-40"></div>
                            <span className="mx-6 text-[#C5A059] text-[9px] font-cinzel opacity-70 tracking-[0.4em] uppercase bg-[#FDFBF7] dark:bg-dark-card px-4">O Ensino Doutrinário Continua</span>
                            <div className="h-[1px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent w-full opacity-40"></div>
                        </div>
                    );
                }

                // Títulos Principais de Seção
                if (trimmed.includes('PANORÂMA BÍBLICO') || trimmed.includes('PANORAMA BÍBLICO')) {
                    return (
                        <div key={lineIdx} className="mb-14 text-center border-b-2 border-[#8B0000] dark:border-[#ff6b6b] pb-8 pt-4">
                            <h1 className="font-cinzel font-bold text-2xl md:text-5xl text-[#8B0000] dark:text-[#ff6b6b] uppercase tracking-[0.1em] drop-shadow-sm leading-tight">
                                {trimmed}
                            </h1>
                        </div>
                    );
                }

                // Cabeçalhos de Tópicos Principais (Exegese)
                const isHeader = trimmed.startsWith('###') || /^[IVX]+\./.test(trimmed);
                if (isHeader) {
                    const title = trimmed.replace(/###/g, '').trim();
                    return (
                        <div key={lineIdx} className="mt-14 mb-8 flex flex-col items-center justify-center gap-3">
                            <h3 className="font-cinzel font-bold text-xl md:text-3xl text-[#1a0f0f] dark:text-[#E0E0E0] uppercase tracking-wider text-center leading-snug">
                                {title}
                            </h3>
                            <div className="h-[3px] bg-[#C5A059] w-16 rounded-full"></div>
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
                        <div key={lineIdx} className="mb-8 flex gap-5 items-start group pl-2 animate-in slide-in-from-left-3 duration-500">
                            <div className="flex-shrink-0 mt-1 min-w-[2.5rem] text-right">
                                <span className="font-cinzel font-bold text-2xl text-[#C5A059] dark:text-[#C5A059] drop-shadow-sm">
                                    {numberPart}
                                </span>
                            </div>
                            <div className="flex-1">
                                <div className="font-cormorant text-xl md:text-2xl leading-relaxed text-gray-900 dark:text-gray-200 text-justify border-l-4 border-[#C5A059]/10 pl-6 group-hover:border-[#C5A059]/40 transition-all">
                                    {parseInlineStyles(textPart)}
                                </div>
                            </div>
                        </div>
                    );
                }

                // Destaques e Boxes de Arqueologia/Curiosidade
                if (trimmed.toUpperCase().includes('CURIOSIDADE') || trimmed.toUpperCase().includes('ATENÇÃO:') || trimmed.toUpperCase().includes('INSIGHT:') || trimmed.toUpperCase().includes('ARQUEOLOGIA') || trimmed.endsWith('?')) {
                    return (
                        <div key={lineIdx} className="my-12 mx-2 font-cormorant text-xl text-[#1a0f0f] dark:text-gray-200 font-medium italic bg-[#C5A059]/10 dark:bg-[#C5A059]/5 p-8 rounded-2xl border border-[#C5A059]/30 shadow-sm text-justify relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#C5A059]"></div>
                            <div className="flex items-center gap-3 mb-4 text-[#C5A059]">
                                <Sparkles className="w-6 h-6" />
                                <span className="text-xs font-bold uppercase tracking-[0.2em] font-montserrat">Esclarecimento Erudito</span>
                            </div>
                            <div>{parseInlineStyles(trimmed)}</div>
                        </div>
                    );
                }

                // Parágrafos de Explicação Exegética
                return (
                    <p key={lineIdx} className="font-cormorant text-xl md:text-2xl leading-loose text-gray-900 dark:text-gray-200 text-justify indent-12 mb-8 tracking-wide">
                        {parseInlineStyles(trimmed)}
                    </p>
                );
            })}
        </div>
    );
  };

  // --- FUNÇÕES DE ADMINISTRAÇÃO E EDIÇÃO MANUAL ---
  const handleStartEditing = () => {
    const text = activeTab === 'student' ? content?.student_content : content?.teacher_content;
    setEditValue(text || '');
    setIsEditing(true);
  };

  const handleSaveManualEdit = async () => {
    if (!content) return;
    const data = {
        ...content,
        student_content: activeTab === 'student' ? editValue : content.student_content,
        teacher_content: activeTab === 'teacher' ? editValue : content.teacher_content,
    };
    try {
        if (content.id) await db.entities.PanoramaBiblico.update(content.id, data);
        await loadContent();
        setIsEditing(false);
        onShowToast('Apostila atualizada com sucesso pelo Admin!', 'success');
    } catch (e) {
        onShowToast('Erro ao salvar apostila.', 'error');
    }
  };

  // ==========================================================================================
  // GERAÇÃO EM LOTE PARA MÁXIMA QUANTIDADE E QUALIDADE (MODO MICHEL FELIX - 100% OBEDIENTE)
  // ==========================================================================================
  const handleGenerate = async (mode: 'start' | 'continue') => {
    setIsGenerating(true);
    const target = activeTab;
    const studyKey = generateChapterKey(book, chapter);
    const existing = (await db.entities.PanoramaBiblico.filter({ study_key: studyKey }))[0] || {};
    const currentText = target === 'student' ? (existing.student_content || '') : (existing.teacher_content || '');
    
    // Captura contexto limpo para continuação fluída
    const cleanContext = currentText.replace(/__CONTINUATION_MARKER__/g, ' ').slice(-6000);

    // Lógica Restorada de Introdução Diferenciada
    const isFirstChapter = chapter === 1;
    const introInstruction = isFirstChapter 
        ? "2. INTRODUÇÃO GERAL:\n           Texto rico contextualizando O LIVRO (autor, data, propósito) e o cenário deste primeiro capítulo."
        : `2. INTRODUÇÃO DO CAPÍTULO:\n           FOCAR EXCLUSIVAMENTE no contexto imediato do capítulo ${chapter}. NÃO repita a introdução geral do livro de ${book} (autoria, data, etc), pois já foi dado nos capítulos anteriores. Vá direto ao ponto do enredo atual.`;

    // BLOCO DE INSTRUÇÕES SUPREMAS (Michel Felix Standard)
    const WRITING_STYLE = `
        ATUE COMO: Professor Michel Felix.
        PERFIL: Teólogo Pentecostal Clássico, Arminiano, Erudito e Assembleiano.

        --- MISSÃO SUPREMA: APOSTILA COMPLETA, DENSA E EXAUSTIVA ---
        1. OBJETIVO ABSOLUTO: Gerar o conteúdo INTEGRAL, VERSÍCULO POR VERSÍCULO, do capítulo ${chapter} de ${book} em uma única apostila completa.
        2. EXTENSÃO OBRIGATÓRIA: Não poupe palavras. O objetivo é uma apostila que teria de 6 a 10 páginas impressas (mínimo 4.000 palavras no total para o capítulo completo).
        3. MICROSCOPIA BÍBLICA: Explique cada versículo de forma profunda. PROIBIDO fazer resumos genéricos que pulam o texto. Se o capítulo tiver 30 versículos, explique todos os 30 em ordem.
        4. O alvo é o EFEITO "AH! ENTENDI!" (CLAREZA E PROFUNDIDADE).

        --- OBJETIVO PEDAGÓGICO ---
        1. LINGUAGEM: O texto deve ser PROFUNDO, mas EXTREMAMENTE CLARO. O aluno (seja jovem ou idoso) deve ler e entender instantaneamente.
        2. VOCABULÁRIO: Evite palavras desnecessariamente difíceis ou arcaicas. Se houver um sinônimo simples, USE-O.
        3. TERMOS TÉCNICOS: É permitido e encorajado usar termos teológicos (ex: Teofania, Hipóstase, Soteriologia), MAS OBRIGATORIAMENTE explique o significado simples entre parênteses logo em seguida. Ex: "Vemos aqui uma Teofania (uma aparição visível de Deus)...".

        --- PROTOCOLO DE SEGURANÇA TEOLÓGICA E DIDÁTICA (NÍVEL MÁXIMO - IMPLÍCITO) ---
        1. A BÍBLIA EXPLICA A BÍBLIA: Antes de formular o comentário, verifique MENTALMENTE e RIGOROSAMENTE o CONTEXTO IMEDIATO (capítulo) e o CONTEXTO REMOTO (livros históricos paralelos, profetas contemporâneos, Novo Testamento) para garantir a coerência.
        2. PRECISÃO CRONOLÓGICA E CONTEXTUAL: Ao explicar, evite anacronismos (ex: confundir reis, datas ou eventos que ainda não ocorreram na narrativa).
        3. EXEMPLO DE RIGOR: Se o texto trata de Ezequias, verifique se Manassés já era nascido. A Bíblia diz que não. Logo, seja exato.
        4. IMPORTANTE: Não escreva "Segundo a regra hermenêutica". Apenas aplique-a silenciosamente para gerar o conteúdo correto.

        --- DIDÁTICA DOS TEXTOS POLÊMICOS E DIFÍCEIS ---
        1. É EXCELENTE citar as principais correntes interpretativas divergentes para enriquecer a cultura do aluno (ex: "Alguns teólogos históricos interpretam como X, outros como Y..."). Mostre erudição citando as visões (Judaica, Patrística, Apócrifa).
        2. CONTUDO, APÓS ELENCAR as visões, você deve OBRIGATORIAMENTE concluir defendendo a interpretação Ortodoxa, Assembleiana e Biblicamente coerente, refutando as demais com base nas Escrituras e nas palavras de Jesus.
        
        --- APLICAÇÃO PRÁTICA EM CASOS ESPECÍFICOS ---
        - Gênesis 6 ("Filhos de Deus"): Cite que a visão de "anjos caídos" existe (Enoque/Josefo), MAS refute-a biblicamente (Mt 22:30). Defenda a "Linhagem de Sete".
        - Jefté: Cite o sacrifício literal, mas defenda a visão da dedicação perpétua ao tabernáculo (celibato).
        - Em resumo: Apresente o leque de interpretações, mas feche a questão com a ortodoxia segura.

        5. ANGELOLOGIA E ANTROPOLOGIA: Respeite a natureza dos seres criados. Não misture naturezas distintas.
        6. TOM: Magistral, Impessoal, Acadêmico, Vibrante e Ortodoxo.

        --- METODOLOGIA DE ENSINO (MICROSCOPIA BÍBLICA) ---
        1. CHEGA DE RESUMOS: O aluno precisa entender o texto COMPLETAMENTE. 
        2. DETALHES QUE FAZEM A DIFERENÇA: Traga costumes da época, geografia e contexto histórico.
        3. PROIBIDO TRANSCREVER O TEXTO BÍBLICO: O aluno já tem a Bíblia. Cite apenas a referência (Ex: "No versículo 1...", ou "Em Gn 47:1-6...") e vá direto para a EXPLICAÇÃO ERUDITA.

        --- IDIOMAS ORIGINAIS E ETIMOLOGIA (INDISPENSÁVEL) ---
        1. PALAVRAS-CHAVE: Cite os termos originais (Hebraico no AT / Grego no NT) transliterados e com a grafia original quando relevante.
        2. SIGNIFICADOS DE NOMES: Sempre traga o significado etimológico de nomes de pessoas e lugares.

        --- ESTRUTURA VISUAL OBRIGATÓRIA (BASEADA NO MODELO ADMA) ---
        1. TÍTULO PRINCIPAL: PANORÂMA BÍBLICO - ${book.toUpperCase()} ${chapter} (PROF. MICHEL FELIX)
        ${introInstruction}
        3. TÓPICOS DO ESTUDO (Use Numeração 1., 2., 3...):
           1. TÍTULO DO TÓPICO EM MAIÚSCULO (Referência: Gn X:Y-Z)
           (Explicação detalhada versículo por versículo aplicando a microscopia bíblica).
        4. SEÇÕES FINAIS OBRIGATÓRIAS:
           ### TIPOLOGIA: CONEXÃO COM JESUS CRISTO (Como este capítulo aponta para o Messias).
           ### CURIOSIDADES E ARQUEOLOGIA (Fatos históricos e arqueológicos).

        --- INSTRUÇÕES DE PAGINAÇÃO ---
        1. O sistema divide automaticamente usando a tag <hr class="page-break">.
        2. VOCÊ DEVE inserir a tag <hr class="page-break"> a cada bloco de exegese densa ou entre os tópicos principais.
    `;
    
    const instructions = customInstructions ? `\nINSTRUÇÕES EXTRAS DO ADMIN: ${customInstructions}` : "";
    const continuationInstructions = `MODO CONTINUAÇÃO. O texto anterior terminou assim: "...${cleanContext.slice(-400)}...". Continue o raciocínio detalhado de onde parou. Se já cobriu todo o texto bíblico, GERE OBRIGATORIAMENTE AS SEÇÕES FINAIS (Tipologia e Arqueologia).`;

    let specificPrompt = target === 'student' ? 
        `OBJETIVO: AULA COMPLETA DO ALUNO para ${book} ${chapter}. ${WRITING_STYLE} ${instructions} ${mode === 'continue' ? continuationInstructions : 'INÍCIO DO ESTUDO COMPLETO E EXAUSTIVO.'}` : 
        `OBJETIVO: MANUAL INTEGRAL DO PROFESSOR para ${book} ${chapter}. ${WRITING_STYLE} ${instructions} ${mode === 'continue' ? continuationInstructions : 'INÍCIO DO ESTUDO COMPLETO E EXAUSTIVO.'}`;

    try {
        // CORREÇÃO CRÍTICA: Passa isLongOutput=true para o serviço permitir geração massiva de tokens (Long thinking)
        const result = await generateContent(specificPrompt, null, true, 'ebd');
        
        if (!result || result.trim().length < 100) throw new Error("A IA retornou conteúdo insuficiente para uma apostila Magnum Opus.");
        
        let cleanedResult = result.trim();
        // Remove possíveis wrappers indesejados de JSON ou Markdown
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
        onShowToast('Apostila Magnum Opus gerada com sucesso!', 'success');
        if (mode === 'continue') setTimeout(() => setCurrentPage(pages.length), 500); 
    } catch (e: any) { 
        onShowToast(`Falha na Geração: ${e.message}`, 'error'); 
    } finally { 
        setIsGenerating(false); 
    }
  };

  const handleDeletePage = async () => {
    if (!window.confirm("Tem certeza que deseja remover esta página da apostila?") || !content) return;
    const updatedPages = pages.filter((_, index) => index !== currentPage);
    const newContent = updatedPages.join('<hr class="page-break">');
    const data = { ...content, student_content: activeTab === 'student' ? newContent : content.student_content, teacher_content: activeTab === 'teacher' ? newContent : content.teacher_content };
    try { 
        if (content.id) await db.entities.PanoramaBiblico.update(content.id, data); 
        setPages(updatedPages); 
        if (currentPage >= updatedPages.length) setCurrentPage(Math.max(0, updatedPages.length - 1)); 
        await loadContent(); 
        onShowToast('Página excluída do manuscrito.', 'success'); 
    } catch (e) { 
        onShowToast('Erro ao excluir.', 'error'); 
    }
  };

  // --- RENDERIZAÇÃO DA INTERFACE ---
  return (
    <div 
        className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-300 flex flex-col" 
        onTouchStart={onTouchStart} 
        onTouchMove={onTouchMove} 
        onTouchEnd={onTouchEnd}
    >
        {/* BARRA SUPERIOR DE NAVEGAÇÃO LUXO */}
        <header className="sticky top-0 z-40 bg-gradient-to-r from-[#600018] to-[#400010] text-white p-4 shadow-2xl flex justify-between items-center safe-top border-b border-[#C5A059]/30">
            <button 
                onClick={onBack} 
                className="p-2 hover:bg-white/10 rounded-full transition-all active:scale-90"
                aria-label="Voltar"
            >
                <ChevronLeft className="w-7 h-7" />
            </button>
            <div className="flex flex-col items-center">
                <h2 className="font-cinzel font-bold text-xl tracking-[0.15em]">Panorama EBD</h2>
                <span className="text-[9px] uppercase tracking-[0.4em] opacity-70 font-montserrat">Edição ADMA Premium</span>
            </div>
            <div className="flex gap-2">
                {isAdmin && !isEditing && content && (
                    <button 
                        onClick={handleStartEditing} 
                        className="p-2 hover:bg-white/10 rounded-full text-[#C5A059] transition-all"
                        title="Modo Manuscrito"
                    >
                        <Edit className="w-6 h-6" />
                    </button>
                )}
                <button 
                    onClick={() => setShowAudioSettings(!showAudioSettings)} 
                    className="p-2 hover:bg-white/10 rounded-full transition-all"
                    title="Configurações de Áudio"
                >
                    <Volume2 className={isPlaying ? "text-green-400 animate-pulse w-6 h-6" : "w-6 h-6"} />
                </button>
            </div>
        </header>

        {/* PAINEL DE CONTROLE DE ÁUDIO (TEXT-TO-SPEECH) */}
        {showAudioSettings && (
            <div className="bg-white/95 dark:bg-dark-card/95 backdrop-blur-xl p-6 border-b border-[#C5A059]/40 shadow-2xl animate-in slide-in-from-top-2 z-30">
                <div className="flex flex-col gap-5 max-w-xl mx-auto">
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-xs uppercase tracking-widest text-[#1a0f0f] dark:text-white flex items-center gap-3">
                            <Clock className="w-4 h-4 text-[#C5A059]" /> Tempo Estimado de Leitura
                        </span>
                        <button 
                            onClick={togglePlay} 
                            className="bg-[#C5A059] text-white px-6 py-2.5 rounded-full font-bold flex items-center gap-3 shadow-lg hover:shadow-[#C5A059]/40 active:scale-95 transition-all"
                        >
                            {isPlaying ? <Pause className="w-4 h-4 fill-current"/> : <Play className="w-4 h-4 fill-current"/>} 
                            {isPlaying ? 'Pausar' : 'Ouvir Agora'}
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-500">Selecionar Professor (Voz)</label>
                            <select 
                                className="w-full p-2.5 text-sm border rounded-xl dark:bg-gray-800 dark:text-white border-[#C5A059]/30 font-montserrat outline-none focus:ring-1 focus:ring-[#C5A059]" 
                                value={selectedVoice} 
                                onChange={e => setSelectedVoice(e.target.value)}
                            >
                                {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-500">Velocidade da Aula</label>
                            <div className="flex gap-2">
                                {[0.8, 1, 1.2, 1.5].map(rate => (
                                    <button 
                                        key={rate} 
                                        onClick={() => setPlaybackRate(rate)} 
                                        className={`flex-1 py-2.5 text-xs font-bold rounded-xl border transition-all ${playbackRate === rate ? 'bg-[#8B0000] text-white border-[#8B0000] shadow-md' : 'bg-gray-100 dark:bg-gray-800 dark:text-gray-400 border-transparent hover:bg-gray-200'}`}
                                    >
                                        {rate}x
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* BARRA DE SELEÇÃO DE LIVRO E CAPÍTULO */}
        <div className="bg-white dark:bg-dark-card p-4 border-b border-[#C5A059]/20 flex gap-4 shadow-sm shrink-0">
             <div className="flex-1 relative">
                 <BookMarked className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#C5A059] opacity-60" />
                 <select 
                    value={book} 
                    onChange={e => setBook(e.target.value)} 
                    className="w-full pl-12 pr-4 py-3.5 border border-[#C5A059]/25 rounded-2xl font-cinzel text-sm dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-[#C5A059]/40 transition-all outline-none"
                >
                    {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                 </select>
             </div>
             <div className="w-28 relative">
                 <History className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#C5A059] opacity-60" />
                 <input 
                    type="number" 
                    value={chapter} 
                    onChange={e => setChapter(Number(e.target.value))} 
                    className="w-full pl-12 pr-4 py-3.5 border border-[#C5A059]/25 rounded-2xl font-cinzel text-sm dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-[#C5A059]/40 transition-all outline-none" 
                    min={1} 
                />
             </div>
        </div>

        {/* NAVEGAÇÃO DE PERFIL (ALUNO / PROFESSOR) */}
        <nav className="flex bg-[#F5F5DC] dark:bg-black border-b border-[#C5A059]/20 shrink-0">
            <button 
                onClick={() => setActiveTab('student')} 
                className={`flex-1 py-6 font-cinzel font-bold text-xs uppercase tracking-[0.25em] flex justify-center items-center gap-4 transition-all ${activeTab === 'student' ? 'bg-[#600018] text-white shadow-inner scale-100' : 'text-gray-500 dark:text-gray-500 hover:bg-black/5'}`}
            >
                <BookOpen className="w-5 h-5" /> Perfil Aluno
            </button>
            <button 
                onClick={() => setActiveTab('teacher')} 
                className={`flex-1 py-6 font-cinzel font-bold text-xs uppercase tracking-[0.25em] flex justify-center items-center gap-4 transition-all ${activeTab === 'teacher' ? 'bg-[#600018] text-white shadow-inner scale-100' : 'text-gray-500 dark:text-gray-500 hover:bg-black/5'}`}
            >
                {isAdmin ? <GraduationCap className="w-6 h-6" /> : <Lock className="w-5 h-5" />} Perfil Professor
            </button>
        </nav>

        {/* PAINEL DO EDITOR CHEFE ADMA (ADMIN ONLY) */}
        {isAdmin && !isEditing && (
            <div className="bg-[#1a0f0f] text-[#C5A059] p-6 shadow-2xl sticky top-[145px] z-20 border-b-4 border-[#8B0000] animate-in slide-in-from-top-4">
                {isGenerating ? (
                    <div className="flex flex-col items-center gap-4 py-3 animate-in fade-in">
                        <div className="flex items-center gap-5">
                            <Loader2 className="animate-spin w-7 h-7 text-[#C5A059]"/>
                            <div className="flex flex-col">
                                <span className="font-cinzel text-xs font-bold uppercase tracking-widest text-white">{loadingStatusMessages[currentStatusIndex]}</span>
                                <span className="text-[10px] opacity-70 font-mono mt-1">Tempo de Geração: {generationTime}s (Modo Apostila Exaustiva)</span>
                            </div>
                        </div>
                        <div className="w-full bg-white/10 h-2 rounded-full mt-3 overflow-hidden border border-white/10 shadow-inner">
                            <div className="bg-gradient-to-r from-[#8B0000] to-[#C5A059] h-full animate-pulse w-full shadow-[0_0_15px_#C5A059]"></div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-[#8B0000] rounded-xl flex items-center justify-center shadow-lg border border-white/10"><ShieldCheck className="w-6 h-6 text-white" /></div>
                                <span className="font-cinzel text-xs font-bold tracking-[0.3em] uppercase">EDITOR CHEFE ADMA</span>
                            </div>
                            <button 
                                onClick={() => setShowInstructions(!showInstructions)} 
                                className="text-[10px] font-bold uppercase tracking-widest underline decoration-double underline-offset-4 hover:text-white transition-colors"
                            >
                                {showInstructions ? 'Ocultar Opções' : 'Instruções Teológicas'}
                            </button>
                        </div>
                        
                        {showInstructions && (
                            <div className="mb-5 animate-in fade-in duration-500 scale-100">
                                <textarea 
                                    value={customInstructions} 
                                    onChange={(e) => setCustomInstructions(e.target.value)} 
                                    placeholder="Ex: Enfatize as profecias messiânicas, o contexto da Aliança e Arqueologia da região..." 
                                    className="w-full p-4 text-sm text-black rounded-2xl border-none focus:ring-2 focus:ring-[#C5A059] font-montserrat shadow-2xl" 
                                    rows={4} 
                                />
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button 
                                onClick={() => handleGenerate('start')} 
                                disabled={isGenerating} 
                                className="flex-2 px-6 py-4 border-2 border-[#C5A059] rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#C5A059] hover:text-[#1a0f0f] transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl"
                            >
                                <Sparkles className="w-5 h-5"/> GERAR APOSTILA COMPLETA
                            </button>
                            <button 
                                onClick={() => handleGenerate('continue')} 
                                disabled={isGenerating} 
                                className="flex-1 px-6 py-4 bg-[#C5A059] text-[#1a0f0f] font-bold rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl"
                            >
                                <Plus className="w-5 h-5"/> CONTINUAR
                            </button>
                            {pages.length > 0 && (
                                <button 
                                    onClick={handleDeletePage} 
                                    className="px-5 py-4 bg-red-900 text-white rounded-2xl hover:bg-red-700 transition-all shadow-xl active:scale-95"
                                    title="Excluir página atual"
                                >
                                    <Trash2 className="w-6 h-6" />
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        )}

        {/* ÁREA DE EXIBIÇÃO DO CONTEÚDO (SCROLLABLE) */}
        <main className="flex-1 overflow-y-auto p-4 md:p-14 max-w-5xl mx-auto pb-48 w-full scroll-smooth transition-all">
            {!hasAccess ? (
                <div className="text-center py-48 opacity-60 dark:text-white animate-in zoom-in duration-1000">
                    <Lock className="w-32 h-32 mx-auto mb-10 text-[#8B0000] drop-shadow-2xl opacity-40" />
                    <h2 className="font-cinzel text-4xl font-bold mb-4 tracking-[0.1em]">Acesso Doutrinário Reservado</h2>
                    <p className="font-montserrat text-sm max-w-sm mx-auto opacity-90 uppercase tracking-[0.3em] leading-loose">
                        Este conteúdo é exclusivo para o corpo docente, líderes autorizados e alunos matriculados na EBD ADMA.
                    </p>
                </div>
            ) : isEditing ? (
                 <div className="bg-white dark:bg-dark-card shadow-2xl p-8 rounded-[40px] border-2 border-[#C5A059] relative animate-in slide-in-from-bottom-8 duration-500">
                     <div className="flex justify-between items-center mb-8 border-b pb-6 dark:border-white/10">
                        <h3 className="font-cinzel font-bold text-2xl text-[#8B0000] dark:text-[#ff6b6b] flex items-center gap-4">
                            <Edit className="w-8 h-8" /> Revisão de Manuscrito
                        </h3>
                        <div className="flex gap-4">
                            <button onClick={() => setIsEditing(false)} className="px-6 py-3 text-xs font-bold border-2 border-red-500 text-red-500 rounded-full hover:bg-red-50 transition-all uppercase tracking-widest active:scale-95">Descartar</button>
                            <button onClick={handleSaveManualEdit} className="px-6 py-3 text-xs font-bold bg-green-600 text-white rounded-full hover:bg-green-700 shadow-xl transition-all uppercase tracking-widest active:scale-95">Salvar Apostila</button>
                        </div>
                     </div>
                     <div className="mb-6 p-4 bg-[#F5F5DC] dark:bg-gray-900 rounded-2xl border border-[#C5A059]/20">
                         <p className="text-[11px] text-[#8B0000] font-bold uppercase tracking-widest mb-1 flex items-center gap-2"><Info className="w-4 h-4"/> Comando de Paginação</p>
                         <p className="text-[10px] text-gray-500 font-montserrat italic">Utilize a tag &lt;hr class="page-break"&gt; para criar quebras de página manuais na apostila.</p>
                     </div>
                     <textarea 
                        value={editValue} 
                        onChange={e => setEditValue(e.target.value)} 
                        className="w-full h-[65vh] p-8 font-mono text-base border-none focus:ring-0 rounded-3xl bg-gray-50 dark:bg-gray-900 dark:text-gray-300 resize-none shadow-inner leading-relaxed" 
                        placeholder="Edite o conteúdo erudito da apostila aqui..." 
                    />
                 </div>
            ) : content && pages.length > 0 ? (
                <article className="bg-white dark:bg-dark-card shadow-[0_25px_70px_-20px_rgba(0,0,0,0.15)] p-8 md:p-24 min-h-[75vh] border border-[#C5A059]/30 relative rounded-[50px] animate-in fade-in duration-1000 select-text">
                     {renderFormattedText(pages[currentPage])}
                     
                     <div className="absolute bottom-12 right-14 flex items-center gap-5 select-none opacity-40 hover:opacity-100 transition-opacity">
                        <div className="h-[1px] w-12 bg-[#C5A059]"></div>
                        <span className="text-[#C5A059] font-cinzel text-xs font-bold tracking-[0.5em]">{currentPage + 1} DE {pages.length}</span>
                     </div>

                     {currentPage === pages.length - 1 && userProgress && (
                         <footer className="mt-28 text-center border-t-2 border-dashed border-[#C5A059]/30 pt-24 animate-in slide-in-from-bottom-5">
                             <div className="max-w-lg mx-auto mb-14">
                                <Quote className="w-12 h-12 mx-auto text-[#C5A059] mb-6 opacity-40" />
                                <h4 className="font-cinzel text-3xl font-bold text-[#8B0000] dark:text-[#ff6b6b] mb-4 uppercase tracking-[0.1em]">Conclusão da Aula</h4>
                                <p className="font-cormorant text-2xl text-gray-500 italic leading-relaxed">"Guardei a tua palavra no meu coração, para não pecar contra ti." (Salmos 119:11)</p>
                             </div>
                             <button 
                                onClick={handleMarkAsRead} 
                                disabled={isRead} 
                                className={`group relative px-16 py-7 rounded-full font-cinzel font-bold text-xl shadow-[0_20px_50px_rgba(139,0,0,0.3)] flex items-center justify-center gap-5 mx-auto overflow-hidden transition-all duration-700 transform hover:scale-105 active:scale-95 ${isRead ? 'bg-green-600 text-white shadow-green-600/20' : 'bg-gradient-to-r from-[#8B0000] to-[#600018] text-white shadow-red-900/40'}`}
                            >
                                 {isRead ? <CheckCircle className="w-8 h-8" /> : <GraduationCap className="w-8 h-8 group-hover:rotate-12 transition-transform duration-500" />}
                                 <span className="relative z-10 tracking-[0.15em]">{isRead ? 'CONTEÚDO JÁ ESTUDADO' : 'CONCLUIR E PONTUAR'}</span>
                                 {!isRead && <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>}
                             </button>
                             {isRead && <p className="text-[11px] font-bold text-green-600 mt-8 uppercase tracking-[0.4em] animate-pulse">Recompensa Acadêmica Registrada</p>}
                         </footer>
                     )}
                </article>
            ) : (
                <div className="text-center py-56 bg-white dark:bg-dark-card rounded-[50px] border-2 border-dashed border-[#C5A059]/40 animate-in fade-in duration-1000 shadow-xl">
                    <div className="relative inline-block mb-12">
                        <div className="absolute inset-0 bg-[#C5A059]/15 blur-[60px] rounded-full scale-150 animate-pulse"></div>
                        <Book className="w-32 h-32 mx-auto text-[#C5A059] opacity-30 relative z-10"/>
                    </div>
                    <p className="font-cinzel text-4xl font-bold text-gray-400 mb-4 tracking-[0.2em] uppercase">Arquivo em Silêncio</p>
                    <p className="font-montserrat text-[11px] text-gray-500 uppercase tracking-[0.5em] mb-12 opacity-80">O Professor Michel Felix ainda não publicou este Panorama.</p>
                    {isAdmin && (
                        <div className="max-w-sm mx-auto p-8 bg-[#8B0000]/5 dark:bg-red-900/15 rounded-[32px] border border-[#8B0000]/25 flex flex-col items-center shadow-lg transition-all hover:bg-[#8B0000]/10">
                            <Info className="w-10 h-10 text-[#8B0000] mb-5 opacity-80" />
                            <p className="text-[11px] font-bold text-[#8B0000] dark:text-red-400 uppercase tracking-widest text-center leading-loose">
                                Atenção Admin: Utilize o motor do Editor Chefe no topo desta tela para realizar a exegese microscópica integral deste capítulo.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </main>

        {/* BARRA DE NAVEGAÇÃO INFERIOR DE PÁGINAS (FLUTUANTE) */}
        {pages.length > 1 && hasAccess && !isEditing && (
            <nav className="fixed bottom-24 left-4 right-4 z-40 max-w-2xl mx-auto animate-in slide-in-from-bottom-6 duration-1000">
                <div className="bg-[#1a0f0f]/98 dark:bg-dark-card/98 backdrop-blur-3xl border-2 border-[#C5A059]/50 p-4 rounded-[30px] flex justify-between items-center shadow-[0_30px_70px_-15px_rgba(0,0,0,0.7)] ring-1 ring-white/10">
                    <button 
                        onClick={() => {
                            setCurrentPage(Math.max(0, currentPage - 1));
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }} 
                        disabled={currentPage === 0} 
                        className="flex items-center gap-3 px-8 py-5 bg-[#8B0000] text-white rounded-2xl font-bold text-[11px] uppercase tracking-widest disabled:opacity-30 disabled:grayscale transition-all active:scale-95 shadow-2xl hover:bg-[#600018]"
                    >
                        <ChevronLeft className="w-5 h-5" /> Anterior
                    </button>
                    
                    <div className="flex flex-col items-center shrink-0">
                        <span className="font-cinzel font-bold text-[#C5A059] text-xl tracking-[0.3em]">{currentPage + 1} / {pages.length}</span>
                        <div className="w-32 bg-white/15 h-1.5 rounded-full mt-2.5 overflow-hidden border border-white/5">
                            <div 
                                className="bg-[#C5A059] h-full transition-all duration-1000 ease-out shadow-[0_0_15px_#C5A059]" 
                                style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }}
                            ></div>
                        </div>
                    </div>

                    <button 
                        onClick={() => {
                            setCurrentPage(Math.min(pages.length - 1, currentPage + 1));
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }} 
                        disabled={currentPage === pages.length - 1} 
                        className="flex items-center gap-3 px-8 py-5 bg-[#8B0000] text-white rounded-2xl font-bold text-[11px] uppercase tracking-widest disabled:opacity-30 disabled:grayscale transition-all active:scale-95 shadow-2xl hover:bg-[#600018]"
                    >
                        Próximo <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </nav>
        )}
        
        {/* ESPAÇADOR DE SEGURANÇA PARA SISTEMAS OPERACIONAIS MOBILE */}
        <div className="h-28 shrink-0 select-none pointer-events-none"></div>
    </div>
  );
}
