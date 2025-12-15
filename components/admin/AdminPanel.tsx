
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Key, ShieldCheck, RefreshCw, Loader2, Save, AlertTriangle, CheckCircle, XCircle, Info, BookOpen, Download, Server, Database, Upload, FileJson, MessageSquare, Languages, GraduationCap, Calendar, Flag, Trash2, ExternalLink, HardDrive, CloudUpload } from 'lucide-react';
import { getStoredApiKey, setStoredApiKey, generateContent } from '../../services/geminiService';
import { BIBLE_BOOKS, generateChapterKey, generateVerseKey, TOTAL_CHAPTERS } from '../../constants';
import { db, bibleStorage } from '../../services/database';
import { Type as GenType } from "@google/genai";
import { ContentReport } from '../../types';

export default function AdminPanel({ onBack, onShowToast }: { onBack: () => void, onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void }) {
  // --- STATES DE INFRAESTRUTURA ---
  const [apiKey, setApiKey] = useState('');
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  
  // --- STATES DE IMPORTAÇÃO/DOWNLOAD ---
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState('');
  const [currentBookProcessing, setCurrentBookProcessing] = useState('');
  const [offlineCount, setOfflineCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- STATES DE GERAÇÃO EM LOTE ---
  const [batchBook, setBatchBook] = useState('Gênesis');
  const [batchChapter, setBatchChapter] = useState(1);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [batchType, setBatchType] = useState<'commentary' | 'dictionary' | null>(null);
  const [stopBatch, setStopBatch] = useState(false);

  // --- STATES DE RELATÓRIOS ---
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [showReportsModal, setShowReportsModal] = useState(false);

  useEffect(() => {
    const k = getStoredApiKey();
    setStoredKey(k);
    if(k) setApiKey(k);
    checkDbConnection();
    loadReports();
    checkOfflineIntegrity();
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

  // Verifica quantos capítulos estão realmente salvos no IndexedDB
  const checkOfflineIntegrity = async () => {
      try {
          const count = await bibleStorage.count();
          setOfflineCount(count);
      } catch (e) {
          console.error("Erro ao ler IndexedDB", e);
          setOfflineCount(0);
      }
  };

  const loadReports = async () => {
      try {
          const data = await db.entities.ContentReports.list();
          setReports(data || []);
      } catch (e) {
          console.error("Erro ao carregar reports");
      }
  };

  const handleDeleteReport = async (id: string) => {
      if(!window.confirm("Marcar como resolvido e apagar?")) return;
      try {
          await db.entities.ContentReports.delete(id);
          setReports(prev => prev.filter(r => r.id !== id));
          onShowToast("Resolvido.", "success");
      } catch(e) {
          onShowToast("Erro ao deletar.", "error");
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

  // --- LÓGICA DE DOWNLOAD API (COMPACTADA E SEGURA COM INDEXEDDB) ---
  const fetchWithRetry = async (url: string, retries = 3, backoff = 1000): Promise<any> => {
      try {
          const res = await fetch(url);
          if (res.status === 429) throw new Error("RATE_LIMIT");
          if (!res.ok) throw new Error(`HTTP_${res.status}`);
          const json = await res.json();
          if (!json || !json.verses || json.verses.length === 0) throw new Error("EMPTY_DATA");
          return json;
      } catch (e: any) {
          if (retries > 0) {
              await new Promise(r => setTimeout(r, backoff));
              return fetchWithRetry(url, retries - 1, backoff * 2);
          }
          throw e;
      }
  };

  const handleDownloadBible = async () => {
      if (!window.confirm("Iniciar Download? Usaremos a nova tecnologia 'IndexedDB' para garantir que todo o conteúdo seja salvo sem travar o seu celular.")) return;
      
      setIsProcessing(true);
      setProcessStatus("Preparando banco de dados...");
      setProgress(0);
      let count = 0;
      
      onShowToast("Formatando armazenamento...", "info");
      await bibleStorage.clear();
      setOfflineCount(0); 

      try {
        for (const book of BIBLE_BOOKS) {
            if (stopBatch) break;
            setCurrentBookProcessing(book.name);

            for (let c = 1; c <= book.chapters; c++) {
                if (stopBatch) break;
                const key = `bible_acf_${book.abbrev}_${c}`;
                
                try {
                    setProcessStatus(`Baixando ${book.name} ${c}...`);
                    
                    await new Promise(r => setTimeout(r, 200));
                    
                    const data = await fetchWithRetry(`https://www.abibliadigital.com.br/api/verses/acf/${book.abbrev}/${c}`);
                    
                    if (data && data.verses) {
                        const optimizedVerses = data.verses.map((v: any) => v.text.trim());
                        await bibleStorage.save(key, optimizedVerses);
                        setOfflineCount(prev => (prev || 0) + 1);
                    }
                } catch(e: any) {
                    console.error(`Falha em ${book.name} ${c}:`, e);
                }
                
                count++;
                setProgress(Math.round((count / TOTAL_CHAPTERS) * 100));
            }
        }
      } catch (err: any) {
          alert(`Erro no processo: ${err.message}`);
      }
      
      setIsProcessing(false);
      setStopBatch(false);
      setCurrentBookProcessing('');
      await checkOfflineIntegrity(); 
      onShowToast("Download Completo! Bíblia salva no IndexedDB.", "success");
  };

  // --- LÓGICA DE IMPORTAÇÃO DE JSON (COM INDEXEDDB + NUVEM) ---
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      setIsProcessing(true);
      setProcessStatus("Lendo arquivo...");

      reader.onload = async (e) => {
          try {
              const jsonText = e.target?.result as string;
              const cleanJson = jsonText.replace(/^\uFEFF/, ''); 
              const jsonData = JSON.parse(cleanJson);
              await processBibleJSON(jsonData);
          } catch (error) {
              console.error(error);
              onShowToast("O arquivo não é um JSON válido.", "error");
              setIsProcessing(false);
          }
      };
      
      reader.readAsText(file);
  };

  const normalizeBookName = (name: string) => {
      if (!name) return "";
      let n = name.toLowerCase().trim()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
      n = n.replace(/^i\s/, "1 ").replace(/^ii\s/, "2 ").replace(/^iii\s/, "3 "); 
      n = n.replace(/^1\.\s/, "1 ").replace(/^2\.\s/, "2 ").replace(/^3\.\s/, "3 ");
      if (n.includes("job")) return "jo";
      if (n.includes("judas")) return "judas";
      if (n.includes("apoc")) return "apocalipse";
      if (n.includes("cantico")) return "cantares";
      if (n.includes("salmo")) return "salmos";
      return n;
  };

  const processBibleJSON = async (data: any) => {
      setProcessStatus("Iniciando upload Universal...");
      // Limpa Local
      await bibleStorage.clear();
      setOfflineCount(0);

      let booksArray: any[] = [];
      if (Array.isArray(data)) booksArray = data;
      else if (data.books && Array.isArray(data.books)) booksArray = data.books;
      else if (data.bible && Array.isArray(data.bible)) booksArray = data.bible;
      else if (data.data && Array.isArray(data.data)) booksArray = data.data;
      else {
          const possibleBooks = Object.values(data);
          if (possibleBooks.length > 0 && typeof possibleBooks[0] === 'object') {
              booksArray = possibleBooks;
          } else {
              onShowToast("Estrutura do JSON não reconhecida.", "error");
              setIsProcessing(false);
              return;
          }
      }

      let booksProcessed = 0;
      let totalSaved = 0;
      
      for (const bookData of booksArray) {
          const rawName = bookData.name || bookData.book || bookData.n || bookData.abbrev || "";
          const normalizedInput = normalizeBookName(rawName);
          
          const targetBook = BIBLE_BOOKS.find(b => normalizeBookName(b.name) === normalizedInput || normalizeBookName(b.abbrev) === normalizedInput);
          
          if (targetBook) {
              const chapters = bookData.chapters || bookData.c || bookData.data;
              if (chapters && Array.isArray(chapters)) {
                  for (let index = 0; index < chapters.length; index++) {
                      const chapterContent = chapters[index];
                      const chapterNum = index + 1;
                      const key = `bible_acf_${targetBook.abbrev}_${chapterNum}`;
                      
                      let simpleVerses: string[] = [];
                      if (Array.isArray(chapterContent) && (typeof chapterContent[0] === 'string')) {
                          simpleVerses = chapterContent.map((t: string) => t.trim());
                      } else if (Array.isArray(chapterContent) && typeof chapterContent[0] === 'object') {
                           simpleVerses = chapterContent.map((v: any) => (v.text || v.t || "").trim());
                      }

                      if (simpleVerses.length > 0) {
                          // 1. Salva Local (IndexedDB) para acesso imediato neste PC
                          await bibleStorage.save(key, simpleVerses);
                          
                          // 2. Salva na Nuvem (Supabase) para acesso no Android/iOS
                          // Isso pode demorar, mas garante universalidade
                          setProcessStatus(`Enviando ${targetBook.name} ${chapterNum} para Nuvem...`);
                          await db.entities.BibleChapter.saveCloud(key, simpleVerses);

                          totalSaved++;
                          if (totalSaved % 5 === 0) setOfflineCount(totalSaved);
                      }
                  }
                  booksProcessed++;
              }
          }
          
          const percentage = Math.round((booksProcessed / Math.max(1, booksArray.length)) * 100);
          setProgress(percentage);
          setCurrentBookProcessing(rawName);
          // Pausa curta para não travar a UI e o servidor
          await new Promise(r => setTimeout(r, 100)); 
      }

      setIsProcessing(false);
      await checkOfflineIntegrity();
      onShowToast(`Sucesso! Bíblia disponível em TODOS os dispositivos.`, "success");
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
          const bookMeta = BIBLE_BOOKS.find(b => b.name === batchBook);
          if (!bookMeta) throw new Error("Livro inválido");

          const cacheKey = `bible_acf_${bookMeta.abbrev}_${batchChapter}`;
          
          // Agora lê do IndexedDB
          const cachedVerses = await bibleStorage.get(cacheKey);
          
          let verses: {number: number, text: string}[] = [];
          if (cachedVerses && Array.isArray(cachedVerses)) {
              verses = cachedVerses.map((t: string, i: number) => ({ number: i + 1, text: t }));
          } else {
              // Fallback online
              const res = await fetch(`https://www.abibliadigital.com.br/api/verses/acf/${bookMeta.abbrev}/${batchChapter}`);
              const data = await res.json();
              verses = data.verses.map((v: any) => ({ number: v.number, text: v.text }));
          }

          if (verses.length === 0) throw new Error("Texto bíblico não encontrado. Baixe a Bíblia primeiro.");

          let processed = 0;
          
          for (const verse of verses) {
              if (stopBatch) break;
              const verseKey = generateVerseKey(batchBook, batchChapter, verse.number);
              
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
              await new Promise(r => setTimeout(r, 2000));
          }
          onShowToast("Lote concluído!", "success");

      } catch (e: any) {
          onShowToast(`Erro: ${e.message}`, "error");
      } finally {
          setIsGeneratingBatch(false);
          setBatchType(null);
      }
  };

  const generateSingleCommentary = async (book: string, chapter: number, verseNum: number, text: string, key: string) => {
      const prompt = `ATUE COMO: Professor Michel Felix. TAREFA: Comentário bíblico curto e vibrante sobre ${book} ${chapter}:${verseNum}. TEXTO: "${text}". VIÉS: Pentecostal Clássico. ESTRUTURA: 2 parágrafos.`;
      const aiRes = await generateContent(prompt);
      await db.entities.Commentary.create({ book, chapter, verse: verseNum, verse_key: key, commentary_text: aiRes });
  };

  const generateSingleDictionary = async (book: string, chapter: number, verseNum: number, text: string, key: string) => {
      const isOT = BIBLE_BOOKS.find(b => b.name === book)?.testament === 'old';
      const prompt = `Análise lexical de ${book} ${chapter}:${verseNum} ("${text}"). Idioma: ${isOT ? 'HEBRAICO' : 'GREGO'}. JSON completo.`;
      const schema = { type: GenType.OBJECT, properties: { hebrewGreekText: { type: GenType.STRING }, phoneticText: { type: GenType.STRING }, words: { type: GenType.ARRAY, items: { type: GenType.OBJECT, properties: { original: { type: GenType.STRING }, transliteration: { type: GenType.STRING }, portuguese: { type: GenType.STRING }, polysemy: { type: GenType.STRING }, etymology: { type: GenType.STRING }, grammar: { type: GenType.STRING } } } } } };
      const res = await generateContent(prompt, schema);
      await db.entities.Dictionary.create({ book, chapter, verse: verseNum, verse_key: key, original_text: res.hebrewGreekText, transliteration: res.phoneticText, key_words: res.words || [] });
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-300">
      
      {/* --- MODAL DE RELATÓRIOS --- */}
      {showReportsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60" onClick={() => setShowReportsModal(false)} />
              <div className="bg-white dark:bg-[#1E1E1E] w-full max-w-2xl max-h-[80vh] rounded-2xl p-6 relative z-10 overflow-hidden flex flex-col shadow-2xl">
                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-[#C5A059]">
                      <h3 className="font-cinzel font-bold text-xl dark:text-white flex items-center gap-2">
                          <Flag className="w-5 h-5 text-red-500" /> Relatórios de Erros
                      </h3>
                      <button onClick={() => setShowReportsModal(false)}><XCircle className="w-6 h-6 text-gray-500" /></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-4">
                      {reports.length === 0 ? (
                          <div className="text-center py-10 text-gray-500">
                              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                              <p>Tudo limpo! Nenhum erro pendente.</p>
                          </div>
                      ) : (
                          reports.map(rep => (
                              <div key={rep.id} className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 p-4 rounded-lg">
                                  <div className="flex justify-between items-start mb-2">
                                      <div>
                                          <span className="font-bold text-red-700 dark:text-red-300 block">{rep.reference_text}</span>
                                          <span className="text-xs text-gray-500 uppercase font-bold">{rep.type}</span>
                                      </div>
                                      <button onClick={() => handleDeleteReport(rep.id!)} className="text-gray-400 hover:text-green-600" title="Marcar como Resolvido">
                                          <CheckCircle className="w-5 h-5" />
                                      </button>
                                  </div>
                                  <p className="text-gray-800 dark:text-gray-200 text-sm mb-2 font-mono bg-white dark:bg-black/20 p-2 rounded">
                                      "{rep.report_text}"
                                  </p>
                                  <div className="text-xs text-gray-400 flex justify-between">
                                      <span>Reportado por: {rep.user_name}</span>
                                      <span>{new Date(rep.date).toLocaleDateString()}</span>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}

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
                 <h3 className="font-bold text-gray-500 mb-2 flex items-center gap-2"><HardDrive className="w-4 h-4"/> Armazenamento Offline</h3>
                 <div className="flex items-end justify-between">
                     <div>
                         <span className="text-3xl font-bold text-[#8B0000] dark:text-[#ff6b6b]">{offlineCount !== null ? offlineCount : '...'}</span>
                         <span className="text-xs text-gray-500 ml-1">capítulos salvos</span>
                     </div>
                     <button onClick={checkOfflineIntegrity} className="text-xs underline text-blue-500">Verificar Agora</button>
                 </div>
                 <div className="w-full bg-gray-200 h-2 rounded-full mt-2">
                     <div className="bg-green-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${((offlineCount || 0) / TOTAL_CHAPTERS) * 100}%` }}></div>
                 </div>
                 <p className="text-[10px] text-gray-400 mt-2">Tecnologia IndexedDB (Sem limites de 5MB).</p>
            </div>
        </div>

        {/* === SEÇÃO 2: BÍBLIA OFFLINE === */}
        <h2 className="font-cinzel font-bold text-xl text-[#8B0000] dark:text-[#ff6b6b] border-b border-[#C5A059] pb-2">1. Bíblia (Texto)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow hover:shadow-lg transition border border-[#C5A059]">
                <CloudUpload className="w-8 h-8 text-[#C5A059] mb-3" />
                <h3 className="font-bold dark:text-white">Importar JSON (Universal)</h3>
                <p className="text-xs text-gray-500 mb-4">Carrega e envia para a Nuvem (Android/iOS).</p>
                {isProcessing && !isGeneratingBatch ? (
                    <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden relative">
                         <div className="h-full bg-[#C5A059]" style={{ width: `${progress}%` }}></div>
                         <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[#8B0000] drop-shadow-sm whitespace-nowrap px-2">{processStatus}</span>
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
                <h3 className="font-bold dark:text-white">Download da Nuvem (Otimizado)</h3>
                <p className="text-xs text-gray-500 mb-4">Baixa da internet se o JSON falhar.</p>
                {isProcessing && !isGeneratingBatch ? (
                    <button onClick={() => setStopBatch(true)} className="w-full py-2 bg-red-100 text-red-600 rounded font-bold text-sm">
                        Cancelar Download ({currentBookProcessing})
                    </button>
                ) : (
                    <button onClick={handleDownloadBible} className="w-full py-2 border border-gray-400 text-gray-600 rounded font-bold text-sm hover:bg-gray-100 dark:hover:bg-gray-800">
                        Iniciar Download Otimizado
                    </button>
                )}
            </div>
        </div>

        {/* ... Rest of the file unchanged ... */}
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
        
        {/* === SEÇÃO 4: FEEDBACK DA COMUNIDADE === */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="bg-white dark:bg-dark-card p-4 rounded-xl shadow flex items-center justify-between border border-red-100 dark:border-red-900/30">
                <div className="flex items-center gap-3">
                    <div className="bg-red-100 p-2 rounded-full relative">
                        <Flag className="w-5 h-5 text-red-600" />
                        {reports.length > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full animate-ping"></span>}
                    </div>
                    <div>
                        <h4 className="font-bold text-sm dark:text-white">Relatórios de Erros</h4>
                        <p className="text-xs text-gray-500">{reports.length} pendentes</p>
                    </div>
                </div>
                <button 
                    className="px-3 py-1 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700 transition"
                    onClick={() => setShowReportsModal(true)}
                >
                    Ver Lista
                </button>
            </div>

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
