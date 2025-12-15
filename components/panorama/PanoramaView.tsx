
import React, { useState, useEffect } from 'react';
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

  // --- NOVOS ESTADOS PARA EDIÇÃO MANUAL ---
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [playbackRate, setPlaybackRate] = useState(1);

  // Swipe State
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  // Status de Leitura
  const studyKey = generateChapterKey(book, chapter);
  const isRead = userProgress?.ebd_read?.includes(studyKey);

  useEffect(() => { loadContent(); }, [book, chapter]);

  useEffect(() => {
    const loadVoices = () => {
        const available = window.speechSynthesis.getVoices().filter(v => v.lang.includes('pt'));
        setVoices(available);
        if(available.length > 0) setSelectedVoice(available[0].name);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    return () => {
        window.speechSynthesis.cancel();
    }
  }, []);

  useEffect(() => {
    if (isPlaying) {
        window.speechSynthesis.cancel();
        speakText();
    }
  }, [playbackRate]);

  // SWIPE HANDLERS
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
    }
    if (isRightSwipe && currentPage > 0) {
        setCurrentPage(p => p - 1);
    }
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
        // Sempre sai do modo de edição ao trocar de aba ou capítulo para evitar sobrescrita acidental
        setIsEditing(false);
    } else {
        setPages([]);
    }
  }, [activeTab, content]);

  const cleanText = (text: string) => {
    if (!text || text === 'undefined') return '';
    return text.trim();
  };

  const processAndPaginate = (html: string) => {
    if (!html) { setPages([]); return; }
    const rawPages = html.split(/<hr[^>]*>/i);
    const cleanedPages = rawPages.map(p => cleanText(p)).filter(p => p.length > 50);
    setPages(cleanedPages.length > 0 ? cleanedPages : [cleanText(html)]);
  };

  const hasAccess = isAdmin || activeTab === 'student'; 

  const speakText = () => {
    if (!pages[currentPage]) return;
    const cleanSpeech = pages[currentPage].replace(/#/g, '').replace(/\*/g, '').replace(/<[^>]*>/g, '');
    const utter = new SpeechSynthesisUtterance(cleanSpeech);
    utter.lang = 'pt-BR';
    utter.rate = playbackRate;
    const voice = voices.find(v => v.name === selectedVoice);
    if (voice) utter.voice = voice;
    utter.onend = () => setIsPlaying(false);
    window.speechSynthesis.speak(utter);
    setIsPlaying(true);
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

      const updated = await db.entities.ReadingProgress.update(userProgress.id, {
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
            return <em key={index} className="text-gray-700 dark:text-gray-300">{part.slice(1, -1)}</em>;
        }
        return part;
    });
  };

  const renderFormattedText = (text: string) => {
    const blocks = text.split('\n').filter(b => b.trim().length > 0);
    return blocks.map((block, idx) => {
        const trimmed = block.trim();
        if (trimmed.includes('PANORÂMA BÍBLICO') || trimmed.includes('PANORAMA BÍBLICO')) {
             return (
                <div key={idx} className="mb-8 text-center border-b-2 border-[#8B0000] dark:border-[#ff6b6b] pb-4 pt-2">
                    <h1 className="font-cinzel font-bold text-2xl md:text-3xl text-[#8B0000] dark:text-[#ff6b6b] uppercase tracking-widest drop-shadow-sm">
                        {trimmed}
                    </h1>
                </div>
            );
        }
        const isHeader = trimmed.startsWith('###') || /^[IVX]+\./.test(trimmed);
        if (isHeader) {
            const title = trimmed.replace(/###/g, '').trim();
            return (
                <div key={idx} className="mt-8 mb-6 flex items-center justify-center gap-4">
                    <div className="h-[1px] bg-[#C5A059] w-8 md:w-16 opacity-60"></div>
                    <h3 className="font-cinzel font-bold text-xl text-[#1a0f0f] dark:text-[#E0E0E0] uppercase tracking-wide text-center">
                        {title}
                    </h3>
                    <div className="h-[1px] bg-[#C5A059] w-8 md:w-16 opacity-60"></div>
                </div>
            );
        }
        const isListItem = /^\d+\./.test(trimmed);
        if (isListItem) {
            const firstSpaceIndex = trimmed.indexOf(' ');
            const numberPart = trimmed.substring(0, firstSpaceIndex > -1 ? firstSpaceIndex : trimmed.length);
            const textPart = firstSpaceIndex > -1 ? trimmed.substring(firstSpaceIndex + 1) : "";
            return (
                <div key={idx} className="mb-6 flex gap-4 items-start group">
                    <div className="flex-shrink-0 mt-1 w-8 text-right">
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
        if (trimmed.toUpperCase().includes('CURIOSIDADE') || trimmed.toUpperCase().includes('ATENÇÃO:') || trimmed.endsWith('?')) {
            return (
                <div key={idx} className="my-6 mx-2 font-cormorant text-lg text-[#1a0f0f] dark:text-gray-200 font-medium italic bg-[#C5A059]/10 dark:bg-[#C5A059]/10 p-6 rounded-lg border-y border-[#C5A059]/40 shadow-sm text-justify">
                    <div className="flex justify-center mb-2">
                        <Sparkles className="w-5 h-5 text-[#C5A059] opacity-70" />
                    </div>
                    <div>{parseInlineStyles(trimmed)}</div>
                </div>
            );
        }
        return (
            <p key={idx} className="font-cormorant text-xl leading-loose text-gray-900 dark:text-gray-300 text-justify indent-8 mb-4 tracking-wide">
                {parseInlineStyles(trimmed)}
            </p>
        );
    });
  };

  // --- FUNÇÕES DE EDIÇÃO MANUAL ---
  const handleStartEditing = () => {
    // Carrega o conteúdo da aba ativa para o editor
    const text = activeTab === 'student' ? content?.student_content : content?.teacher_content;
    setEditValue(text || '');
    setIsEditing(true);
  };

  const handleSaveManualEdit = async () => {
    if (!content) return;
    
    // Atualiza apenas o conteúdo da aba que estava sendo editada
    const data = {
        ...content,
        student_content: activeTab === 'student' ? editValue : content.student_content,
        teacher_content: activeTab === 'teacher' ? editValue : content.teacher_content,
    };

    try {
        if (content.id) await db.entities.PanoramaBiblico.update(content.id, data);
        await loadContent(); // Recarrega do banco para confirmar
        setIsEditing(false);
        onShowToast('Texto atualizado manualmente com sucesso!', 'success');
    } catch (e) {
        console.error(e);
        onShowToast('Erro ao salvar edição.', 'error');
    }
  };

  const handleGenerate = async (mode: 'start' | 'continue') => {
    setIsGenerating(true);
    const target = activeTab;
    const studyKey = generateChapterKey(book, chapter);
    const existing = (await db.entities.PanoramaBiblico.filter({ study_key: studyKey }))[0] || {};
    const currentText = target === 'student' ? (existing.student_content || '') : (existing.teacher_content || '');
    
    const lastContext = currentText.slice(-3000); 

    const WRITING_STYLE = `
        VOCÊ É O PROFESSOR MICHEL FELIX.
        
        --- DIRETRIZES DE ESTILO (RIGOROSAS) ---
        1. PROIBIDO AUTO-IDENTIFICAÇÃO: NUNCA use frases como "Nós pentecostais", "Como cremos", "Eu acredito", "Minha visão". O texto deve ser impessoal, direto e autoritativo.
        2. ESTRUTURA: Inicie sempre com "PANORÂMA BÍBLICO - [LIVRO] (Prof. Michel Felix)". Use "### TÍTULO" para seções e <hr class="page-break"> para quebra de página.
        3. DIDÁTICA: Explique o original (Hebraico/Grego) entre parênteses. Conecte o evento a Jesus (Tipologia). Inclua um tópico "### CURIOSIDADES E ARQUEOLOGIA".

        --- SEGURANÇA TEOLÓGICA (CRÍTICO - LEIA COM ATENÇÃO) ---
        1. BASE DOUTRINÁRIA: Arminiana e Pentecostal Clássica, mas EQUILIBRADA e ORTODOXA.
        2. TRATAMENTO DE TEXTOS POLÊMICOS:
           - Se houver múltiplas interpretações (ex: Gn 6 "Filhos de Deus"), APRESENTE as correntes, MAS CONCLUA sempre com a visão mais coerente com o Cânon Bíblico (Novo Testamento).
           - REGRA DE OURO: Rejeite interpretações baseadas em livros apócrifos (como Enoque) ou mitologia se contradizerem Jesus ou a sã doutrina.
           - EXEMPLO ESPECÍFICO: Para Gênesis 6, cite a visão dos anjos (apócrifa) mas refute-a com Mateus 22:30, optando pela visão da Linhagem de Sete (Filhos de Deus = Descendentes de Sete).
           - EVITE POLÊMICAS DESNECESSÁRIAS: Busque a edificação, não a confusão. O sobrenatural aceito é o Bíblico, não o mitológico.
    `;
    const instructions = customInstructions ? `\nINSTRUÇÕES ADICIONAIS DO USUÁRIO: ${customInstructions}` : "";
    const continuationInstructions = `MODO CONTINUAÇÃO (PÁGINA ${pages.length + 1}). CONTEXTO: "...${lastContext.slice(-400)}..."`;

    let specificPrompt = target === 'student' ? 
        `OBJETIVO: AULA DO ALUNO para ${book} ${chapter}. ${WRITING_STYLE} ${instructions} ${mode === 'continue' ? continuationInstructions : 'INÍCIO DO ESTUDO.'}` : 
        `OBJETIVO: MANUAL DO PROFESSOR para ${book} ${chapter}. ${WRITING_STYLE} ${instructions} ${mode === 'continue' ? continuationInstructions : 'INÍCIO DO ESTUDO.'}`;

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
        onShowToast('Conteúdo gerado no Padrão Michel Felix (Ortodoxo)!', 'success');
        if (mode === 'continue') setTimeout(() => setCurrentPage(pages.length), 500); 

    } catch (e: any) {
        onShowToast(`Erro: ${e.message}`, 'error');
    } finally {
        setIsGenerating(false);
    }
  };

  const handleDeletePage = async () => {
    if (!window.confirm("Tem certeza que deseja apagar ESTA página?")) return;
    if (!content) return;
    const newPages = [...pages];
    newPages.splice(currentPage, 1);
    const newHtml = newPages.join('<hr class="page-break">');
    const target = activeTab;
    const data = {
        ...content,
        student_content: target === 'student' ? newHtml : content.student_content,
        teacher_content: target === 'teacher' ? newHtml : content.teacher_content,
    };
    if (content.id) await db.entities.PanoramaBiblico.update(content.id, data);
    await loadContent();
    setCurrentPage(Math.max(0, currentPage - 1));
    onShowToast("Página removida.", "success");
  };

  return (
    <div 
        className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-300"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
    >
        <div className="sticky top-0 z-30 bg-gradient-to-r from-[#600018] to-[#400010] text-white p-4 shadow-lg flex justify-between items-center">
            <button onClick={onBack}><ChevronLeft /></button>
            <h2 className="font-cinzel font-bold">Panorama EBD</h2>
            <div className="flex gap-2">
                {/* BOTÃO DE EDIÇÃO MANUAL (Apenas Admin) */}
                {isAdmin && !isEditing && content && (
                    <button onClick={handleStartEditing} title="Editar Texto Manualmente" className="p-2 hover:bg-white/10 rounded-full">
                        <Edit className="w-5 h-5 text-[#C5A059]" />
                    </button>
                )}
                {/* Audio Button triggers settings popover */}
                <button onClick={() => setShowAudioSettings(!showAudioSettings)} title="Opções de Áudio">
                    <Volume2 className={isPlaying ? "text-green-400 animate-pulse" : ""} />
                </button>
            </div>
        </div>

        {showAudioSettings && (
            <div className="bg-white dark:bg-dark-card p-4 border-b border-[#C5A059]/30 animate-in slide-in-from-top-2">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-[#1a0f0f] dark:text-white">Leitura de Áudio</span>
                        <button 
                            onClick={togglePlay}
                            className="bg-[#C5A059] text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-[#a88645]"
                        >
                            {isPlaying ? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4"/>} 
                            {isPlaying ? 'Pausar' : 'Ouvir Página'}
                        </button>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Voz:</label>
                        <select className="w-full p-1 text-sm border rounded mt-1 dark:bg-gray-800 dark:text-white" value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}>
                            {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
                            <FastForward className="w-3 h-3" /> Velocidade:
                        </span>
                        <div className="flex gap-2">
                            {[0.75, 1, 1.25, 1.5, 2].map(rate => (
                                <button 
                                    key={rate}
                                    onClick={() => setPlaybackRate(rate)}
                                    className={`flex-1 py-1 text-xs font-bold rounded border ${playbackRate === rate ? 'bg-[#8B0000] text-white border-[#8B0000]' : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'}`}
                                >
                                    {rate}x
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        <div className="bg-white dark:bg-dark-card p-4 border-b border-[#C5A059]/30 flex gap-2">
             <select value={book} onChange={e => setBook(e.target.value)} className="flex-1 p-2 border rounded font-cinzel dark:bg-gray-800 dark:text-white">
                {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
             </select>
             <input type="number" value={chapter} onChange={e => setChapter(Number(e.target.value))} className="w-20 p-2 border rounded font-cinzel dark:bg-gray-800 dark:text-white" min={1} />
        </div>

        <div className="flex bg-[#F5F5DC] dark:bg-black">
            <button 
                onClick={() => setActiveTab('student')}
                className={`flex-1 py-4 font-cinzel font-bold flex justify-center gap-2 transition-all ${activeTab === 'student' ? 'bg-[#600018] text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-[#600018]/10'}`}
            >
                <BookOpen className="w-5 h-5" /> Aluno
            </button>
            <button 
                onClick={() => setActiveTab('teacher')}
                className={`flex-1 py-4 font-cinzel font-bold flex justify-center gap-2 transition-all ${activeTab === 'teacher' ? 'bg-[#600018] text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-[#600018]/10'}`}
            >
                {isAdmin ? <GraduationCap className="w-5 h-5" /> : <Lock className="w-5 h-5" />} Professor
            </button>
        </div>

        {isAdmin && !isEditing && (
            <div className="bg-[#1a0f0f] text-[#C5A059] p-4 shadow-inner sticky top-[130px] z-20 border-b-4 border-[#8B0000]">
                {/* Admin controls hidden for brevity, same as before */}
                <div className="flex items-center justify-between mb-2">
                    <span className="font-cinzel text-xs flex items-center gap-2 font-bold"><Sparkles className="w-4 h-4" /> EDITOR CHEFE ({activeTab.toUpperCase()})</span>
                    <button onClick={() => setShowInstructions(!showInstructions)} className="text-xs underline hover:text-white">
                        {showInstructions ? 'Ocultar Instruções' : 'Adicionar Instruções'}
                    </button>
                </div>
                {showInstructions && (
                    <textarea value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} placeholder="Instruções..." className="w-full p-2 text-xs text-black rounded mb-2 font-montserrat" rows={2} />
                )}
                <div className="flex gap-2">
                    <button onClick={() => handleGenerate('start')} disabled={isGenerating} className="flex-1 px-3 py-2 border border-[#C5A059] rounded text-xs hover:bg-[#C5A059] hover:text-[#1a0f0f] transition disabled:opacity-50 font-bold">
                        {isGenerating ? <Loader2 className="animate-spin w-3 h-3 mx-auto"/> : 'INÍCIO (Padrão EBD)'}
                    </button>
                    <button onClick={() => handleGenerate('continue')} disabled={isGenerating} className="flex-1 px-3 py-2 bg-[#C5A059] text-[#1a0f0f] font-bold rounded text-xs hover:bg-white transition disabled:opacity-50">
                        {isGenerating ? <Loader2 className="animate-spin w-3 h-3 mx-auto"/> : 'CONTINUAR (+ Conteúdo)'}
                    </button>
                    {pages.length > 0 && (
                        <button onClick={handleDeletePage} className="px-3 py-2 bg-red-900 text-white rounded hover:bg-red-700 transition"><Trash2 className="w-4 h-4" /></button>
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
                 <div className="bg-white dark:bg-dark-card shadow-2xl p-4 rounded-lg border border-[#C5A059] relative animate-in slide-in-from-bottom-5">
                     <div className="flex justify-between items-center mb-4 border-b border-[#C5A059]/30 pb-2">
                        <h3 className="font-cinzel font-bold text-[#8B0000] dark:text-[#ff6b6b] flex items-center gap-2">
                            <Edit className="w-5 h-5" /> Modo de Edição Manual
                        </h3>
                        <div className="flex gap-2">
                            <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-sm border border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded flex items-center gap-1 transition-colors">
                                <X className="w-4 h-4"/> Cancelar
                            </button>
                            <button onClick={handleSaveManualEdit} className="px-3 py-1 text-sm bg-green-600 text-white hover:bg-green-700 rounded flex items-center gap-1 transition-colors shadow-sm">
                                <Save className="w-4 h-4"/> Salvar Alterações
                            </button>
                        </div>
                     </div>
                     <p className="text-xs text-gray-500 mb-2 font-montserrat">
                        Edite o conteúdo bruto abaixo. Use <code>&lt;hr class="page-break"&gt;</code> para criar novas páginas.
                     </p>
                     <textarea 
                        value={editValue} 
                        onChange={e => setEditValue(e.target.value)} 
                        className="w-full h-[600px] p-4 font-mono text-sm border border-gray-300 rounded focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] outline-none dark:bg-gray-800 dark:text-white dark:border-gray-700" 
                     />
                 </div>
            ) : content && pages.length > 0 ? (
                <div className="bg-white dark:bg-dark-card shadow-2xl p-8 md:p-16 min-h-[600px] border border-[#C5A059]/20 relative">
                     {(!content.student_content.includes('PANORÂMA') && currentPage === 0) && (
                         <div className="mb-8 text-center border-b-2 border-[#8B0000] dark:border-[#ff6b6b] pb-4 pt-2">
                            <h1 className="font-cinzel font-bold text-2xl md:text-3xl text-[#8B0000] dark:text-[#ff6b6b] uppercase tracking-widest drop-shadow-sm">
                                PANORÂMA BÍBLICO - {content.book} {content.chapter}
                            </h1>
                        </div>
                     )}
                     
                     <div className="space-y-6">
                        {renderFormattedText(pages[currentPage])}
                     </div>
                     
                     {/* Paginação */}
                     <div className="absolute bottom-4 right-8 text-[#C5A059] font-cinzel text-sm">
                        {currentPage + 1} / {pages.length}
                     </div>

                     {/* Botão de Conclusão na Última Página */}
                     {currentPage === pages.length - 1 && userProgress && (
                         <div className="mt-12 text-center">
                             <button
                                onClick={handleMarkAsRead}
                                disabled={isRead}
                                className={`px-8 py-4 rounded-full font-cinzel font-bold text-lg shadow-lg flex items-center justify-center gap-2 mx-auto transition-all transform hover:scale-105 ${
                                    isRead 
                                    ? 'bg-green-600 text-white cursor-default'
                                    : 'bg-gradient-to-r from-[#C5A059] to-[#8B0000] text-white hover:shadow-xl animate-pulse'
                                }`}
                             >
                                 {isRead ? <CheckCircle className="w-6 h-6" /> : <GraduationCap className="w-6 h-6" />}
                                 {isRead ? 'ESTUDO CONCLUÍDO' : 'CONCLUIR ESTUDO'}
                             </button>
                             {isRead && <p className="text-xs text-green-600 mt-2 font-bold">Registrado no Ranking de EBD</p>}
                         </div>
                     )}
                </div>
            ) : (
                <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                    <Book className="w-16 h-16 mx-auto mb-4 text-[#C5A059] opacity-50"/>
                    <p className="font-cinzel text-lg">Conteúdo em Preparação</p>
                    {isAdmin && <p className="text-sm mt-2 text-[#600018] dark:text-[#ff6b6b] animate-pulse">Use o Editor Chefe acima para gerar.</p>}
                </div>
            )}
        </div>

        {pages.length > 1 && hasAccess && !isEditing && (
            <div className="fixed bottom-16 left-0 w-full bg-white dark:bg-dark-card border-t border-[#C5A059] p-4 flex justify-between items-center z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] safe-bottom">
                <button 
                    onClick={() => setCurrentPage(Math.max(0, currentPage - 1))} 
                    disabled={currentPage === 0} 
                    className="flex items-center gap-1 px-4 py-3 bg-[#8B0000] text-white rounded-lg font-bold shadow-md hover:bg-[#600018] disabled:opacity-50 disabled:bg-gray-400 transition-all active:scale-95"
                >
                    <ChevronLeft /> Anterior
                </button>
                <span className="font-cinzel font-bold text-[#1a0f0f] dark:text-white text-sm md:text-base">
                    {currentPage + 1} / {pages.length}
                </span>
                <button 
                    onClick={() => setCurrentPage(Math.min(pages.length - 1, currentPage + 1))} 
                    disabled={currentPage === pages.length - 1} 
                    className="flex items-center gap-1 px-4 py-3 bg-[#8B0000] text-white rounded-lg font-bold shadow-md hover:bg-[#600018] disabled:opacity-50 disabled:bg-gray-400 transition-all active:scale-95"
                >
                    Próximo <ChevronRight />
                </button>
            </div>
        )}
    </div>
  );
}
