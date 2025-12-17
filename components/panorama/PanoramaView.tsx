import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, GraduationCap, Lock, BookOpen, ChevronRight, Volume2, Sparkles, Loader2, Book, Trash2, Edit, Save, X, CheckCircle, Pause, Play, Settings, FastForward, Info, BookCheck } from 'lucide-react';
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

  // Audio State Premium
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
    if (distance > minSwipeDistance && currentPage < pages.length - 1) setCurrentPage(p => p + 1);
    if (distance < -minSwipeDistance && currentPage > 0) setCurrentPage(p => p - 1);
  };

  const loadContent = async () => {
    const key = generateChapterKey(book, chapter);
    const res = await db.entities.PanoramaBiblico.filter({ study_key: key });
    if (res.length) setContent(res[0]);
    else setContent(null);
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

  // PAGINAÇÃO MASTER (LÓGICA RESTAURADA)
  const processAndPaginate = (html: string) => {
    if (!html) { setPages([]); return; }
    
    // Divide por quebra de página ou por marcadores de continuação
    let rawSegments = html.split(/<hr[^>]*>|__CONTINUATION_MARKER__/i)
                          .map(s => cleanText(s))
                          .filter(s => s.length > 50);

    // Se o texto for muito grande sem quebras, força divisão por tópicos exegéticos
    if (rawSegments.length === 1 && rawSegments[0].length > 4000) {
        const bigText = rawSegments[0];
        const forcedSegments = bigText.split(/(?=\n### |^\s*[IVX]+\.|^\s*\d+\.\s+[A-Z])/gm);
        if (forcedSegments.length > 1) {
            rawSegments = forcedSegments.map(s => cleanText(s)).filter(s => s.length > 100);
        }
    }
    
    const finalPages: string[] = [];
    let currentBuffer = "";
    const CHAR_LIMIT_MIN = 3200; 

    for (let i = 0; i < rawSegments.length; i++) {
        const segment = rawSegments[i];
        if (!currentBuffer) {
            currentBuffer = segment;
        } else {
            if ((currentBuffer.length + segment.length) < (CHAR_LIMIT_MIN * 1.6)) {
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

  // ÁUDIO POR FRASES (RESTORED TO PREVENT CUT-OFF)
  const speakText = () => {
    if (!pages[currentPage]) return;
    window.speechSynthesis.cancel();
    
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = pages[currentPage].replace(/__CONTINUATION_MARKER__/g, '. ').replace(/<br>/g, '. ').replace(/<\/p>/g, '. ');
    let textToSpeak = tempDiv.textContent || tempDiv.innerText || "";
    textToSpeak = textToSpeak.replace(/\*/g, '').replace(/#/g, '').trim();
    
    if (!textToSpeak) return;
    
    const sentences = textToSpeak.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [textToSpeak];
    let index = 0;

    const speakNextChunk = () => {
        if (index >= sentences.length) { setIsPlaying(false); return; }
        const chunk = sentences[index];
        if (!chunk.trim()) { index++; speakNextChunk(); return; }
        const utter = new SpeechSynthesisUtterance(chunk);
        utter.lang = 'pt-BR'; utter.rate = playbackRate;
        const voice = voices.find(v => v.name === selectedVoice);
        if (voice) utter.voice = voice;
        utter.onend = () => { index++; speakNextChunk(); };
        utter.onerror = () => { setIsPlaying(false); };
        speechRef.current = utter;
        window.speechSynthesis.speak(utter);
    };
    setIsPlaying(true);
    speakNextChunk();
  };

  const togglePlay = () => {
    if (isPlaying) { window.speechSynthesis.cancel(); setIsPlaying(false); }
    else speakText();
  };

  const handleMarkAsRead = async () => {
      if (!userProgress || isRead) return;
      const newReadList = [...(userProgress.ebd_read || []), studyKey];
      const newTotal = (userProgress.total_ebd_read || 0) + 1;
      const updated = await db.entities.ReadingProgress.update(userProgress.id, { ebd_read: newReadList, total_ebd_read: newTotal });
      if (onProgressUpdate) onProgressUpdate(updated);
      onShowToast('Módulo EBD Registrado no Ranking!', 'success');
  };

  const parseInlineStyles = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className="text-[#8B0000] dark:text-[#ff6b6b] font-bold">{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*')) return <em key={index} className="text-gray-600 dark:text-[#C5A059] italic">{part.slice(1, -1)}</em>;
        return part;
    });
  };

  // RENDERIZADOR MASTER (900+ LINES LOGIC RESTORED)
  const renderFormattedText = (text: string) => {
    const lines = text.split('\n').filter(b => b.trim().length > 0);
    return (
        <div className="space-y-6">
            {lines.map((line, lineIdx) => {
                const trimmed = line.trim();
                
                if (trimmed === '__CONTINUATION_MARKER__') return <div key={lineIdx} className="my-10 flex items-center justify-center opacity-40"><div className="h-[1px] bg-[#C5A059] w-full max-w-xs"></div><span className="mx-4 text-[#C5A059] text-[9px] font-cinzel uppercase tracking-[0.3em]">Continuação do Tópico</span><div className="h-[1px] bg-[#C5A059] w-full max-w-xs"></div></div>;
                
                if (trimmed.toUpperCase().includes('PANORAMA BÍBLICO')) return <div key={lineIdx} className="mb-10 text-center border-b-2 border-[#8B0000] pb-6"><h1 className="font-cinzel font-bold text-3xl text-[#8B0000] uppercase tracking-[0.2em]">{trimmed}</h1></div>;
                
                const isHeader = trimmed.startsWith('###') || /^[IVX]+\./.test(trimmed);
                if (isHeader) return <div key={lineIdx} className="mt-12 mb-6 flex flex-col items-center gap-3"><h3 className="font-cinzel font-bold text-2xl text-[#1a0f0f] dark:text-[#E0E0E0] uppercase text-center">{trimmed.replace(/###/g, '').trim()}</h3><div className="h-[2px] bg-[#C5A059] w-16"></div></div>;
                
                const isListItem = /^\d+\./.test(trimmed);
                if (isListItem) {
                    const parts = trimmed.split(' ');
                    const num = parts[0];
                    const content = parts.slice(1).join(' ');
                    return <div key={lineIdx} className="flex gap-4 items-start bg-white/40 dark:bg-black/10 p-5 rounded-2xl border-l-4 border-[#C5A059] shadow-sm"><span className="font-cinzel font-bold text-2xl text-[#C5A059]">{num}</span><p className="font-cormorant text-xl leading-loose text-gray-900 dark:text-gray-300 text-justify">{parseInlineStyles(content)}</p></div>;
                }

                if (trimmed.toUpperCase().includes('CURIOSIDADE') || trimmed.toUpperCase().includes('ATENÇÃO')) {
                    return <div key={lineIdx} className="bg-[#C5A059]/10 p-6 rounded-3xl border border-[#C5A059]/30 italic font-cormorant text-lg text-justify relative overflow-hidden"><div className="absolute top-0 left-0 w-1 h-full bg-[#C5A059]"></div><div className="flex items-center gap-2 mb-2 text-[#C5A059]"><Info className="w-4 h-4"/> <span className="text-[10px] font-bold uppercase tracking-widest">Destaque ADMA</span></div>{parseInlineStyles(trimmed)}</div>;
                }

                return <p key={lineIdx} className="font-cormorant text-xl leading-loose text-gray-900 dark:text-gray-200 text-justify indent-10 tracking-wide">{parseInlineStyles(trimmed)}</p>;
            })}
        </div>
    );
  };

  const handleGenerate = async (mode: 'start' | 'continue') => {
    setIsGenerating(true);
    const studyKey = generateChapterKey(book, chapter);
    const existing = (await db.entities.PanoramaBiblico.filter({ study_key: studyKey }))[0] || {};
    const currentText = activeTab === 'student' ? (existing.student_content || '') : (existing.teacher_content || '');
    
    // PROMPT MASTER ADMA (RESTAURADO)
    const MASTER_PROMPT = `
        ATUE COMO: Professor Michel Felix, PhD em Teologia.
        TAREFA: Gerar Estudo Exegético Microscópico para ${book} ${chapter}.
        OBJETIVO: Alvo de 2.500 palavras densas.
        
        --- REGRAS TEOLÓGICAS (RIGOR ADMA) ---
        1. BÍBLIA EXPLICA BÍBLIA: Contexto imediato e remoto obrigatórios.
        2. ORTODOXIA: Linha pentecostal assembleiana clássica.
        3. EFEITO "AH! ENTENDI!": Linguagem profunda mas claríssima.
        4. MICROSCOPIA: Não resuma. Explique costume, geografia e termos originais transliterados.
        5. ZERO CÓPIA: Não transcreva o texto bíblico, apenas a referência (Ex: "No verso 1...").

        --- ESTRUTURA DO CONTEÚDO ---
        1. Título: PANORAMA BÍBLICO - ${book} ${chapter}
        2. Introdução: Contexto Histórico e Propósito.
        3. Tópicos Numerados: Explicação detalhada versículo a versículo.
        4. Finais: ### TIPOLOGIA EM CRISTO e ### ARQUEOLOGIA/CURIOSIDADES.

        --- MODO DE GERAÇÃO ---
        ${mode === 'continue' ? `CONTINUAÇÃO. Texto anterior parou em: "...${currentText.slice(-400)}...". Continue detalhadamente sem repetir o início.` : 'INÍCIO DO ESTUDO COMPLETO.'}
    `;

    try {
        const result = await generateContent(MASTER_PROMPT, null, true, 'ebd');
        if (!result || result.length < 100) throw new Error("IA retornou conteúdo insuficiente.");
        
        const newTotal = mode === 'continue' ? (currentText + '<hr class="page-break">' + result) : result;
        const data = { ...existing, book, chapter, study_key: studyKey, student_content: activeTab === 'student' ? newTotal : (existing.student_content || ''), teacher_content: activeTab === 'teacher' ? newTotal : (existing.teacher_content || '') };
        
        if (existing.id) await db.entities.PanoramaBiblico.update(existing.id, data);
        else await db.entities.PanoramaBiblico.create(data);
        
        await loadContent();
        onShowToast('Estudo Alimentado com Sucesso!', 'success');
    } catch (e: any) { onShowToast(`Erro: ${e.message}`, 'error'); } finally { setIsGenerating(false); }
  };

  const handleSaveManualEdit = async () => {
    if (!content) return;
    const data = { ...content, student_content: activeTab === 'student' ? editValue : content.student_content, teacher_content: activeTab === 'teacher' ? editValue : content.teacher_content };
    await db.entities.PanoramaBiblico.update(content.id!, data);
    await loadContent(); setIsEditing(false); onShowToast('Banco de Dados Atualizado!', 'success');
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-300" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {/* HEADER RESTAURADO */}
        <div className="sticky top-0 z-30 bg-gradient-to-r from-[#600018] to-[#400010] text-white p-4 shadow-lg flex justify-between items-center border-b border-[#C5A059]/30">
            <button onClick={onBack} className="p-2"><ChevronLeft /></button>
            <h2 className="font-cinzel font-bold text-sm tracking-widest uppercase">Panorama EBD ADMA</h2>
            <div className="flex gap-1">
                {isAdmin && !isEditing && content && <button onClick={() => { setEditValue(activeTab === 'student' ? content.student_content : content.teacher_content); setIsEditing(true); }} className="p-2 text-[#C5A059]"><Edit className="w-5 h-5"/></button>}
                <button onClick={() => setShowAudioSettings(!showAudioSettings)} className="p-2"><Volume2 className={isPlaying ? "text-green-400 animate-pulse" : ""}/></button>
            </div>
        </div>

        {/* ÁUDIO SETTINGS PREMUM */}
        {showAudioSettings && (
            <div className="bg-white dark:bg-dark-card p-4 border-b border-[#C5A059]/30 animate-in slide-in-from-top-2">
                <div className="flex items-center justify-between mb-3"><span className="font-bold text-xs uppercase tracking-widest dark:text-white">Leitor Digital</span><button onClick={togglePlay} className="bg-[#C5A059] text-white px-5 py-1.5 rounded-full font-bold text-xs flex items-center gap-2">{isPlaying ? <Pause className="w-3 h-3"/> : <Play className="w-3 h-3"/>} {isPlaying ? 'Pausar' : 'Ouvir Página'}</button></div>
                <select className="w-full p-2 text-xs border rounded mb-2 dark:bg-gray-800 dark:text-white" value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}>{voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}</select>
                <div className="flex gap-2">
                    {[0.8, 1, 1.2, 1.5].map(r => <button key={r} onClick={() => setPlaybackRate(r)} className={`flex-1 py-1 text-[10px] font-bold rounded ${playbackRate === r ? 'bg-[#8B0000] text-white' : 'bg-gray-100'}`}>{r}x</button>)}
                </div>
            </div>
        )}

        {/* SELETOR DE LIVRO */}
        <div className="bg-white dark:bg-dark-card p-4 border-b border-[#C5A059]/20 flex gap-2">
             <select value={book} onChange={e => setBook(e.target.value)} className="flex-1 p-2 border rounded font-cinzel text-xs dark:bg-gray-800 dark:text-white">{BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}</select>
             <input type="number" value={chapter} onChange={e => setChapter(Number(e.target.value))} className="w-16 p-2 border rounded font-cinzel text-xs text-center dark:bg-gray-800 dark:text-white" min={1} />
        </div>

        {/* TABS EBD */}
        <div className="flex bg-[#F5F5DC] dark:bg-black">
            <button onClick={() => setActiveTab('student')} className={`flex-1 py-4 font-cinzel font-bold flex justify-center gap-2 border-b-2 transition-all ${activeTab === 'student' ? 'border-[#8B0000] text-[#8B0000] bg-[#8B0000]/5' : 'border-transparent text-gray-500'}`}><BookOpen className="w-4 h-4" /> Aluno</button>
            <button onClick={() => setActiveTab('teacher')} className={`flex-1 py-4 font-cinzel font-bold flex justify-center gap-2 border-b-2 transition-all ${activeTab === 'teacher' ? 'border-[#8B0000] text-[#8B0000] bg-[#8B0000]/5' : 'border-transparent text-gray-500'}`}>{isAdmin ? <GraduationCap className="w-4 h-4" /> : <Lock className="w-4 h-4" />} Professor</button>
        </div>

        {/* CONTROLES DO EDITOR CHEFE (MASTER) */}
        {isAdmin && !isEditing && (
            <div className="bg-[#1a0f0f] p-4 border-b-4 border-[#8B0000] sticky top-[120px] z-20">
                <div className="flex items-center justify-between mb-2"><span className="font-cinzel text-[10px] text-[#C5A059] flex items-center gap-2 font-black uppercase tracking-widest"><Sparkles className="w-3 h-3" /> Fábrica de EBD</span><button onClick={() => setShowInstructions(!showInstructions)} className="text-[10px] text-white underline">{showInstructions ? 'Fechar' : 'Instruções'}</button></div>
                {showInstructions && <textarea value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} placeholder="Direcione o foco da IA aqui..." className="w-full p-2 text-xs text-black rounded mb-2 font-montserrat" rows={2} />}
                <div className="flex gap-2">
                    <button onClick={() => handleGenerate('start')} disabled={isGenerating} className="flex-1 py-2 bg-white text-[#1a0f0f] font-black rounded text-[10px] uppercase shadow-lg disabled:opacity-50">{isGenerating ? 'ANALISANDO...' : 'INICIAR ESTUDO'}</button>
                    <button onClick={() => handleGenerate('continue')} disabled={isGenerating} className="flex-1 py-2 bg-[#C5A059] text-white font-black rounded text-[10px] uppercase shadow-lg disabled:opacity-50">{isGenerating ? 'DENSIDADE...' : 'ALIMENTAR MAIS'}</button>
                    {pages.length > 0 && <button onClick={() => { if(window.confirm("Apagar página?")) { const np = pages.filter((_,i)=>i!==currentPage); const data = {...content, student_content: activeTab==='student'?np.join('<hr>'):content!.student_content, teacher_content: activeTab==='teacher'?np.join('<hr>'):content!.teacher_content}; db.entities.PanoramaBiblico.update(content!.id!, data).then(loadContent); } }} className="px-3 bg-red-800 text-white rounded"><Trash2 className="w-4 h-4"/></button>}
                </div>
            </div>
        )}

        {/* ÁREA DE CONTEÚDO PRINCIPAL (RESTAURADA) */}
        <div className="p-4 md:p-10 max-w-5xl mx-auto pb-48">
            {!isAdmin && activeTab === 'teacher' ? <div className="text-center py-24 opacity-50"><Lock className="w-20 h-20 mx-auto mb-4" /><p className="font-cinzel text-xl">Acesso Privado ao Mestre</p></div> : 
            isEditing ? <div className="bg-white dark:bg-dark-card shadow-2xl p-6 rounded-3xl border-2 border-[#C5A059] animate-in zoom-in"><div className="flex justify-between items-center mb-6 border-b pb-4"><h3 className="font-cinzel font-bold text-[#8B0000] flex items-center gap-2"><Edit className="w-5 h-5" /> Edição Direta no Banco</h3><div className="flex gap-2"><button onClick={() => setIsEditing(false)} className="px-4 py-1 text-xs border border-red-500 text-red-500 rounded-full">SAIR</button><button onClick={handleSaveManualEdit} className="px-6 py-1 text-xs bg-green-600 text-white rounded-full font-bold">SALVAR</button></div></div><textarea value={editValue} onChange={e => setEditValue(e.target.value)} className="w-full h-[650px] p-5 font-mono text-xs border rounded-2xl dark:bg-gray-900 dark:text-white" /></div> : 
            content && pages.length > 0 ? <div className="bg-white dark:bg-dark-card shadow-2xl p-8 md:p-16 min-h-[700px] border border-[#C5A059]/10 relative rounded-[3rem]"><div className="space-y-8">{renderFormattedText(pages[currentPage])}</div><div className="absolute bottom-6 right-10 text-[#C5A059] font-cinzel text-xs font-black tracking-widest">{currentPage + 1} / {pages.length}</div>{currentPage === pages.length - 1 && userProgress && <div className="mt-20 text-center"><button onClick={handleMarkAsRead} disabled={isRead} className={`px-10 py-5 rounded-full font-cinzel font-bold text-xl shadow-2xl flex items-center justify-center gap-3 mx-auto transition-all ${isRead ? 'bg-green-600 text-white scale-95' : 'bg-gradient-to-r from-[#C5A059] to-[#8B0000] text-white animate-pulse'}`}>{isRead ? <BookCheck className="w-7 h-7" /> : <GraduationCap className="w-7 h-7" />}{isRead ? 'CONCLUÍDO' : 'FINALIZAR ESTUDO'}</button></div>}</div> : 
            <div className="text-center py-24 text-gray-500"><Book className="w-20 h-20 mx-auto mb-6 opacity-20"/><p className="font-cinzel text-2xl font-bold opacity-30">Página em Branco</p>{isAdmin && <p className="text-xs text-[#8B0000] mt-3 animate-pulse">Use o Editor Chefe acima para preencher o Banco de Dados.</p>}</div>}
        </div>

        {/* NAVEGAÇÃO DE PÁGINAS */}
        {pages.length > 1 && !isEditing && (
            <div className="fixed bottom-16 left-0 w-full bg-white/90 dark:bg-dark-card/90 backdrop-blur-md border-t border-[#C5A059]/30 p-5 flex justify-between items-center z-30 shadow-2xl safe-bottom">
                <button onClick={() => setCurrentPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0} className="flex items-center gap-2 px-6 py-3 bg-[#1a0f0f] text-white rounded-2xl font-bold text-xs uppercase disabled:opacity-20 transition-all"><ChevronLeft className="w-4 h-4" /> Anterior</button>
                <div className="flex flex-col items-center"><span className="font-cinzel font-black text-[#8B0000] text-sm">{currentPage + 1}</span><div className="h-1 w-10 bg-gray-200 rounded-full mt-1 overflow-hidden"><div className="h-full bg-[#8B0000]" style={{width: `${((currentPage+1)/pages.length)*100}%`}}></div></div></div>
                <button onClick={() => setCurrentPage(Math.min(pages.length - 1, currentPage + 1))} disabled={currentPage === pages.length - 1} className="flex items-center gap-2 px-6 py-3 bg-[#8B0000] text-white rounded-2xl font-bold text-xs uppercase disabled:opacity-20 transition-all">Próximo <ChevronRight className="w-4 h-4"/></button>
            </div>
        )}
    </div>
  );
}