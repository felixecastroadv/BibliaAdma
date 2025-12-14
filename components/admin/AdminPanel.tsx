
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Key, ShieldCheck, RefreshCw, Loader2, Save, AlertTriangle, CheckCircle, XCircle, Info, BookOpen, Download, Server, Database, Upload, FileJson, Sparkles, Languages, GraduationCap, Calendar, MessageSquare, Mic } from 'lucide-react';
import { getStoredApiKey, setStoredApiKey, generateContent } from '../../services/geminiService';
import { BIBLE_BOOKS, generateChapterKey, generateVerseKey } from '../../constants';
import { db } from '../../services/database';
import { Type as GenType } from "@google/genai";

export default function AdminPanel({ onBack, onShowToast }: { onBack: () => void, onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void }) {
  // --- STATES DE INFRAESTRUTURA ---
  const [apiKey, setApiKey] = useState('');
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  
  // --- STATES DE IMPORTAÇÃO ---
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- STATES DE GERAÇÃO EM LOTE (FÁBRICA DE CONTEÚDO) ---
  const [batchBook, setBatchBook] = useState('Gênesis');
  const [batchChapter, setBatchChapter] = useState(1);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [batchType, setBatchType] = useState<'commentary' | 'dictionary' | null>(null);
  const [stopBatch, setStopBatch] = useState(false);

  useEffect(() => {
    const k = getStoredApiKey();
    setStoredKey(k);
    if(k) setApiKey(k);
    checkDbConnection();
  }, []);

  const checkDbConnection = async () => {
    setDbStatus('checking');
    try {
        await db.entities.ReadingProgress.list('chapters', 1);
        setDbStatus('connected');
    } catch (e) {
        setDbStatus('error');
    }
  };

  const handleSaveKey = () => {
    if (apiKey.trim()) {
      setStoredApiKey(apiKey.trim());
      setStoredKey(apiKey.trim());
      onShowToast('Chave de API salva localmente!', 'success');
    } else {
      setStoredApiKey('');
      setStoredKey(null);
      onShowToast('Chave removida.', 'info');
    }
  };

  const handleClearKey = () => {
    setStoredApiKey('');
    setStoredKey(null);
    setApiKey('');
    onShowToast('Chave removida.', 'info');
  };

  // --- LÓGICA DE DOWNLOAD API (FALLBACK) ---
  const handleDownloadBible = async () => {
      if (!window.confirm("Isso irá baixar todos os textos da API online. Pode demorar. Continuar?")) return;
      
      setIsProcessing(true);
      setProcessStatus("Baixando da API...");
      setProgress(0);
      let total = 0;
      let count = 0;
      
      BIBLE_BOOKS.forEach(b => total += b.chapters);

      for (const book of BIBLE_BOOKS) {
          for (let c = 1; c <= book.chapters; c++) {
              const key = `bible_acf_${book.abbrev}_${c}`;
              if (!localStorage.getItem(key)) {
                   try {
                        const res = await fetch(`https://www.abibliadigital.com.br/api/verses/acf/${book.abbrev}/${c}`);
                        if (res.ok) {
                            const data = await res.json();
                             if (data.verses) {
                                const cleanVerses = data.verses.map((v: any) => ({ number: v.number, text: v.text.trim() }));
                                localStorage.setItem(key, JSON.stringify(cleanVerses));
                            }
                        }
                   } catch(e) {}
                   await new Promise(r => setTimeout(r, 200)); 
              }
              count++;
              setProgress(Math.round((count / total) * 100));
          }
      }
      
      setIsProcessing(false);
      onShowToast("Bíblia baixada para uso offline!", "success");
  };

  // --- LÓGICA DE IMPORTAÇÃO DE JSON LOCAL (MELHORADA) ---
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      setIsProcessing(true);
      setProcessStatus("Lendo arquivo...");

      reader.onload = async (e) => {
          try {
              const jsonText = e.target?.result as string;
              const jsonData = JSON.parse(jsonText);
              await processBibleJSON(jsonData);
          } catch (error) {
              console.error(error);
              onShowToast("Erro ao ler JSON. Formato inválido ou corrompido.", "error");
              setIsProcessing(false);
          }
      };
      
      reader.readAsText(file);
  };

  const processBibleJSON = async (data: any) => {
      setProcessStatus("Processando estrutura...");
      let booksProcessed = 0;
      let totalChapters = 0;
      
      // 1. Tenta encontrar o Array de livros em estruturas comuns
      let booksArray: any[] = [];
      if (Array.isArray(data)) {
          booksArray = data;
      } else if (data.books && Array.isArray(data.books)) {
          booksArray = data.books; // Formato comum { version: '...', books: [...] }
      } else if (data.bible && Array.isArray(data.bible)) {
          booksArray = data.bible;
      } else if (data.data && Array.isArray(data.data)) {
          booksArray = data.data;
      } else {
          onShowToast("Formato não reconhecido. O JSON precisa ter uma lista de livros.", "error");
          setIsProcessing(false);
          return;
      }

      // Normaliza nomes para comparação (remove acentos, lowercase)
      const normalize = (str: string) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";

      for (const bookData of booksArray) {
          // Tenta encontrar o livro correspondente nas nossas constantes
          const bookName = bookData.name || bookData.book || bookData.n || ""; // .n é comum em alguns JSONs compactos
          if (!bookName) continue;

          const targetBook = BIBLE_BOOKS.find(b => normalize(b.name) === normalize(bookName));
          
          if (targetBook) {
              // Verifica onde estão os capítulos
              const chapters = bookData.chapters || bookData.c || bookData.data;

              if (chapters && Array.isArray(chapters)) {
                  chapters.forEach((chapterContent: any, index: number) => {
                      const chapterNum = index + 1;
                      const key = `bible_acf_${targetBook.abbrev}_${chapterNum}`;
                      
                      let formattedVerses: {number: number, text: string}[] = [];

                      // Suporta formato: chapters: [ ["v1", "v2"], ... ] (Array de Strings)
                      if (Array.isArray(chapterContent) && typeof chapterContent[0] === 'string') {
                          formattedVerses = chapterContent.map((text: string, vIndex: number) => ({
                              number: vIndex + 1,
                              text: text.trim()
                          }));
                      }
                      // Suporta formato: chapters: [ [ {number:1, text: "v1"}, ... ] ] (Array de Objetos)
                      else if (Array.isArray(chapterContent) && typeof chapterContent[0] === 'object') {
                           formattedVerses = chapterContent.map((v: any, vIndex: number) => ({
                              number: v.number || parseInt(v.verse) || (vIndex + 1),
                              text: (v.text || v.t || "").trim()
                          }));
                      }

                      if (formattedVerses.length > 0) {
                          localStorage.setItem(key, JSON.stringify(formattedVerses));
                          totalChapters++;
                      }
                  });
                  booksProcessed++;
              }
          }
          
          const percentage = Math.round((booksProcessed / Math.max(1, booksArray.length)) * 100);
          setProgress(percentage);
          // Pausa a cada 5 livros para UI respirar
          if (booksProcessed % 5 === 0) await new Promise(r => setTimeout(r, 10)); 
      }

      setIsProcessing(false);
      onShowToast(`Sucesso! ${totalChapters} capítulos de ${booksProcessed} livros importados.`, "success");
      if (fileInputRef.current) fileInputRef.current.value = "";
  };


  // --- LÓGICA DE GERAÇÃO EM LOTE ---
  const handleBatchGenerate = async (type: 'commentary' | 'dictionary') => {
      setStopBatch(false);
      setIsGeneratingBatch(true);
      setBatchType(type);
      setProgress(0);
      setProcessStatus("Iniciando IA...");

      try {
          // 1. Pega os versículos do capítulo selecionado
          const bookMeta = BIBLE_BOOKS.find(b => b.name === batchBook);
          if (!bookMeta) throw new Error("Livro inválido");

          const cacheKey = `bible_acf_${bookMeta.abbrev}_${batchChapter}`;
          const cachedVerses = localStorage.getItem(cacheKey);
          
          let verses: {number: number, text: string}[] = [];
          if (cachedVerses) {
              verses = JSON.parse(cachedVerses);
          } else {
              // Tenta fetch rápido se não tiver cache
              const res = await fetch(`https://www.abibliadigital.com.br/api/verses/acf/${bookMeta.abbrev}/${batchChapter}`);
              const data = await res.json();
              verses = data.verses.map((v: any) => ({ number: v.number, text: v.text }));
          }

          if (verses.length === 0) throw new Error("Texto bíblico não encontrado para gerar conteúdo.");

          let processed = 0;
          
          for (const verse of verses) {
              if (stopBatch) break; // Permite cancelar

              const verseKey = generateVerseKey(batchBook, batchChapter, verse.number);
              
              // Verifica se já existe para não gastar cota à toa (opcional, aqui vou forçar geração se o admin mandou)
              // Mas para ser eficiente, vamos verificar
              if (type === 'commentary') {
                  const exists = await db.entities.Commentary.filter({ verse_key: verseKey });
                  if (exists.length === 0) {
                      await generateSingleCommentary(batchBook, batchChapter, verse.number, verse.text, verseKey);
                  }
              } else {
                  const exists = await db.entities.Dictionary.filter({ verse_key: verseKey });
                  if (exists.length === 0) {
                      await generateSingleDictionary(batchBook, batchChapter, verse.number, verse.text, verseKey);
                  }
              }

              processed++;
              setProgress(Math.round((processed / verses.length) * 100));
              setProcessStatus(`Gerando ${type === 'commentary' ? 'Comentário' : 'Dicionário'} v.${verse.number}...`);
              
              // Delay para não estourar rate limit da API
              await new Promise(r => setTimeout(r, 2000));
          }

          onShowToast(`${type === 'commentary' ? 'Comentários' : 'Dicionários'} gerados com sucesso!`, "success");

      } catch (e: any) {
          console.error(e);
          onShowToast(`Erro no lote: ${e.message}`, "error");
      } finally {
          setIsGeneratingBatch(false);
          setBatchType(null);
      }
  };

  const generateSingleCommentary = async (book: string, chapter: number, verseNum: number, text: string, key: string) => {
      const prompt = `
            ATUE COMO: Professor Michel Felix.
            TAREFA: Comentário bíblico curto e vibrante sobre ${book} ${chapter}:${verseNum}.
            TEXTO: "${text}"
            VIÉS: Pentecostal Clássico. Foco na aplicação prática.
            ESTRUTURA: 2 parágrafos. Sem saudações.
      `;
      const aiRes = await generateContent(prompt);
      await db.entities.Commentary.create({
          book, chapter, verse: verseNum, verse_key: key, commentary_text: aiRes
      });
  };

  const generateSingleDictionary = async (book: string, chapter: number, verseNum: number, text: string, key: string) => {
      const isOT = BIBLE_BOOKS.find(b => b.name === book)?.testament === 'old';
      const lang = isOT ? 'HEBRAICO' : 'GREGO';
      
      const prompt = `
          Análise lexical de ${book} ${chapter}:${verseNum} ("${text}"). Idioma: ${lang}.
          JSON com: hebrewGreekText, phoneticText, words array (original, transliteration, portuguese, polysemy, etymology, grammar).
      `;
      const schema = {
        type: GenType.OBJECT,
        properties: {
            hebrewGreekText: { type: GenType.STRING },
            phoneticText: { type: GenType.STRING },
            words: { type: GenType.ARRAY, items: { type: GenType.OBJECT, properties: {
                original: { type: GenType.STRING },
                transliteration: { type: GenType.STRING },
                portuguese: { type: GenType.STRING },
                polysemy: { type: GenType.STRING },
                etymology: { type: GenType.STRING },
                grammar: { type: GenType.STRING }
            }}}
        }
      };
      
      const res = await generateContent(prompt, schema);
      await db.entities.Dictionary.create({
          book, chapter, verse: verseNum, verse_key: key,
          original_text: res.hebrewGreekText,
          transliteration: res.phoneticText,
          key_words: res.words || []
      });
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-300">
      <div className="bg-[#1a0f0f] text-white p-4 flex items-center gap-4 sticky top-0 shadow-lg z-10">
        <button onClick={onBack}><ChevronLeft /></button>
        <h1 className="font-cinzel font-bold text-[#C5A059] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5"/> Painel do Editor Chefe
        </h1>
      </div>

      <div className="p-6 max-w-4xl mx-auto space-y-8 pb-24">
        
        {/* === SEÇÃO 1: INFRAESTRUTURA === */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow border border-[#C5A059]/20">
                <h3 className="font-bold text-gray-500 mb-4 flex items-center gap-2"><Server className="w-4 h-4"/> Status Banco de Dados</h3>
                <div className="flex items-center gap-3">
                    {dbStatus === 'checking' && <Loader2 className="w-6 h-6 animate-spin text-blue-500" />}
                    {dbStatus === 'connected' && <CheckCircle className="w-6 h-6 text-green-500" />}
                    {dbStatus === 'error' && <XCircle className="w-6 h-6 text-red-500" />}
                    <span className="font-bold dark:text-white">
                        {dbStatus === 'connected' ? 'Conectado (Supabase)' : 'Verificando...'}
                    </span>
                </div>
                <button onClick={checkDbConnection} className="mt-4 text-xs text-[#8B0000] underline flex items-center gap-1"><RefreshCw className="w-3 h-3"/> Testar</button>
            </div>

            <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow border border-[#C5A059]/20">
                 <h3 className="font-bold text-gray-500 mb-4 flex items-center gap-2"><Key className="w-4 h-4"/> API Key (Gemini)</h3>
                 {storedKey ? (
                     <div className="bg-green-100 text-green-800 p-2 rounded text-xs flex justify-between">
                         <span className="font-mono">••••{storedKey.slice(-4)}</span>
                         <button onClick={handleClearKey} className="underline text-red-600">Remover</button>
                     </div>
                 ) : (
                     <div className="bg-yellow-100 text-yellow-800 p-2 rounded text-xs flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> Modo Rotação (Servidor)</div>
                 )}
                 <div className="mt-4 flex gap-2">
                     <input type="password" placeholder="Nova Key..." className="flex-1 border p-1 rounded text-xs dark:bg-gray-800 dark:text-white" value={apiKey} onChange={e => setApiKey(e.target.value)} />
                     <button onClick={handleSaveKey} className="bg-[#8B0000] text-white px-3 rounded"><Save className="w-4 h-4"/></button>
                 </div>
            </div>
        </div>

        {/* === SEÇÃO 2: BÍBLIA OFFLINE === */}
        <h2 className="font-cinzel font-bold text-xl text-[#8B0000] dark:text-[#ff6b6b] border-b border-[#C5A059] pb-2">1. Bíblia Offline (Texto)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow hover:shadow-lg transition border border-[#C5A059]">
                <FileJson className="w-8 h-8 text-[#C5A059] mb-3" />
                <h3 className="font-bold dark:text-white">Importar JSON</h3>
                <p className="text-xs text-gray-500 mb-4">Carregue arquivo <code>.json</code> (Array de livros ou formato 'abibliadigital').</p>
                {isProcessing && !isGeneratingBatch ? (
                    <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden relative">
                         <div className="h-full bg-[#C5A059]" style={{ width: `${progress}%` }}></div>
                         <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{processStatus} {progress}%</span>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                        <button onClick={() => fileInputRef.current?.click()} className="w-full py-2 bg-[#8B0000] text-white rounded font-bold text-sm flex items-center justify-center gap-2">
                            <Upload className="w-4 h-4"/> Selecionar Arquivo
                        </button>
                    </div>
                )}
            </div>
            
            <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow">
                <Download className="w-8 h-8 text-gray-400 mb-3" />
                <h3 className="font-bold dark:text-white">Baixar da Nuvem</h3>
                <p className="text-xs text-gray-500 mb-4">Se não tiver JSON, baixe da API pública (Lento).</p>
                <button onClick={handleDownloadBible} className="w-full py-2 border border-gray-400 text-gray-600 rounded font-bold text-sm hover:bg-gray-100 dark:hover:bg-gray-800">
                    Iniciar Download API
                </button>
            </div>
        </div>

        {/* === SEÇÃO 3: FÁBRICA DE CONTEÚDO (IA) === */}
        <h2 className="font-cinzel font-bold text-xl text-[#8B0000] dark:text-[#ff6b6b] border-b border-[#C5A059] pb-2 mt-8">2. Fábrica de Conteúdo (IA)</h2>
        
        <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow border-l-4 border-[#8B0000]">
            <div className="flex flex-col md:flex-row gap-4 items-end mb-6">
                <div className="flex-1 w-full">
                    <label className="text-xs font-bold text-gray-500 uppercase">Livro Alvo</label>
                    <select value={batchBook} onChange={e => setBatchBook(e.target.value)} className="w-full p-2 border rounded font-cinzel font-bold dark:bg-gray-800 dark:text-white">
                        {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                    </select>
                </div>
                <div className="w-24">
                    <label className="text-xs font-bold text-gray-500 uppercase">Capítulo</label>
                    <input type="number" value={batchChapter} onChange={e => setBatchChapter(Number(e.target.value))} className="w-full p-2 border rounded font-bold dark:bg-gray-800 dark:text-white" min={1} />
                </div>
            </div>

            {isGeneratingBatch ? (
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-[#8B0000] flex items-center gap-2">
                            <Loader2 className="animate-spin w-4 h-4"/> {processStatus}
                        </span>
                        <button onClick={() => setStopBatch(true)} className="text-xs text-red-500 underline">Parar</button>
                    </div>
                    <div className="w-full bg-gray-300 rounded-full h-4">
                        <div className="bg-[#8B0000] h-4 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                    <p className="text-center text-xs mt-1">{progress}% Concluído</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button 
                        onClick={() => handleBatchGenerate('commentary')}
                        className="p-4 border border-[#C5A059] rounded-lg flex flex-col items-center gap-2 hover:bg-[#C5A059]/10 transition group"
                    >
                        <MessageSquare className="w-6 h-6 text-[#C5A059] group-hover:scale-110 transition" />
                        <div className="text-center">
                            <span className="font-bold text-sm block dark:text-white">Gerar Comentários</span>
                            <span className="text-[10px] text-gray-500">Para todos os versículos do capítulo</span>
                        </div>
                    </button>

                    <button 
                        onClick={() => handleBatchGenerate('dictionary')}
                        className="p-4 border border-[#C5A059] rounded-lg flex flex-col items-center gap-2 hover:bg-[#C5A059]/10 transition group"
                    >
                        <Languages className="w-6 h-6 text-[#C5A059] group-hover:scale-110 transition" />
                        <div className="text-center">
                            <span className="font-bold text-sm block dark:text-white">Gerar Dicionários</span>
                            <span className="text-[10px] text-gray-500">Análise léxica completa do capítulo</span>
                        </div>
                    </button>

                    <button 
                         className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg flex flex-col items-center gap-2 opacity-50 cursor-not-allowed"
                         title="Use a aba EBD no App"
                    >
                        <GraduationCap className="w-6 h-6 text-gray-400" />
                        <div className="text-center">
                            <span className="font-bold text-sm block dark:text-white">Gerar Panorama EBD</span>
                            <span className="text-[10px] text-gray-500">Disponível na aba "EBD" do App</span>
                        </div>
                    </button>
                </div>
            )}
        </div>

        {/* === SEÇÃO 4: OUTROS === */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="bg-white dark:bg-dark-card p-4 rounded-xl shadow flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-2 rounded-full"><Calendar className="w-5 h-5 text-purple-600" /></div>
                    <div>
                        <h4 className="font-bold text-sm dark:text-white">Devocional Diário</h4>
                        <p className="text-xs text-gray-500">Forçar geração do dia</p>
                    </div>
                </div>
                <button className="px-3 py-1 bg-purple-600 text-white rounded text-xs font-bold" onClick={() => onShowToast("Use o botão de edição na tela de Devocional", "info")}>Ir p/ Tela</button>
            </div>
        </div>

      </div>
    </div>
  );
}
