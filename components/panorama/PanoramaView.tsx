import React, { useState, useEffect, useRef } from 'react';
// Componente de Visualização do Panorama Bíblico
import { ChevronLeft, GraduationCap, Lock, BookOpen, ChevronRight, Volume2, Sparkles, Loader2, Book, Trash2, Edit, Save, X, CheckCircle, Pause, Play, Settings, FastForward } from 'lucide-react';
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

  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [playbackRate, setPlaybackRate] = useState(1);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Swipe State
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  const studyKey = generateChapterKey(book, chapter);
  const isRead = userProgress?.ebd_read?.includes(studyKey);

  useEffect(() => { loadContent(); }, [book, chapter]);

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
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  }, [currentPage, book, chapter, activeTab]);

  useEffect(() => {
    if (isPlaying) {
        window.speechSynthesis.cancel();
        speakText();
    }
  }, [playbackRate, selectedVoice]);

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

  // --- PAGINAÇÃO OTIMIZADA PARA 600 PALAVRAS (~4200 CARACTERES) ---
  const processAndPaginate = (html: string) => {
    if (!html) { setPages([]); return; }
    
    // Divide por marcadores de quebra ou blocos de continuação
    let rawSegments = html.split(/<hr[^>]*>|__CONTINUATION_MARKER__/i)
                          .map(s => cleanText(s))
                          .filter(s => s.length > 15);

    const finalPages: string[] = [];
    let currentBuffer = "";
    // 4200 caracteres é o alvo para 600 palavras exegéticas densas
    const TARGET_CHAR_LIMIT = 4200; 

    for (let i = 0; i < rawSegments.length; i++) {
        const segment = rawSegments[i];
        if (!currentBuffer) {
            currentBuffer = segment;
        } else {
            // Se o conteúdo atual + o novo segmento não ultrapassar muito o limite, junta eles.
            // Isso garante que introduções curtas fiquem presas ao primeiro tópico (Padrão 2.5)
            if ((currentBuffer.length + segment.length) < (TARGET_CHAR_LIMIT * 1.35)) {
                currentBuffer += "\n\n__CONTINUATION_MARKER__\n\n" + segment;
            } else {
                // Se já atingiu o volume de palavras ideal, cria a página
                finalPages.push(currentBuffer);
                currentBuffer = segment;
            }
        }
    }
    
    if (currentBuffer) finalPages.push(currentBuffer);
    setPages(finalPages.length > 0 ? finalPages : [cleanText(html)]);
  };

  const hasAccess = isAdmin || activeTab === 'student'; 

  const speakText = () => {
    if (!pages[currentPage]) return;
    window.speechSynthesis.cancel();
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = pages[currentPage]
        .replace(/__CONTINUATION_MARKER__/g, '. ')
        .replace(/<br>/g, '. ')
        .replace(/<\/p>/g, '. ');
    
    let textToSpeak = tempDiv.textContent || tempDiv.innerText || "";
    textToSpeak = textToSpeak.replace(/\*/g, '').replace(/#/g, '').trim();
    if (!textToSpeak) return;

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
        utter.onerror = () => setIsPlaying(false);
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

  const handleMarkAsRead = async () => {
      if (!userProgress || isRead) return;
      const newReadList = [...(userProgress.ebd_read || []), studyKey];
      const newTotal = (userProgress.total_ebd_read || 0) + 1;
      const updated = await db.entities.ReadingProgress.update(userProgress.id!, {
          ebd_read: newReadList,
          total_ebd_read: newTotal
      });
      if (onProgressUpdate) onProgressUpdate(updated);
      onShowToast('Estudo EBD concluído! Adicionado ao Ranking.', 'success');
  };

  const parseInlineStyles = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} className="text-[#8B0000] dark:text-[#ff6b6b] font-bold">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
            return <em key={index} className="text-gray-700 dark:text-gray-300 italic">{part.slice(1, -1)}</em>;
        }
        return part;
    });
  };

  const renderFormattedText = (text: string) => {
    const lines = text.split('\n').filter(b => b.trim().length > 0);
    return (
        <div>
            {lines.map((line, lineIdx) => {
                const trimmed = line.trim();
                if (trimmed === '__CONTINUATION_MARKER__') {
                    return (
                        <div key={lineIdx} className="my-12 flex items-center justify-center select-none animate-in fade-in duration-500">
                            <div className="h-[1px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent w-full max-w-xs opacity-50"></div>
                            <span className="mx-4 text-[#C5A059] text-[10px] font-cinzel opacity-80 tracking-[0.3em] uppercase bg-[#FDFBF7] dark:bg-dark-card px-2">Continuação</span>
                            <div className="h-[1px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent w-full max-w-xs opacity-50"></div>
                        </div>
                    );
                }
                if (trimmed.includes('PANORÂMA BÍBLICO') || trimmed.includes('PANORAMA BÍBLICO')) {
                    return (
                        <div key={lineIdx} className="mb-10 text-center border-b-2 border-[#8B0000] dark:border-[#ff6b6b] pb-6 pt-2">
                            <h1 className="font-cinzel font-bold text-2xl md:text-4xl text-[#8B0000] dark:text-[#ff6b6b] uppercase tracking-widest drop-shadow-sm leading-tight">
                                {trimmed}
                            </h1>
                        </div>
                    );
                }
                const isHeader = trimmed.startsWith('###') || /^[IVX]+\./.test(trimmed);
                if (isHeader) {
                    const title = trimmed.replace(/###/g, '').trim();
                    return (
                        <div key={lineIdx} className="mt-10 mb-6 flex flex-col items-center justify-center gap-2">
                            <h3 className="font-cinzel font-bold text-xl md:text-2xl text-[#1a0f0f] dark:text-[#E0E0E0] uppercase tracking-wide text-center leading-snug">
                                {title}
                            </h3>
                            <div className="h-[2px] bg-[#C5A059] w-12 rounded-full"></div>
                        </div>
                    );
                }
                const isListItem = /^\d+\./.test(trimmed);
                if (isListItem) {
                    const firstSpaceIndex = trimmed.indexOf(' ');
                    const numberPart = trimmed.substring(0, firstSpaceIndex > -1 ? firstSpaceIndex : trimmed.length);
                    const textPart = firstSpaceIndex > -1 ? trimmed.substring(firstSpaceIndex + 1) : "";
                    return (
                        <div key={lineIdx} className="mb-6 flex gap-4 items-start group pl-2">
                            <div className="flex-shrink-0 mt-1 min-w-[2rem] text-right">
                                <span className="font-cinzel font-bold text-xl text-[#C5A059] dark:text-[#C5A059]">
                                    {numberPart}
                                </span>
                            </div>
                            <div className="flex-1">
                                <p className="font-cormorant text-xl leading-loose text-gray-900 dark:text-gray-300 text-justify border-l-2 border-[#C5A059]/20 pl-4">
                                    {parseInlineStyles(textPart)}
                                </p>
                            </div>
                        </div>
                    );
                }
                return (
                    <p key={lineIdx} className="font-cormorant text-xl leading-loose text-gray-900 dark:text-gray-200 text-justify indent-8 mb-6 tracking-wide">
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
        onShowToast('Texto atualizado manualmente com sucesso!', 'success');
    } catch (e) {
        onShowToast('Erro ao salvar edição.', 'error');
    }
  };

  const handleGenerate = async (mode: 'start' | 'continue') => {
    setIsGenerating(true);
    const target = activeTab;
    const studyKey = generateChapterKey(book, chapter);
    const existing = (await db.entities.PanoramaBiblico.filter({ study_key: studyKey }))[0] || {};
    const currentText = target === 'student' ? (existing.student_content || '') : (existing.teacher_content || '');
    const cleanContext = currentText.replace(/__CONTINUATION_MARKER__/g, ' ').slice(-4200);

    const WRITING_STYLE = `
        ATUE COMO: Professor Michel Felix.
        PERFIL: Teólogo Pentecostal Clássico, Arminiano, Erudito e Assembleiano.

        --- OBJETIVO SUPREMO: CONTEÚDO COMPLETO E DENSO (PADRÃO GEMINI 2.5 FLASH) ---
        1. NÃO RESUMA. Explique CADA versículo com profundidade exegética e histórica total.
        2. TAMANHO DA PÁGINA: O alvo é escrever blocos de 600 PALAVRAS por título/sessão.
        3. PAGINAÇÃO: Insira a tag <hr class="page-break"> APENAS após atingir um volume de pelo menos 4200 caracteres de texto denso.
        4. TERMOS TÉCNICOS: Explique o significado entre parênteses. Ex: "Vemos aqui uma Teofania (uma aparição visível de Deus)...".
        
        --- ESTRUTURA VISUAL OBRIGATÓRIA ---
        1. TÍTULO: PANORÂMA BÍBLICO - ${book.toUpperCase()} ${chapter} (PROF. MICHEL FELIX)
        2. INTRODUÇÃO: Texto rico contextualizando o capítulo. JUNTE OBRIGATORIAMENTE a introdução com o primeiro tópico do estudo para preencher a página 1 com 600 palavras.
        3. TÓPICOS: Use numeração (1., 2., 3...) e escreva o máximo de detalhes exegéticos possíveis.
    `;
    
    const instructions = customInstructions ? `\nINSTRUÇÕES EXTRAS: ${customInstructions}` : "";
    const continuationInstructions = `MODO CONTINUAÇÃO. Continue exatamente de onde parou: "...${cleanContext.slice(-500)}...". Mantenha a densidade de 600 palavras por página e exegese profunda.`;

    let specificPrompt = target === 'student' ? 
        `OBJETIVO: AULA DO ALUNO para ${book} ${chapter}. ${WRITING_STYLE} ${instructions} ${mode === 'continue' ? continuationInstructions : 'INÍCIO DO ESTUDO COMPLETO.'}` : 
        `OBJETIVO: MANUAL DO PROFESSOR para ${book} ${chapter}. ${WRITING_STYLE} ${instructions} ${mode === 'continue' ? continuationInstructions : 'INÍCIO DO ESTUDO COMPLETO.'}`;

    try {
        const result = await generateContent(specificPrompt);
        if (!result || result.trim() === 'undefined' || result.length < 50) throw new Error("A IA retornou vazio.");
        
        let separator = '';
        if (mode === 'continue' && currentText.length > 0 && !currentText.trim().endsWith('>')) {
            separator = '<hr class="page-break">';
        }

        const newTotal = mode === 'continue' ? (currentText + separator + result) : result;
        const data = {
            book, chapter, study_key: studyKey,
            title: existing.title || `Estudo de ${book} ${chapter}`,
            outline: existing.outline || [],
            student_content: target === 'student' ? newTotal : (existing.student_content || ''),
            teacher_content: target === 'teacher' ? newTotal : (existing.teacher_content || ''),
        };

        if (existing.id) await db.entities.PanoramaBiblico.update(existing.id, data);
        else await db.entities.PanoramaBiblico.create(data);

        await loadContent();
        onShowToast('Conteúdo gerado no Padrão Profundo ADMA!', 'success');
    } catch (e: any) {
        onShowToast(`Erro: ${e.message}`, 'error');
    } finally {
        setIsGenerating(false);
    }
  };

  const handleDeletePage = async () => {
    if (!window.confirm("Apagar esta página?")) return;
    if (!content) return;
    const updatedPages = pages.filter((_, index) => index !== currentPage);
    const newContent = updatedPages.join('<hr class="page-break">');
    const data = {
        ...content,
        student_content: activeTab === 'student' ? newContent : content.student_content,
        teacher_content: activeTab === 'teacher' ? newContent : content.teacher_content,
    };
    try {
        if (content.id) await db.entities.PanoramaBiblico.update(content.id, data);
        setPages(updatedPages);
        if (currentPage >= updatedPages.length) setCurrentPage(Math.max(0, updatedPages.length - 1));
        await loadContent();
        onShowToast('Página apagada.', 'success');
    } catch (e) {
        onShowToast('Erro ao apagar.', 'error');
    }
  };

  return (
    <div 
        className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-300"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
    >
        <div className="sticky top-0 z-30 bg-gradient-to-r from-[#600018] to-[#400010] text-white p-4 shadow-lg flex justify-between items-center">
            <button onClick={onBack} className="p-2"><ChevronLeft /></button>
            <h2 className="font-cinzel font-bold text-sm tracking-widest uppercase text-[#C5A059]">Panorama EBD</h2>
            <div className="flex gap-2">
                {isAdmin && !isEditing && content && (
                    <button onClick={handleStartEditing} title="Editar" className="p-2 hover:bg-white/10 rounded-full">
                        <Edit className="w-5 h-5 text-[#C5A059]" />
                    </button>
                )}
                <button onClick={() => setShowAudioSettings(!showAudioSettings)} title="Áudio" className="p-2">
                    <Volume2 className={isPlaying ? "text-green-400 animate-pulse" : "w-6 h-6"} />
                </button>
            </div>
        </div>

        {showAudioSettings && (
            <div className="bg-white dark:bg-dark-card p-4 border-b border-[#C5A059]/30 animate-in slide-in-from-top-2">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-[#1a0f0f] dark:text-white">Leitura de Áudio</span>
                        <button onClick={togglePlay} className="bg-[#C5A059] text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-[#a88645]">
                            {isPlaying ? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4"/>} {isPlaying ? 'Pausar' : 'Ouvir'}
                        </button>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500">Voz:</label>
                        <select className="w-full p-1 text-sm border rounded mt-1 dark:bg-gray-800 dark:text-white" value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}>
                            {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>
        )}

        <div className="bg-white dark:bg-dark-card p-4 border-b border-[#C5A059]/30 flex gap-2">
             <select value={book} onChange={e => setBook(e.target.value)} className="flex-1 p-2 border rounded font-cinzel dark:bg-gray-800 dark:text-white">
                {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
             </select>
             <input type="number" value={chapter} onChange={e => setChapter(Number(e.target.value))} className="w-20 p-2 border rounded font-cinzel dark:bg-gray-800 dark:text-white text-center" min={1} />
        </div>

        <div className="flex bg-[#F5F5DC] dark:bg-black">
            <button onClick={() => setActiveTab('student')} className={`flex-1 py-4 font-cinzel font-bold flex justify-center gap-2 transition-all ${activeTab === 'student' ? 'bg-[#600018] text-white shadow-inner' : 'text-gray-600 dark:text-gray-400'}`}>
                <BookOpen className="w-5 h-5" /> Aluno
            </button>
            <button onClick={() => setActiveTab('teacher')} className={`flex-1 py-4 font-cinzel font-bold flex justify-center gap-2 transition-all ${activeTab === 'teacher' ? 'bg-[#600018] text-white shadow-inner' : 'text-gray-600 dark:text-gray-400'}`}>
                {isAdmin ? <GraduationCap className="w-5 h-5" /> : <Lock className="w-5 h-5" />} Professor
            </button>
        </div>

        {isAdmin && !isEditing && (
            <div className="bg-[#1a0f0f] text-[#C5A059] p-4 shadow-inner sticky top-[130px] z-20 border-b-4 border-[#8B0000]">
                <div className="flex items-center justify-between mb-2">
                    <span className="font-cinzel text-xs flex items-center gap-2 font-bold"><Sparkles className="w-4 h-4" /> EDITOR CHEFE (2.5 FLASH PREVIEW)</span>
                    <button onClick={() => setShowInstructions(!showInstructions)} className="text-xs underline">
                        {showInstructions ? 'Ocultar' : 'Instruções'}
                    </button>
                </div>
                {showInstructions && (
                    <textarea value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} placeholder="Instruções..." className="w-full p-2 text-xs text-black rounded mb-2" rows={2} />
                )}
                <div className="flex gap-2">
                    <button onClick={() => handleGenerate('start')} disabled={isGenerating} className="flex-1 px-3 py-2 border border-[#C5A059] rounded text-xs hover:bg-[#C5A059] hover:text-[#1a0f0f] transition disabled:opacity-50 font-bold">
                        {isGenerating ? <Loader2 className="animate-spin w-3 h-3 mx-auto"/> : 'INÍCIO (ESTUDO LONGO)'}
                    </button>
                    <button onClick={() => handleGenerate('continue')} disabled={isGenerating} className="flex-1 px-3 py-2 bg-[#C5A059] text-[#1a0f0f] font-bold rounded text-xs hover:bg-white transition disabled:opacity-50">
                        {isGenerating ? <Loader2 className="animate-spin w-3 h-3 mx-auto"/> : 'CONTINUAR'}
                    </button>
                    {pages.length > 0 && (
                        <button onClick={handleDeletePage} className="px-3 py-2 bg-red-900 text-white rounded hover:bg-red-700 transition" title="Apagar Página"><Trash2 className="w-4 h-4" /></button>
                    )}
                </div>
            </div>
        )}

        <div className="p-4 md:p-8 max-w-4xl mx-auto pb-48">
            {!hasAccess ? (
                <div className="text-center py-20 opacity-50 dark:text-white">
                    <Lock className="w-16 h-16 mx-auto mb-4" />
                    <p className="font-cinzel text-xl">Conteúdo Restrito ao Admin/Professor</p>
                </div>
            ) : isEditing ? (
                 <div className="bg-white dark:bg-dark-card shadow-2xl p-4 rounded-lg border border-[#C5A059] relative">
                     <div className="flex justify-between items-center mb-4 border-b border-[#C5A059]/30 pb-2">
                        <h3 className="font-cinzel font-bold text-[#8B0000] dark:text-[#ff6b6b] flex items-center gap-2">Modo Edição Manual</h3>
                        <div className="flex gap-2">
                            <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-sm border border-red-500 text-red-500 rounded flex items-center gap-1">Cancelar</button>
                            <button onClick={handleSaveManualEdit} className="px-3 py-1 text-sm bg-green-600 text-white hover:bg-green-700 rounded flex items-center gap-1 shadow-sm"><Save className="w-4 h-4"/> Salvar</button>
                        </div>
                     </div>
                     <textarea value={editValue} onChange={e => setEditValue(e.target.value)} className="w-full h-[600px] p-4 font-mono text-sm border rounded dark:bg-gray-800 dark:text-white outline-none" />
                 </div>
            ) : content && pages.length > 0 ? (
                <div className="bg-white dark:bg-dark-card shadow-2xl p-8 md:p-16 min-h-[600px] border border-[#C5A059]/20 relative rounded-[2rem]">
                     <div className="space-y-6">
                        {renderFormattedText(pages[currentPage])}
                     </div>
                     <div className="absolute bottom-4 right-8 text-[#C5A059] font-cinzel text-sm">
                        {currentPage + 1} / {pages.length}
                     </div>
                     {currentPage === pages.length - 1 && userProgress && (
                         <div className="mt-12 text-center">
                             <button onClick={handleMarkAsRead} disabled={isRead} className={`px-8 py-4 rounded-full font-cinzel font-bold text-lg shadow-lg flex items-center justify-center gap-2 mx-auto transition-all transform hover:scale-105 ${isRead ? 'bg-green-600 text-white' : 'bg-gradient-to-r from-[#C5A059] to-[#8B0000] text-white animate-pulse'}`}>
                                 {isRead ? <CheckCircle className="w-6 h-6" /> : <GraduationCap className="w-6 h-6" />}
                                 {isRead ? 'ESTUDO CONCLUÍDO' : 'CONCLUIR ESTUDO'}
                             </button>
                         </div>
                     )}
                </div>
            ) : (
                <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                    <Book className="w-16 h-16 mx-auto mb-4 text-[#C5A059] opacity-50"/>
                    <p className="font-cinzel text-lg">Nenhum estudo disponível ainda.</p>
                    {isAdmin && <p className="text-sm mt-2 text-[#8B0000] animate-pulse">Use o Editor Chefe acima para gerar o estudo.</p>}
                </div>
            )}
        </div>

        {pages.length > 1 && hasAccess && !isEditing && (
            <div className="fixed bottom-16 left-0 w-full bg-white dark:bg-dark-card border-t border-[#C5A059] p-4 flex justify-between items-center z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] safe-bottom">
                <button onClick={() => setCurrentPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0} className="flex items-center gap-1 px-4 py-3 bg-[#8B0000] text-white rounded-lg font-bold disabled:opacity-50 disabled:bg-gray-400 transition-all">
                    <ChevronLeft /> Anterior
                </button>
                <span className="font-cinzel font-bold text-[#1a0f0f] dark:text-white text-sm md:text-base">
                    Página {currentPage + 1} de {pages.length}
                </span>
                <button onClick={() => setCurrentPage(Math.min(pages.length - 1, currentPage + 1))} disabled={currentPage === pages.length - 1} className="flex items-center gap-1 px-4 py-3 bg-[#8B0000] text-white rounded-lg font-bold disabled:opacity-50 disabled:bg-gray-400 transition-all">
                    Próxima <ChevronRight />
                </button>
            </div>
        )}
    </div>
  );
}