import React, { useState, useEffect } from 'react';
// Componente de Visualização do Panorama Bíblico
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
                            <h1 className="font-cinzel font-bold text-2xl md:text-4xl text-[#8B0000] dark:text-[#ff6b6b] uppercase tracking-widest drop-shadow-sm leading-tight">
                                {trimmed}
                            </h1>
                        </div>
                    );
                }
                const isHeader = trimmed.startsWith('###') || /^[IVX]+\./.test(trimmed);
                if (isHeader) {
                    const title = trimmed.replace(/###/g, '').trim();
                    return (
                        <div key={lineIdx} className="mt-10 mb-6 flex flex-col items-center justify-center gap-2">
                            <h3 className="font-cinzel font-bold text-xl md:text-2xl text-[#1a0f0f] dark:text-[#E0E0E0] uppercase tracking-wide text-center leading-snug">
                                {title}
                            </h3>
                            <div className="h-[2px] bg-[#C5A059] w-12 rounded-full"></div>
                        </div>
                    );
                }
                const isListItem = /^\d+\./.test(trimmed);
                if (isListItem) {
                    const firstSpaceIndex = trimmed.indexOf(' ');
                    const numberPart = trimmed.substring(0, firstSpaceIndex > -1 ? firstSpaceIndex : trimmed.length);
                    const textPart = firstSpaceIndex > -1 ? trimmed.substring(firstSpaceIndex + 1) : "";
                    return (
                        <div key={lineIdx} className="mb-6 flex gap-4 items-start group pl-2">
                            <div className="flex-shrink-0 mt-1 min-w-[2rem] text-right">
                                <span className="font-cinzel font-bold text-xl text-[#C5A059] dark:text-[#C5A059]">
                                    {numberPart}
                                </span>
                            </div>
                            <div className="flex-1">
                                <p className="font-cormorant text-xl leading-loose text-gray-900 dark:text-gray-300 text-justify border-l-2 border-[#C5A059]/20 pl-4">
                                    {parseInlineStyles(textPart)}
                                </p>
                            </div>
                        </div>
                    );
                }
                if (trimmed.toUpperCase().includes('CURIOSIDADE') || trimmed.toUpperCase().includes('ATENÇÃO:') || trimmed.endsWith('?')) {
                    return (
                        <div key={lineIdx} className="my-8 mx-2 font-cormorant text-lg text-[#1a0f0f] dark:text-gray-200 font-medium italic bg-[#C5A059]/10 dark:bg-[#C5A059]/5 p-6 rounded-xl border border-[#C5A059]/30 shadow-sm text-justify relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-[#C5A059]"></div>
                            <div className="flex items-center gap-2 mb-3 text-[#C5A059]">
                                <Sparkles className="w-5 h-5" />
                                <span className="text-xs font-bold uppercase tracking-wider font-montserrat">Destaque</span>
                            </div>
                            <div>{parseInlineStyles(trimmed)}</div>
                        </div>
                    );
                }
                return (
                    <p key={lineIdx} className="font-cormorant text-xl leading-loose text-gray-900 dark:text-gray-200 text-justify indent-8 mb-6 tracking-wide">
                        {parseInlineStyles(trimmed)}
                    </p>
                );
            })}
        </div>
    );
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
    try {
        if (content.id) await db.entities.PanoramaBiblico.update(content.id, data);
        await loadContent();
        setIsEditing(false);
        onShowToast('Texto atualizado manualmente com sucesso!', 'success');
    } catch (e) {
        onShowToast('Erro ao salvar edição.', 'error');
    }
  };

  const handleGenerate = async (mode: 'start' | 'continue') => {
    setIsGenerating(true);
    const target = activeTab;
    const studyKey = generateChapterKey(book, chapter);
    const existing = (await db.entities.PanoramaBiblico.filter({ study_key: studyKey }))[0] || {};
    const currentText = target === 'student' ? (existing.student_content || '') : (existing.teacher_content || '');
    
    // Pega contexto limpo (sem marcadores internos)
    const cleanContext = currentText.replace(/__CONTINUATION_MARKER__/g, ' ').slice(-3000);

    const isFirstChapter = chapter === 1;
    const introInstruction = isFirstChapter 
        ? "2. INTRODUÇÃO GERAL:\n           Texto rico contextualizando O LIVRO (autor, data, propósito) e o cenário deste primeiro capítulo."
        : `2. INTRODUÇÃO DO CAPÍTULO:\n           FOCAR EXCLUSIVAMENTE no contexto imediato do capítulo ${chapter}. NÃO repita a introdução geral do livro de ${book} (autoria, data, etc), pois já foi dado nos capítulos anteriores. Vá direto ao ponto do enredo atual.`;

    const WRITING_STYLE = `
        ATUE COMO: Professor Michel Felix.
        PERFIL: Teólogo Pentecostal Clássico, Arminiano, Erudito e Assembleiano.

        --- OBJETIVO SUPREMO: O EFEITO "AH! ENTENDI!" (CLAREZA E PROFUNDIDADE) ---
        1. LINGUAGEM: O texto deve ser PROFUNDO, mas EXTREMAMENTE CLARO. O aluno (seja jovem ou idoso) deve ler e entender instantaneamente.
        2. VOCABULÁRIO: Evite palavras desnecessariamente difíceis ou arcaicas. Se houver um sinônimo simples, USE-O.
        3. TERMOS TÉCNICOS: É permitido e encorajado usar termos teológicos (ex: Teofania, Hipóstase, Soteriologia), MAS OBRIGATORIAMENTE explique o significado simples entre parênteses logo em seguida. Ex: "Vemos aqui uma Teofania (uma aparição visível de Deus)..." ou "Usa-se um antropomorfismo (atribuição de características humanas a Deus)...".
        4. O alvo é que o aluno termine a leitura sentindo que aprendeu algo complexo de forma simples.

        --- PROTOCOLO DE SEGURANÇA TEOLÓGICA E DIDÁTICA (NÍVEL MÁXIMO) ---
        1. HERMENÊUTICA: A Bíblia interpreta a Bíblia (Analogia da Fé).
        2. DIDÁTICA DOS TEXTOS POLÊMICOS E DIFÍCEIS:
           - É EXCELENTE, DIDÁTICO e RECOMENDADO citar as principais correntes interpretativas divergentes para enriquecer a cultura do aluno (ex: "Alguns teólogos históricos interpretam como X, outros como Y..."). Mostre erudição citando as visões (Judaica, Patrística, Apócrifa).
           - CONTUDO, APÓS ELENCAR as visões, você deve OBRIGATORIAMENTE concluir defendendo a interpretação Ortodoxa, Assembleiana e Biblicamente coerente, refutando as demais com base nas Escrituras e nas palavras de Jesus.
        
        3. APLICAÇÃO PRÁTICA EM CASOS ESPECÍFICOS:
           - Gênesis 6 ("Filhos de Deus"): Cite que a visão de "anjos caídos" existe e é antiga (Livro de Enoque/Josefo), MAS refute-a biblicamente (Jesus disse que anjos não casam em Mt 22:30). A doutrina a ser firmada como CORRETA é a "Linhagem de Sete" (justos) se misturando com a "Linhagem de Caim".
           - Jefté: Cite a possibilidade de sacrifício literal, mas defenda a visão da dedicação perpétua ao tabernáculo (voto de celibato).
           - Em resumo: Apresente o leque de interpretações para conhecimento, mas feche a questão com a ortodoxia segura.

        4. ANGELOLOGIA E ANTROPOLOGIA: Respeite a natureza dos seres criados. Não misture naturezas distintas (espíritos não possuem genética reprodutiva humana).
        5. TOM: Magistral, Impessoal, Acadêmico, Vibrante e Ortodoxo.

        --- METODOLOGIA DE ENSINO (MICROSCOPIA BÍBLICA) ---
        1. CHEGA DE RESUMOS: O aluno precisa entender o texto COMPLETAMENTE. Não faça explicações genéricas que cobrem 10 versículos de uma vez.
        2. DETALHES QUE FAZEM A DIFERENÇA: Traga costumes da época, geografia e contexto histórico para iluminar o texto e causar o efeito "Ah! Entendi!".
        3. DENSIDADE: Extraia todo o suco do texto. Se houver uma lista de nomes, explique a relevância. Se houver uma ação detalhada, explique o motivo.
        4. O texto deve ser DENSO e EXEGÉTICO, mas respeitando o limite de tamanho (aprox. 600 palavras por resposta).
        5. PROIBIDO TRANSCREVER O TEXTO BÍBLICO: O aluno já tem a Bíblia. NÃO escreva o versículo por extenso. Cite apenas a referência (Ex: "No versículo 1...", ou "Em Gn 47:1-6...") e vá direto para a EXPLICAÇÃO.

        --- IDIOMAS ORIGINAIS E ETIMOLOGIA (INDISPENSÁVEL) ---
        O EBD não é um curso de línguas, mas para um melhor ensino é OBRIGATÓRIO:
        1. PALAVRAS-CHAVE: Cite os termos originais (Hebraico no AT / Grego no NT) transliterados e com a grafia original quando relevante para explicar o sentido profundo.
        2. SIGNIFICADOS DE NOMES: Sempre traga o significado etimológico de nomes de pessoas e lugares.

        --- ESTRUTURA VISUAL OBRIGATÓRIA (BASEADA NO MODELO ADMA) ---
        Use EXATAMENTE esta estrutura de tópicos. NÃO use cabeçalhos como "Introdução" ou "Desenvolvimento" explicitamente, apenas comece o texto ou use os números.

        1. TÍTULO PRINCIPAL:
           PANORÂMA BÍBLICO - ${book.toUpperCase()} ${chapter} (PROF. MICHEL FELIX)

        ${introInstruction}

        3. TÓPICOS DO ESTUDO (Use Numeração 1., 2., 3...):
           Exemplo:
           1. TÍTULO DO TÓPICO EM MAIÚSCULO (Referência: Gn X:Y-Z)
           (Aqui entra a explicação detalhada, versículo por versículo, sem pressa, aplicando a metodologia de microscopia bíblica. NÃO COPIE O TEXTO BÍBLICO, APENAS EXPLIQUE).

        4. SEÇÕES FINAIS OBRIGATÓRIAS (No final do estudo):
           ### TIPOLOGIA: CONEXÃO COM JESUS CRISTO
           (Liste de forma enumerada se houver múltiplos pontos, ou texto corrido. Mostre como o texto aponta para o Messias).

           ### CURIOSIDADES E ARQUEOLOGIA
           (Fatos históricos, culturais e arqueológicos relevantes).

        --- INSTRUÇÕES DE PAGINAÇÃO ---
        1. Texto de TAMANHO MÉDIO (aprox. 600 palavras por geração).
        2. Insira <hr class="page-break"> entre os tópicos principais para dividir as páginas.
        3. Se for CONTINUAÇÃO, não repita o título nem a introdução, siga para o próximo tópico numérico ou continue a explicação detalhada do versículo onde parou.
    `;
    
    const instructions = customInstructions ? `\nINSTRUÇÕES EXTRAS: ${customInstructions}` : "";
    const continuationInstructions = `MODO CONTINUAÇÃO. O texto anterior terminou assim: "...${cleanContext.slice(-400)}...". Continue o raciocínio detalhado. Se já cobriu todo o texto bíblico (até o último versículo), GERE AS SEÇÕES FINAIS (Tipologia e Arqueologia).`;

    let specificPrompt = target === 'student' ? 
        `OBJETIVO: AULA DO ALUNO para ${book} ${chapter}. ${WRITING_STYLE} ${instructions} ${mode === 'continue' ? continuationInstructions : 'INÍCIO DO ESTUDO COMPLETO.'}` : 
        `OBJETIVO: MANUAL DO PROFESSOR para ${book} ${chapter}. ${WRITING_STYLE} ${instructions} ${mode === 'continue' ? continuationInstructions : 'INÍCIO DO ESTUDO COMPLETO.'}`;

    try {
        const result = await generateContent(specificPrompt);
        if (!result || result.trim() === 'undefined' || result.length < 50) throw new Error("A IA retornou vazio.");
        
        let separator = '';
        if (mode === 'continue' && currentText.length > 0 && !currentText.trim().endsWith('>')) {
            separator = '<hr class="page-break">';
        }

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
        onShowToast('Conteúdo gerado no Padrão ADMA!', 'success');
        if (mode === 'continue') setTimeout(() => setCurrentPage(pages.length), 500); 

    } catch (e: any) {
        onShowToast(`Erro: ${e.message}`, 'error');
    } finally {
        setIsGenerating(false);
    }
  };

  // --- CORREÇÃO DO BOTÃO APAGAR ---
  const handleDeletePage = async () => {
    if (!window.confirm("Tem certeza que deseja apagar o conteúdo DESTA página?")) return;
    if (!content) return;

    // Cria uma nova lista de páginas removendo a atual
    // Essa é a maneira mais segura: reconstruir o texto baseando-se no que sobrou
    const updatedPages = pages.filter((_, index) => index !== currentPage);
    
    // Reconstrói o conteúdo total juntando as páginas restantes com o separador padrão de quebra
    const newContent = updatedPages.join('<hr class="page-break">');

    const data = {
        ...content,
        student_content: activeTab === 'student' ? newContent : content.student_content,
        teacher_content: activeTab === 'teacher' ? newContent : content.teacher_content,
    };

    try {
        if (content.id) await db.entities.PanoramaBiblico.update(content.id, data);
        
        // Atualiza estado local imediatamente para feedback visual
        setPages(updatedPages);
        
        // Ajusta a página atual se estivermos na última
        if (currentPage >= updatedPages.length) {
            setCurrentPage(Math.max(0, updatedPages.length - 1));
        }

        // Recarrega do banco para garantir sincronia
        await loadContent();
        
        onShowToast('Página apagada com sucesso.', 'success');
    } catch (e) {
        onShowToast('Erro ao apagar página.', 'error');
    }
  };

  return (
    <div 
        className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-300"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
    >
        <div className="sticky top-0 z-30 bg-gradient-to-r from-[#600018] to-[#400010] text-white p-4 shadow-lg flex justify-between items-center">
            <button onClick={onBack}><ChevronLeft /></button>
            <h2 className="font-cinzel font-bold">Panorama EBD</h2>
            <div className="flex gap-2">
                {isAdmin && !isEditing && content && (
                    <button onClick={handleStartEditing} title="Editar Texto Manualmente" className="p-2 hover:bg-white/10 rounded-full">
                        <Edit className="w-5 h-5 text-[#C5A059]" />
                    </button>
                )}
                <button onClick={() => setShowAudioSettings(!showAudioSettings)} title="Opções de Áudio">
                    <Volume2 className={isPlaying ? "text-green-400 animate-pulse" : ""} />
                </button>
            </div>
        </div>

        {showAudioSettings && (
            <div className="bg-white dark:bg-dark-card p-4 border-b border-[#C5A059]/30 animate-in slide-in-from-top-2">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-[#1a0f0f] dark:text-white">Leitura de Áudio</span>
                        <button 
                            onClick={togglePlay}
                            className="bg-[#C5A059] text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-[#a88645]"
                        >
                            {isPlaying ? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4"/>} 
                            {isPlaying ? 'Pausar' : 'Ouvir Página'}
                        </button>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Voz:</label>
                        <select className="w-full p-1 text-sm border rounded mt-1 dark:bg-gray-800 dark:text-white" value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}>
                            {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
                            <FastForward className="w-3 h-3" /> Velocidade:
                        </span>
                        <div className="flex gap-2">
                            {[0.75, 1, 1.25, 1.5, 2].map(rate => (
                                <button 
                                    key={rate}
                                    onClick={() => setPlaybackRate(rate)}
                                    className={`flex-1 py-1 text-xs font-bold rounded border ${playbackRate === rate ? 'bg-[#8B0000] text-white border-[#8B0000]' : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'}`}
                                >
                                    {rate}x
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

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
                    <textarea value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} placeholder="Instruções..." className="w-full p-2 text-xs text-black rounded mb-2 font-montserrat" rows={2} />
                )}
                <div className="flex gap-2">
                    <button onClick={() => handleGenerate('start')} disabled={isGenerating} className="flex-1 px-3 py-2 border border-[#C5A059] rounded text-xs hover:bg-[#C5A059] hover:text-[#1a0f0f] transition disabled:opacity-50 font-bold">
                        {isGenerating ? <Loader2 className="animate-spin w-3 h-3 mx-auto"/> : 'INÍCIO (Padrão EBD)'}
                    </button>
                    <button onClick={() => handleGenerate('continue')} disabled={isGenerating} className="flex-1 px-3 py-2 bg-[#C5A059] text-[#1a0f0f] font-bold rounded text-xs hover:bg-white transition disabled:opacity-50">
                        {isGenerating ? <Loader2 className="animate-spin w-3 h-3 mx-auto"/> : 'CONTINUAR (+ Conteúdo)'}
                    </button>
                    {pages.length > 0 && (
                        <button onClick={handleDeletePage} className="px-3 py-2 bg-red-900 text-white rounded hover:bg-red-700 transition" title="Apagar esta página"><Trash2 className="w-4 h-4" /></button>
                    )}
                </div>
            </div>
        )}

        <div className="p-4 md:p-8 max-w-4xl mx-auto pb-48">
            {!hasAccess ? (
                <div className="text-center py-20 opacity-50 dark:text-white">
                    <Lock className="w-16 h-16 mx-auto mb-4" />
                    <p className="font-cinzel text-xl">Conteúdo Restrito ao Admin/Professor</p>
                </div>
            ) : isEditing ? (
                 <div className="bg-white dark:bg-dark-card shadow-2xl p-4 rounded-lg border border-[#C5A059] relative animate-in slide-in-from-bottom-5">
                     <div className="flex justify-between items-center mb-4 border-b border-[#C5A059]/30 pb-2">
                        <h3 className="font-cinzel font-bold text-[#8B0000] dark:text-[#ff6b6b] flex items-center gap-2">
                            <Edit className="w-5 h-5" /> Modo de Edição Manual
                        </h3>
                        <div className="flex gap-2">
                            <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-sm border border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded flex items-center gap-1 transition-colors">
                                <X className="w-4 h-4"/> Cancelar
                            </button>
                            <button onClick={handleSaveManualEdit} className="px-3 py-1 text-sm bg-green-600 text-white hover:bg-green-700 rounded flex items-center gap-1 transition-colors shadow-sm">
                                <Save className="w-4 h-4"/> Salvar Alterações
                            </button>
                        </div>
                     </div>
                     <p className="text-xs text-gray-500 mb-2 font-montserrat">
                        Use <code>__CONTINUATION_MARKER__</code> (em uma nova linha) para criar separadores visuais sem quebrar a página.
                        Use <code>&lt;hr class="page-break"&gt;</code> para forçar nova página.
                     </p>
                     <textarea 
                        value={editValue} 
                        onChange={e => setEditValue(e.target.value)} 
                        className="w-full h-[600px] p-4 font-mono text-sm border border-gray-300 rounded focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] outline-none dark:bg-gray-800 dark:text-white dark:border-gray-700" 
                     />
                 </div>
            ) : content && pages.length > 0 ? (
                <div className="bg-white dark:bg-dark-card shadow-2xl p-8 md:p-16 min-h-[600px] border border-[#C5A059]/20 relative">
                     {(!content.student_content.includes('PANORÂMA') && currentPage === 0) && (
                         <div className="mb-8 text-center border-b-2 border-[#8B0000] dark:border-[#ff6b6b] pb-4 pt-2">
                            <h1 className="font-cinzel font-bold text-2xl md:text-3xl text-[#8B0000] dark:text-[#ff6b6b] uppercase tracking-widest drop-shadow-sm">
                                PANORÂMA BÍBLICO - {content.book} {content.chapter}
                            </h1>
                        </div>
                     )}
                     
                     <div className="space-y-6">
                        {renderFormattedText(pages[currentPage])}
                     </div>
                     
                     <div className="absolute bottom-4 right-8 text-[#C5A059] font-cinzel text-sm">
                        {currentPage + 1} / {pages.length}
                     </div>

                     {currentPage === pages.length - 1 && userProgress && (
                         <div className="mt-12 text-center">
                             <button
                                onClick={handleMarkAsRead}
                                disabled={isRead}
                                className={`px-8 py-4 rounded-full font-cinzel font-bold text-lg shadow-lg flex items-center justify-center gap-2 mx-auto transition-all transform hover:scale-105 ${
                                    isRead 
                                    ? 'bg-green-600 text-white cursor-default'
                                    : 'bg-gradient-to-r from-[#C5A059] to-[#8B0000] text-white hover:shadow-xl animate-pulse'
                                }`}
                             >
                                 {isRead ? <CheckCircle className="w-6 h-6" /> : <GraduationCap className="w-6 h-6" />}
                                 {isRead ? 'ESTUDO CONCLUÍDO' : 'CONCLUIR ESTUDO'}
                             </button>
                             {isRead && <p className="text-xs text-green-600 mt-2 font-bold">Registrado no Ranking de EBD</p>}
                         </div>
                     )}
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
            <div className="fixed bottom-16 left-0 w-full bg-white dark:bg-dark-card border-t border-[#C5A059] p-4 flex justify-between items-center z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] safe-bottom">
                <button 
                    onClick={() => setCurrentPage(Math.max(0, currentPage - 1))} 
                    disabled={currentPage === 0} 
                    className="flex items-center gap-1 px-4 py-3 bg-[#8B0000] text-white rounded-lg font-bold shadow-md hover:bg-[#600018] disabled:opacity-50 disabled:bg-gray-400 transition-all active:scale-95"
                >
                    <ChevronLeft /> Anterior
                </button>
                <span className="font-cinzel font-bold text-[#1a0f0f] dark:text-white text-sm md:text-base">
                    {currentPage + 1} / {pages.length}
                </span>
                <button 
                    onClick={() => setCurrentPage(Math.min(pages.length - 1, currentPage + 1))} 
                    disabled={currentPage === pages.length - 1} 
                    className="flex items-center gap-1 px-4 py-3 bg-[#8B0000] text-white rounded-lg font-bold shadow-md hover:bg-[#600018] disabled:opacity-50 disabled:bg-gray-400 transition-all active:scale-95"
                >
                    Próximo <ChevronRight />
                </button>
            </div>
        )}
    </div>
  );
}