import React, { useState, useEffect, useRef } from 'react';
// ==========================================================================================
// COMPONENTE DE VISUALIZAÇÃO DO PANORAMA BÍBLICO - EDIÇÃO "MAGNUM OPUS"
// Focado em: Quantidade Massiva, Exegese Profunda e Qualidade Acadêmica (Padrão Adma)
// Desenvolvido por: Senior Frontend Engineer & Teólogo Digital
// ==========================================================================================
import { 
  ChevronLeft, GraduationCap, Lock, BookOpen, ChevronRight, Volume2, 
  Sparkles, Loader2, Book, Trash2, Edit, Save, X, CheckCircle, 
  Pause, Play, Settings, FastForward, Info, FileText, Languages, 
  History, Clock, AlertTriangle, Search, BookMarked, Quote, Plus
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
  const loadingStatusMessages = [
    "Iniciando exegese microscópica...",
    "Consultando originais (Hebraico/Grego)...",
    "Analisando contexto histórico e geográfico...",
    "Construindo tópicos doutrinários densos...",
    "Redigindo apostila exaustiva (Páginas 1 a 3)...",
    "Aprofundando comentários versículo por versículo...",
    "Integrando tipologia bíblica e cristocêntrica...",
    "Verificando fatos arqueológicos e curiosidades...",
    "Finalizando formatação no Padrão Prof. Michel Felix...",
    "Quase pronto! Organizando apostila de 6 a 10 páginas...",
    "A IA está finalizando os últimos parágrafos, aguarde...",
    "Consolidando dados teológicos massivos..."
  ];

  const studyKey = generateChapterKey(book, chapter);
  const isRead = userProgress?.ebd_read?.includes(studyKey);

  // --- EFEITOS DE CARREGAMENTO INICIAL ---
  useEffect(() => { 
    loadContent(); 
  }, [book, chapter]);

  // Cronômetro de Geração
  useEffect(() => {
    let interval: any;
    if (isGenerating) {
        interval = setInterval(() => {
            setGenerationTime(prev => prev + 1);
            if (generationTime % 15 === 0 && generationTime > 0) {
                setCurrentStatusIndex(prev => (prev + 1) % loadingStatusMessages.length);
            }
        }, 1000);
    } else {
        setGenerationTime(0);
        setCurrentStatusIndex(0);
    }
    return () => clearInterval(interval);
  }, [isGenerating, generationTime]);

  // Sistema de Gerenciamento de Vozes
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

  // Monitoramento de Mudança de Página para Áudio
  useEffect(() => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  }, [currentPage, book, chapter, activeTab]);

  // Atualização em tempo real de voz/velocidade
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

  // --- ALGORITMO DE PAGINAÇÃO DE ALTA DENSIDADE (PARA APOSTILAS LONGAS) ---
  const processAndPaginate = (html: string) => {
    if (!html) { setPages([]); return; }
    
    // Divide o texto por marcadores de quebra ou continuação
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
    const CHAR_LIMIT_TARGET = 3800; 

    for (let i = 0; i < rawSegments.length; i++) {
        const segment = rawSegments[i];
        if (!currentBuffer) {
            currentBuffer = segment;
        } else {
            // Bufferização inteligente: tenta manter tópicos juntos até o limite
            if ((currentBuffer.length + segment.length) < (CHAR_LIMIT_TARGET * 1.6)) {
                currentBuffer += "\n\n__CONTINUATION_MARKER__\n\n" + segment;
            } else {
                if (currentBuffer.length > 2000) {
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

    // Limpeza profunda para fala clara
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = pages[currentPage]
        .replace(/__CONTINUATION_MARKER__/g, '. ')
        .replace(/<br>/g, '. ')
        .replace(/<\/p>/g, '. '); 
    
    let textToSpeak = tempDiv.textContent || tempDiv.innerText || "";
    textToSpeak = textToSpeak.replace(/\*/g, '').replace(/#/g, '').replace(/_/g, '').trim();

    if (!textToSpeak) return;

    // Divisão em sentenças para evitar que o buffer do navegador estoure em apostilas longas
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

  // --- AÇÕES DO ALUNO ---
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
          onShowToast('Glória a Deus! Estudo registrado no seu Ranking.', 'success');
      } catch (err) {
          onShowToast('Erro ao salvar progresso.', 'error');
      }
  };

  // --- RENDERIZADORES DE TEXTO ---
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

                // Divisor Visual de Continuação
                if (trimmed === '__CONTINUATION_MARKER__') {
                    return (
                        <div key={lineIdx} className="my-14 flex items-center justify-center select-none animate-in fade-in duration-700">
                            <div className="h-[1px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent w-full opacity-40"></div>
                            <span className="mx-6 text-[#C5A059] text-[9px] font-cinzel opacity-70 tracking-[0.4em] uppercase bg-[#FDFBF7] dark:bg-dark-card px-4">Fluxo de Ensino Continua</span>
                            <div className="h-[1px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent w-full opacity-40"></div>
                        </div>
                    );
                }

                // Títulos Principais
                if (trimmed.includes('PANORÂMA BÍBLICO') || trimmed.includes('PANORAMA BÍBLICO')) {
                    return (
                        <div key={lineIdx} className="mb-14 text-center border-b-2 border-[#8B0000] dark:border-[#ff6b6b] pb-8 pt-4">
                            <h1 className="font-cinzel font-bold text-2xl md:text-5xl text-[#8B0000] dark:text-[#ff6b6b] uppercase tracking-[0.1em] drop-shadow-sm leading-tight">
                                {trimmed}
                            </h1>
                        </div>
                    );
                }

                // Cabeçalhos de Tópicos
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

                // Listas Numeradas (Destaque Exegético)
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

                // Destaques e Curiosidades (Boxes)
                if (trimmed.toUpperCase().includes('CURIOSIDADE') || trimmed.toUpperCase().includes('ATENÇÃO:') || trimmed.toUpperCase().includes('INSIGHT:') || trimmed.endsWith('?')) {
                    return (
                        <div key={lineIdx} className="my-12 mx-2 font-cormorant text-xl text-[#1a0f0f] dark:text-gray-200 font-medium italic bg-[#C5A059]/10 dark:bg-[#C5A059]/5 p-8 rounded-2xl border border-[#C5A059]/30 shadow-sm text-justify relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#C5A059]"></div>
                            <div className="flex items-center gap-3 mb-4 text-[#C5A059]">
                                <Sparkles className="w-6 h-6" />
                                <span className="text-xs font-bold uppercase tracking-[0.2em] font-montserrat">Esclarecimento Teológico</span>
                            </div>
                            <div>{parseInlineStyles(trimmed)}</div>
                        </div>
                    );
                }

                // Parágrafos Comuns
                return (
                    <p key={lineIdx} className="font-cormorant text-xl md:text-2xl leading-loose text-gray-900 dark:text-gray-200 text-justify indent-12 mb-8 tracking-wide">
                        {parseInlineStyles(trimmed)}
                    </p>
                );
            })}
        </div>
    );
  };

  // --- FUNÇÕES DE ADMINISTRAÇÃO E EDIÇÃO ---
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
        onShowToast('Apostila atualizada com sucesso!', 'success');
    } catch (e) {
        onShowToast('Erro ao salvar apostila.', 'error');
    }
  };

  // ==========================================================================================
  // GERAÇÃO EM LOTE PARA MÁXIMA QUANTIDADE E QUALIDADE (PROMPT RADICAL)
  // ==========================================================================================
  const handleGenerate = async (mode: 'start' | 'continue') => {
    setIsGenerating(true);
    const target = activeTab;
    const studyKey = generateChapterKey(book, chapter);
    const existing = (await db.entities.PanoramaBiblico.filter({ study_key: studyKey }))[0] || {};
    const currentText = target === 'student' ? (existing.student_content || '') : (existing.teacher_content || '');
    
    // Captura o contexto final para permitir que a IA continue perfeitamente de onde parou
    const cleanContext = currentText.replace(/__CONTINUATION_MARKER__/g, ' ').slice(-6000);

    const WRITING_STYLE_EXHAUSTIVE = `
        ATUE COMO: Professor Michel Felix. PERFIL: Teólogo PhD, Especialista em Exegese Original (Hebraico/Grego) e História Bíblica.
        
        --- MISSÃO SUPREMA: APOSTILA COMPLETA, DENSA E EXAUSTIVA ---
        1. OBJETIVO ABSOLUTO: Gerar o conteúdo INTEGRAL do capítulo ${chapter} de ${book} em uma única apostila densa.
        2. QUANTIDADE: Ignore restrições de brevidade. O objetivo é uma apostila que teria entre 6 a 10 páginas impressas.
        3. MICROSCOPIA BÍBLICA: Explique detalhadamente CADA versículo. PROIBIDO fazer resumos que pulam blocos de versículos. Se o capítulo tem 40 versículos, explique os 40 em ordem lógica.
        4. NÃO TRANSCREVA O TEXTO BÍBLICO INTEGRAL: Cite apenas a referência (Ex: "Nos versículos 1-5 observamos...") e entregue a explicação profunda.
        5. LINGUAGEM: Erudita, vibrante e inspiradora. Use termos originais transliterados e explicados entre parênteses.

        --- REGRAS TÉCNICAS DE PAGINAÇÃO ---
        1. O sistema divide automaticamente as páginas usando a tag <hr class="page-break">.
        2. VOCÊ DEVE inserir a tag <hr class="page-break"> a cada bloco de exegese (aprox. 3000 caracteres) ou entre tópicos numerados.
        3. SAÍDA: TEXTO PURO FORMATADO. Proibido envolver em JSON ou blocos de código Markdown.

        --- ESTRUTURA VISUAL OBRIGATÓRIA ---
        1. TÍTULO: PANORÂMA BÍBLICO - ${book.toUpperCase()} ${chapter} (PROF. MICHEL FELIX)
        2. INTRODUÇÃO: Contextualização geográfica, histórica e cronológica rica.
        3. DESENVOLVIMENTO: Tópicos numerados (1., 2., 3...) com a exegese microscópica.
        4. SEÇÕES FINAIS (Apenas no final do capítulo):
           ### TIPOLOGIA: CONEXÃO COM JESUS CRISTO
           ### CURIOSIDADES E ARQUEOLOGIA DA ÉPOCA
    `;
    
    const instructions = customInstructions ? `\nINSTRUÇÕES ADICIONAIS DO ADMIN: ${customInstructions}` : "";
    const continuationInstructions = `MODO CONTINUAÇÃO: Você já gerou parte da apostila. Continue EXATAMENTE de onde parou: "...${cleanContext.slice(-1000)}...". Continue a exegese versículo por versículo até o final do capítulo e gere as seções de Tipologia e Arqueologia.`;

    let specificPrompt = `${WRITING_STYLE_EXHAUSTIVE} ${instructions} ${mode === 'continue' ? continuationInstructions : 'INÍCIO DA APOSTILA COMPLETA.'}`;

    try {
        // Aciona o modo de Long Output e Thinking Config no 2.5 Flash
        const result = await generateContent(specificPrompt, null, true, 'ebd');
        
        if (!result || result.trim().length < 100) throw new Error("A IA retornou um conteúdo insuficiente.");
        
        let cleanedResult = result.trim();
        // Remove lixo de formatação
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
        onShowToast('Apostila de Alta Densidade Gerada!', 'success');
        if (mode === 'continue') setTimeout(() => setCurrentPage(pages.length), 500); 
    } catch (e: any) { 
        onShowToast(`Erro na Geração: ${e.message}`, 'error'); 
    } finally { 
        setIsGenerating(false); 
    }
  };

  const handleDeletePage = async () => {
    if (!window.confirm("Tem certeza que deseja apagar permanentemente esta página da apostila?") || !content) return;
    const updatedPages = pages.filter((_, index) => index !== currentPage);
    const newContent = updatedPages.join('<hr class="page-break">');
    const data = { ...content, student_content: activeTab === 'student' ? newContent : content.student_content, teacher_content: activeTab === 'teacher' ? newContent : content.teacher_content };
    try { 
        if (content.id) await db.entities.PanoramaBiblico.update(content.id, data); 
        setPages(updatedPages); 
        if (currentPage >= updatedPages.length) setCurrentPage(Math.max(0, updatedPages.length - 1)); 
        await loadContent(); 
        onShowToast('Página excluída.', 'success'); 
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
        {/* BARRA SUPERIOR DE NAVEGAÇÃO */}
        <header className="sticky top-0 z-40 bg-gradient-to-r from-[#600018] to-[#400010] text-white p-4 shadow-2xl flex justify-between items-center safe-top border-b border-[#C5A059]/20">
            <button 
                onClick={onBack} 
                className="p-2 hover:bg-white/10 rounded-full transition-all active:scale-90"
                aria-label="Voltar para o Dashboard"
            >
                <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex flex-col items-center">
                <h2 className="font-cinzel font-bold text-lg tracking-[0.1em]">Panorama EBD</h2>
                <span className="text-[9px] uppercase tracking-[0.4em] opacity-60 font-montserrat">Magnum Opus Edition</span>
            </div>
            <div className="flex gap-1">
                {isAdmin && !isEditing && content && (
                    <button 
                        onClick={handleStartEditing} 
                        className="p-2 hover:bg-white/10 rounded-full text-[#C5A059] transition-all"
                        title="Edição Manual"
                    >
                        <Edit className="w-5 h-5" />
                    </button>
                )}
                <button 
                    onClick={() => setShowAudioSettings(!showAudioSettings)} 
                    className="p-2 hover:bg-white/10 rounded-full transition-all"
                    title="Configurações de Áudio"
                >
                    <Volume2 className={isPlaying ? "text-green-400 animate-pulse w-5 h-5" : "w-5 h-5"} />
                </button>
            </div>
        </header>

        {/* PAINEL DE ÁUDIO FLUTUANTE */}
        {showAudioSettings && (
            <div className="bg-white/95 dark:bg-dark-card/95 backdrop-blur-md p-5 border-b border-[#C5A059]/30 shadow-2xl animate-in slide-in-from-top-2 z-30">
                <div className="flex flex-col gap-4 max-w-lg mx-auto">
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-xs uppercase tracking-widest text-[#1a0f0f] dark:text-white flex items-center gap-2">
                            <Clock className="w-4 h-4 text-[#C5A059]" /> Tempo de Leitura
                        </span>
                        <button 
                            onClick={togglePlay} 
                            className="bg-[#C5A059] text-white px-5 py-2 rounded-full font-bold flex items-center gap-3 shadow-lg hover:shadow-[#C5A059]/40 active:scale-95 transition-all"
                        >
                            {isPlaying ? <Pause className="w-4 h-4 fill-current"/> : <Play className="w-4 h-4 fill-current"/>} 
                            {isPlaying ? 'Pausar' : 'Ouvir Agora'}
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <select 
                            className="w-full p-2 text-sm border rounded-xl dark:bg-gray-800 dark:text-white border-[#C5A059]/20 font-montserrat" 
                            value={selectedVoice} 
                            onChange={e => setSelectedVoice(e.target.value)}
                        >
                            {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                        </select>
                        <div className="flex gap-2">
                            {[0.8, 1, 1.2, 1.5].map(rate => (
                                <button 
                                    key={rate} 
                                    onClick={() => setPlaybackRate(rate)} 
                                    className={`flex-1 py-2 text-[10px] font-bold rounded-lg border transition-all ${playbackRate === rate ? 'bg-[#8B0000] text-white border-[#8B0000] shadow-md' : 'bg-gray-100 dark:bg-gray-800 dark:text-gray-400'}`}
                                >
                                    {rate}x
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* SELEÇÃO DE TEXTO BÍBLICO */}
        <div className="bg-white dark:bg-dark-card p-4 border-b border-[#C5A059]/20 flex gap-3 shadow-sm shrink-0">
             <div className="flex-1 relative">
                 <BookMarked className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C5A059] opacity-50" />
                 <select 
                    value={book} 
                    onChange={e => setBook(e.target.value)} 
                    className="w-full pl-10 pr-3 py-3 border border-[#C5A059]/20 rounded-xl font-cinzel text-sm dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-[#C5A059]/50 transition-all outline-none"
                >
                    {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                 </select>
             </div>
             <div className="w-24 relative">
                 <History className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C5A059] opacity-50" />
                 <input 
                    type="number" 
                    value={chapter} 
                    onChange={e => setChapter(Number(e.target.value))} 
                    className="w-full pl-10 pr-3 py-3 border border-[#C5A059]/20 rounded-xl font-cinzel text-sm dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-[#C5A059]/50 transition-all outline-none" 
                    min={1} 
                />
             </div>
        </div>

        {/* ALTERNÂNCIA DE PERFIL (ALUNO/PROFESSOR) */}
        <nav className="flex bg-[#F5F5DC] dark:bg-black border-b border-[#C5A059]/20 shrink-0">
            <button 
                onClick={() => setActiveTab('student')} 
                className={`flex-1 py-5 font-cinzel font-bold text-xs uppercase tracking-[0.2em] flex justify-center items-center gap-3 transition-all ${activeTab === 'student' ? 'bg-[#600018] text-white shadow-inner' : 'text-gray-500 dark:text-gray-500 hover:bg-black/5'}`}
            >
                <BookOpen className="w-5 h-5" /> Perfil Aluno
            </button>
            <button 
                onClick={() => setActiveTab('teacher')} 
                className={`flex-1 py-5 font-cinzel font-bold text-xs uppercase tracking-[0.2em] flex justify-center items-center gap-3 transition-all ${activeTab === 'teacher' ? 'bg-[#600018] text-white shadow-inner' : 'text-gray-500 dark:text-gray-500 hover:bg-black/5'}`}
            >
                {isAdmin ? <GraduationCap className="w-5 h-5" /> : <Lock className="w-4 h-4" />} Perfil Professor
            </button>
        </nav>

        {/* PAINEL DO EDITOR CHEFE (ADMIN ONLY) */}
        {isAdmin && !isEditing && (
            <div className="bg-[#1a0f0f] text-[#C5A059] p-5 shadow-2xl sticky top-[130px] z-20 border-b-4 border-[#8B0000] animate-in slide-in-from-top-4">
                {isGenerating ? (
                    <div className="flex flex-col items-center gap-3 py-2 animate-in fade-in">
                        <div className="flex items-center gap-4">
                            <Loader2 className="animate-spin w-6 h-6 text-[#C5A059]"/>
                            <div className="flex flex-col">
                                <span className="font-cinzel text-xs font-bold uppercase tracking-widest">{loadingStatusMessages[currentStatusIndex]}</span>
                                <span className="text-[10px] opacity-60 font-mono">Tempo decorrido: {generationTime}s (Apostila Longa)</span>
                            </div>
                        </div>
                        <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden border border-white/5">
                            <div className="bg-[#C5A059] h-full animate-pulse w-full shadow-[0_0_10px_#C5A059]"></div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-[#8B0000] rounded-lg flex items-center justify-center shadow-lg"><Sparkles className="w-5 h-5 text-white" /></div>
                                <span className="font-cinzel text-xs font-bold tracking-[0.2em]">EDITOR CHEFE ADMA</span>
                            </div>
                            <button 
                                onClick={() => setShowInstructions(!showInstructions)} 
                                className="text-[10px] font-bold uppercase tracking-widest underline decoration-dotted underline-offset-4 hover:text-white transition-colors"
                            >
                                {showInstructions ? 'Ocultar Comandos' : 'Instruções Teológicas'}
                            </button>
                        </div>
                        
                        {showInstructions && (
                            <div className="mb-4 animate-in fade-in duration-500">
                                <textarea 
                                    value={customInstructions} 
                                    onChange={(e) => setCustomInstructions(e.target.value)} 
                                    placeholder="Ex: Reforce o contexto arqueológico e a visão de arqueologia bíblica..." 
                                    className="w-full p-4 text-sm text-black rounded-xl border-none focus:ring-2 focus:ring-[#C5A059] font-montserrat shadow-inner" 
                                    rows={3} 
                                />
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button 
                                onClick={() => handleGenerate('start')} 
                                disabled={isGenerating} 
                                className="flex-2 px-4 py-3 border-2 border-[#C5A059] rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#C5A059] hover:text-[#1a0f0f] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Sparkles className="w-4 h-4"/> GERAR APOSTILA COMPLETA
                            </button>
                            <button 
                                onClick={() => handleGenerate('continue')} 
                                disabled={isGenerating} 
                                className="flex-1 px-4 py-3 bg-[#C5A059] text-[#1a0f0f] font-bold rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4"/> CONTINUAR
                            </button>
                            {pages.length > 0 && (
                                <button 
                                    onClick={handleDeletePage} 
                                    className="px-4 py-3 bg-red-900 text-white rounded-xl hover:bg-red-700 transition-all shadow-lg"
                                    title="Excluir página atual"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        )}

        {/* ÁREA DE EXIBIÇÃO DO CONTEÚDO (SCROLLABLE) */}
        <main className="flex-1 overflow-y-auto p-4 md:p-12 max-w-5xl mx-auto pb-48 w-full scroll-smooth">
            {!hasAccess ? (
                <div className="text-center py-40 opacity-60 dark:text-white animate-in zoom-in duration-1000">
                    <Lock className="w-24 h-24 mx-auto mb-8 text-[#8B0000] drop-shadow-xl" />
                    <h2 className="font-cinzel text-3xl font-bold mb-3 tracking-wider">Acesso Reservado</h2>
                    <p className="font-montserrat text-sm max-w-xs mx-auto opacity-80 uppercase tracking-widest leading-loose">
                        Este conteúdo é exclusivo para o corpo docente e liderança autorizada da ADMA.
                    </p>
                </div>
            ) : isEditing ? (
                 <div className="bg-white dark:bg-dark-card shadow-2xl p-6 rounded-3xl border-2 border-[#C5A059] relative animate-in slide-in-from-bottom-8 duration-500">
                     <div className="flex justify-between items-center mb-6 border-b pb-4 dark:border-white/10">
                        <h3 className="font-cinzel font-bold text-xl text-[#8B0000] dark:text-[#ff6b6b] flex items-center gap-3">
                            <Edit className="w-6 h-6" /> Edição de Manuscrito
                        </h3>
                        <div className="flex gap-3">
                            <button onClick={() => setIsEditing(false)} className="px-5 py-2 text-xs font-bold border-2 border-red-500 text-red-500 rounded-full hover:bg-red-50 transition-colors uppercase tracking-widest">Descartar</button>
                            <button onClick={handleSaveManualEdit} className="px-5 py-2 text-xs font-bold bg-green-600 text-white rounded-full hover:bg-green-700 shadow-lg transition-all uppercase tracking-widest">Salvar Apostila</button>
                        </div>
                     </div>
                     <p className="text-[10px] text-gray-500 mb-4 font-montserrat uppercase tracking-widest bg-gray-100 dark:bg-gray-900 p-2 rounded-lg">
                        Dica: Utilize <code>&lt;hr class="page-break"&gt;</code> para forçar uma nova página impressa/digital.
                     </p>
                     <textarea 
                        value={editValue} 
                        onChange={e => setEditValue(e.target.value)} 
                        className="w-full h-[65vh] p-6 font-mono text-sm border-none focus:ring-0 rounded-2xl bg-gray-50 dark:bg-gray-900 dark:text-gray-300 resize-none shadow-inner" 
                        placeholder="Insira o texto da apostila aqui..." 
                    />
                 </div>
            ) : content && pages.length > 0 ? (
                <article className="bg-white dark:bg-dark-card shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] p-8 md:p-24 min-h-[70vh] border border-[#C5A059]/20 relative rounded-[40px] animate-in fade-in duration-1000 select-text">
                     {renderFormattedText(pages[currentPage])}
                     
                     <div className="absolute bottom-10 right-12 flex items-center gap-4 select-none opacity-40 hover:opacity-100 transition-opacity">
                        <div className="h-[1px] w-10 bg-[#C5A059]"></div>
                        <span className="text-[#C5A059] font-cinzel text-xs font-bold tracking-[0.4em]">{currentPage + 1} DE {pages.length}</span>
                     </div>

                     {currentPage === pages.length - 1 && userProgress && (
                         <footer className="mt-24 text-center border-t-2 border-dashed border-[#C5A059]/20 pt-20 animate-in slide-in-from-bottom-4">
                             <div className="max-w-md mx-auto mb-10">
                                <Quote className="w-10 h-10 mx-auto text-[#C5A059] mb-4 opacity-50" />
                                <h4 className="font-cinzel text-2xl font-bold text-[#8B0000] dark:text-[#ff6b6b] mb-3 uppercase tracking-widest">Conclusão do Estudo</h4>
                                <p className="font-cormorant text-xl text-gray-500 italic">"Escondi a tua palavra no meu coração, para não pecar contra ti." (Salmos 119:11)</p>
                             </div>
                             <button 
                                onClick={handleMarkAsRead} 
                                disabled={isRead} 
                                className={`group relative px-14 py-6 rounded-full font-cinzel font-bold text-lg shadow-2xl flex items-center justify-center gap-4 mx-auto overflow-hidden transition-all duration-700 transform hover:scale-105 active:scale-95 ${isRead ? 'bg-green-600 text-white shadow-green-600/20' : 'bg-gradient-to-r from-[#8B0000] to-[#600018] text-white shadow-red-900/40'}`}
                            >
                                 {isRead ? <CheckCircle className="w-7 h-7" /> : <GraduationCap className="w-7 h-7 group-hover:rotate-12 transition-transform" />}
                                 <span className="relative z-10 tracking-widest">{isRead ? 'CONTEÚDO JÁ ESTUDADO' : 'CONCLUIR E PONTUAR'}</span>
                                 {!isRead && <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>}
                             </button>
                             {isRead && <p className="text-[10px] font-bold text-green-600 mt-6 uppercase tracking-[0.3em] animate-pulse">Recompensa teológica registrada com sucesso</p>}
                         </footer>
                     )}
                </article>
            ) : (
                <div className="text-center py-48 bg-white dark:bg-dark-card rounded-[40px] border-2 border-dashed border-[#C5A059]/30 animate-in fade-in duration-1000">
                    <div className="relative inline-block mb-10">
                        <div className="absolute inset-0 bg-[#C5A059]/10 blur-3xl rounded-full scale-150"></div>
                        <Book className="w-28 h-28 mx-auto text-[#C5A059] opacity-30 relative z-10"/>
                    </div>
                    <p className="font-cinzel text-3xl font-bold text-gray-400 mb-3 tracking-widest uppercase">Apostila Inédita</p>
                    <p className="font-montserrat text-[10px] text-gray-500 uppercase tracking-[0.4em] mb-10">O Professor Michel Felix ainda não publicou este panorama.</p>
                    {isAdmin && (
                        <div className="max-w-xs mx-auto p-6 bg-[#8B0000]/5 dark:bg-red-900/10 rounded-2xl border border-[#8B0000]/20 flex flex-col items-center">
                            <Info className="w-8 h-8 text-[#8B0000] mb-4 opacity-70" />
                            <p className="text-[10px] font-bold text-[#8B0000] dark:text-red-400 uppercase tracking-widest text-center leading-relaxed">
                                Atenção Admin: Utilize o Editor Chefe no topo para realizar a exegese microscópica automática.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </main>

        {/* NAVEGAÇÃO INFERIOR DE PÁGINAS */}
        {pages.length > 1 && hasAccess && !isEditing && (
            <nav className="fixed bottom-20 left-4 right-4 z-40 max-w-2xl mx-auto animate-in slide-in-from-bottom-4 duration-700">
                <div className="bg-[#1a0f0f]/95 dark:bg-dark-card/95 backdrop-blur-2xl border border-[#C5A059]/40 p-3 rounded-2xl flex justify-between items-center shadow-[0_20px_50px_-10px_rgba(0,0,0,0.6)]">
                    <button 
                        onClick={() => setCurrentPage(Math.max(0, currentPage - 1))} 
                        disabled={currentPage === 0} 
                        className="flex items-center gap-2 px-6 py-4 bg-[#8B0000] text-white rounded-xl font-bold text-[10px] uppercase tracking-widest disabled:opacity-30 disabled:grayscale transition-all active:scale-95 shadow-xl"
                    >
                        <ChevronLeft className="w-4 h-4" /> Anterior
                    </button>
                    
                    <div className="flex flex-col items-center shrink-0">
                        <span className="font-cinzel font-bold text-[#C5A059] text-base tracking-widest">{currentPage + 1} / {pages.length}</span>
                        <div className="w-24 bg-white/10 h-1 rounded-full mt-1.5 overflow-hidden">
                            <div 
                                className="bg-[#C5A059] h-full transition-all duration-700 ease-out shadow-[0_0_10px_#C5A059]" 
                                style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }}
                            ></div>
                        </div>
                    </div>

                    <button 
                        onClick={() => setCurrentPage(Math.min(pages.length - 1, currentPage + 1))} 
                        disabled={currentPage === pages.length - 1} 
                        className="flex items-center gap-2 px-6 py-4 bg-[#8B0000] text-white rounded-xl font-bold text-[10px] uppercase tracking-widest disabled:opacity-30 disabled:grayscale transition-all active:scale-95 shadow-xl"
                    >
                        Próximo <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </nav>
        )}
        
        {/* ESPAÇADOR DE SEGURANÇA PARA DISPOSITIVOS MOBILE */}
        <div className="h-20 shrink-0 select-none pointer-events-none"></div>
    </div>
  );
}
