import React, { useState, useEffect } from 'react';
import { ChevronLeft, GraduationCap, Lock, BookOpen, ChevronRight, Volume2, Sparkles, Loader2, Book, Trash2, Edit, Save, X, CheckCircle } from 'lucide-react';
import { db } from '../../services/database';
import { BIBLE_BOOKS, generateChapterKey } from '../../constants';
import { EBDContent } from '../../types';
import { generateContent } from '../../services/geminiService';

export default function PanoramaView({ isAdmin, onShowToast, onBack }: any) {
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

  useEffect(() => { loadContent(); }, [book, chapter]);

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

  const processAndPaginate = (html: string) => {
    if (!html) { setPages([]); return; }
    const rawPages = html.split('<hr class="page-break">');
    const cleanedPages = rawPages.map(p => cleanText(p)).filter(p => p.length > 50);
    setPages(cleanedPages.length > 0 ? cleanedPages : [cleanText(html)]);
  };

  const hasAccess = isAdmin || activeTab === 'student'; 

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

        // 1. TÍTULO PRINCIPAL (PANORÂMA BÍBLICO...)
        if (trimmed.includes('PANORÂMA BÍBLICO') || trimmed.includes('PANORAMA BÍBLICO')) {
             return (
                <div key={idx} className="mb-8 text-center border-b-2 border-[#8B0000] dark:border-[#ff6b6b] pb-4 pt-2">
                    <h1 className="font-cinzel font-bold text-2xl md:text-3xl text-[#8B0000] dark:text-[#ff6b6b] uppercase tracking-widest drop-shadow-sm">
                        {trimmed}
                    </h1>
                </div>
            );
        }

        // 2. SUBTÍTULOS ELEGANTES (Detecta ###, números romanos/arábicos iniciais, ou títulos em caixa alta curtos)
        const isHeader = trimmed.startsWith('###') || /^\d+\./.test(trimmed) || /^[IVX]+\./.test(trimmed);
        
        if (isHeader) {
            const title = trimmed.replace(/###/g, '').trim();
            return (
                <div key={idx} className="mt-10 mb-6 flex items-center justify-center gap-4">
                    <div className="h-[1px] bg-[#C5A059] w-8 md:w-16 opacity-60"></div>
                    <h3 className="font-cinzel font-bold text-xl text-[#1a0f0f] dark:text-[#E0E0E0] uppercase tracking-wide text-center">
                        {title}
                    </h3>
                    <div className="h-[1px] bg-[#C5A059] w-8 md:w-16 opacity-60"></div>
                </div>
            );
        }

        // 3. CAIXAS DE DESTAQUE (Curiosidades / Perguntas)
        if (trimmed.toUpperCase().includes('CURIOSIDADE') || trimmed.toUpperCase().includes('ATENÇÃO:') || trimmed.endsWith('?')) {
            return (
                <div key={idx} className="my-6 mx-2 font-cormorant text-lg text-[#1a0f0f] dark:text-gray-200 font-medium italic bg-[#C5A059]/10 dark:bg-[#C5A059]/10 p-6 rounded-lg border-y border-[#C5A059]/40 shadow-sm">
                    <Sparkles className="w-5 h-5 text-[#C5A059] mb-2 mx-auto opacity-70" />
                    <div className="text-center">{parseInlineStyles(trimmed)}</div>
                </div>
            );
        }
        
        // 4. TEXTO PADRÃO (Justificado e Elegante)
        return (
            <p key={idx} className="font-cormorant text-xl leading-loose text-gray-900 dark:text-gray-300 text-justify indent-8 mb-4 tracking-wide">
                {parseInlineStyles(trimmed)}
            </p>
        );
    });
  };

  const handleStartEditing = () => {
    const text = activeTab === 'student' ? content?.student_content : content?.teacher_content;
    setEditValue(text || '');
    setIsEditing(true);
  };

  const handleSaveManualEdit = async () => {
    if (!content) return;
    const data = {
        ...content,
        student_content: activeTab === 'student' ? editValue : content.student_content,
        teacher_content: activeTab === 'teacher' ? editValue : content.teacher_content,
    };
    if (content.id) await db.entities.PanoramaBiblico.update(content.id, data);
    await loadContent();
    setIsEditing(false);
    onShowToast('Texto atualizado manualmente!', 'success');
  };

  const handleGenerate = async (mode: 'start' | 'continue') => {
    setIsGenerating(true);
    const target = activeTab;
    const studyKey = generateChapterKey(book, chapter);
    const existing = (await db.entities.PanoramaBiblico.filter({ study_key: studyKey }))[0] || {};
    const currentText = target === 'student' ? (existing.student_content || '') : (existing.teacher_content || '');
    
    // Contexto aumentado para garantir continuidade fluida
    const lastContext = currentText.slice(-4000); 

    const basePersona = `
        VOCÊ É O PROFESSOR MICHEL FELIX.
        
        IDENTIDADE VISUAL E ESTRUTURAL (OBRIGATÓRIO PARA TODAS AS PÁGINAS):
        1. **Estilo:** LIVRO ACADÊMICO DE LUXO.
        2. **Formatação de Títulos (CRÍTICO):** 
           - USE SEMPRE "###" ANTES DE CADA NOVO TÓPICO. Ex: "### 2. A QUEDA DO HOMEM"
           - Isso cria as linhas douradas e centralização. NÃO use apenas negrito para títulos.
        3. **Densidade:** 
           - O usuário exige MUITO TEXTO.
           - Mínimo de 800 a 1000 palavras nesta geração.
           - Parágrafos longos e bem explicados.
        
        CONTEÚDO:
        - Teologia: Arminiana / Pentecostal.
        - Etimologia: Sempre traga o original (Hebraico/Grego).
    `;
    
    const instructions = customInstructions ? `\nINSTRUÇÕES ADICIONAIS DO USUÁRIO: ${customInstructions}` : "";
    
    // Instrução de continuação ajustada para manter o padrão
    const continuationInstructions = `
        MODO DE CONTINUAÇÃO (PÁGINA ${pages.length + 1}).
        
        CONTEXTO ANTERIOR: "...${lastContext.slice(-500)}..."
        
        TAREFA:
        1. Continue o assunto IMEDIATAMENTE, sem resumos.
        2. MANTENHA A FORMATAÇÃO: Use "### TÍTULO" para novas seções.
        3. Se estiver no meio de um tópico, termine-o com profundidade e inicie outro.
        4. Escreva mais 1000 palavras densas.
    `;

    let specificPrompt = "";

    if (target === 'student') {
        specificPrompt = `
        OBJETIVO: AULA DO ALUNO (${book} ${chapter}).
        ${instructions}
        
        ${mode === 'continue' ? continuationInstructions : `
        INÍCIO DA AULA (PÁGINA 1).
        Cabeçalho Obrigatório: "PANORÂMA BÍBLICO - ${book.toUpperCase()} (Prof. Michel Felix)"
        
        Estrutura Obrigatória:
        ### 1. INTRODUÇÃO GERAL
        (3 parágrafos densos)
        
        ### 2. ANÁLISE INICIAL
        (Explicação versículo a versículo detalhada)
        `}
        
        REQUISITOS FINAIS:
        - Priorize TEXTO CORRIDO e DENSO.
        - NÃO seja sucinto. Escreva como se fosse um livro pago.
        `;
    } else {
        specificPrompt = `
        OBJETIVO: MANUAL DO PROFESSOR (${book} ${chapter}).
        ${instructions}
        
        ${mode === 'continue' ? continuationInstructions : `
        INÍCIO DA AULA (PÁGINA 1).
        Cabeçalho Obrigatório: "PANORÂMA BÍBLICO - ${book.toUpperCase()} (Manual do Mestre)"
        `}
        
        DIFERENCIAL:
        - Use "### TÍTULO" para separar seções de Arqueologia, Exegese e Aplicação.
        - Escreva 1200 palavras.
        `;
    }

    try {
        const result = await generateContent(`${basePersona}\n${specificPrompt}`);
        if (!result || result.trim() === 'undefined' || result.length < 50) {
            throw new Error("Conteúdo vazio. Tente novamente.");
        }
        
        const separator = (mode === 'continue' && currentText.length > 0) ? '<hr class="page-break">' : '';
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
        onShowToast('Conteúdo gerado! Padrão Michel Felix aplicado.', 'success');
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

  const handleSpeak = () => {
    if (!pages[currentPage]) return;
    const cleanSpeech = pages[currentPage].replace(/#/g, '').replace(/\*/g, '');
    const utter = new SpeechSynthesisUtterance(cleanSpeech);
    utter.lang = 'pt-BR';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-300">
        <div className="sticky top-0 z-30 bg-gradient-to-r from-[#600018] to-[#400010] text-white p-4 shadow-lg flex justify-between items-center">
            <button onClick={onBack}><ChevronLeft /></button>
            <h2 className="font-cinzel font-bold">Panorama EBD</h2>
            <div className="flex gap-2">
                {isAdmin && (
                    <button onClick={handleStartEditing} title="Editar Manualmente">
                        <Edit className="w-5 h-5 text-[#C5A059]" />
                    </button>
                )}
                <button onClick={handleSpeak} title="Ouvir"><Volume2 /></button>
            </div>
        </div>

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
                <div className="flex items-center justify-between mb-2">
                    <span className="font-cinzel text-xs flex items-center gap-2 font-bold"><Sparkles className="w-4 h-4" /> EDITOR CHEFE ({activeTab.toUpperCase()})</span>
                    <button onClick={() => setShowInstructions(!showInstructions)} className="text-xs underline hover:text-white">
                        {showInstructions ? 'Ocultar Instruções' : 'Adicionar Instruções'}
                    </button>
                </div>
                {showInstructions && (
                    <textarea 
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                        placeholder="Instruções para a IA (Ex: Foque na arqueologia, refute tal heresia...)"
                        className="w-full p-2 text-xs text-black rounded mb-2 font-montserrat"
                        rows={2}
                    />
                )}
                <div className="flex gap-2">
                    <button 
                        onClick={() => handleGenerate('start')} 
                        disabled={isGenerating}
                        className="flex-1 px-3 py-2 border border-[#C5A059] rounded text-xs hover:bg-[#C5A059] hover:text-[#1a0f0f] transition disabled:opacity-50 font-bold"
                    >
                        {isGenerating ? <Loader2 className="animate-spin w-3 h-3 mx-auto"/> : 'INÍCIO (1.000+ palavras)'}
                    </button>
                    <button 
                        onClick={() => handleGenerate('continue')} 
                        disabled={isGenerating}
                        className="flex-1 px-3 py-2 bg-[#C5A059] text-[#1a0f0f] font-bold rounded text-xs hover:bg-white transition disabled:opacity-50"
                    >
                        {isGenerating ? <Loader2 className="animate-spin w-3 h-3 mx-auto"/> : 'CONTINUAR (+1.000)'}
                    </button>
                    {pages.length > 0 && (
                        <button onClick={handleDeletePage} className="px-3 py-2 bg-red-900 text-white rounded hover:bg-red-700 transition">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        )}

        <div className="p-4 md:p-8 max-w-4xl mx-auto pb-32">
            {!hasAccess ? (
                <div className="text-center py-20 opacity-50 dark:text-white">
                    <Lock className="w-16 h-16 mx-auto mb-4" />
                    <p className="font-cinzel text-xl">Conteúdo Restrito ao Admin/Professor</p>
                </div>
            ) : isEditing ? (
                 <div className="bg-white dark:bg-dark-card shadow-2xl p-4 rounded-lg border border-[#C5A059] relative">
                     <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <h3 className="font-cinzel font-bold text-[#8B0000] dark:text-[#ff6b6b]">Modo de Edição Manual</h3>
                        <div className="flex gap-2">
                            <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-sm border border-red-500 text-red-500 rounded flex items-center gap-1">
                                <X className="w-4 h-4"/> Cancelar
                            </button>
                            <button onClick={handleSaveManualEdit} className="px-3 py-1 text-sm bg-green-600 text-white rounded flex items-center gap-1">
                                <Save className="w-4 h-4"/> Salvar
                            </button>
                        </div>
                     </div>
                     <textarea 
                        value={editValue} 
                        onChange={e => setEditValue(e.target.value)}
                        className="w-full h-[600px] p-4 font-mono text-sm border border-gray-300 rounded focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] outline-none dark:bg-gray-800 dark:text-white"
                    />
                 </div>
            ) : content && pages.length > 0 ? (
                <div className="bg-white dark:bg-dark-card shadow-2xl p-8 md:p-16 min-h-[900px] border border-[#C5A059]/20 relative">
                     {/* Se não tiver cabeçalho explícito na string, renderiza um padrão para não ficar vazio */}
                     {(!content.student_content.includes('PANORÂMA') && currentPage === 0) && (
                         <div className="mb-8 text-center border-b-2 border-[#8B0000] dark:border-[#ff6b6b] pb-4 pt-2">
                            <h1 className="font-cinzel font-bold text-2xl md:text-3xl text-[#8B0000] dark:text-[#ff6b6b] uppercase tracking-widest drop-shadow-sm">
                                PANORÂMA BÍBLICO - {content.book} {content.chapter}
                            </h1>
                        </div>
                     )}
                     
                     <div className="space-y-6">
                        {renderFormattedText(pages[currentPage])}

                        {currentPage === pages.length - 1 && hasAccess && !isEditing && (
                            <div className="mt-12 pt-8 border-t border-[#C5A059]/30 text-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
                                <Sparkles className="w-8 h-8 text-[#C5A059] mx-auto mb-4 animate-pulse" />
                                <h3 className="font-cinzel font-bold text-xl text-[#8B0000] dark:text-[#ff6b6b] mb-2">
                                    Estudo Finalizado
                                </h3>
                                <p className="font-cormorant text-gray-600 dark:text-gray-300 italic mb-6">
                                    Que este conhecimento edifique sua vida espiritual.
                                </p>
                                <button 
                                    onClick={() => {
                                        onShowToast('Estudo concluído! Parabéns!', 'success');
                                        setTimeout(onBack, 2000);
                                    }}
                                    className="bg-green-700 hover:bg-green-800 text-white px-8 py-4 rounded-xl font-cinzel font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-3 mx-auto transform hover:scale-105"
                                >
                                    <CheckCircle className="w-6 h-6" /> Concluir Estudo
                                </button>
                            </div>
                        )}
                     </div>
                     <div className="absolute bottom-4 right-8 text-[#C5A059] font-cinzel text-sm">
                        {currentPage + 1} / {pages.length}
                     </div>
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
            <div className="fixed bottom-0 w-full bg-white dark:bg-dark-card border-t border-[#C5A059] p-4 flex justify-between items-center z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.1)]">
                <button 
                    onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                    disabled={currentPage === 0}
                    className="flex items-center gap-1 px-4 py-2 border rounded-lg text-[#8B0000] dark:text-[#ff6b6b] disabled:opacity-50 hover:bg-[#8B0000]/10 transition"
                >
                    <ChevronLeft /> Anterior
                </button>
                <span className="font-cinzel font-bold text-[#1a0f0f] dark:text-white text-sm md:text-base">Página {currentPage + 1} de {pages.length}</span>
                <button 
                    onClick={() => setCurrentPage(Math.min(pages.length - 1, currentPage + 1))}
                    disabled={currentPage === pages.length - 1}
                    className="flex items-center gap-1 px-4 py-2 border rounded-lg text-[#8B0000] dark:text-[#ff6b6b] disabled:opacity-50 hover:bg-[#8B0000]/10 transition"
                >
                    Próximo <ChevronRight />
                </button>
            </div>
        )}
    </div>
  );
}