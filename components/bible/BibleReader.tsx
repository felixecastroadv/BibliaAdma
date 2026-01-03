
import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Settings, Type, Play, Pause, CheckCircle, ChevronRight, Book, ChevronDown, Search, Sparkles, Loader2, Clock, Lock } from 'lucide-react';
import VersePanel from './VersePanel';
import { db } from '../../services/database';
import { generateChapterKey, BIBLE_BOOKS } from '../../constants';
import { generateContent } from '../../services/geminiService';
import { ChapterMetadata } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

const BIBLE_CATEGORIES = [
    { id: 'ot_law', name: 'Pentateuco (Lei)', color: 'text-blue-600 dark:text-blue-400', books: ['Gênesis', 'Êxodo', 'Levítico', 'Números', 'Deuteronômio'] },
    { id: 'ot_history', name: 'Históricos (AT)', color: 'text-green-600 dark:text-green-400', books: ['Josué', 'Juízes', 'Rute', '1 Samuel', '2 Samuel', '1 Reis', '2 Reis', '1 Crônicas', '2 Crônicas', 'Esdras', 'Neemias', 'Ester'] },
    { id: 'ot_poetry', name: 'Poéticos & Sabedoria', color: 'text-purple-600 dark:text-purple-400', books: ['Jó', 'Salmos', 'Provérbios', 'Eclesiastes', 'Cantares'] },
    { id: 'ot_prophets', name: 'Profetas', color: 'text-orange-600 dark:text-orange-400', books: ['Isaías', 'Jeremias', 'Lamentações', 'Ezequiel', 'Daniel', 'Oséias', 'Joel', 'Amós', 'Obadias', 'Jonas', 'Miquéias', 'Naum', 'Habacuque', 'Sofonias', 'Ageu', 'Zacarias', 'Malaquias'] },
    { id: 'nt_gospels', name: 'Evangelhos & Atos', color: 'text-red-600 dark:text-red-400', books: ['Mateus', 'Marcos', 'Lucas', 'João', 'Atos'] },
    { id: 'nt_paul', name: 'Cartas de Paulo', color: 'text-indigo-600 dark:text-indigo-400', books: ['Romanos', '1 Coríntios', '2 Coríntios', 'Gálatas', 'Efésios', 'Filipenses', 'Colossenses', '1 Tessalonicenses', '2 Tessalonicenses', '1 Timóteo', '2 Timóteo', 'Tito', 'Filemom'] },
    { id: 'nt_general', name: 'Cartas Gerais & Revelação', color: 'text-teal-600 dark:text-teal-400', books: ['Hebreus', 'Tiago', '1 Pedro', '2 Pedro', '1 João', '2 João', '3 João', 'Judas', 'Apocalipse'] }
];

// Helper component for bible navigation
const PremiumNavigator = ({ isOpen, onClose, currentBook, onSelect }: any) => {
    const [selectedBook, setSelectedBook] = useState<string>(currentBook);
    const [searchTerm, setSearchTerm] = useState('');
    useEffect(() => { if (isOpen) { setSelectedBook(currentBook); setSearchTerm(''); } }, [isOpen, currentBook]);
    const activeBookData = BIBLE_BOOKS.find(b => b.name === selectedBook);
    const filteredCategories = searchTerm.trim() === '' 
        ? BIBLE_CATEGORIES 
        : BIBLE_CATEGORIES.map(cat => ({ ...cat, books: cat.books.filter(b => b.toLowerCase().includes(searchTerm.toLowerCase())) })).filter(cat => cat.books.length > 0);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="bg-[#FDFBF7] dark:bg-[#121212] w-full md:w-[90%] md:max-w-5xl h-full md:h-[85vh] md:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-[#C5A059]/30">
                <div className="bg-[#1a0f0f] text-white p-5 flex items-center justify-between border-b border-[#C5A059]/50">
                    <h2 className="font-cinzel font-bold text-xl tracking-widest text-[#C5A059]">NAVEGAÇÃO BÍBLICA</h2>
                    <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all"><ChevronRight className="rotate-90" /></button>
                </div>
                <div className="flex flex-col md:flex-row h-full overflow-hidden">
                    <div className="w-full md:w-1/3 border-r border-[#C5A059]/20 bg-[#F5F5DC]/50 dark:bg-black/20 flex flex-col h-[40vh] md:h-full">
                        <div className="p-4 border-b border-[#C5A059]/10 bg-white dark:bg-[#1E1E1E]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar livro..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 p-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#C5A059]"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {filteredCategories.map(cat => (
                                <div key={cat.id}>
                                    <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-3 px-2 ${cat.color}`}>{cat.name}</h3>
                                    <div className="grid grid-cols-1 gap-1">
                                        {cat.books.map(b => (
                                            <button 
                                                key={b} 
                                                onClick={() => setSelectedBook(b)}
                                                className={`p-3 text-left rounded-xl text-sm font-bold transition-all ${selectedBook === b ? 'bg-[#8B0000] text-white shadow-lg scale-[1.02]' : 'hover:bg-white dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'}`}
                                            >
                                                {b}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 bg-white dark:bg-[#1E1E1E] flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                            <h3 className="font-cinzel font-bold text-2xl text-[#8B0000] dark:text-[#ff6b6b]">{selectedBook.toUpperCase()}</h3>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{activeBookData?.chapters} Capítulos</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                                {activeBookData && Array.from({ length: activeBookData.chapters }, (_, i) => i + 1).map(c => (
                                    <button 
                                        key={c}
                                        onClick={() => onSelect(selectedBook, c)}
                                        className="aspect-square rounded-xl border-2 border-gray-100 dark:border-gray-800 flex items-center justify-center font-bold text-lg hover:border-[#C5A059] hover:text-[#C5A059] transition-all active:scale-90 dark:text-gray-300"
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

// named export for BibleReader as required by App.tsx
export function BibleReader({ onBack, isAdmin, onShowToast, initialBook, initialChapter, userProgress, onProgressUpdate }: any) {
    const [book, setBook] = useState(initialBook || 'Gênesis');
    const [chapter, setChapter] = useState(initialChapter || 1);
    const [verses, setVerses] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedVerse, setSelectedVerse] = useState<any>(null);
    const [isNavOpen, setIsNavOpen] = useState(false);
    const [metadata, setMetadata] = useState<ChapterMetadata | null>(null);

    // Load chapter content whenever book or chapter changes
    useEffect(() => {
        loadChapter();
    }, [book, chapter]);

    const loadChapter = async () => {
        setLoading(true);
        const key = generateChapterKey(book, chapter);
        try {
            // Try loading from local indexedDB cache
            let data = await db.entities.BibleChapter.getOffline(key);
            if (!data) {
                // If not local, try fetching from the cloud storage
                data = await db.entities.BibleChapter.getCloud(key);
                if (data) {
                    await db.entities.BibleChapter.saveOffline(key, data);
                }
            }

            if (data && Array.isArray(data)) {
                setVerses(data);
            } else {
                setVerses([]);
                onShowToast("Capítulo não encontrado. Baixe a bíblia no painel admin para uso offline.", "info");
            }

            // Fetch metadata like titles or subtitles if available
            const meta = await db.entities.ChapterMetadata.get(key);
            setMetadata(meta);

        } catch (e) {
            console.error("BibleReader Load Error:", e);
            onShowToast("Erro ao carregar manuscritos bíblicos.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleVerseClick = (text: string, num: number) => {
        setSelectedVerse({ text, num });
    };

    const markAsRead = async () => {
        if (!userProgress) return;
        const key = generateChapterKey(book, chapter);
        if (userProgress.chapters_read.includes(key)) return;

        const updated = await db.entities.ReadingProgress.update(userProgress.id, {
            chapters_read: [...userProgress.chapters_read, key],
            total_chapters: (userProgress.total_chapters || 0) + 1,
            last_book: book,
            last_chapter: chapter
        });
        if (updated) onProgressUpdate(updated);
        onShowToast("Capítulo marcado como lido no seu progresso!", "success");
    };

    const nextChapter = () => {
        const bookMeta = BIBLE_BOOKS.find(b => b.name === book);
        if (!bookMeta) return;
        if (chapter < bookMeta.chapters) {
            setChapter(chapter + 1);
        } else {
            const bookIdx = BIBLE_BOOKS.findIndex(b => b.name === book);
            if (bookIdx < BIBLE_BOOKS.length - 1) {
                setBook(BIBLE_BOOKS[bookIdx + 1].name);
                setChapter(1);
            }
        }
    };

    const prevChapter = () => {
        if (chapter > 1) {
            setChapter(chapter - 1);
        } else {
            const bookIdx = BIBLE_BOOKS.findIndex(b => b.name === book);
            if (bookIdx > 0) {
                const prevBook = BIBLE_BOOKS[bookIdx - 1];
                setBook(prevBook.name);
                setChapter(prevBook.chapters);
            }
        }
    };

    const isRead = userProgress?.chapters_read?.includes(generateChapterKey(book, chapter));

    return (
        <div className="flex flex-col h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-300">
            {/* Navigation Header */}
            <div className="bg-[#1a0f0f] text-white p-4 flex items-center justify-between shadow-lg sticky top-0 z-30">
                <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors"><ChevronLeft className="w-6 h-6" /></button>
                <button onClick={() => setIsNavOpen(true)} className="flex items-center gap-2 group">
                    <div className="text-center">
                        <h2 className="font-cinzel font-bold text-lg text-[#C5A059] group-hover:text-white transition-colors tracking-widest">{book.toUpperCase()}</h2>
                        <p className="text-[10px] uppercase tracking-widest opacity-70">Capítulo {chapter}</p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-[#C5A059]" />
                </button>
                <div className="w-10"></div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 md:p-12 pb-32">
                <div className="max-w-3xl mx-auto">
                    {metadata && (
                        <div className="text-center mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
                            <h1 className="font-cinzel font-bold text-3xl text-[#8B0000] dark:text-[#ff6b6b] mb-2">{metadata.title}</h1>
                            <p className="font-cormorant italic text-lg text-gray-500">{metadata.subtitle}</p>
                            <div className="w-24 h-1 bg-[#C5A059] mx-auto mt-6 rounded-full opacity-30"></div>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-32 opacity-50">
                            <Loader2 className="w-12 h-12 animate-spin text-[#8B0000] mb-4" />
                            <p className="font-cinzel text-gray-500 uppercase tracking-widest text-sm">Abrindo Manuscritos Sagrados...</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {verses.length > 0 ? verses.map((v, i) => (
                                <p 
                                    key={i} 
                                    onClick={() => handleVerseClick(v, i + 1)}
                                    className="font-cormorant text-xl md:text-2xl leading-relaxed text-gray-800 dark:text-gray-200 text-justify cursor-pointer hover:bg-[#C5A059]/10 p-2 rounded-xl transition-all group"
                                >
                                    <span className="font-cinzel font-bold text-xs text-[#C5A059] mr-4 align-top inline-block mt-1 group-hover:scale-125 transition-transform">{i + 1}</span>
                                    {v}
                                </p>
                            )) : (
                                <div className="text-center py-20 opacity-30">
                                    <Book className="w-16 h-16 mx-auto mb-4" />
                                    <p className="font-cinzel">Texto não disponível no momento.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Progress & Navigation Footer */}
                    <div className="mt-24 pt-10 border-t border-[#C5A059]/20 flex flex-col items-center gap-10">
                        <button 
                            onClick={markAsRead}
                            disabled={isRead || verses.length === 0}
                            className={`px-12 py-5 rounded-full font-cinzel font-bold text-sm shadow-2xl transition-all transform active:scale-95 flex items-center gap-3 ${isRead ? 'bg-green-600 text-white cursor-default' : 'bg-[#8B0000] text-white hover:bg-[#600018] hover:shadow-red-900/40'}`}
                        >
                            {isRead ? <CheckCircle className="w-5 h-5" /> : <Book className="w-5 h-5" />}
                            {isRead ? 'CAPÍTULO CONCLUÍDO' : 'CONCLUIR LEITURA'}
                        </button>

                        <div className="flex gap-4 w-full max-w-sm">
                            <button onClick={prevChapter} className="flex-1 p-5 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all shadow-md active:scale-90">
                                <ChevronLeft className="w-5 h-5 text-[#8B0000]" />
                                <span className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Anterior</span>
                            </button>
                            <button onClick={nextChapter} className="flex-1 p-5 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all shadow-md active:scale-90">
                                <ChevronRight className="w-5 h-5 text-[#8B0000]" />
                                <span className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Próximo</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Overlays */}
            <PremiumNavigator 
                isOpen={isNavOpen} 
                onClose={() => setIsNavOpen(false)} 
                currentBook={book}
                onSelect={(b: string, c: number) => {
                    setBook(b);
                    setChapter(c);
                    setIsNavOpen(false);
                }}
            />

            {selectedVerse && (
                <VersePanel 
                    isOpen={!!selectedVerse} 
                    onClose={() => setSelectedVerse(null)}
                    verse={selectedVerse.text}
                    verseNumber={selectedVerse.num}
                    book={book}
                    chapter={chapter}
                    isAdmin={isAdmin}
                    onShowToast={onShowToast}
                    userProgress={userProgress}
                />
            )}
        </div>
    );
}
