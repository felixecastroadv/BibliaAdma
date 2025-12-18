import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Settings, Play, Pause, CheckCircle } from 'lucide-react';
import { BIBLE_BOOKS, generateChapterKey } from '../../constants';
import { db } from '../../services/database';

export default function BibleReader({ onBack, userProgress, onProgressUpdate }: any) {
  const [book, setBook] = useState('Gênesis');
  const [chapter, setChapter] = useState(1);
  const [verses, setVerses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    fetchChapter();
  }, [book, chapter]);

  const fetchChapter = async () => {
    setLoading(true);
    const key = `bible_acf_${BIBLE_BOOKS.find(b => b.name === book)?.abbrev}_${chapter}`;
    const cached = await db.entities.BibleChapter.getOffline(key);
    if (cached) {
      setVerses(cached.map((t: string, i: number) => ({ number: i + 1, text: t })));
    } else {
      try {
        const res = await fetch(`https://www.abibliadigital.com.br/api/verses/acf/${BIBLE_BOOKS.find(b => b.name === book)?.abbrev}/${chapter}`);
        const data = await res.json();
        const clean = data.verses.map((v: any) => v.text);
        await db.entities.BibleChapter.saveOffline(key, clean);
        setVerses(data.verses);
      } catch (e) {
        setVerses([]);
      }
    }
    setLoading(false);
    window.scrollTo(0,0);
  };

  const toggleRead = async () => {
    const key = generateChapterKey(book, chapter);
    const isRead = userProgress.chapters_read.includes(key);
    const newRead = isRead ? userProgress.chapters_read.filter((k: string) => k !== key) : [...userProgress.chapters_read, key];
    const updated = await db.entities.ReadingProgress.update(userProgress.id, { chapters_read: newRead, total_chapters: newRead.length });
    onProgressUpdate(updated);
  };

  return (
    <div className="flex flex-col h-full bg-[#FDFBF7] dark:bg-dark-bg">
      <div className="bg-primary text-white p-4 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <button onClick={onBack}><ChevronLeft/></button>
          <h1 className="font-cinzel font-bold">{book} {chapter}</h1>
        </div>
        <div className="flex gap-4">
          <button onClick={toggleRead} className={userProgress.chapters_read.includes(generateChapterKey(book, chapter)) ? "text-green-400" : "text-white"}><CheckCircle/></button>
          <button><Settings/></button>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-2xl mx-auto">
        {loading ? <div className="text-center py-20 animate-pulse">Carregando...</div> : verses.map(v => (
          <div key={v.number} className="flex gap-4">
            <span className="font-cinzel text-xs text-primary pt-1">{v.number}</span>
            <p className="font-cormorant text-xl leading-relaxed text-justify">{v.text}</p>
          </div>
        ))}
      </div>

      <div className="fixed bottom-24 w-full px-6 flex justify-between items-center pointer-events-none">
        <button onClick={() => setChapter(Math.max(1, chapter - 1))} className="pointer-events-auto p-4 bg-white dark:bg-dark-card rounded-full shadow-lg"><ChevronLeft/></button>
        <button onClick={() => setChapter(chapter + 1)} className="pointer-events-auto p-4 bg-white dark:bg-dark-card rounded-full shadow-lg"><ChevronRight/></button>
      </div>
    </div>
  );
}