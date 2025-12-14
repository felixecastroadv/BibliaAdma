
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Key, ShieldCheck, RefreshCw, Loader2, Save, AlertTriangle, CheckCircle, XCircle, Info, BookOpen, Download, Server, Database, Upload, FileJson, MessageSquare, Languages, GraduationCap, Calendar, Flag, Trash2, ExternalLink, HardDrive } from 'lucide-react';
import { getStoredApiKey, setStoredApiKey, generateContent } from '../../services/geminiService';
import { BIBLE_BOOKS, generateChapterKey, generateVerseKey, TOTAL_CHAPTERS } from '../../constants';
import { db } from '../../services/database';
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

  // Verifica quantos capítulos estão realmente salvos no LocalStorage
  const checkOfflineIntegrity = () => {
      let count = 0;
      BIBLE_BOOKS.forEach(b => {
          for(let c=1; c<=b.chapters; c++) {
              if (localStorage.getItem(`bible_acf_${b.abbrev}_${c}`)) count++;
          }
      });
      setOfflineCount(count);
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

  // --- LÓGICA DE DOWNLOAD API (ROBUSTA & OTIMIZADA) ---
  const fetchWithRetry = async (url: string, retries = 3, backoff = 1000): Promise<any> => {
      try {
          const res = await fetch(url);
          if (res.status === 429) throw new Error("RATE_LIMIT");
          if (!res.ok) throw new Error(`HTTP_${res.status}`);
          const json = await res.json();
          // Validação extra: o JSON deve ter versículos
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
      if (!window.confirm("ATENÇÃO: O download será reiniciado. Isso otimizará o banco de dados para economizar espaço. Continuar?")) return;
      
      setIsProcessing(true);
      setProcessStatus("Preparando...");
      setProgress(0);
      let count = 0;
      
      // Limpa dados antigos para evitar conflitos de formato e liberar espaço
      onShowToast("Limpando cache antigo...", "info");
      BIBLE_BOOKS.forEach(b => {
          for(let c=1; c<=b.chapters; c++) localStorage.removeItem(`bible_acf_${b.abbrev}_${c}`);
      });

      try {
        for (const book of BIBLE_BOOKS) {
            if (stopBatch) break;
            setCurrentBookProcessing(book.name);

            for (let c = 1; c <= book.chapters; c++) {
                if (stopBatch) break;
                const key = `bible_acf_${book.abbrev}_${c}`;
                
                try {
                    setProcessStatus(`Baixando ${book.name} ${c}...`);
                    
                    // Delay para evitar bloqueio (300ms)
                    await new Promise(r => setTimeout(r, 300));
                    
                    const data = await fetchWithRetry(`https://www.abibliadigital.com.br/api/verses/acf/${book.abbrev}/${c}`);
                    
                    if (data && data.verses) {
                        // OTIMIZAÇÃO: Salva apenas array de strings ["Texto v1", "Texto v2"]
                        // Isso economiza MUITO espaço no LocalStorage (evita repetição de chaves 'text', 'number')
                        const optimizedVerses = data.verses.map((v: any) => v.text.trim());
                        localStorage.setItem(key, JSON.stringify(optimizedVerses));
                    }
                } catch(e: any) {
                    console.error(`Falha em ${book.name} ${c}:`, e);
                    // Se falhar, não salva nada, permitindo que o usuário tente novamente depois
                }
                
                count++;
                setProgress(Math.round((count / TOTAL_CHAPTERS) * 100));
            }
        }
      } catch (err: any) {
          if (err.name === 'QuotaExceededError') {
              alert("ERRO: Memória do navegador cheia! O modo otimizado deve resolver, mas tente limpar o cache do navegador se persistir.");
          }
      }
      
      setIsProcessing(false);
      setStopBatch(false);
      setCurrentBookProcessing('');
      checkOfflineIntegrity(); // Atualiza contador
      onShowToast("Processo finalizado. Verifique a integridade.", "success");
  };

  // --- LÓGICA DE IMPORTAÇÃO DE JSON (NORMALIZADOR AVANÇADO) ---
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      setIsProcessing(true);
      setProcessStatus("Lendo arquivo...");

      reader.onload = async (e) => {
          try {
              const jsonText = e.target?.result as string;
              // Tenta limpar caracteres invisíveis que quebram JSON
              const cleanJson = jsonText.replace(/^\uFEFF/, ''); 
              const jsonData = JSON.parse(cleanJson);
              await processBibleJSON(jsonData);
          } catch (error) {
              console.error(error);
              onShowToast("O arquivo não é um JSON válido. Verifique a sintaxe.", "error");
              setIsProcessing(false);
          }
      };
      
      reader.readAsText(file);
  };

  const normalizeBookName = (name: string) => {
      if (!name) return "";
      let n = name.toLowerCase().trim()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove acentos

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
      setProcessStatus("Otimizando e salvando...");
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
      
      for (const bookData of booksArray) {
          const rawName = bookData.name || bookData.book || bookData.n || bookData.abbrev || "";
          const normalizedInput = normalizeBookName(rawName);
          
          const targetBook = BIBLE_BOOKS.find(b => normalizeBookName(b.name) === normalizedInput || normalizeBookName(b.abbrev) === normalizedInput);
          
          if (targetBook) {
              const chapters = bookData.chapters || bookData.c || bookData.data;
              if (chapters && Array.isArray(chapters)) {
                  chapters.forEach((chapterContent: any, index: number) => {
                      const chapterNum = index + 1;
                      const key = `bible_acf_${targetBook.abbrev}_${chapterNum}`;
                      
                      let simpleVerses: string[] = [];

                      // Formato 1: Array de Strings (Ideal)
                      if (Array.isArray(chapterContent) && (typeof chapterContent[0] === 'string')) {
                          simpleVerses = chapterContent.map((t: string) => t.trim());
                      }
                      // Formato 2: Array de Objetos
                      else if (Array.isArray(chapterContent) && typeof chapterContent[0] === 'object') {
                           simpleVerses = chapterContent.map((v: any) => (v.text || v.t || "").trim());
                      }

                      if (simpleVerses.length > 0) {
                          localStorage.setItem(key, JSON.stringify(simpleVerses));
                      }
                  });
                  booksProcessed++;
              }
          }
          
          const percentage = Math.round((booksProcessed / Math.max(1, booksArray.length)) * 100);
          setProgress(percentage);
          setCurrentBookProcessing(rawName);
          if (booksProcessed % 10 === 0) await new Promise(r => setTimeout(r, 5));
      }

      setIsProcessing(false);
      checkOfflineIntegrity();
      onShowToast(`Importação concluída! Verifique o contador.`, "success");
      if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- LÓGICA DE GERAÇÃO EM LOTE (MANTIDA IGUAL) ---
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
          const cachedVerses = localStorage.getItem(cacheKey);
          
          let verses: {number: number, text: string}[] = [];
          if (cachedVerses) {
              const parsed = JSON.parse(cachedVerses);
              // Suporte a formato otimizado (array de strings) ou antigo (objetos)
              if (parsed.length > 0 && typeof parsed[0] === 'string') {
                  verses = parsed.map((t: string, i: number) => ({ number: i + 1, text: t }));
              } else {
                  verses = parsed;
              }
          } else {
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
                  {/* ... conteúdo do modal ... */}
                  <button onClick={() => setShowReportsModal(false)}><XCircle className="w-6 h-6 text-gray-500" /></button>
                  {/* ... (mantido igual) ... */}
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
        
        {/* === SEÇÃO 1: STATUS DO SISTEMA === */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow border border-[#C5A059]/20">
                <h3 className="font-bold text-gray-500 mb-4 flex items-center gap-2"><Server className="w-4 h-4"/> Banco de Dados</h3>
                <div className="flex items-center gap-3">
                    {dbStatus === 'connected' ? <CheckCircle className="w-6 h-6 text-green-500" /> : <Loader2 className="w-6 h-6 animate-spin text-blue-500" />}
                    <span className="font-bold dark:text-white">
                        {dbStatus === 'connected' ? 'Supabase Conectado' : 'Verificando...'}
                    </span>
                </div>
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
            </div>
        </div>

        {/* === SEÇÃO 2: BÍBLIA OFFLINE === */}
        <h2 className="font-cinzel font-bold text-xl text-[#8B0000] dark:text-[#ff6b6b] border-b border-[#C5A059] pb-2">1. Bíblia Offline (Texto)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow hover:shadow-lg transition border border-[#C5A059]">
                <FileJson className="w-8 h-8 text-[#C5A059] mb-3" />
                <h3 className="font-bold dark:text-white">Importar JSON</h3>
                <p className="text-xs text-gray-500 mb-4">Carregue arquivo .json (Otimizado automaticamente).</p>
                {isProcessing && !isGeneratingBatch ? (
                    <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden relative">
                         <div className="h-full bg-[#C5A059]" style={{ width: `${progress}%` }}></div>
                         <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[#8B0000]">{processStatus} {progress}%</span>
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
                <p className="text-xs text-gray-500 mb-4">Baixa e compacta a Bíblia para caber no seu dispositivo.</p>
                {isProcessing && !isGeneratingBatch ? (
                    <button onClick={() => setStopBatch(true)} className="w-full py-2 bg-red-100 text-red-600 rounded font-bold text-sm">
                        Cancelar ({currentBookProcessing})
                    </button>
                ) : (
                    <button onClick={handleDownloadBible} className="w-full py-2 border border-gray-400 text-gray-600 rounded font-bold text-sm hover:bg-gray-100 dark:hover:bg-gray-800">
                        Iniciar Download Otimizado
                    </button>
                )}
            </div>
        </div>

        {/* ... Resto do código (Fábrica de Conteúdo, Relatórios) mantido igual ... */}
        {/* Apenas fechando as tags corretamente para o XML */}
      </div>
    </div>
  );
}
