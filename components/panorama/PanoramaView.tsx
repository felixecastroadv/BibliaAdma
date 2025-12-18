
import React, { useState, useEffect, useRef } from 'react';
// Componente de Visualização do Panorama Bíblico - Edição Especial "Quantidade & Profundidade"
import { 
  ChevronLeft, GraduationCap, Lock, BookOpen, ChevronRight, Volume2, 
  Sparkles, Loader2, Book, Trash2, Edit, Save, X, CheckCircle, 
  Pause, Play, Settings, FastForward, Info, BookText, HelpCircle,
  FileText, MessageSquare, Quote, Languages, History, Map, ShieldCheck, Plus
} from 'lucide-react';
import { db } from '../../services/database';
import { BIBLE_BOOKS, generateChapterKey } from '../../constants';
import { EBDContent } from '../../types';
import { generateContent } from '../../services/geminiService';

export default function PanoramaView({ isAdmin, onShowToast, onBack, userProgress, onProgressUpdate }: any) {
  const [book, setBook] = useState('Gênesis');
  const [chapter, setChapter] = useState(1);
  const [content, setContent] = useState<EBDContent | null>(null);
  const [activeTab, setActiveTab] = useState<'student' | 'teacher'>('student');
  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState<string[]>([]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  // Audio State (Lógica de leitura avançada)
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [playbackRate, setPlaybackRate] = useState(1);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Swipe State para navegação por gestos
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  const studyKey = generateChapterKey(book, chapter);
  const isRead = userProgress?.ebd_read?.includes(studyKey);

  useEffect(() => { loadContent(); }, [book, chapter]);

  // Sistema de Gerenciamento de Vozes Humanizadas
  useEffect(() => {
    const loadVoices = () => {
        let available = window.speechSynthesis.getVoices().filter(v => v.lang.includes('pt'));
        
        available.sort((a, b) => {
            const getScore = (v: SpeechSynthesisVoice) => {
                let score = 0;
                if (v.name.includes('Google')) score += 5;
                if (v.name.includes('Microsoft')) score += 4;
                if (v.name.includes('Luciana')) score += 3;
                if (v.name.includes('Joana')) score += 3;
                if (v.name.includes('Daniela')) score += 2;
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

  useEffect(() => {
    // Interromper áudio se o contexto mudar drasticamente
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  }, [currentPage, book, chapter, activeTab]);

  useEffect(() => {
    if (isPlaying) {
        window.speechSynthesis.cancel();
        speakText();
    }
  }, [playbackRate, selectedVoice]);

  // Handlers para Gestos de Swipe
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

  const loadContent = async () => {
    const key = generateChapterKey(book, chapter);
    const res = await db.entities.PanoramaBiblico.filter({ study_key: key });
    if (res.length) {
        setContent(res[0]);
    } else {
        setContent(null);
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

  // --- ALGORITMO DE PAGINAÇÃO DE ALTA DENSIDADE ---
  const processAndPaginate = (html: string) => {
    if (!html) { setPages([]); return; }
    
    // Divide por tags de quebra de página explícitas ou marcadores de continuação
    let rawSegments = html.split(/<hr[^>]*>|__CONTINUATION_MARKER__/i)
                          .map(s => cleanText(s))
                          .filter(s => s.length > 50);

    // Se a IA gerou um bloco gigante único (falha na tag <hr>), forçamos a divisão por tópicos
    if (rawSegments.length === 1 && rawSegments[0].length > 4000) {
        const bigText = rawSegments[0];
        const forcedSegments = bigText.split(/(?=\n### |^\s*[IVX]+\.|^\s*\d+\.\s+[A-Z]|### )/gm);
        if (forcedSegments.length > 1) {
            rawSegments = forcedSegments.map(s => cleanText(s)).filter(s => s.length > 50);
        }
    }
    
    const finalPages: string[] = [];
    let currentBuffer = "";
    // Limite ideal para uma "página" mobile confortável (aprox. 3000-4000 chars)
    const CHAR_LIMIT_MIN = 3500; 

    for (let i = 0; i < rawSegments.length; i++) {
        const segment = rawSegments[i];
        if (!currentBuffer) {
            currentBuffer = segment;
        } else {
            // Se o buffer atual + o novo segmento não excederem muito o limite, combinamos
            if ((currentBuffer.length + segment.length) < (CHAR_LIMIT_MIN * 1.5)) {
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

  const hasAccess = isAdmin || activeTab === 'student'; 

  // --- LÓGICA DE ÁUDIO EXTREMAMENTE ROBUSTA ---
  const speakText = () => {
    if (!pages[currentPage]) return;
    window.speechSynthesis.cancel(); 

    // Limpeza profunda de HTML para garantir que a voz não leia tags
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = pages[currentPage]
        .replace(/__CONTINUATION_MARKER__/g, '. ')
        .replace(/<br>/g, '. ')
        .replace(/<\/p>/g, '. ')
        .replace(/<li>/g, ' - ')
        .replace(/<\/li>/g, '. ');
    
    let textToSpeak = tempDiv.textContent || tempDiv.innerText || "";
    // Limpeza de caracteres Markdown residuais
    textToSpeak = textToSpeak.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '').trim();

    if (!textToSpeak) return;

    // Divisão em frases para evitar que o motor de síntese trave em textos longos
    const sentences = textToSpeak.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [textToSpeak];
    let currentSentenceIndex = 0;

    const speakNextChunk = () => {
        if (currentSentenceIndex >= sentences.length) {
            setIsPlaying(false);
            return;
        }

        const chunk = sentences[currentSentenceIndex];
        if (!chunk.trim()) {
            currentSentenceIndex++;
            speakNextChunk();
            return;
        }

        const utter = new SpeechSynthesisUtterance(chunk);
        utter.lang = 'pt-BR';
        utter.rate = playbackRate;
        const voice = voices.find(v => v.name === selectedVoice);
        if (voice) utter.voice = voice;

        utter.onend = () => {
            currentSentenceIndex++;
            speakNextChunk();
        };

        utter.onerror = () => { setIsPlaying(false); };

        speechRef.current = utter;
        window.speechSynthesis.speak(utter);
    };

    setIsPlaying(true);
    speakNextChunk();
  };

  const togglePlay = () => isPlaying ? (window.speechSynthesis.cancel(), setIsPlaying(false)) : speakText();

  const handleMarkAsRead = async () => {
      if (!userProgress || isRead) return;
      const newReadList = [...(userProgress.ebd_read || []), studyKey];
      const newTotal = (userProgress.total_ebd_read || 0) + 1;
      const updated = await db.entities.ReadingProgress.update(userProgress.id, {
          ebd_read: newReadList,
          total_ebd_read: newTotal
      });
      if (onProgressUpdate) onProgressUpdate(updated);
      onShowToast('Parabéns! Estudo concluído e registrado no Ranking.', 'success');
  };

  const parseInlineStyles = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} className="text-[#8B0000] dark:text-[#ff6b6b] font-bold">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
            return <em key={index} className="text-gray-700 dark:text-gray-300 font-medium italic">{part.slice(1, -1)}</em>;
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

                if (trimmed === '__CONTINUATION_MARKER__') {
                    return (
                        <div key={lineIdx} className="my-10 flex items-center justify-center select-none animate-in fade-in duration-700">
                            <div className="h-[1px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent w-full opacity-40"></div>
                            <span className="mx-6 text-[#C5A059] text-[9px] font-cinzel opacity-70 tracking-[0.4em] uppercase bg-[#FDFBF7] dark:bg-dark-card px-4">Continuação do Ensino</span>
                            <div className="h-[1px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent w-full opacity-40"></div>
                        </div>
                    );
                }

                if (trimmed.includes('PANORÂMA BÍBLICO') || trimmed.includes('PANORAMA BÍBLICO')) {
                    return (
                        <div key={lineIdx} className="mb-12 text-center border-b-2 border-[#8B0000] dark:border-[#ff6b6b] pb-8 pt-4">
                            <h1 className="font-cinzel font-bold text-2xl md:text-5xl text-[#8B0000] dark:text-[#ff6b6b] uppercase tracking-[0.1em] leading-tight drop-shadow-sm">
                                {trimmed}
                            </h1>
                        </div>
                    );
                }

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

                const isListItem = /^\d+\./.test(trimmed);
                if (isListItem) {
                    const firstSpaceIndex = trimmed.indexOf(' ');
                    const numberPart = trimmed.substring(0, firstSpaceIndex > -1 ? firstSpaceIndex : trimmed.length);
                    const textPart = firstSpaceIndex > -1 ? trimmed.substring(firstSpaceIndex + 1) : "";
                    return (
                        <div key={lineIdx} className="mb-8 flex gap-5 items-start group pl-2">
                            <div className="flex-shrink-0 mt-1 min-w-[2.5rem] text-right">
                                <span className="font-cinzel font-bold text-2xl text-[#C5A059] dark:text-[#C5A059]">
                                    {numberPart}
                                </span>
                            </div>
                            <div className="flex-1">
                                <p className="font-cormorant text-xl md:text-2xl leading-relaxed text-gray-900 dark:text-gray-200 text-justify border-l-4 border-[#C5A059]/10 pl-6 group-hover:border-[#C5A059]/30 transition-all">
                                    {parseInlineStyles(textPart)}
                                </p>
                            </div>
                        </div>
                    );
                }

                if (trimmed.toUpperCase().includes('CURIOSIDADE') || trimmed.toUpperCase().includes('ATENÇÃO:') || trimmed.toUpperCase().includes('DICA:') || trimmed.endsWith('?')) {
                    return (
                        <div key={lineIdx} className="my-10 mx-2 font-cormorant text-xl text-[#1a0f0f] dark:text-gray-200 font-medium italic bg-[#C5A059]/10 dark:bg-[#C5A059]/5 p-8 rounded-2xl border border-[#C5A059]/30 shadow-sm text-justify relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#C5A059]"></div>
                            <div className="flex items-center gap-3 mb-4 text-[#C5A059]">
                                <Sparkles className="w-6 h-6" />
                                <span className="text-xs font-bold uppercase tracking-[0.2em] font-montserrat">Insight Teológico</span>
                            </div>
                            <div>{parseInlineStyles(trimmed)}</div>
                        </div>
                    );
                }

                return (
                    <p key={lineIdx} className="font-cormorant text-xl md:text-2xl leading-loose text-gray-900 dark:text-gray-200 text-justify indent-10 mb-8 tracking-wide">
                        {parseInlineStyles(trimmed)}
                    </p>
                );
            })}
        </div>
    );
  };

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

  // --- LÓGICA DE GERAÇÃO EM LOTE PARA MÁXIMA QUANTIDADE ---
  const handleGenerate = async (mode: 'start' | 'continue') => {
    setIsGenerating(true);
    const target = activeTab;
    const studyKey = generateChapterKey(book, chapter);
    const existing = (await db.entities.PanoramaBiblico.filter({ study_key: studyKey }))[0] || {};
    const currentText = target === 'student' ? (existing.student_content || '') : (existing.teacher_content || '');
    const cleanContext = currentText.replace(/__CONTINUATION_MARKER__/g, ' ').slice(-5000);

    // Escape nested backticks to prevent premature termination of the template literal
    const WRITING_STYLE = `
        ATUE COMO: Professor Michel Felix. PERFIL: Teólogo PhD, Especialista em Exegese Original e História Bíblica.
        
        --- MISSÃO SUPREMA: APOSTILA COMPLETA, DENSA E EXAUSTIVA ---
        1. OBJETIVO: Gerar o conteúdo INTEGRAL, VERSÍCULO POR VERSÍCULO, do capítulo ${chapter} de ${book} em uma única apostila completa.
        2. EXTENSÃO OBRIGATÓRIA: Não poupe palavras. O objetivo é uma apostila de 6 a 10 páginas (mínimo 4.000 palavras no total).
        3. MICROSCOPIA BÍBLICA: Explique cada versículo de forma profunda. PROIBIDO resumos genéricos que pulam o texto. Se o capítulo tiver 30 versículos, explique todos os 30 em ordem.
        4. NÃO TRANSCREVA O TEXTO BÍBLICO: Cite apenas a referência (Ex: "Nos versículos 1 a 3 vemos...") e entregue a explicação erudita.
        5. LINGUAGEM: Magistral, clara e inspiradora. Use termos em Hebraico/Grego explicados entre parênteses.

        --- REGRAS TÉCNICAS DE FORMATAÇÃO PARA PAGINAÇÃO ---
        1. O sistema divide automaticamente as páginas usando a tag <hr class="page-break">.
        2. VOCÊ DEVE inserir a tag <hr class="page-break"> a cada bloco de exegese (aprox. 2500 caracteres) ou entre tópicos numerados principais.
        3. SAÍDA: TEXTO PURO FORMATADO. PROIBIDO ENVOLVER EM JSON OU \`\`\`json.

        --- ESTRUTURA VISUAL ---
        1. TÍTULO: PANORÂMA BÍBLICO - ${book.toUpperCase()} ${chapter} (PROF. MICHEL FELIX)
        2. INTRODUÇÃO: Contextualização geográfica, histórica e cronológica.
        3. DESENVOLVIMENTO: Tópicos numerados (1., 2., 3...) com exegese detalhada versículo por versículo.
        4. CONCLUSÃO OBRIGATÓRIA (Sempre ao final da apostila):
           ### TIPOLOGIA: CONEXÃO COM JESUS CRISTO (Como este capítulo aponta para o Messias)
           ### CURIOSIDADES E ARQUEOLOGIA (Dados científicos e históricos extras)
    `;
    
    const instructions = customInstructions ? `\nINSTRUÇÕES ADICIONAIS DO ADMIN: ${customInstructions}` : "";
    const continuationInstructions = `MODO CONTINUAÇÃO: Você já gerou parte da apostila. Continue EXATAMENTE de onde parou: "...${cleanContext.slice(-800)}...". Continue a exegese versículo por versículo até o final do capítulo e gere as seções finais (Tipologia e Arqueologia).`;

    let specificPrompt = `${WRITING_STYLE} ${instructions} ${mode === 'continue' ? continuationInstructions : 'INÍCIO DA APOSTILA COMPLETA DO CAPÍTULO.'}`;

    try {
        // Usa isLongOutput=true para permitir que a IA gere o máximo de tokens possível
        const result = await generateContent(specificPrompt, null, true, 'ebd');
        if (!result || result.trim().length < 100) throw new Error("A IA retornou um conteúdo muito curto para ser uma apostila.");
        
        let cleanedResult = result.trim();
        // Remove possíveis wrappers indesejados
        if (cleanedResult.startsWith('{"text":')) { try { cleanedResult = JSON.parse(cleanedResult).text; } catch(e){} }
        if (cleanedResult.startsWith('```')) { cleanedResult = cleanedResult.replace(/```[a-z]*\n|```/g, ''); }

        let separator = (mode === 'continue' && currentText.length > 0 && !currentText.trim().endsWith('>')) ? '<hr class="page-break">' : '';
        const newTotal = mode === 'continue' ? (currentText + separator + cleanedResult) : cleanedResult;
        
        const data = { 
            book, chapter, study_key: studyKey, 
            title: existing.title || `Estudo de ${book} ${chapter}`, 
            outline: existing.outline || [], 
            student_content: target === 'student' ? newTotal : (existing.student_content || ''), 
            teacher_content: target === 'teacher' ? newTotal : (existing.teacher_content || '') 
        };

        if (existing.id) await db.entities.PanoramaBiblico.update(existing.id, data);
        else await db.entities.PanoramaBiblico.create(data);

        await loadContent();
        onShowToast('Apostila densa gerada com sucesso!', 'success');
        if (mode === 'continue') setTimeout(() => setCurrentPage(pages.length), 500); 
    } catch (e: any) { 
        onShowToast(`Falha: ${e.message}`, 'error'); 
    } finally { 
        setIsGenerating(false); 
    }
  };

  const handleDeletePage = async () => {
    if (!window.confirm("Apagar permanentemente o conteúdo desta página?") || !content) return;
    const updatedPages = pages.filter((_, index) => index !== currentPage);
    const newContent = updatedPages.join('<hr class="page-break">');
    const data = { ...content, student_content: activeTab === 'student' ? newContent : content.student_content, teacher_content: activeTab === 'teacher' ? newContent : content.teacher_content };
    try { 
        if (content.id) await db.entities.PanoramaBiblico.update(content.id, data); 
        setPages(updatedPages); 
        if (currentPage >= updatedPages.length) setCurrentPage(Math.max(0, updatedPages.length - 1)); 
        await loadContent(); 
        onShowToast('Página removida da apostila.', 'success'); 
    } catch (e) { 
        onShowToast('Erro ao remover.', 'error'); 
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-300 flex flex-col" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {/* Barra Superior de Navegação e Opções */}
        <div className="sticky top-0 z-30 bg-gradient-to-r from-[#600018] to-[#400010] text-white p-4 shadow-xl flex justify-between items-center safe-top">
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-all active:scale-90"><ChevronLeft /></button>
            <div className="flex flex-col items-center">
                <h2 className="font-cinzel font-bold text-lg tracking-widest">Panorama EBD</h2>
                <span className="text-[9px] uppercase tracking-[0.3em] opacity-60 font-montserrat">Edição ADMA Premium</span>
            </div>
            <div className="flex gap-1">
                {isAdmin && !isEditing && content && (
                    <button onClick={handleStartEditing} title="Edição Manual" className="p-2 hover:bg-white/10 rounded-full text-[#C5A059] transition-all"><Edit className="w-5 h-5" /></button>
                )}
                <button onClick={() => setShowAudioSettings(!showAudioSettings)} className="p-2 hover:bg-white/10 rounded-full transition-all">
                    <Volume2 className={isPlaying ? "text-green-400 animate-pulse w-5 h-5" : "w-5 h-5"} />
                </button>
            </div>
        </div>

        {/* Painel de Controle de Áudio Flutuante */}
        {showAudioSettings && (
            <div className="bg-white/95 dark:bg-dark-card/95 backdrop-blur-md p-5 border-b border-[#C5A059]/30 shadow-2xl animate-in slide-in-from-top-2 z-40">
                <div className="flex flex-col gap-4 max-w-lg mx-auto">
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-xs uppercase tracking-widest text-[#1a0f0f] dark:text-white">Motor de Voz</span>
                        <button onClick={togglePlay} className="bg-[#C5A059] text-white px-5 py-2 rounded-full font-bold flex items-center gap-3 shadow-lg hover:shadow-[#C5A059]/40 active:scale-95 transition-all">
                            {isPlaying ? <Pause className="w-4 h-4 fill-current"/> : <Play className="w-4 h-4 fill-current"/>} 
                            {isPlaying ? 'Pausar' : 'Ouvir Agora'}
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <select className="w-full p-2 text-sm border rounded-xl dark:bg-gray-800 dark:text-white border-[#C5A059]/20" value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}>
                            {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                        </select>
                        <div className="flex gap-2">
                            {[0.8, 1, 1.2, 1.5].map(rate => (
                                <button key={rate} onClick={() => setPlaybackRate(rate)} className={`flex-1 py-2 text-[10px] font-bold rounded-lg border transition-all ${playbackRate === rate ? 'bg-[#8B0000] text-white border-[#8B0000] shadow-md' : 'bg-gray-100 dark:bg-gray-800 dark:text-gray-400'}`}>{rate}x</button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Seleção de Livro e Capítulo */}
        <div className="bg-white dark:bg-dark-card p-4 border-b border-[#C5A059]/20 flex gap-3 shadow-sm shrink-0">
             <div className="flex-1 relative">
                 <BookText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C5A059] opacity-50" />
                 <select value={book} onChange={e => setBook(e.target.value)} className="w-full pl-10 pr-3 py-3 border border-[#C5A059]/20 rounded-xl font-cinzel text-sm dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-[#C5A059]/50 transition-all outline-none">
                    {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                 </select>
             </div>
             <div className="w-24 relative">
                 <History className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C5A059] opacity-50" />
                 <input type="number" value={chapter} onChange={e => setChapter(Number(e.target.value))} className="w-full pl-10 pr-3 py-3 border border-[#C5A059]/20 rounded-xl font-cinzel text-sm dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-[#C5A059]/50 transition-all outline-none" min={1} />
             </div>
        </div>

        {/* Alternância de Perfil (Aluno / Professor) */}
        <div className="flex bg-[#F5F5DC] dark:bg-black border-b border-[#C5A059]/20 shrink-0">
            <button onClick={() => setActiveTab('student')} className={`flex-1 py-5 font-cinzel font-bold text-xs uppercase tracking-[0.2em] flex justify-center items-center gap-3 transition-all ${activeTab === 'student' ? 'bg-[#600018] text-white shadow-inner' : 'text-gray-500 dark:text-gray-500 hover:bg-black/5'}`}>
                <BookOpen className="w-5 h-5" /> Perfil Aluno
            </button>
            <button onClick={() => setActiveTab('teacher')} className={`flex-1 py-5 font-cinzel font-bold text-xs uppercase tracking-[0.2em] flex justify-center items-center gap-3 transition-all ${activeTab === 'teacher' ? 'bg-[#600018] text-white shadow-inner' : 'text-gray-500 dark:text-gray-500 hover:bg-black/5'}`}>
                {isAdmin ? <GraduationCap className="w-5 h-5" /> : <Lock className="w-4 h-4" />} Perfil Professor
            </button>
        </div>

        {/* Área de Gerenciamento do Editor Chefe (Admin Only) */}
        {isAdmin && !isEditing && (
            <div className="bg-[#1a0f0f] text-[#C5A059] p-5 shadow-2xl sticky top-[130px] z-20 border-b-4 border-[#8B0000] animate-in slide-in-from-top-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#8B0000] rounded-lg flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-white" /></div>
                        <span className="font-cinzel text-xs font-bold tracking-[0.2em]">EDITOR CHEFE ADMA</span>
                    </div>
                    <button onClick={() => setShowInstructions(!showInstructions)} className="text-[10px] font-bold uppercase tracking-widest underline decoration-dotted underline-offset-4 hover:text-white transition-colors">
                        {showInstructions ? 'Ocultar Opções' : 'Instruções Extras'}
                    </button>
                </div>
                
                {showInstructions && (
                    <div className="mb-4 animate-in fade-in duration-500">
                        <textarea value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} placeholder="Comandos para a IA (Ex: Enfatize o contexto arqueológico deste capítulo...)" className="w-full p-4 text-sm text-black rounded-xl border-none focus:ring-2 focus:ring-[#C5A059] font-montserrat shadow-inner" rows={3} />
                    </div>
                )}

                <div className="flex gap-3">
                    <button onClick={() => handleGenerate('start')} disabled={isGenerating} className="flex-1 px-4 py-3 border-2 border-[#C5A059] rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#C5A059] hover:text-[#1a0f0f] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                        {isGenerating ? <Loader2 className="animate-spin w-4 h-4"/> : <Sparkles className="w-4 h-4"/>} Gerar Apostila Completa
                    </button>
                    <button onClick={() => handleGenerate('continue')} disabled={isGenerating} className="flex-1 px-4 py-3 bg-[#C5A059] text-[#1a0f0f] font-bold rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                        {isGenerating ? <Loader2 className="animate-spin w-4 h-4"/> : <Plus className="w-4 h-4"/>} Continuar Exegese
                    </button>
                    {pages.length > 0 && (
                        <button onClick={handleDeletePage} className="px-4 py-3 bg-red-900 text-white rounded-xl hover:bg-red-700 transition-all shadow-lg active:scale-95" title="Apagar Página Atual">
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>
        )}

        {/* Área de Exibição do Conteúdo (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 md:p-12 max-w-5xl mx-auto pb-48 w-full">
            {!hasAccess ? (
                <div className="text-center py-32 opacity-60 dark:text-white animate-in zoom-in duration-700">
                    <Lock className="w-24 h-24 mx-auto mb-6 text-[#8B0000]" />
                    <h2 className="font-cinzel text-3xl font-bold mb-2">Acesso Restrito</h2>
                    <p className="font-montserrat text-sm max-w-xs mx-auto">Este conteúdo é exclusivo para professores e líderes autorizados do Ministério Ágape.</p>
                </div>
            ) : isEditing ? (
                 <div className="bg-white dark:bg-dark-card shadow-2xl p-6 rounded-3xl border-2 border-[#C5A059] relative animate-in slide-in-from-bottom-8 duration-500">
                     <div className="flex justify-between items-center mb-6 border-b pb-4 dark:border-white/10">
                        <h3 className="font-cinzel font-bold text-xl text-[#8B0000] dark:text-[#ff6b6b] flex items-center gap-3"><Edit className="w-6 h-6" /> Edição Manual da Apostila</h3>
                        <div className="flex gap-3">
                            <button onClick={() => setIsEditing(false)} className="px-5 py-2 text-xs font-bold border-2 border-red-500 text-red-500 rounded-full hover:bg-red-50 transition-colors uppercase tracking-widest">Descartar</button>
                            <button onClick={handleSaveManualEdit} className="px-5 py-2 text-xs font-bold bg-green-600 text-white rounded-full hover:bg-green-700 shadow-lg shadow-green-600/20 transition-all uppercase tracking-widest">Salvar Apostila</button>
                        </div>
                     </div>
                     <textarea value={editValue} onChange={e => setEditValue(e.target.value)} className="w-full h-[65vh] p-6 font-mono text-sm border-none focus:ring-0 rounded-2xl bg-gray-50 dark:bg-gray-900 dark:text-gray-300 resize-none shadow-inner" placeholder="Escreva ou cole o conteúdo aqui..." />
                 </div>
            ) : content && pages.length > 0 ? (
                <div className="bg-white dark:bg-dark-card shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] p-8 md:p-20 min-h-[70vh] border border-[#C5A059]/20 relative rounded-3xl animate-in fade-in duration-1000">
                     <div className="space-y-10">{renderFormattedText(pages[currentPage])}</div>
                     
                     <div className="absolute bottom-8 right-10 flex items-center gap-3">
                        <div className="h-[1px] w-8 bg-[#C5A059]/40"></div>
                        <span className="text-[#C5A059] font-cinzel text-xs font-bold tracking-widest">{currentPage + 1} de {pages.length}</span>
                     </div>

                     {currentPage === pages.length - 1 && userProgress && (
                         <div className="mt-20 text-center border-t-2 border-dashed border-[#C5A059]/20 pt-16">
                             <div className="max-w-md mx-auto mb-8">
                                <h4 className="font-cinzel text-2xl font-bold text-[#8B0000] dark:text-[#ff6b6b] mb-2 uppercase">Fim da Aula</h4>
                                <p className="font-cormorant text-lg text-gray-500 italic">"Examinai tudo. Retende o bem." (1 Ts 5:21)</p>
                             </div>
                             <button onClick={handleMarkAsRead} disabled={isRead} className={`group relative px-12 py-5 rounded-full font-cinzel font-bold text-lg shadow-2xl flex items-center justify-center gap-4 mx-auto overflow-hidden transition-all duration-500 transform hover:scale-105 active:scale-95 ${isRead ? 'bg-green-600 text-white shadow-green-600/20' : 'bg-[#8B0000] text-white shadow-red-900/30'}`}>
                                 {isRead ? <CheckCircle className="w-7 h-7" /> : <GraduationCap className="w-7 h-7 group-hover:rotate-12 transition-transform" />}
                                 <span className="relative z-10">{isRead ? 'CONTEÚDO JÁ ESTUDADO' : 'MARCAR COMO ESTUDADO'}</span>
                                 {!isRead && <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>}
                             </button>
                             {isRead && <p className="text-[10px] font-bold text-green-600 mt-4 uppercase tracking-[0.2em] animate-pulse">Você já pontuou neste Panorama Bíblico</p>}
                         </div>
                     )}
                </div>
            ) : (
                <div className="text-center py-40 bg-white dark:bg-dark-card rounded-3xl border border-dashed border-[#C5A059]/40 animate-in fade-in duration-1000">
                    <div className="relative inline-block mb-8">
                        <div className="absolute inset-0 bg-[#C5A059]/20 blur-2xl rounded-full"></div>
                        <Book className="w-24 h-24 mx-auto text-[#C5A059] opacity-40 relative z-10"/>
                    </div>
                    <p className="font-cinzel text-2xl font-bold text-gray-400 mb-2">Apostila em Preparação</p>
                    <p className="font-montserrat text-xs text-gray-500 uppercase tracking-widest">O Professor está organizando os materiais...</p>
                    {isAdmin && (
                        <div className="mt-10 max-w-xs mx-auto p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-900/20">
                            <HelpCircle className="w-6 h-6 text-red-800 mx-auto mb-2" />
                            <p className="text-[10px] font-bold text-red-800 dark:text-red-400 uppercase tracking-wider">Atenção Admin: Utilize o Editor Chefe acima para gerar o panorama deste capítulo.</p>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Navegação Inferior de Páginas (Apenas se houver várias páginas) */}
        {pages.length > 1 && hasAccess && !isEditing && (
            <div className="fixed bottom-20 left-4 right-4 z-40 max-w-xl mx-auto">
                <div className="bg-[#1a0f0f]/95 dark:bg-dark-card/95 backdrop-blur-xl border border-[#C5A059]/30 p-3 rounded-2xl flex justify-between items-center shadow-[0_15px_40px_-10px_rgba(0,0,0,0.5)]">
                    <button 
                        onClick={() => setCurrentPage(Math.max(0, currentPage - 1))} 
                        disabled={currentPage === 0} 
                        className="flex items-center gap-2 px-5 py-3 bg-[#8B0000] text-white rounded-xl font-bold text-[10px] uppercase tracking-widest disabled:opacity-30 disabled:grayscale transition-all active:scale-95 shadow-lg shadow-red-900/20"
                    >
                        <ChevronLeft className="w-4 h-4" /> Anterior
                    </button>
                    
                    <div className="flex flex-col items-center">
                        <span className="font-cinzel font-bold text-[#C5A059] text-sm">{currentPage + 1} / {pages.length}</span>
                        <div className="w-20 bg-white/10 h-1 rounded-full mt-1 overflow-hidden">
                            <div className="bg-[#C5A059] h-full transition-all duration-300" style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }}></div>
                        </div>
                    </div>

                    <button 
                        onClick={() => setCurrentPage(Math.min(pages.length - 1, currentPage + 1))} 
                        disabled={currentPage === pages.length - 1} 
                        className="flex items-center gap-2 px-5 py-3 bg-[#8B0000] text-white rounded-xl font-bold text-[10px] uppercase tracking-widest disabled:opacity-30 disabled:grayscale transition-all active:scale-95 shadow-lg shadow-red-900/20"
                    >
                        Próximo <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )}
    </div>
  );
}
