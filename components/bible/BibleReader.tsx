import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Settings, Type, Play, Pause, CheckCircle, ChevronRight, List, Book, ChevronDown, RefreshCw, WifiOff, Zap, Volume2, X, FastForward, Search, Trash2, Sparkles, Loader2, Clock, Lock } from 'lucide-react';
import VersePanel from './VersePanel';
import { db } from '../../services/database';
import { generateChapterKey, BIBLE_BOOKS } from '../../constants';
import { generateContent } from '../../services/geminiService';
import { ChapterMetadata } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

const BIBLE_CATEGORIES = [
    { id: 'ot_law', name: 'Pentateuco (Lei)', color: 'text-blue-600', books: ['Gênesis', 'Êxodo', 'Levítico', 'Números', 'Deuteronômio'] },
    { id: 'ot_history', name: 'Históricos', color: 'text-green-600', books: ['Josué', 'Juízes', 'Rute', '1 Samuel', '2 Samuel', '1 Reis', '2 Reis', '1 Crônicas', '2 Crônicas', 'Esdras', 'Neemias', 'Ester'] },
    { id: 'ot_poetry', name: 'Poéticos', color: 'text-purple-600', books: ['Jó', 'Salmos', 'Provérbios', 'Eclesiastes', 'Cantares'] },
    { id: 'ot_prophets', name: 'Profetas', color: 'text-orange-600', books: ['Isaías', 'Jeremias', 'Lamentações', 'Ezequiel', 'Daniel', 'Oséias', 'Joel', 'Amós', 'Obadias', 'Jonas', 'Miquéias', 'Naum', 'Habacuque', 'Sofonias', 'Ageu', 'Zacarias', 'Malaquias'] },
    { id: 'nt_gospels', name: 'Evangelhos & Atos', color: 'text-red-600', books: ['Mateus', 'Marcos', 'Lucas', 'João', 'Atos'] },
    { id: 'nt_paul', name: 'Epístolas Paulinas', color: 'text-indigo-600', books: ['Romanos', '1 Coríntios', '2 Coríntios', 'Gálatas', 'Efésios', 'Filipenses', 'Colossenses', '1 Tessalonicenses', '2 Tessalonicenses', '1 Timóteo', '2 Timóteo', 'Tito', 'Filemom'] },
    { id: 'nt_general', name: 'Gerais & Apocalipse', color: 'text-teal-600', books: ['Hebreus', 'Tiago', '1 Pedro', '2 Pedro', '1 João', '2 João', '3 João', 'Judas', 'Apocalipse'] }
];

const PremiumNavigator = ({ isOpen, onClose, currentBook, onSelect }: any) => {
    const [selectedBook, setSelectedBook] = useState<string>(currentBook);
    const [searchTerm, setSearchTerm] = useState('');
    const activeBookData = BIBLE_BOOKS.find(b => b.name === selectedBook);
    const filteredCategories = searchTerm.trim() === '' ? BIBLE_CATEGORIES : BIBLE_CATEGORIES.map(cat => ({
        ...cat, books: cat.books.filter(b => b.toLowerCase().includes(searchTerm.toLowerCase()))
    })).filter(cat => cat.books.length > 0);

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#FDFBF7] dark:bg-[#121212] w-full max-w-4xl h-[85vh] md:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-[#C5A059]/30">
                <div className="bg-[#1a0f0f] text-white p-5 flex items-center justify-between border-b border-[#C5A059]/50">
                    <h2 className="font-cinzel font-bold text-xl text-[#C5A059]">NAVEGAÇÃO BÍBLICA</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all"><X/></button>
                </div>
                <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                    <div className="w-full md:w-1/3 border-r border-[#C5A059]/20 bg-[#F5F5DC]/50 dark:bg-black/20 flex flex-col">
                        <div className="p-4 bg-white dark:bg-[#1E1E1E]"><input type="text" placeholder="Buscar livro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm focus:ring-2 focus:ring-[#C5A059] outline-none dark:text-white"/></div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {filteredCategories.map(cat => (
                                <div key={cat.id}>
                                    <h3 className={`font-cinzel font-bold text-xs uppercase tracking-widest mb-3 ${cat.color}`}>{cat.name}</h3>
                                    <div className="space-y-1">
                                        {cat.books.map(b => (
                                            <button key={b} onClick={() => setSelectedBook(b)} className={`w-full text-left px-4 py-2 rounded-xl text-sm font-bold ${selectedBook === b ? 'bg-[#C5A059] text-white shadow-lg' : 'text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-white/5'}`}>{b}</button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="w-full md:w-2/3 bg-white dark:bg-[#1E1E1E] flex flex-col p-6 overflow-y-auto">
                        <h2 className="font-cinzel text-3xl font-bold text-[#8B0000] dark:text-[#ff6b6b] mb-4 text-center">{selectedBook}</h2>
                        <div className="grid grid-cols-5 md:grid-cols-8 gap-3">
                            {Array.from({ length: activeBookData?.chapters || 0 }, (_, i) => i + 1).map(chap => (
                                <button key={chap} onClick={() => { onSelect(selectedBook, chap); onClose(); }} className="aspect-square rounded-xl border border-[#C5A059]/20 flex items-center justify-center font-bold hover:bg-[#8B0000] hover:text-white transition-all">{chap}</button>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default function BibleReader({ onBack, isAdmin, onShowToast, initialBook, initialChapter, userProgress, onProgressUpdate }: any) {
    const [book, setBook] = useState(initialBook || 'Gênesis');
    const [chapter, setChapter] = useState(initialChapter || 1);
    const [verses, setVerses] = useState<{number: number, text: string}[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSelector, setShowSelector] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [fontSize, setFontSize] = useState(20); 
    const [selectedVerse, setSelectedVerse] = useState<{text: string, number: number} | null>(null);
    const [metadata, setMetadata] = useState<ChapterMetadata | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<string>('');
    const [playbackRate, setPlaybackRate] = useState(1);
    const [readingTimer, setReadingTimer] = useState(0);

    const chapterKey = generateChapterKey(book, chapter);
    const isRead = userProgress?.chapters_read?.includes(chapterKey);
    const isLocked = !isRead && readingTimer > 0;

    useEffect(() => {
        const loadVoices = () => {
            const v = window.speechSynthesis.getVoices().filter(voice => voice.lang.includes('pt'));
            setVoices(v);
            if(v.length > 0 && !selectedVoice) setSelectedVoice(v[0].name);
        };
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }, []);

    useEffect(() => {
        window.scrollTo(0, 0);
        fetchChapter();
        loadMetadata();
        setReadingTimer(isRead ? 0 : 40);
    }, [book, chapter]);

    useEffect(() => {
        let interval: any;
        if (readingTimer > 0 && !isRead) interval = setInterval(() => setReadingTimer(prev => prev - 1), 1000);
        return () => clearInterval(interval);
    }, [readingTimer, isRead]);

    const fetchChapter = async () => {
        setLoading(true);
        const bookMeta = BIBLE_BOOKS.find(b => b.name === book);
        const cacheKey = `bible_acf_${bookMeta?.abbrev}_${chapter}`;
        const cached = await db.entities.BibleChapter.getOffline(cacheKey);
        if (cached) {
            setVerses(cached.map((t: string, i: number) => ({ number: i + 1, text: t })));
        } else {
            try {
                const res = await fetch(`https://www.abibliadigital.com.br/api/verses/acf/${bookMeta?.abbrev}/${chapter}`);
                const data = await res.json();
                const vTexts = data.verses.map((v: any) => v.text);
                await db.entities.BibleChapter.saveUniversal(cacheKey, vTexts);
                setVerses(data.verses);
            } catch (e) { onShowToast("Erro de rede.", "error"); }
        }
        setLoading(false);
    };

    const loadMetadata = async () => {
        const meta = await db.entities.ChapterMetadata.get(chapterKey);
        setMetadata(meta || null);
    };

    const generateMetadata = async () => {
        onShowToast("Gerando epígrafe...", "info");
        const prompt = `Gere epígrafe para ${book} ${chapter} em pt-BR. JSON: { "title": "...", "subtitle": "..." }. Estilo clássico.`;
        const res = await generateContent(prompt, { properties: { title: { type: 'STRING' }, subtitle: { type: 'STRING' } } });
        const data = { chapter_key: chapterKey, title: res.title, subtitle: res.subtitle };
        await db.entities.ChapterMetadata.save(data);
        setMetadata(data);
        onShowToast("Epígrafe salva!", "success");
    };

    const togglePlay = () => {
        if (isPlaying) { window.speechSynthesis.cancel(); setIsPlaying(false); }
        else {
            const text = `${book} ${chapter}. ${verses.map(v => v.text).join(' ')}`;
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = 'pt-BR'; utter.rate = playbackRate;
            const v = voices.find(vo => vo.name === selectedVoice);
            if (v) utter.voice = v;
            utter.onend = () => setIsPlaying(false);
            window.speechSynthesis.speak(utter);
            setIsPlaying(true);
        }
    };

    const toggleRead = async () => {
        if (isLocked) { onShowToast(`Aguarde ${readingTimer}s para confirmar leitura.`, "info"); return; }
        const newRead = isRead ? userProgress.chapters_read.filter((k: string) => k !== chapterKey) : [...userProgress.chapters_read, chapterKey];
        const updated = await db.entities.ReadingProgress.update(userProgress.id, { chapters_read: newRead, total_chapters: newRead.length, last_book: book, last_chapter: chapter });
        onProgressUpdate(updated);
        onShowToast(isRead ? "Removido" : "Capítulo concluído!", "success");
    };

    return (
        <div className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors">
            <div className="sticky top-0 z-30 bg-[#8B0000]/90 dark:bg-black/80 backdrop-blur-xl text-white p-3 flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-2">
                    <button onClick={onBack} className="p-2"><ChevronLeft /></button>
                    <div onClick={() => setShowSelector(true)} className="cursor-pointer">
                        <h1 className="font-cinzel font-bold text-lg flex items-center gap-1">{book} {chapter} <ChevronDown className="w-4 h-4 text-[#C5A059]" /></h1>
                        <span className="text-[9px] uppercase opacity-70">Almeida Corrigida</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={togglePlay}>{isPlaying ? <Pause className="text-[#C5A059]" /> : <Play />}</button>
                    <button onClick={toggleRead} className={isRead ? "text-green-400" : "opacity-50"}>{isLocked ? <span className="text-xs">{readingTimer}s</span> : <CheckCircle />}</button>
                    <button onClick={() => setShowSettings(!showSettings)}><Settings /></button>
                </div>
            </div>

            {showSettings && (
                <div className="bg-white dark:bg-dark-card p-6 border-b border-[#C5A059] shadow-xl animate-in slide-in-from-top-2">
                    <div className="max-w-lg mx-auto space-y-6">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-sm">TAMANHO DA LETRA</span>
                            <div className="flex gap-4 items-center">
                                <button onClick={() => setFontSize(Math.max(14, fontSize - 2))} className="w-8 h-8 rounded-full border">-</button>
                                <span className="font-bold">{fontSize}</span>
                                <button onClick={() => setFontSize(Math.min(32, fontSize + 2))} className="w-8 h-8 rounded-full border">+</button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold">VOZ DE LEITURA</label>
                            <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-800">
                                {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            )}

            <PremiumNavigator isOpen={showSelector} onClose={() => setShowSelector(false)} currentBook={book} onSelect={(b: string, c: number) => { setBook(b); setChapter(c); }} />

            <div className="p-6 max-w-3xl mx-auto pb-32">
                {loading ? <div className="text-center py-20 animate-pulse font-cinzel">Carregando Escrituras...</div> : (
                    <>
                        <div className="text-center mb-12">
                            <h1 className="font-cinzel text-5xl font-bold text-[#8B0000] dark:text-[#ff6b6b] mb-4">{book} <span className="text-[#C5A059]">{chapter}</span></h1>
                            {metadata ? (
                                <div className="space-y-1">
                                    <h2 className="font-cinzel text-xs font-bold text-[#C5A059] uppercase tracking-[0.2em]">{metadata.title}</h2>
                                    <p className="font-cormorant text-xl text-gray-500 italic">"{metadata.subtitle}"</p>
                                </div>
                            ) : isAdmin && <button onClick={generateMetadata} className="text-xs underline text-[#C5A059]">Gerar Epígrafe</button>}
                        </div>
                        <div className="space-y-2">
                            {verses.map(v => (
                                <div key={v.number} onClick={() => setSelectedVerse(v)} className="flex gap-4 p-2 rounded-xl hover:bg-[#C5A059]/10 cursor-pointer transition-colors">
                                    <span className="font-cinzel text-xs text-[#8B0000] pt-1 w-6 shrink-0">{v.number}</span>
                                    <p className="font-cormorant text-justify leading-relaxed" style={{ fontSize: `${fontSize}px` }}>{v.text}</p>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            <VersePanel isOpen={!!selectedVerse} onClose={() => setSelectedVerse(null)} verse={selectedVerse?.text || ''} verseNumber={selectedVerse?.number || 1} book={book} chapter={chapter} isAdmin={isAdmin} onShowToast={onShowToast} userProgress={userProgress} />
        </div>
    );
}
