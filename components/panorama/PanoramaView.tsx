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
    return () => { window.speechSynthesis.cancel(); }
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

  // --- PAGINAÇÃO HÍBRIDA ---
  const processAndPaginate = (html: string) => {
    if (!html) { setPages([]); return; }
    
    // 1. Tenta dividir pelos marcadores explícitos da IA
    let rawSegments = html.split(/<hr[^>]*>|__CONTINUATION_MARKER__/i)
                          .map(s => cleanText(s))
                          .filter(s => s.length > 50);

    // 2. FALLBACK INTELIGENTE: Se a IA gerou um bloco gigante único (> 4000 caracteres)
    if (rawSegments.length === 1 && rawSegments[0].length > 4000) {
        const bigText = rawSegments[0];
        // Tenta quebrar pelos Títulos (### ou Numerais Romanos/Arábicos no início de linha)
        const forcedSegments = bigText.split(/(?=\n### |^\s*[IVX]+\.|^\s*\d+\.\s+[A-Z])/gm);
        
        if (forcedSegments.length > 1) {
            rawSegments = forcedSegments.map(s => cleanText(s)).filter(s => s.length > 100);
        }
    }
    
    const finalPages: string[] = [];
    let currentBuffer = "";
    
    // META: ~600 palavras (aprox 3500 caracteres)
    const CHAR_LIMIT_MIN = 3500; 

    for (let i = 0; i < rawSegments.length; i++) {
        const segment = rawSegments[i];
        
        if (!currentBuffer) {
            currentBuffer = segment;
        } else {
            if ((currentBuffer.length + segment.length) < (CHAR_LIMIT_MIN * 1.5)) {
                currentBuffer += "\n\n__CONTINUATION_MARKER__\n\n" + segment;
            } else {
                if (currentBuffer.length > 2000) {
                    finalPages.push(currentBuffer);
                    currentBuffer = segment;
                } else {
                    currentBuffer += "\n\n__CONTINUATION_MARKER__\n\n" + segment;
                }
            }
        }
    }
    
    if (currentBuffer) finalPages.push(currentBuffer);
    setPages(finalPages.length > 0 ? finalPages : [cleanText(html)]);
  };

  const hasAccess = isAdmin || activeTab === 'student'; 

  const speakText = () => {
    if (!pages[currentPage]) return;
    const cleanSpeech = pages[currentPage]
        .replace('__CONTINUATION_MARKER__', '... Continuação ...')
        .replace(/#/g, '')
        .replace(/\*/g, '')
        .replace(/<[^>]*>/g, '');
        
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
                            <h1 className="font-cinzel font-bold text-2xl md:text-4xl text-[#8B0