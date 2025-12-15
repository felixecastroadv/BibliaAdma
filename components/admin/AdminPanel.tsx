
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ShieldCheck, RefreshCw, Loader2, Upload, Download, Server, HardDrive, Flag, CheckCircle, XCircle, MessageSquare, Languages, GraduationCap, Calendar, CloudUpload, Wand2, Play, StopCircle, Trash2, AlertTriangle, FileJson, Save } from 'lucide-react';
import { generateContent } from '../../services/geminiService';
import { BIBLE_BOOKS, generateChapterKey, generateVerseKey, TOTAL_CHAPTERS } from '../../constants';
import { db, bibleStorage } from '../../services/database';
import { Type as GenType } from "@google/genai";
import { ContentReport, AppConfig, Devotional } from '../../types';
import AppBuilder from './AppBuilder';
import { format, addDays } from 'date-fns';

export default function AdminPanel({ onBack, onShowToast }: { onBack: () => void, onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void }) {
  // --- STATES DE INFRAESTRUTURA ---
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  
  // --- STATES DE IMPORTAÇÃO/DOWNLOAD ---
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState('');
  const [offlineCount, setOfflineCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- STATES DE GERAÇÃO EM LOTE ---
  const [batchBook, setBatchBook] = useState('Gênesis');
  const [batchStartChapter, setBatchStartChapter] = useState(1);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [batchType, setBatchType] = useState<'commentary' | 'dictionary' | null>(null);
  const [stopBatch, setStopBatch] = useState(false);
  const [batchLogs, setBatchLogs] = useState<string[]>([]);

  // --- STATE DE DEVOCIONAL ---
  const [devotionalDate, setDevotionalDate] = useState(new Date().toISOString().split('T')[0]);

  // --- STATES DE RELATÓRIOS ---
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [showReportsModal, setShowReportsModal] = useState(false);

  // --- BUILDER STATE ---
  const [showBuilder, setShowBuilder] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    checkDbConnection();
    loadReports();
    checkOfflineIntegrity();
    loadAppConfig();
  }, []);

  const loadAppConfig = async () => {
    try {
        const cfg = await db.entities.AppConfig.get();
        setAppConfig(cfg);
    } catch(e) {}
  };

  const checkDbConnection = async () => {
    setDbStatus('checking');
    try {
        await db.entities.ReadingProgress.list('chapters', 1);
        setDbStatus('connected');
    } catch (e) {
        setDbStatus('error');
    }
  };

  const checkOfflineIntegrity = async () => {
      try {
          const count = await bibleStorage.count();
          setOfflineCount(count);
      } catch (e) {
          setOfflineCount(0);
      }
  };

  const loadReports = async () => {
      try {
          const data = await db.entities.ContentReports.list();
          setReports(data || []);
      } catch (e) {}
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

  // --- FUNÇÕES DE DOWNLOAD / IMPORTAÇÃO BÍBLIA ---

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
      if (!window.confirm("Isso baixará toda a Bíblia da API externa para o armazenamento local. Continuar?")) return;
      setIsProcessing(true);
      setProcessStatus("Preparando...");
      setProgress(0);
      let count = 0;
      await bibleStorage.clear();
      setOfflineCount(0); 
      
      try {
        for (const book of BIBLE_BOOKS) {
            if (stopBatch) break;
            for (let c = 1; c <= book.chapters; c++) {
                if (stopBatch) break;
                const key = `bible_acf_${book.abbrev}_${c}`;
                try {
                    setProcessStatus(`Baixando ${book.name} ${c}...`);
                    // Delay para não estourar rate limit da API externa
                    await new Promise(r => setTimeout(r, 150)); 
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
          onShowToast("Erro no download.", "error");
      }
      setIsProcessing(false);
      setStopBatch(false);
      await checkOfflineIntegrity(); 
      onShowToast("Download Completo!", "success");
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      setIsProcessing(true);
      setProcessStatus("Lendo arquivo...");
      
      reader.onload = async (e) => {
          try {
              const jsonText = e.target?.result as string;
              // Remove BOM se existir
              const cleanJson = jsonText.replace(/^\uFEFF/, ''); 
              const jsonData = JSON.parse(cleanJson);
              
              if (!Array.isArray(jsonData)) throw new Error("Formato inválido. Esperado array.");
              
              setProcessStatus("Salvando no banco...");
              let count = 0;
              
              // Formato esperado do JSON: [{ key: "bible_acf_gn_1", verses: ["No principio...", "..."] }, ...]
              for (const item of jsonData) {
                  if (item.key && item.verses) {
                      await bibleStorage.save(item.key, item.verses);
                      count++;
                      if (count % 50 === 0) setProgress(Math.round((count / jsonData.length) * 100));
                  }
              }
              
              setOfflineCount(count);
              onShowToast(`${count} capítulos importados!`, "success");
          } catch (error) {
              onShowToast("Erro ao processar JSON.", "error");
          } finally {
              setIsProcessing(false);
              setProgress(0);
          }
      };
      reader.readAsText(file);
  };

  const handleExportJson = async () => {
      setIsProcessing(true);
      setProcessStatus("Gerando arquivo...");
      try {
          const allData: any[] = [];
          for (const book of BIBLE_BOOKS) {
              for (let c = 1; c <= book.chapters; c++) {
                  const key = `bible_acf_${book.abbrev}_${c}`;
                  const verses = await bibleStorage.get(key);
                  if (verses) {
                      allData.push({ key, verses });
                  }
              }
          }
          
          const blob = new Blob([JSON.stringify(allData)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `backup_biblia_adma_${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          onShowToast("Exportação concluída.", "success");
      } catch (e) {
          onShowToast("Erro ao exportar.", "error");
      } finally {
          setIsProcessing(false);
      }
  };

  // --- FUNÇÕES DE GERAÇÃO EM LOTE (IA) ---
  
  const addLog = (msg: string) => setBatchLogs(prev => [msg, ...prev].slice(0, 50));

  const handleBatchGenerate = async (type: 'commentary' | 'dictionary') => {
      setIsGeneratingBatch(true);
      setBatchType(type);
      setStopBatch(false);
      
      const bookMeta = BIBLE_BOOKS.find(b => b.name === batchBook);
      if (!bookMeta) return;

      let processed = 0;
      
      // Loop pelos capítulos a partir do selecionado
      for (let c = batchStartChapter; c <= bookMeta.chapters; c++) {
          if (stopBatch) { addLog("Processo interrompido pelo usuário."); break; }

          const verseNum = 1; 
          
          try {
              // Verifica se já temos o texto do versículo (precisamos do texto para gerar comentário)
              const chapKey = `bible_acf_${bookMeta.abbrev}_${c}`;
              const verses = await bibleStorage.get(chapKey);
              
              if (!verses || verses.length === 0) {
                  addLog(`[Pular] ${bookMeta.name} ${c}: Texto bíblico não encontrado offline.`);
                  continue;
              }

              const verseText = verses[verseNum - 1]; // Versículo 1
              const verseKey = generateVerseKey(bookMeta.name, c, verseNum);

              addLog(`Gerando ${type} para ${bookMeta.name} ${c}:${verseNum}...`);

              if (type === 'commentary') {
                  // Prompt de Comentário
                   const prompt = `
                    ATUE COMO: Professor Michel Felix.
                    TAREFA: Comentário bíblico curto para ${bookMeta.name} ${c}:${verseNum}.
                    TEXTO: "${verseText}"
                    ESTILO: Pentecostal Clássico, Arminiano.
                    INSTRUÇÃO EXTRA: Se estritamente necessário (ex: polissemia), cite a palavra original (Hebraico/Grego) e significado para clareza. Não abuse.
                    FORMATO: Texto corrido, vibrante, max 200 palavras.
                `;
                const text = await generateContent(prompt);
                await db.entities.Commentary.create({
                    book: bookMeta.name, chapter: c, verse: verseNum, verse_key: verseKey, commentary_text: text
                });
              } else {
                  // Prompt de Dicionário
                  const prompt = `
                    Análise lexical JSON de ${bookMeta.name} ${c}:${verseNum} ("${verseText}").
                    Idioma original: ${bookMeta.testament === 'old' ? 'Hebraico' : 'Grego'}.
                    Retorne JSON com: original_text, transliteration, key_words (array de objetos com original, transliteration, portuguese, polysemy, etymology, grammar).
                  `;
                   const schema = {
                      type: GenType.OBJECT,
                      properties: {
                        original_text: { type: GenType.STRING },
                        transliteration: { type: GenType.STRING },
                        key_words: {
                          type: GenType.ARRAY,
                          items: {
                            type: GenType.OBJECT,
                            properties: {
                              original: { type: GenType.STRING },
                              transliteration: { type: GenType.STRING },
                              portuguese: { type: GenType.STRING },
                              polysemy: { type: GenType.STRING },
                              etymology: { type: GenType.STRING },
                              grammar: { type: GenType.STRING }
                            }
                          }
                        }
                      }
                    };
                    const res = await generateContent(prompt, schema);
                    await db.entities.Dictionary.create({
                        book: bookMeta.name, chapter: c, verse: verseNum, verse_key: verseKey,
                        original_text: res.original_text, transliteration: res.transliteration, key_words: res.key_words
                    });
              }
              
              processed++;
              // Delay de segurança
              await new Promise(r => setTimeout(r, 2000));

          } catch (e: any) {
              addLog(`Erro em ${bookMeta.name} ${c}: ${e.message}`);
          }
      }

      setIsGeneratingBatch(false);
      onShowToast(`Lote finalizado. ${processed} itens gerados.`, 'success');
  };

  const handleGenerateDevotional = async () => {
      if (!devotionalDate) return;
      
      setIsGeneratingBatch(true);
      setStopBatch(false);
      setBatchType(null);
      
      // Data já vem no formato YYYY-MM-DD do input date
      const dateStr = devotionalDate;
      const displayDate = new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
      
      addLog(`Gerando devocional para ${displayDate}...`);
      
      try {
         // Verifica se já existe e deleta para substituir
         const existing = await db.entities.Devotional.filter({ date: dateStr });
         if(existing.length > 0) {
             addLog(`Substituindo devocional existente de ${displayDate}...`);
             await db.entities.Devotional.delete(existing[0].id);
         }

         const prompt = `
            ATUE COMO: Michel Felix.
            TAREFA: Devocional para ${displayDate}.
            TEMA: Aleatório bíblico, focando em encorajamento e doutrina.
            JSON FORMAT: { title, reference, verse_text, body (com \\n\\n), prayer }.
         `;
         const schema = {
            type: GenType.OBJECT,
            properties: {
                title: { type: GenType.STRING },
                reference: { type: GenType.STRING },
                verse_text: { type: GenType.STRING },
                body: { type: GenType.STRING },
                prayer: { type: GenType.STRING }
            }
         };
         
         const res = await generateContent(prompt, schema);
         await db.entities.Devotional.create({ ...res, date: dateStr, is_published: true });
         
         addLog(`Devocional de ${displayDate} criado com sucesso!`);
         onShowToast(`Devocional de ${displayDate} gerado!`, "success");
      } catch (e: any) {
          addLog(`Erro dia ${dateStr}: ${e.message}`);
      }
      
      setIsGeneratingBatch(false);
  };

  if (showBuilder) {
      return <AppBuilder onBack={() => { setShowBuilder(false); loadAppConfig(); }} onShowToast={onShowToast} currentConfig={appConfig} />;
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-300">
      
      {/* MODAL DE RELATÓRIOS */}
      {showReportsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60" onClick={() => setShowReportsModal(false)} />
              <div className="bg-white dark:bg-[#1E1E1E] w-full max-w-2xl max-h-[80vh] rounded-2xl p-6 relative z-10 overflow-hidden flex flex-col shadow-2xl animate-in zoom-in">
                  <div className="flex justify-between items-center mb-4 border-b pb-2 dark:border-gray-700">
                      <h3 className="font-cinzel font-bold text-xl dark:text-white flex items-center gap-2">
                          <Flag className="w-5 h-5 text-red-500"/> Relatórios de Erro ({reports.length})
                      </h3>
                      <button onClick={() => setShowReportsModal(false)}><XCircle className="w-6 h-6 text-gray-500" /></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                      {reports.length === 0 ? (
                          <p className="text-center text-gray-400 py-10">Nenhum reporte pendente.</p>
                      ) : (
                          reports.map(report => (
                              <div key={report.id} className="bg-gray-50 dark:bg-black/20 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                  <div className="flex justify-between">
                                      <span className="font-bold text-sm text-[#8B0000] dark:text-[#ff6b6b]">{report.reference_text}</span>
                                      <span className="text-xs text-gray-400">{new Date(report.date).toLocaleDateString()}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                      <span className="uppercase bg-gray-200 dark:bg-gray-700 px-1 rounded">{report.type}</span>
                                      <span>por {report.user_name}</span>
                                  </div>
                                  <p className="text-gray-700 dark:text-gray-300 italic mb-3">"{report.report_text}"</p>
                                  <button 
                                    onClick={() => handleDeleteReport(report.id!)}
                                    className="w-full bg-green-600 text-white py-1 rounded text-xs font-bold hover:bg-green-700 flex items-center justify-center gap-2"
                                  >
                                      <CheckCircle className="w-3 h-3"/> Marcar como Resolvido
                                  </button>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* HEADER */}
      <div className="bg-[#1a0f0f] text-white p-4 flex items-center gap-4 sticky top-0 shadow-lg z-10">
        <button onClick={onBack}><ChevronLeft /></button>
        <h1 className="font-cinzel font-bold text-[#C5A059] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5"/> Painel do Editor Chefe
        </h1>
        <div className="ml-auto flex gap-2">
            <button onClick={() => setShowReportsModal(true)} className="relative p-2 hover:bg-white/10 rounded-full">
                <Flag className="w-5 h-5 text-red-500" />
                {reports.length > 0 && <span className="absolute top-0 right-0 w-3 h-3 bg-red-600 rounded-full animate-pulse border border-white"></span>}
            </button>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto space-y-8 pb-24">
        
        {/* === BOTÃO DO BUILDER === */}
        <div className="bg-gradient-to-r from-[#C5A059] to-[#8B0000] p-6 rounded-xl shadow-xl text-white flex justify-between items-center transform hover:scale-[1.01] transition-transform cursor-pointer" onClick={() => setShowBuilder(true)}>
            <div>
                <h2 className="font-cinzel font-bold text-2xl flex items-center gap-2"><Wand2 className="w-6 h-6"/> ADMA Builder AI</h2>
                <p className="text-sm opacity-90">Crie módulos, altere cores e gerencie o app conversando com a IA.</p>
            </div>
            <button className="bg-white text-[#8B0000] px-6 py-3 rounded-lg font-bold shadow-lg">Abrir Builder</button>
        </div>

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
            </div>
        </div>

        {/* === SEÇÃO 2: BÍBLIA OFFLINE (BOTOES) === */}
        <h2 className="font-cinzel font-bold text-xl text-[#8B0000] dark:text-[#ff6b6b] border-b border-[#C5A059] pb-2">1. Gestão da Bíblia (JSON)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <button 
                onClick={handleDownloadBible}
                disabled={isProcessing}
                className="bg-white dark:bg-dark-card p-4 rounded-xl shadow border border-[#C5A059]/30 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
             >
                 {isProcessing ? <Loader2 className="w-8 h-8 animate-spin text-[#C5A059]" /> : <CloudUpload className="w-8 h-8 text-[#C5A059]" />}
                 <span className="font-bold text-sm text-center dark:text-white">Baixar da Nuvem (API)</span>
             </button>

             <div className="bg-white dark:bg-dark-card p-4 rounded-xl shadow border border-[#C5A059]/30 flex flex-col items-center justify-center gap-2 relative overflow-hidden group">
                 <Upload className="w-8 h-8 text-blue-500" />
                 <span className="font-bold text-sm text-center dark:text-white">Upload JSON</span>
                 <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".json"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    disabled={isProcessing}
                 />
             </div>

             <button 
                onClick={handleExportJson}
                disabled={isProcessing}
                className="bg-white dark:bg-dark-card p-4 rounded-xl shadow border border-[#C5A059]/30 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
             >
                 <Download className="w-8 h-8 text-green-500" />
                 <span className="font-bold text-sm text-center dark:text-white">Backup (Exportar JSON)</span>
             </button>
        </div>

        {isProcessing && (
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl">
                <div className="flex justify-between text-xs mb-1 font-bold dark:text-white">
                    <span>{processStatus}</span>
                    <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-full h-2">
                    <div className="bg-[#8B0000] h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>
            </div>
        )}

        {/* === SEÇÃO 3: FÁBRICA DE CONTEÚDO (IA) === */}
        <h2 className="font-cinzel font-bold text-xl text-[#8B0000] dark:text-[#ff6b6b] border-b border-[#C5A059] pb-2 mt-8">2. Fábrica de Conteúdo (IA)</h2>
        
        <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow border-l-4 border-[#8B0000]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="text-xs font-bold text-gray-500">Livro Inicial</label>
                    <select value={batchBook} onChange={e => setBatchBook(e.target.value)} className="w-full p-2 border rounded mt-1 dark:bg-gray-800 dark:text-white">
                        {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500">Capítulo Inicial</label>
                    <input type="number" value={batchStartChapter} onChange={e => setBatchStartChapter(Number(e.target.value))} className="w-full p-2 border rounded mt-1 dark:bg-gray-800 dark:text-white" min={1}/>
                </div>
            </div>

            {isGeneratingBatch ? (
                 <div className="text-center py-6">
                     <Loader2 className="w-10 h-10 animate-spin mx-auto text-[#8B0000] mb-2"/>
                     <p className="font-cinzel font-bold dark:text-white">Gerando em Lote...</p>
                     <button onClick={() => setStopBatch(true)} className="mt-4 bg-red-600 text-white px-4 py-2 rounded flex items-center justify-center gap-2 mx-auto">
                         <StopCircle className="w-4 h-4" /> Parar Processo
                     </button>
                     <div className="mt-4 h-32 overflow-y-auto bg-black text-green-400 p-2 rounded text-xs text-left font-mono">
                         {batchLogs.map((log, i) => <div key={i}>{log}</div>)}
                     </div>
                 </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button onClick={() => handleBatchGenerate('commentary')} className="bg-[#8B0000] text-white py-3 rounded font-bold flex flex-col items-center justify-center gap-1 hover:bg-[#600018]">
                        <MessageSquare className="w-5 h-5" />
                        Gerar Comentários
                        <span className="text-[10px] font-normal opacity-70">A partir do cap. selecionado</span>
                    </button>
                    <button onClick={() => handleBatchGenerate('dictionary')} className="bg-[#C5A059] text-white py-3 rounded font-bold flex flex-col items-center justify-center gap-1 hover:bg-[#a88645]">
                        <Languages className="w-5 h-5" />
                        Gerar Dicionários
                        <span className="text-[10px] font-normal opacity-70">A partir do cap. selecionado</span>
                    </button>
                    
                    {/* GERADOR DE DEVOCIONAL POR DATA */}
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded border border-purple-200 dark:border-purple-800 flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Gerador de Devocional
                        </label>
                        <input 
                            type="date" 
                            value={devotionalDate} 
                            onChange={e => setDevotionalDate(e.target.value)} 
                            className="p-1.5 text-xs border rounded w-full dark:bg-gray-900 dark:text-white"
                        />
                        <button onClick={handleGenerateDevotional} className="bg-purple-700 text-white py-1.5 rounded text-xs font-bold hover:bg-purple-800 w-full">
                            Gerar para esta Data
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
