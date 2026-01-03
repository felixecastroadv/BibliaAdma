
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
                                <Search className="absolute left-3