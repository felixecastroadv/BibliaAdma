import React, { useState, useEffect } from 'react';
import { ChevronLeft, GraduationCap, Lock, BookOpen, ChevronRight, Volume2, Sparkles, Loader2, Book, Trash2, Edit, Save, X } from 'lucide-react';
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
        // Cabeçalho estilo Michel Felix (PANORÂMA BÍBLICO)
        if (trimmed.includes('PANORÂMA BÍBLICO') || trimmed.includes('PANORAMA BÍBLICO')) {
             return (
                <div key={idx} className="mb-6 text-center border-b-2 border-[#8B0000] pb-2">
                    <h1 className="font-cinzel font-bold text-xl text-[#8B0000] dark:text-[#ff6b6b] uppercase tracking-wide">
                        {trimmed}
                    </h1>
                </div>
            );
        }

        // Subtítulos Numerados (Ex: 1) O NASCIMENTO...)
        if (/^\d+\)/.test(trimmed) || (trimmed === trimmed.toUpperCase() && trimmed.length < 80 && trimmed.length > 5)) {
            const title = trimmed.replace(/#+/g, '').trim();
            return (
                <div key={idx} className="mt-6 mb-3">
                    <h3 className="font-cinzel font-bold text-lg text-[#1a0f0f] dark:text-gray-100 uppercase tracking-wide border-l-4 border-[#C5A059] pl-3">
                        {title}
                    </h3>
                </div>
            );
        }

        // Perguntas ou Curiosidades
        if (trimmed.toUpperCase().includes('CURIOSIDADE') || trimmed.endsWith('?')) {
            return (
                <div key={idx} className="font-cormorant text-lg text-[#1a0f0f] dark:text-gray-200 font-bold italic bg-[#C5A059]/10 dark:bg-[#C5A059]/20 p-3 rounded mb-4 border border-[#C5A059]/30">
                    {parseInlineStyles(trimmed)}
                </div>
            );
        }
        
        return (
            <p key={idx} className="font-cormorant text-xl leading-loose text-gray-900 dark:text-gray-300 text-justify indent-8 mb-4">
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
    const lastContext = currentText.slice(-3000); 

    const basePersona = `
        VOCÊ É O PROFESSOR MICHEL FELIX.
        
        SUA IDENTIDADE E ESTILO DE ESCRITA (MIMETISMO ESTRITO):
        1. **Teologia:** Arminiana e Pentecostal Clássica (Assembleia de Deus).
        2. **Tom de Voz:** Educador, profundo, reverente, mas acessível. Usa exclamações para ênfase espiritual.
        3. **Estrutura Fundamental:**
           - TÍTULO: "PANORÂMA BÍBLICO - [LIVRO] (Escrito por: [Autor] em [Data])".
           - SUBTÍTULOS: Numerados (1), 2), 3)...) com TÍTULO EM CAIXA ALTA e CRONOLOGIA (Ex: CRONOLOGIA: 1462 a.C.).
        4. **Marcas Registradas (OBRIGATÓRIO USAR):**
           - **Etimologia:** SEMPRE explique palavras chaves no original entre parênteses. 
             Exemplo: "...o nome Jetro (Yitrô: excelência, abundância)..." ou "...clamar (za'aq: gritar por socorro)...".
           - **Cronologia:** Estime sempre o ano aproximado A.C. dos eventos.
           - **Tipologia:** Conecte o evento do Antigo Testamento com Jesus ou a Igreja. (Ex: José é um tipo de Cristo; A Páscoa aponta para a Ceia).
           - **Curiosidades:** Inclua seções chamadas "CURIOSIDADES ARQUEOLÓGICAS" ou "CONTEXTO HISTÓRICO".
        5. **Formatação:**
           - NÃO use Markdown de listas (bolinhas ou números automáticos). O texto deve ser corrido e fluido.
           - Use **negrito** para destacar nomes e conceitos chaves.
           - Separe páginas virtuais com a tag exata: <hr class="page-break">
    `;
    
    let specificPrompt = "";
    const instructions = customInstructions ? `\nINSTRUÇÕES ADICIONAIS DO USUÁRIO: ${customInstructions}` : "";
    const continuationInstructions = `
        CONTINUAÇÃO DO TEXTO.
        SITUAÇÃO: Você está escrevendo a PARTE ${pages.length + 1}.
        ÚLTIMO CONTEXTO (Para manter a coesão): "...${lastContext.slice(-500)}..."
        REGRA: Não repita o cabeçalho "PANORÂMA BÍBLICO". Continue o tópico de onde parou ou inicie o próximo ponto numérico.
    `;

    if (target === 'student') {
        specificPrompt = `
        OBJETIVO: Escrever uma AULA COMPLETA (Estilo Apostila) sobre ${book} Capítulo ${chapter}.
        ${instructions}
        
        ${mode === 'continue' ? continuationInstructions : `
        INÍCIO DA AULA.
        Comece com o cabeçalho padrão: "PANORÂMA BÍBLICO - ${book.toUpperCase()}..."
        Em seguida, desenvolva o capítulo versículo por versículo (agrupando-os), focando na explicação histórica e aplicação prática.
        `}
        
        REGRAS DE EXTENSÃO: Gere texto suficiente para preencher cerca de 1000 a 1200 palavras. Use <hr class="page-break"> entre as seções se necessário.
        `;
    } else {
        specificPrompt = `
        OBJETIVO: MANUAL DO PROFESSOR (Conteúdo Aprofundado) sobre ${book} Capítulo ${chapter}.
        ${instructions}
        
        ${mode === 'continue' ? continuationInstructions : `
        INÍCIO DA AULA.
        Comece com o cabeçalho padrão: "PANORÂMA BÍBLICO - ${book.toUpperCase()}..."
        `}
        
        DIFERENCIAL DO PROFESSOR:
        - Aprofunde muito mais na ETIMOLOGIA (Hebraico/Grego).
        - Traga "CURIOSIDADES ARQUEOLÓGICAS" detalhadas (Ex: costumes da época, geografia).
        - Forneça "REFLEXÕES HOMILÉTICAS" para o professor aplicar em sala.
        - Conecte com o Novo Testamento (Tipologia) de forma explícita.
        
        REGRAS DE EXTENSÃO: Gere texto denso com cerca de 1200 palavras. Use <hr class="page-break">.
        `;
    }

    try {
        const result = await generateContent(`${basePersona}\n${specificPrompt}`);
        if (!result || result.trim() === 'undefined' || result.length < 50) {
            throw new Error("A IA gerou um conteúdo vazio. Verifique se a chave de API é válida ou se o texto é muito longo.");
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
        onShowToast('Conteúdo gerado no estilo Michel Felix!', 'success');
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
                        {isGenerating ? <Loader2 className="animate-spin w-3 h-3 mx-auto"/> : 'INÍCIO (3 págs)'}
                    </button>
                    <button 
                        onClick={() => handleGenerate('continue')} 
                        disabled={isGenerating}
                        className="flex-1 px-3 py-2 bg-[#C5A059] text-[#1a0f0f] font-bold rounded text-xs hover:bg-white transition disabled:opacity-50"
                    >
                        {isGenerating ? <Loader2 className="animate-spin w-3 h-3 mx-auto"/> : 'CONTINUAR (+3)'}
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
                <div className="bg-white dark:bg-dark-card shadow-2xl p-6 md:p-12 min-h-[800px] border border-[#C5A059]/20 relative">
                     {/* Decorative Header handled by renderFormattedText if present, otherwise default */}
                     {!content.student_content.includes('PANORÂMA') && (
                         <div className="text-center mb-8 border-b-2 border-[#C5A059] pb-4">
                            <span className="font-montserrat text-xs tracking-[0.3em] text-[#C5A059] uppercase">Teologia Sistemática ADMA</span>
                            <h1 className="font-cinzel text-2xl md:text-3xl font-bold text-[#600018] dark:text-[#ff6b6b] mt-2 mb-2">{content.title}</h1>
                            <div className="w-20 h-1 bg-[#C5A059] mx-auto rounded-full"></div>
                         </div>
                     )}
                     
                     <div className="space-y-6">
                        {renderFormattedText(pages[currentPage])}
                     </div>
                     <div className="absolute bottom-4 right-8 text-[#C5A059] font-cinzel text-sm">
                        {currentPage + 1}
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