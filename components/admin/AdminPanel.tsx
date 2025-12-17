import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ShieldCheck, RefreshCw, Loader2, Upload, Download, Server, HardDrive, Flag, CheckCircle, XCircle, MessageSquare, Languages, GraduationCap, Calendar, CloudUpload, Wand2, StopCircle, Trash2, AlertTriangle, Save, Lock, Unlock, KeyRound, Search, Cloud, Activity, Zap, Battery, Info, Database } from 'lucide-react';
import { generateContent } from '../../services/geminiService';
import { BIBLE_BOOKS, generateChapterKey, generateVerseKey, TOTAL_CHAPTERS } from '../../constants';
import { db, bibleStorage } from '../../services/database';
import { Type as GenType } from "@google/genai";
import { ContentReport, AppConfig, UserProgress } from '../../types';
import AppBuilder from './AppBuilder';

export default function AdminPanel({ onBack, onShowToast }: { onBack: () => void, onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void }) {
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [cloudCount, setCloudCount] = useState<number | null>(null);
  const [isCheckingDb, setIsCheckingDb] = useState(false);
  const [isCountingCloud, setIsCountingCloud] = useState(false);
  
  const [keysStatus, setKeysStatus] = useState<any>(null);
  const [isCheckingKeys, setIsCheckingKeys] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [batchBook, setBatchBook] = useState('Gênesis');
  const [batchStartChapter, setBatchStartChapter] = useState(1);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [batchLogs, setBatchLogs] = useState<string[]>([]);
  const stopBatchRef = useRef(false);
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);

  useEffect(() => {
    checkAll();
    loadAppConfig();
    loadReports();
  }, []);

  const checkAll = () => {
      checkDbConnection();
      countCloudChapters();
  };

  const loadAppConfig = async () => {
    try {
        const cfg = await db.entities.AppConfig.get();
        setAppConfig(cfg);
    } catch(e) {}
  };

  const loadReports = async () => {
      try {
          const data = await db.entities.ContentReports.list();
          setReports(data || []);
      } catch (e) {}
  };

  const checkDbConnection = async () => {
    setDbStatus('checking');
    setIsCheckingDb(true);
    try {
        // Ping real no Supabase via API
        const res = await fetch('/api/storage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'ping' })
        });
        if (res.ok) setDbStatus('connected');
        else setDbStatus('error');
    } catch (e) {
        setDbStatus('error');
    } finally {
        setIsCheckingDb(false);
    }
  };

  const countCloudChapters = async () => {
      setIsCountingCloud(true);
      try {
          // Busca a lista de capítulos da nuvem para contar
          const data = await db.entities.BibleChapter.list();
          setCloudCount(Array.isArray(data) ? data.length : 0);
      } catch (e) {
          setCloudCount(0);
      } finally {
          setIsCountingCloud(false);
      }
  };

  const checkKeysHealth = async () => {
      setIsCheckingKeys(true);
      setKeysStatus(null);
      try {
          const res = await fetch('/api/keys-status');
          const data = await res.json();
          setKeysStatus(data);
          onShowToast(`Monitoramento: ${data.healthy} de ${data.total} chaves operacionais.`, data.healthy > 0 ? "success" : "error");
      } catch (e) {
          onShowToast("Erro ao testar chaves API.", "error");
      } finally {
          setIsCheckingKeys(false);
      }
  };

  const handleDownloadBible = async () => {
      if (!window.confirm("Isso baixará toda a Bíblia da API externa e salvará DIRETAMENTE NA NUVEM (Supabase). Continuar?")) return;
      setIsProcessing(true);
      setProcessStatus("Iniciando Sincronização Nuvem...");
      setProgress(0);
      let count = 0;
      stopBatchRef.current = false;
      
      try {
        for (const book of BIBLE_BOOKS) {
            if (stopBatchRef.current) break;
            for (let c = 1; c <= book.chapters; c++) {
                if (stopBatchRef.current) break;
                const key = `bible_acf_${book.abbrev}_${c}`;
                try {
                    setProcessStatus(`Sincronizando ${book.name} ${c}...`);
                    const res = await fetch(`https://www.abibliadigital.com.br/api/verses/acf/${book.abbrev}/${c}`);
                    const data = await res.json();
                    if (data && data.verses) {
                        const optimizedVerses = data.verses.map((v: any) => v.text.trim());
                        // Salva tanto no IndexedDB quanto no Supabase (Universal)
                        await db.entities.BibleChapter.saveUniversal(key, optimizedVerses);
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
      stopBatchRef.current = false;
      countCloudChapters(); 
      onShowToast("Base de Dados Cloud Atualizada!", "success");
  };

  const handleBatchGenerate = async (type: 'commentary' | 'dictionary') => {
      setIsGeneratingBatch(true);
      setBatchLogs([]);
      stopBatchRef.current = false;
      
      const bookMeta = BIBLE_BOOKS.find(b => b.name === batchBook);
      if (!bookMeta) return;

      const c = batchStartChapter; 
      try {
          const chapKey = `bible_acf_${bookMeta.abbrev}_${c}`;
          // Prioriza pegar o texto da Nuvem para garantir que a IA use a base oficial
          let verses = (await db.entities.BibleChapter.getCloud(chapKey)) as any[];
          
          if (!verses || verses.length === 0) {
              addLog(`❌ Texto de ${bookMeta.name} ${c} não encontrado na Nuvem.`);
              setIsGeneratingBatch(false);
              return;
          }

          addLog(`🚀 Iniciando lote (${verses.length} versículos).`);

          for (let i = 0; i < verses.length; i++) {
              if (stopBatchRef.current) { addLog("🛑 Interrompido."); break; }
              const verseNum = i + 1;
              const verseKey = generateVerseKey(bookMeta.name, c, verseNum);
              addLog(`⏳ Processando ${bookMeta.name} ${c}:${verseNum}...`);

              try {
                  if (type === 'commentary') {
                        const prompt = `ATUE COMO: Professor Michel Felix. TAREFA: Comentário EXEGÉTICO. TEXTO: "${verses[i]}". INÍCIO OBRIGATÓRIO: "Este versículo revela...". MAX 250 Palavras.`;
                        const text = await generateContent(prompt);
                        await db.entities.Commentary.create({ book: bookMeta.name, chapter: c, verse: verseNum, verse_key: verseKey, commentary_text: text });
                  } else {
                        const prompt = `ATUE COMO: HELENISTA/HEBRAÍSTA. TAREFA: Análise lexical de ${bookMeta.name} ${c}:${verseNum}. TEXTO: "${verses[i]}". Retorne JSON.`;
                        const schema = {
                            type: GenType.OBJECT,
                            properties: {
                                hebrewGreekText: { type: GenType.STRING },
                                phoneticText: { type: GenType.STRING },
                                words: { type: GenType.ARRAY, items: { type: GenType.OBJECT, properties: { original: { type: GenType.STRING }, transliteration: { type: GenType.STRING }, portuguese: { type: GenType.STRING }, polysemy: { type: GenType.STRING }, etymology: { type: GenType.STRING }, grammar: { type: GenType.STRING } } } }
                            }
                        };
                        const res = await generateContent(prompt, schema);
                        await db.entities.Dictionary.create({ book: bookMeta.name, chapter: c, verse: verseNum, verse_key: verseKey, original_text: res.hebrewGreekText, transliteration: res.phoneticText, key_words: res.words });
                  }
                  addLog(`✅ Concluído ${c}:${verseNum}`);
                  await new Promise(r => setTimeout(r, 1000)); 
              } catch (err: any) { addLog(`⚠️ Falha ${c}:${verseNum}: ${err.message}`); }
          }
      } catch (e: any) { addLog(`Erro crítico: ${e.message}`); }
      setIsGeneratingBatch(false);
  };

  const addLog = (msg: string) => setBatchLogs(prev => [msg, ...prev].slice(0, 30));

  if (showBuilder) return <AppBuilder onBack={() => { setShowBuilder(false); loadAppConfig(); }} onShowToast={onShowToast} currentConfig={appConfig} />;

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-[#121212] transition-colors duration-300">
      
      {/* HEADER */}
      <div className="bg-[#1a0f0f] text-white p-4 flex items-center gap-4 sticky top-0 shadow-lg z-30 border-b border-[#C5A059]/30">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full"><ChevronLeft /></button>
        <h1 className="font-cinzel font-bold text-[#C5A059] flex items-center gap-2 tracking-widest uppercase text-sm md:text-base">
            <ShieldCheck className="w-5 h-5"/> Painel do Editor Chefe
        </h1>
        <div className="ml-auto flex gap-2">
            <button onClick={() => setShowReportsModal(true)} className="relative p-2 hover:bg-white/10 rounded-full">
                <Flag className={`w-5 h-5 ${reports.length > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                {reports.length > 0 && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-600 rounded-full animate-ping border border-white"></span>}
            </button>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto space-y-8 pb-32">
        
        {/* CARD ESTRATÉGICO DE COTAS */}
        <div className="bg-[#8B0000] text-white p-6 rounded-3xl shadow-2xl relative overflow-hidden group border border-[#C5A059]/30">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                <Activity className="w-32 h-32" />
            </div>
            <div className="relative z-10">
                <h2 className="font-cinzel font-bold text-xl flex items-center gap-2 mb-2"><Info className="w-5 h-5 text-[#C5A059]"/> Estratégia de Alimentação (IA)</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="bg-black/20 p-4 rounded-2xl border border-white/10">
                        <p className="text-[10px] uppercase font-bold text-[#C5A059] mb-1">Capacidade Diária</p>
                        <p className="text-2xl font-montserrat font-black">30.000 <span className="text-xs font-normal opacity-70">REQS</span></p>
                        <p className="text-[9px] opacity-60 mt-1">Soma das 20 chaves configuradas</p>
                    </div>
                    <div className="bg-black/20 p-4 rounded-2xl border border-white/10">
                        <p className="text-[10px] uppercase font-bold text-[#C5A059] mb-1">Custo Bíblia Toda</p>
                        <p className="text-2xl font-montserrat font-black">~65.700 <span className="text-xs font-normal opacity-70">REQS</span></p>
                        <p className="text-[9px] opacity-60 mt-1">Comentário + Dicionário + EBD</p>
                    </div>
                    <div className="bg-black/20 p-4 rounded-2xl border border-white/10">
                        <p className="text-[10px] uppercase font-bold text-[#C5A059] mb-1">Tempo Estimado</p>
                        <p className="text-2xl font-montserrat font-black">2.5 DIAS</p>
                        <p className="text-[9px] opacity-60 mt-1">Para conclusão de 100% da base</p>
                    </div>
                </div>
            </div>
        </div>

        {/* STATUS TILES - FOCO EM NUVEM */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* TILE: STATUS BANCO DE DADOS */}
            <div className="bg-white dark:bg-[#1E1E1E] p-5 rounded-2xl shadow-lg border border-[#C5A059]/20 flex items-center justify-between group transition-all">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${dbStatus === 'connected' ? 'bg-green-100 text-green-600' : dbStatus === 'checking' ? 'bg-gray-100 text-gray-400' : 'bg-red-100 text-red-600'}`}>
                        <Server className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Banco de Dados</p>
                        <p className="font-cinzel font-bold dark:text-white uppercase tracking-wider">
                            {dbStatus === 'connected' ? 'Online' : dbStatus === 'checking' ? 'Conectando...' : 'Desconectado'}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={checkDbConnection} 
                    disabled={isCheckingDb}
                    className="p-2 text-gray-300 hover:text-[#C5A059] hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all active:rotate-180"
                    title="Checar Conexão"
                >
                    <RefreshCw className={`w-4 h-4 ${isCheckingDb ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* TILE: CONTAGEM NA BASE CLOUD */}
            <div className="bg-white dark:bg-[#1E1E1E] p-5 rounded-2xl shadow-lg border border-[#C5A059]/20 flex items-center justify-between group transition-all">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
                        <Database className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Base de Dados (Nuvem)</p>
                        <p className="font-cinzel font-bold dark:text-white uppercase tracking-wider">
                            {cloudCount !== null ? `${cloudCount} Capítulos` : '---'}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={countCloudChapters} 
                    disabled={isCountingCloud}
                    className="p-2 text-gray-300 hover:text-[#C5A059] hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all active:rotate-180"
                    title="Contar Capítulos na Nuvem"
                >
                    <RefreshCw className={`w-4 h-4 ${isCountingCloud ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* TILE: SAÚDE API */}
            <button onClick={checkKeysHealth} disabled={isCheckingKeys} className="bg-white dark:bg-[#1E1E1E] p-5 rounded-2xl shadow-lg border border-[#C5A059]/20 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-left">
                <div className={`p-3 rounded-xl ${keysStatus?.healthy > 0 ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-600'}`}>
                    {isCheckingKeys ? <Loader2 className="w-6 h-6 animate-spin" /> : <Activity className="w-6 h-6" />}
                </div>
                <div className="flex-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Saúde das APIs</p>
                    <p className="font-cinzel font-bold dark:text-white uppercase tracking-wider">
                        {keysStatus ? `${keysStatus.healthy}/${keysStatus.total} OK` : 'Testar Agora'}
                    </p>
                </div>
            </button>
        </div>

        {/* FÁBRICA DE CONTEÚDO (EM LOTE) */}
        <div className="bg-white dark:bg-[#1E1E1E] rounded-[2rem] shadow-xl border border-[#C5A059]/30 overflow-hidden">
            <div className="bg-[#1a0f0f] p-6 flex justify-between items-center border-b border-[#C5A059]/20">
                <div>
                    <h3 className="font-cinzel font-bold text-white text-lg">Fábrica de Conteúdo</h3>
                    <p className="text-[10px] text-[#C5A059] uppercase tracking-widest font-bold">Processamento em Lote com Rotação de Chaves</p>
                </div>
                <div className="flex gap-2">
                    <select value={batchBook} onChange={e => setBatchBook(e.target.value)} className="bg-gray-800 text-white text-xs border-none rounded-lg p-2 font-cinzel outline-none">
                        {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                    </select>
                    <input type="number" value={batchStartChapter} onChange={e => setBatchStartChapter(Number(e.target.value))} className="bg-gray-800 text-white text-xs border-none rounded-lg w-16 p-2 font-cinzel outline-none" min={1}/>
                </div>
            </div>
            
            <div className="p-8">
                {isGeneratingBatch ? (
                    <div className="space-y-6">
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                            <Loader2 className="w-12 h-12 animate-spin text-[#8B0000] mb-3" />
                            <p className="font-cinzel font-bold dark:text-white text-xl">Alimentando {batchBook} {batchStartChapter}...</p>
                            <p className="text-sm text-gray-500 mt-1">Utilizando rotação automática entre suas 20 chaves.</p>
                            <button onClick={() => { stopBatchRef.current = true; }} className="mt-6 flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-full font-bold hover:bg-red-700 transition-all">
                                <StopCircle className="w-4 h-4" /> Parar Processamento
                            </button>
                        </div>
                        <div className="bg-black/90 rounded-2xl p-6 font-mono text-[11px] text-green-400 h-64 overflow-y-auto shadow-inner border border-white/5">
                            {batchLogs.map((log, i) => <div key={i} className="mb-1">{log}</div>)}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button onClick={() => handleBatchGenerate('commentary')} className="group p-8 bg-gradient-to-br from-[#8B0000] to-[#500000] rounded-[2rem] text-white flex flex-col items-center gap-4 hover:shadow-2xl transition-all hover:scale-[1.02]">
                            <MessageSquare className="w-10 h-10 text-[#C5A059]" />
                            <div className="text-center">
                                <p className="font-cinzel font-bold text-lg">Gerar Comentários Exegéticos</p>
                                <p className="text-xs opacity-70 mt-1">Cria explicações para todo o capítulo selecionado.</p>
                            </div>
                        </button>
                        <button onClick={() => handleBatchGenerate('dictionary')} className="group p-8 bg-gradient-to-br from-[#1a0f0f] to-[#000000] border border-[#C5A059]/40 rounded-[2rem] text-white flex flex-col items-center gap-4 hover:shadow-2xl transition-all hover:scale-[1.02]">
                            <Languages className="w-10 h-10 text-[#C5A059]" />
                            <div className="text-center">
                                <p className="font-cinzel font-bold text-lg">Gerar Dicionário de Originais</p>
                                <p className="text-xs opacity-70 mt-1">Analisa Hebraico/Grego versículo a versículo.</p>
                            </div>
                        </button>
                    </div>
                )}
            </div>
        </div>

        {/* GESTÃO DE BÍBLIA (CLOUD) */}
        <div className="bg-white dark:bg-[#1E1E1E] p-8 rounded-[2.5rem] shadow-xl border border-[#C5A059]/20">
            <h3 className="font-cinzel font-bold text-xl dark:text-white mb-6 border-b border-gray-100 dark:border-white/5 pb-4">Gestão de Dados (Cloud Sync)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button onClick={handleDownloadBible} disabled={isProcessing} className="flex flex-col items-center gap-3 p-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-3xl hover:bg-amber-100 transition-all group">
                    <CloudUpload className="w-8 h-8 text-amber-600 group-hover:scale-110 transition-transform" />
                    <div>
                        <p className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-200">Sincronizar Nuvem</p>
                        <p className="text-[8px] opacity-60">Baixa da Web e salva no Supabase</p>
                    </div>
                </button>
                <div className="flex flex-col items-center gap-3 p-6 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-900/30 rounded-3xl hover:bg-indigo-100 transition-all group cursor-pointer relative overflow-hidden">
                    <Upload className="w-8 h-8 text-indigo-600 group-hover:scale-110 transition-transform" />
                    <div>
                        <p className="text-[10px] font-black uppercase text-indigo-800 dark:text-indigo-200">Importar JSON</p>
                        <p className="text-[8px] opacity-60">Carregar base externa manualmente</p>
                    </div>
                    <input type="file" ref={fileInputRef} onChange={(e) => {/* handle upload logic */}} accept=".json" className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
                <button onClick={onBack} className="flex flex-col items-center gap-3 p-6 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl hover:bg-gray-100 transition-all group">
                    <ChevronLeft className="w-8 h-8 text-gray-600" />
                    <span className="text-[10px] font-bold uppercase dark:text-gray-400">Voltar para o App</span>
                </button>
            </div>
            
            {isProcessing && (
                <div className="mt-8 space-y-2">
                    <div className="flex justify-between text-[10px] font-black dark:text-white uppercase tracking-widest">
                        <span>{processStatus}</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden">
                        <div className="bg-[#8B0000] h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}