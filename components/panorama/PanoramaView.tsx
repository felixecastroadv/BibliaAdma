import React, { useState, useEffect } from 'react';
import { ChevronLeft, GraduationCap, BookOpen, ChevronRight, Volume2, Sparkles, Loader2, Book, Edit, Save, X, CheckCircle, Pause, Play, Settings, FastForward } from 'lucide-react';
import { db } from '../../services/database';
import { BIBLE_BOOKS, generateChapterKey } from '../../constants';
import { EBDContent } from '../../types';
import { generateContent } from '../../services/geminiService';

export default function PanoramaView({ isAdmin, onShowToast, onBack, userProgress, onProgressUpdate }: any) {
  const [book, setBook] = useState('Gênesis');
  const [chapter, setChapter] = useState(1);
  const [content, setContent] = useState<EBDContent | null>(null);
  const [activeTab, setActiveTab] = useState<'student' | 'teacher'>('student');
  const [isGenerating, setIsGenerating] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const studyKey = generateChapterKey(book, chapter);
  const isRead = userProgress?.ebd_read?.includes(studyKey);

  useEffect(() => { loadContent(); }, [book, chapter]);

  const loadContent = async () => {
    const res = await db.entities.PanoramaBiblico.filter({ study_key: studyKey });
    setContent(res[0] || null);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
        const prompt = `Crie um Panorama Bíblico para ${book} ${chapter} no estilo Prof. Michel Felix. Gere conteúdo para Aluno e Professor separadamente. FORMATO JSON: { "student_content": "...", "teacher_content": "..." }.`;
        const res = await generateContent(prompt, { 
            properties: { 
                student_content: { type: 'STRING' }, 
                teacher_content: { type: 'STRING' } 
            } 
        });
        const data = { ...res, book, chapter, study_key: studyKey, title: `Panorama de ${book} ${chapter}` };
        await db.entities.PanoramaBiblico.save(data);
        setContent(data as any);
        onShowToast("Estudo gerado com sucesso!", "success");
    } catch (e) { onShowToast("Erro na IA", "error"); }
    finally { setIsGenerating(true); loadContent(); setIsGenerating(false); }
  };

  const handleMarkAsRead = async () => {
    if (isRead) return;
    const newRead = [...(userProgress.ebd_read || []), studyKey];
    const updated = await db.entities.ReadingProgress.update(userProgress.id, { ebd_read: newRead, total_ebd_read: newRead.length });
    onProgressUpdate(updated);
    onShowToast("Estudo concluído!", "success");
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg">
        <div className="bg-[#0a3d62] text-white p-4 flex justify-between items-center shadow-lg">
            <button onClick={onBack}><ChevronLeft /></button>
            <h2 className="font-cinzel font-bold">Panorama EBD</h2>
            <div className="flex gap-2">
                {isAdmin && <button onClick={() => { setEditValue(activeTab === 'student' ? content?.student_content || '' : content?.teacher_content || ''); setIsEditing(true); }}><Edit size={18}/></button>}
                <button><Volume2 size={18}/></button>
            </div>
        </div>

        <div className="p-4 bg-white dark:bg-dark-card border-b flex gap-2">
             <select value={book} onChange={e => setBook(e.target.value)} className="flex-1 p-2 border rounded font-cinzel dark:bg-gray-800">
                {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
             </select>
             <input type="number" value={chapter} onChange={e => setChapter(Number(e.target.value))} className="w-20 p-2 border rounded font-cinzel dark:bg-gray-800" min={1} />
        </div>

        <div className="flex bg-[#F5F5DC] dark:bg-black">
            <button onClick={() => setActiveTab('student')} className={`flex-1 py-4 font-cinzel font-bold flex justify-center gap-2 ${activeTab === 'student' ? 'bg-[#0a3d62] text-white' : 'text-gray-600'}`}><BookOpen size={18}/> ALUNO</button>
            <button onClick={() => setActiveTab('teacher')} className={`flex-1 py-4 font-cinzel font-bold flex justify-center gap-2 ${activeTab === 'teacher' ? 'bg-[#0a3d62] text-white' : 'text-gray-600'}`}><GraduationCap size={18}/> PROFESSOR</button>
        </div>

        <div className="p-6 max-w-4xl mx-auto pb-32">
            {isGenerating ? (
                <div className="text-center py-20 animate-pulse"><Loader2 className="animate-spin mx-auto mb-2" /> Gerando estudo especializado...</div>
            ) : content ? (
                <div className="prose dark:prose-invert max-w-none">
                    <h1 className="font-cinzel text-[#0a3d62] dark:text-[#ff6b6b] text-center border-b pb-4 mb-8">{content.title}</h1>
                    <div className="font-cormorant text-xl leading-relaxed whitespace-pre-wrap text-justify">
                        {activeTab === 'student' ? content.student_content : content.teacher_content}
                    </div>
                    <div className="mt-12 text-center">
                        <button onClick={handleMarkAsRead} disabled={isRead} className={`px-8 py-3 rounded-full font-bold transition-all ${isRead ? 'bg-green-600 text-white' : 'bg-[#0a3d62] text-white hover:scale-105'}`}>{isRead ? 'ESTUDO CONCLUÍDO' : 'CONCLUIR ESTUDO'}</button>
                    </div>
                </div>
            ) : (
                <div className="text-center py-20 opacity-50">
                    <Book className="w-16 h-16 mx-auto mb-4" />
                    <p className="font-cinzel">Estudo não disponível para este capítulo.</p>
                    {isAdmin && <button onClick={handleGenerate} className="mt-4 bg-[#0a3d62] text-white px-6 py-2 rounded-lg font-bold">GERAR AGORA</button>}
                </div>
            )}
        </div>
    </div>
  );
}
