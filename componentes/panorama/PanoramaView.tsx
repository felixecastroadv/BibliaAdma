
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, GraduationCap, Lock, BookOpen, ChevronRight, Volume2, Sparkles, Loader2, Book, Trash2, Edit, Save, X, CheckCircle, Pause, Play, FastForward } from 'lucide-react';
import { db } from '../../serviços/database';
import { BIBLE_BOOKS, generateChapterKey } from '../../constantes';
import { EBDContent } from '../../tipos';
import { generateContent } from '../../serviços/geminiService';

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
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [playbackRate, setPlaybackRate] = useState(1);

  const studyKey = generateChapterKey(book, chapter);
  const isRead = userProgress?.ebd_read?.includes(studyKey);

  useEffect(() => { loadContent(); }, [book, chapter]);

  useEffect(() => {
    const loadVoices = () => {
        let available = window.speechSynthesis.getVoices().filter(v => v.lang.includes('pt'));
        setVoices(available);
        if(available.length > 0 && !selectedVoice) setSelectedVoice(available[0].name);
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

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
    } else {
        setPages([]);
    }
  }, [activeTab, content]);

  const processAndPaginate = (html: string) => {
    if (!html) { setPages([]); return; }
    const rawSegments = html.split(/<hr[^>]*>|__CONTINUATION_MARKER__/i).filter(s => s.trim().length > 10);
    setPages(rawSegments.length > 0 ? rawSegments : [html]);
  };

  const togglePlay = () => {
    if (isPlaying) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
    } else {
        if (!pages[currentPage]) return;
        const text = pages[currentPage].replace(/<[^>]*>/g, '').replace(/\*/g, '');
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'pt-BR';
        utter.rate = playbackRate;
        const voice = voices.find(v => v.name === selectedVoice);
        if (voice) utter.voice = voice;
        utter.onend = () => setIsPlaying(false);
        window.speechSynthesis.speak(utter);
        setIsPlaying(true);
    }
  };

  const handleGenerate = async (mode: 'start' | 'continue') => {
    setIsGenerating(true);
    const target = activeTab;
    const studyKey = generateChapterKey(book, chapter);
    const existing = (await db.entities.PanoramaBiblico.filter({ study_key: studyKey }))[0] || {};
    const currentText = target === 'student' ? (existing.student_content || '') : (existing.teacher_content || '');

    const prompt = `GERE ESTUDO EBD: ${book} ${chapter}. MODO: ${mode}. PERSONAGEM: PROF. MICHEL FELIX. ESTRUTURA: PANORAMAVIEW MICROSCOPIA. ${customInstructions}`;

    try {
        const result = await generateContent(prompt);
        const separator = mode === 'continue' ? '<hr class="page-break">' : '';
        const newTotal = mode === 'continue' ? (currentText + separator + result) : result;
        
        const data = {
            book, chapter, study_key: studyKey,
            title: `Estudo de ${book} ${chapter}`,
            student_content: target === 'student' ? newTotal : (existing.student_content || ''),
            teacher_content: target === 'teacher' ? newTotal : (existing.teacher_content || ''),
        };

        if (existing.id) await db.entities.PanoramaBiblico.update(existing.id, data);
        else await db.entities.PanoramaBiblico.create(data);

        await loadContent();
        onShowToast('Conteúdo gerado com sucesso!', 'success');
    } catch (e: any) {
        onShowToast(`Erro: ${e.message}`, 'error');
    } finally {
        setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col text-white">
        {/* Header - Conforme o print */}
        <div className="bg-[#400010] p-4 flex items-center justify-between border-b border-white/5">
            <button onClick={onBack} className="p-1"><ChevronLeft className="w-6 h-6"/></button>
            <h2 className="font-cinzel font-bold text-lg tracking-widest uppercase">Panorama EBD</h2>
            <div className="flex gap-4">
                <button onClick={() => setIsEditing(!isEditing)}><Edit className="w-5 h-5 text-[#C5A059]"/></button>
                <button onClick={togglePlay}><Volume2 className={`w-6 h-6 ${isPlaying ? 'text-green-400' : 'text-white'}`}/></button>
            </div>
        </div>

        {/* Selection Area - Conforme o print */}
        <div className="p-3 bg-[#1e1e1e] flex gap-2">
            <div className="flex-1 relative">
                <select 
                    value={book.toUpperCase()} 
                    onChange={e => setBook(e.target.value)} 
                    className="w-full bg-transparent border border-gray-600 rounded p-2 font-cinzel text-sm appearance-none outline-none"
                >
                    {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name.toUpperCase()} className="bg-[#1e1e1e]">{b.name.toUpperCase()}</option>)}
                </select>
                <ChevronRight className="absolute right-2 top-2.5 w-4 h-4 text-gray-500 rotate-90" />
            </div>
            <input 
                type="number" 
                value={chapter} 
                onChange={e => setChapter(Number(e.target.value))} 
                className="w-20 bg-transparent border border-gray-600 rounded p-2 text-center font-cinzel text-sm outline-none"
            />
        </div>

        {/* Tabs - Conforme o print (Cores específicas) */}
        <div className="flex">
            <button 
                onClick={() => setActiveTab('student')}
                className={`flex-1 py-4 font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'student' ? 'bg-[#8B0000] text-white' : 'bg-transparent text-gray-400 border-b border-white/5'}`}
            >
                <BookOpen className="w-5 h-5" /> ALUNO
            </button>
            <button 
                onClick={() => setActiveTab('teacher')}
                className={`flex-1 py-4 font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'teacher' ? 'bg-black text-white' : 'bg-transparent text-gray-400 border-b border-white/5'}`}
            >
                <GraduationCap className="w-5 h-5" /> PROFESSOR
            </button>
        </div>

        {/* Editor Chefe Section - Conforme o print */}
        {isAdmin && (
            <div className="bg-[#151515] p-4 border-b border-[#8B0000]/30">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#C5A059]" />
                        <span className="text-[#C5A059] font-bold text-xs uppercase tracking-wider">Editor Chefe ({activeTab === 'student' ? 'Student' : 'Teacher'})</span>
                    </div>
                    <button onClick={() => setShowInstructions(!showInstructions)} className="text-[#C5A059] text-xs underline decoration-[#C5A059]/50">
                        Adicionar Instruções
                    </button>
                </div>
                
                {showInstructions && (
                    <textarea 
                        value={customInstructions} 
                        onChange={e => setCustomInstructions(e.target.value)} 
                        placeholder="Instruções adicionais para a IA..."
                        className="w-full bg-black/40 border border-gray-700 rounded p-2 text-xs mb-3 outline-none"
                    />
                )}

                <div className="flex gap-3">
                    <button 
                        onClick={() => handleGenerate('start')}
                        disabled={isGenerating}
                        className="flex-1 bg-[#C5A059] text-black font-bold py-3 rounded-lg text-xs uppercase tracking-tight hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {isGenerating ? 'Processando...' : 'INÍCIO (Padrão EBD)'}
                    </button>
                    <button 
                        onClick={() => handleGenerate('continue')}
                        disabled={isGenerating}
                        className="flex-1 bg-[#C5A059] text-black font-bold py-3 rounded-lg text-xs uppercase tracking-tight hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {isGenerating ? 'Processando...' : 'CONTINUAR (+ Conteúdo)'}
                    </button>
                </div>
            </div>
        )}

        {/* Content Body - Conforme o print (Empty State) */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-black">
            {pages.length > 0 ? (
                <div className="w-full max-w-2xl prose prose-invert animate-in fade-in duration-500">
                    <div dangerouslySetInnerHTML={{ __html: pages[currentPage] }} />
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="w-24 h-32 border-4 border-[#C5A059]/30 rounded-lg mx-auto flex items-center justify-center relative">
                        <div className="w-16 h-1 bg-[#C5A059]/30 absolute bottom-4 rounded"></div>
                        <Book className="w-12 h-12 text-[#C5A059]/30" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="font-cinzel text-xl font-bold tracking-widest text-gray-500 uppercase">Conteúdo em Preparação</h3>
                        <p className="text-sm text-[#8B0000] font-bold">Use o Editor Chefe acima para gerar.</p>
                    </div>
                </div>
            )}
        </div>
        
        {/* Page Nav */}
        {pages.length > 1 && (
            <div className="p-4 bg-black flex justify-between items-center text-xs border-t border-white/5">
                <button onClick={() => setCurrentPage(p => Math.max(0, p-1))} disabled={currentPage === 0} className="p-2 disabled:opacity-30"><ChevronLeft/></button>
                <span className="font-cinzel">{currentPage + 1} / {pages.length}</span>
                <button onClick={() => setCurrentPage(p => Math.min(pages.length-1, p+1))} disabled={currentPage === pages.length-1} className="p-2 disabled:opacity-30"><ChevronRight/></button>
            </div>
        )}
    </div>
  );
}
