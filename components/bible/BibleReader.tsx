import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Settings, Type, CheckCircle, ChevronRight, Book } from 'lucide-react';
import VersePanel from './VersePanel';
import { db } from '../../services/database';
import { generateChapterKey, BIBLE_BOOKS } from '../../constants';

// Mapeamento para garantir que a API encontre os livros corretamente (especialmente os de 1 capítulo)
const BOOK_NAME_MAPPING: Record<string, string> = {
    "Gênesis": "Genesis", "Êxodo": "Exodus", "Levítico": "Leviticus", "Números": "Numbers", "Deuteronômio": "Deuteronomy",
    "Josué": "Joshua", "Juízes": "Judges", "Rute": "Ruth", "1 Samuel": "1 Samuel", "2 Samuel": "2 Samuel",
    "1 Reis": "1 Kings", "2 Reis": "2 Kings", "1 Crônicas": "1 Chronicles", "2 Crônicas": "2 Chronicles",
    "Esdras": "Ezra", "Neemias": "Nehemiah", "Ester": "Esther", "Jó": "Job", "Salmos": "Psalms",
    "Provérbios": "Proverbs", "Eclesiastes": "Ecclesiastes", "Cantares": "Song of Solomon", "Isaías": "Isaiah",
    "Jeremias": "Jeremiah", "Lamentações": "Lamentations", "Ezequiel": "Ezekiel", "Daniel": "Daniel",
    "Oséias": "Hosea", "Joel": "Joel", "Amós": "Amos", "Obadias": "Obadiah", "Jonas": "Jonah",
    "Miquéias": "Micah", "Naum": "Nahum", "Habacuque": "Habakkuk", "Sofonias": "Zephaniah", "Ageu": "Haggai",
    "Zacarias": "Zechariah", "Malaquias": "Malachi", "Mateus": "Matthew", "Marcos": "Mark", "Lucas": "Luke",
    "João": "John", "Atos": "Acts", "Romanos": "Romans", "1 Coríntios": "1 Corinthians", "2 Coríntios": "2 Corinthians",
    "Gálatas": "Galatians", "Efésios": "Ephesians", "Filipenses": "Philippians", "Colossenses": "Colossians",
    "1 Tessalonicenses": "1 Thessalonians", "2 Tessalonicenses": "2 Thessalonians", "1 Timóteo": "1 Timothy",
    "2 Timóteo": "2 Timothy", "Tito": "Titus", "Filemom": "Philemon", "Hebreus": "Hebrews", "Tiago": "James",
    "1 Pedro": "1 Peter", "2 Pedro": "2 Peter", "1 João": "1 John", "2 João": "2 John", "3 João": "3 John",
    "Judas": "Jude", "Apocalipse": "Revelation"
};

export default function BibleReader({ onBack, isAdmin, onShowToast, initialBook, initialChapter, userProgress, onProgressUpdate }: any) {
  const [currentBook, setCurrentBook] = useState(initialBook || 'Gênesis');
  const [currentChapter, setCurrentChapter] = useState(initialChapter || 1);
  const [verses, setVerses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState<any>(null);
  const [fontSize, setFontSize] = useState(18);
  const [showSettings, setShowSettings] = useState(false);
  
  // Mark as read state
  const chapterKey = generateChapterKey(currentBook, currentChapter);
  const isRead = userProgress?.chapters_read?.includes(chapterKey);

  useEffect(() => {
    fetchChapter();
    window.scrollTo(0, 0);
  }, [currentBook, currentChapter]);

  const fetchChapter = async () => {
    setLoading(true);
    try {
        const engBook = BOOK_NAME_MAPPING[currentBook] || currentBook;
        // Using bible-api.com which is free and supports Almeida
        const response = await fetch(`https://bible-api.com/${engBook}+${currentChapter}?translation=almeida`);
        const data = await response.json();
        
        if (data.verses) {
            setVerses(data.verses);
        } else {
            setVerses([]);
            onShowToast('Capítulo não encontrado ou erro na API.', 'error');
        }
    } catch (error) {
        console.error("Error fetching bible text", error);
        onShowToast('Erro de conexão ao buscar texto bíblico.', 'error');
    } finally {
        setLoading(false);
    }
  };

  const handleNext = () => {
    const bookMeta = BIBLE_BOOKS.find(b => b.name === currentBook);
    if (!bookMeta) return;

    if (currentChapter < bookMeta.chapters) {
        setCurrentChapter(c => c + 1);
    } else {
        // Next book
        const idx = BIBLE_BOOKS.findIndex(b => b.name === currentBook);
        if (idx < BIBLE_BOOKS.length - 1) {
            const nextBook = BIBLE_BOOKS[idx + 1];
            setCurrentBook(nextBook.name);
            setCurrentChapter(1);
        }
    }
  };

  const handlePrev = () => {
    if (currentChapter > 1) {
        setCurrentChapter(c => c - 1);
    } else {
        // Prev book
        const idx = BIBLE_BOOKS.findIndex(b => b.name === currentBook);
        if (idx > 0) {
            const prevBook = BIBLE_BOOKS[idx - 1];
            setCurrentBook(prevBook.name);
            setCurrentChapter(prevBook.chapters);
        }
    }
  };

  const toggleRead = async () => {
      if (!userProgress) return;
      
      let newReadList = [...userProgress.chapters_read];
      if (isRead) {
          newReadList = newReadList.filter(k => k !== chapterKey);
      } else {
          newReadList.push(chapterKey);
      }

      const newTotal = newReadList.length;
      
      try {
        const updated = await db.entities.ReadingProgress.update(userProgress.id, {
            chapters_read: newReadList,
            total_chapters: newTotal,
            last_book: currentBook,
            last_chapter: currentChapter
        });
        
        if (onProgressUpdate) onProgressUpdate(updated);
        if (!isRead) onShowToast('Capítulo marcado como lido!', 'success');
      } catch (e) {
        console.error(e);
      }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-300 pb-20">
        {/* Header */}
        <div className="bg-[#8B0000] text-white p-4 flex justify-between items-center sticky top-0 shadow-lg z-10">
            <div className="flex items-center gap-2">
                <button onClick={onBack}><ChevronLeft /></button>
                <div className="flex flex-col">
                    <h2 className="font-cinzel font-bold text-lg leading-none">{currentBook} {currentChapter}</h2>
                    <span className="text-[10px] font-montserrat opacity-80">Bíblia Almeida</span>
                </div>
            </div>
            <div className="flex gap-2">
                 <button onClick={toggleRead} className={`p-2 rounded-full transition-colors ${isRead ? 'bg-green-500 text-white' : 'bg-white/10 hover:bg-white/20'}`}>
                    <CheckCircle className="w-5 h-5" />
                 </button>
                 <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-white/10 rounded-full">
                    <Settings className="w-5 h-5" />
                 </button>
            </div>
        </div>

        {/* Settings Bar */}
        {showSettings && (
            <div className="bg-white dark:bg-dark-card p-4 border-b border-[#C5A059] flex items-center justify-between animate-in slide-in-from-top-2">
                <span className="font-bold text-sm dark:text-white flex items-center gap-2"><Type className="w-4 h-4"/> Tamanho:</span>
                <div className="flex items-center gap-4">
                    <button onClick={() => setFontSize(Math.max(14, fontSize - 2))} className="w-8 h-8 border rounded flex items-center justify-center font-bold dark:text-white">-</button>
                    <span className="dark:text-white">{fontSize}</span>
                    <button onClick={() => setFontSize(Math.min(32, fontSize + 2))} className="w-8 h-8 border rounded flex items-center justify-center font-bold dark:text-white">+</button>
                </div>
            </div>
        )}

        {/* Content */}
        <div className="p-6 max-w-3xl mx-auto">
            {loading ? (
                <div className="text-center py-20 text-[#8B0000] dark:text-[#ff6b6b] animate-pulse">
                    <Book className="w-12 h-12 mx-auto mb-2 opacity-50"/>
                    <p className="font-cinzel">Carregando Escrituras...</p>
                </div>
            ) : (
                <div className="font-cormorant text-gray-900 dark:text-gray-200 leading-loose text-justify" style={{ fontSize: `${fontSize}px` }}>
                    {verses.map((v) => (
                        <span 
                            key={v.verse} 
                            onClick={() => setSelectedVerse(v)}
                            className={`inline hover:bg-[#C5A059]/20 cursor-pointer rounded px-1 transition-colors ${selectedVerse?.verse === v.verse ? 'bg-[#C5A059]/30' : ''}`}
                        >
                            <sup className="text-xs font-bold text-[#8B0000] dark:text-[#ff6b6b] mr-1 select-none">{v.verse}</sup>
                            {v.text}
                        </span>
                    ))}
                </div>
            )}
        </div>

        {/* Navigation Footer */}
        <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-dark-card border-t border-[#C5A059] p-4 flex justify-between items-center z-20 safe-bottom shadow-[0_-5px_10px_rgba(0,0,0,0.05)]">
            <button onClick={handlePrev} className="flex items-center gap-1 px-4 py-2 text-[#8B0000] dark:text-[#ff6b6b] font-bold hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                <ChevronLeft className="w-5 h-5" /> Anterior
            </button>
            <span className="font-cinzel font-bold text-sm dark:text-white">{currentBook} {currentChapter}</span>
            <button onClick={handleNext} className="flex items-center gap-1 px-4 py-2 text-[#8B0000] dark:text-[#ff6b6b] font-bold hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                Próximo <ChevronRight className="w-5 h-5" />
            </button>
        </div>

        {/* Verse Panel */}
        {selectedVerse && (
            <VersePanel 
                isOpen={!!selectedVerse}
                onClose={() => setSelectedVerse(null)}
                book={currentBook}
                chapter={currentChapter}
                verse={selectedVerse.text}
                verseNumber={selectedVerse.verse}
                isAdmin={isAdmin}
                onShowToast={onShowToast}
                userProgress={userProgress}
            />
        )}
    </div>
  );
}