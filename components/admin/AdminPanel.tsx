import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ShieldCheck, RefreshCw, Loader2, Upload, Download, Server, HardDrive, Flag, CheckCircle, XCircle, MessageSquare, Languages, GraduationCap, Calendar, CloudUpload, Wand2, StopCircle, Trash2, AlertTriangle, Save, Lock, Unlock, KeyRound, Search, Cloud, Activity, Zap, Battery, Info, Database } from 'lucide-react';
import { generateContent } from '../../services/geminiService';
import { BIBLE_BOOKS, generateChapterKey, generateVerseKey, TOTAL_CHAPTERS } from '../../constants';
import { db } from '../../services/database';
import { Type as GenType } from "@google/genai";
import { ContentReport, AppConfig } from '../../types';
import AppBuilder from './AppBuilder';

const TOTAL_VERSES = 31102;

export default function AdminPanel({ onBack, onShowToast }: { onBack: () => void, onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void }) {
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [counts, setCounts] = useState({ chapters: 0, commentaries: 0, dictionaries: 0 });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCheckingDb, setIsCheckingDb] = useState(false);
  
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
    refreshRealData();
    loadAppConfig();
    loadReports();
  }, []);

  const refreshRealData = async () => {
      setIsRefreshing(true);
      await checkDbConnection();
      await updateRealCounts();
      setIsRefreshing(false);
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
        const res = await fetch('/api/storage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'ping' })
        });
        const data = await res.json();
        if (data.status === 'ok') setDbStatus('connected');
        else setDbStatus('error');
    } catch (e) {
        setDbStatus('error');
    } finally {
        setIsCheckingDb(false);
    }
  };

  const updateRealCounts = async () => {
      try {
          const [cRes, mRes, dRes] = await Promise.all([
              fetch('/api/storage', { method: 'POST', body: JSON.stringify({ action: 'count', collection: 'bible_chapters' }) }),
              fetch('/api/storage', { method: 'POST', body: JSON.stringify({ action: 'count', collection: 'commentaries' }) }),
              fetch('/api/storage', { method: 'POST', body: JSON.stringify({ action: 'count', collection: 'dictionaries' }) })
          ]);
          
          const cData = await cRes.json();
          const mData = await mRes.json();
          const dData = await dRes.json();

          setCounts({
              chapters: cData.count || 0,
              commentaries: mData.count || 0,
              dictionaries: dData.count || 0
          });
      } catch (e) {
          console.error("Erro ao contar itens reais na nuvem:", e);
      }
  };

  const checkKeysHealth = async () => {
      setIsCheckingKeys(true);
      try {
          const res = await fetch('/api/keys-status');
          const data = await res.json();
          setKeysStatus(data);
          onShowToast(`Monitoramento Real: ${data.healthy} chaves ativas.`, data.healthy > 0 ? "success" : "error");
      } catch (e) {
          onShowToast("Falha na checagem de APIs.", "error");
      } finally {
          setIsCheckingKeys(false);
      }
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
          let verses = (await db.entities.BibleChapter.getCloud(chapKey)) as any[];
          
          if (!verses || verses.length === 0) {
              addLog(`❌ Erro: Texto de ${bookMeta.name} ${c} não encontrado no Supabase.`);
              setIsGeneratingBatch(false);
              return;
          }

          addLog(`🚀 Iniciando Alimentação Real: ${bookMeta.name} ${c} (${verses.length} versículos).`);

          for (let i = 0; i < verses.length; i++) {
              if (stopBatchRef.current) { addLog("🛑 Processamento Interrompido."); break; }
              const verseNum = i + 1;
              const vKey = generateVerseKey(bookMeta.name, c, verseNum);
              const textBase = verses[i];
              addLog(`⏳ Alimentando ${bookMeta.name} ${c}:${verseNum}...`);

              try {
                  if (type === 'commentary') {
                        // RESTAURAÇÃO INTEGRAL DO PROMPT MICHEL FELIX PHD (PADRÃO VERSE PANEL)
                        const prompt = `
                            ATUE COMO: Professor Michel Felix, PhD em Teologia.
                            TAREFA: Escrever um comentário EXEGÉTICO para o sistema ADMA.
                            TEXTO BÍBLICO: "${textBase}"
                            REFERÊNCIA: ${bookMeta.name} ${c}:${verseNum}

                            --- REGRAS DE OURO (NÃO NEGOCIÁVEL) ---
                            1. INÍCIO OBRIGATÓRIO: "Este versículo revela...".
                            2. ZERO SAUDAÇÕES: Proibido "Olá", "A Paz do Senhor" ou introduções sociais.
                            3. TONE: Magistral, Acadêmico, Erudito mas Claro.

                            --- PROTOCOLO DE HERMENÊUTICA ADMA ---
                            - USO IMPLÍCITO: A Bíblia explica a Bíblia. Verifique o contexto remoto.
                            - PRECISÃO CRONOLÓGICA: Sem anacronismos históricos.
                            - ORTODOXIA: Linha pentecostal conservadora (Assembleiana).
                            - EFEITO "AH! ENTENDI!": Descomplique o texto sem perder a profundidade.

                            --- ESTRUTURA (3 Parágrafos) ---
                            O Desvendar do Texto, Conexão Teológica e Aplicação Prática.
                        `;
                        const resText = await generateContent(prompt);
                        await db.entities.Commentary.create({ 
                            book: bookMeta.name, chapter: c, verse: verseNum, 
                            verse_key: vKey, commentary_text: resText 
                        });
                  } else {
                        // DICIONÁRIO PROFISSIONAL
                        const lang = bookMeta.testament === 'old' ? 'HEBRAICO' : 'GREGO';
                        const prompt = `Você é um HEBRAÍSTA e HELENISTA SÊNIOR. Realize análise lexical de ${bookMeta.name} ${c}:${verseNum}. Texto: "${textBase}". Idioma: ${lang}. Retorne JSON.`;
                        const schema = {
                            type: GenType.OBJECT,
                            properties: {
                                hebrewGreekText: { type: GenType.STRING },
                                phoneticText: { type: GenType.STRING },
                                words: { 
                                    type: GenType.ARRAY, 
                                    items: { 
                                        type: GenType.OBJECT, 
                                        properties: { original: { type: GenType.STRING }, transliteration: { type: GenType.STRING }, portuguese: { type: GenType.STRING }, polysemy: { type: GenType.STRING }, etymology: { type: GenType.STRING }, grammar: { type: GenType.STRING } } 
                                    } 
                                }
                            }
                        };
                        const resJson = await generateContent(prompt, schema);
                        await db.entities.Dictionary.create({ 
                            book: bookMeta.name, chapter: c, verse: verseNum, 
                            verse_key: vKey, original_text: resJson.hebrewGreekText, 
                            transliteration: resJson.phoneticText, key_words: resJson.words 
                        });
                  }
                  addLog(`✅ Sucesso em ${c}:${verseNum}`);
                  await new Promise(r => setTimeout(r, 850)); 
              } catch (err: any) { 
                  addLog(`⚠️ Falha em ${c}:${verseNum}: ${err.message}`); 
              }
          }
      } catch (e: any) { addLog(`Erro Crítico de Rede: ${e.message}`); }
      setIsGeneratingBatch(false);
      updateRealCounts();
  };

  const addLog = (msg: string) => setBatchLogs(prev => [msg, ...prev].slice(0, 30));

  const bibleProgress = Math.round((counts.chapters / 1189) * 100);
  const commentaryProgress = Math.round((counts.commentaries / TOTAL_VERSES) * 100);
  const reqsRemaining = Math.max(0, (TOTAL_VERSES * 2) - (counts.commentaries + counts.dictionaries));

  if (showBuilder) return <AppBuilder onBack={() => { setShowBuilder(false); loadAppConfig(); }} onShowToast={onShowToast} currentConfig={appConfig} />;

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-[#121212] transition-colors duration-300">
      
      {/* HEADER RESTAURADO */}
      <div className="bg-[#1a0f0f] text-white p-4 flex items-center gap-4 sticky top-0 shadow-lg z-30 border-b border-[#C5A059]/30">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full"><ChevronLeft /></button>
        <h1 className="font-cinzel font-bold text-[#C5A059] flex items-center gap-2 tracking-widest text-xs md:text-sm uppercase">
            <ShieldCheck className="w-5 h-5"/> Painel do Editor Chefe ADMA
        </h1>
        <button onClick={refreshRealData} className={`ml-auto p-2 rounded-full ${isRefreshing ? 'animate-spin text-[#C5A059]' : 'text-white'}`}>
            <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 max-w-5xl mx-auto space-y-8 pb-32">
        
        {/* ESTRATÉGIA DE ALIMENTAÇÃO - TOTALMENTE FUNCIONAL */}
        <div className="bg-[#8B0000] text-white p-6 rounded-3xl shadow-2xl relative overflow-hidden group border border-[#C5A059]/30">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                <Activity className="w-32 h-32" />
            </div>
            <div className="relative z-10">
                <h2 className="font-cinzel font-bold text-xl flex items-center gap-2 mb-4"><Info className="w-5 h-5 text-[#C5A059]"/> Estratégia Real de Alimentação</h2>
                
                <div className="space-y-4 mb-6">
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                            <span>Base de Capítulos (Supabase)</span>
                            <span>{counts.chapters} / 1189 ({bibleProgress}%)</span>
                        </div>
                        <div className="w-full bg-black/30 rounded-full h-2 overflow-hidden border border-white/5">
                            <div className="bg-[#C5A059] h-full transition-all duration-1000" style={{ width: `${bibleProgress}%` }}></div>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                            <span>Exegese Comentada (Versículos)</span>
                            <span>{counts.commentaries} / ~31.100 ({commentaryProgress}%)</span>
                        </div>
                        <div className="w-full bg-black/30 rounded-full h-2 overflow-hidden border border-white/5">
                            <div className="bg-green-500 h-full transition-all duration-1000" style={{ width: `${commentaryProgress}%` }}></div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-white/10 pt-4">
                    <div className="bg-black/20 p-4 rounded-2xl border border-white/10">
                        <p className="text-[10px] uppercase font-bold text-[#C5A059] mb-1">Capacidade Diária</p>
                        <p className="text-2xl font-montserrat font-black">30.000 <span className="text-xs font-normal opacity-70">REQS</span></p>
                    </div>
                    <div className="bg-black/20 p-4 rounded-2xl border border-white/10">
                        <p className="text-[10px] uppercase font-bold text-[#C5A059] mb-1">Faltam Gerar</p>
                        <p className="text-2xl font-montserrat font-black">~{reqsRemaining} <span className="text-xs font-normal opacity-70">ITENS</span></p>
                    </div>
                    <div className="bg-black/20 p-4 rounded-2xl border border-white/10">
                        <p className="text-[10px] uppercase font-bold text-[#C5A059] mb-1">Tempo Estimado</p>
                        <p className="text-2xl font-montserrat font-black">~{Math.ceil(reqsRemaining / 30000)} DIAS</p>
                    </div>
                </div>
            </div>
        </div>

        {/* STATUS TILES - FUNCIONAL E VERDADEIRO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-[#1E1E1E] p-5 rounded-2xl shadow-lg border border-[#C5A059]/20 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${dbStatus === 'connected' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        <Server className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Banco de Dados</p>
                        <p className="font-cinzel font-bold dark:text-white uppercase">{dbStatus === 'connected' ? 'Online' : dbStatus === 'checking' ? 'Testando...' : 'Offline'}</p>
                    </div>
                </div>
                <button onClick={checkDbConnection} disabled={isCheckingDb} className="p-2 text-gray-300 hover:text-[#C5A059] transition-all">
                    <RefreshCw className={`w-4 h-4 ${isCheckingDb ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="bg-white dark:bg-[#1E1E1E] p-5 rounded-2xl shadow-lg border border-[#C5A059]/20 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
                        <Database className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Base (Nuvem)</p>
                        <p className="font-cinzel font-bold dark:text-white">{counts.chapters} Capítulos</p>
                    </div>
                </div>
                <button onClick={updateRealCounts} disabled={isRefreshing} className="p-2 text-gray-300 hover:text-[#C5A059] transition-all">
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <button onClick={checkKeysHealth} disabled={isCheckingKeys} className="bg-white dark:bg-[#1E1E1E] p-5 rounded-2xl shadow-lg border border-[#C5A059]/20 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-left">
                <div className={`p-3 rounded-xl ${keysStatus?.healthy > 0 ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-600'}`}>
                    {isCheckingKeys ? <Loader2 className="w-6 h-6 animate-spin" /> : <Activity className="w-6 h-6" />}
                </div>
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Saúde das APIs</p>
                    <p className="font-cinzel font-bold dark:text-white uppercase">{keysStatus ? `${keysStatus.healthy} Chaves OK` : 'Testar Agora'}</p>
                </div>
            </button>
        </div>

        {/* FÁBRICA DE CONTEÚDO EM LOTE */}
        <div className="bg-white dark:bg-[#1E1E1E] rounded-[2rem] shadow-xl border border-[#C5A059]/30 overflow-hidden">
            <div className="bg-[#1a0f0f] p-6 flex justify-between items-center border-b border-[#C5A059]/20">
                <div>
                    <h3 className="font-cinzel font-bold text-white text-lg">Gerador de Massa (Padrão ADMA)</h3>
                    <p className="text-[10px] text-[#C5A059] uppercase tracking-widest font-bold">Processamento Sequencial com Rigor Exegético</p>
                </div>
                <div className="flex gap-2">
                    <select value={batchBook} onChange={e => setBatchBook(e.target.value)} className="bg-gray-800 text-white text-[11px] border-none rounded-lg p-2 font-cinzel outline-none">
                        {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                    </select>
                    <input type="number" value={batchStartChapter} onChange={e => setBatchStartChapter(Number(e.target.value))} className="bg-gray-800 text-white text-xs border-none rounded-lg w-14 p-2 font-cinzel text-center outline-none" min={1}/>
                </div>
            </div>
            
            <div className="p-8">
                {isGeneratingBatch ? (
                    <div className="space-y-6">
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                            <Loader2 className="w-12 h-12 animate-spin text-[#8B0000] mb-3" />
                            <p className="font-cinzel font-bold dark:text-white text-xl">Gerindo Massa de Dados: {batchBook} {batchStartChapter}...</p>
                            <p className="text-sm text-gray-500 mt-1">O Professor está analisando versículo por versículo.</p>
                            <button onClick={() => { stopBatchRef.current = true; }} className="mt-6 flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-full font-bold hover:bg-red-700 transition-all text-xs">
                                <StopCircle className="w-4 h-4" /> PARAR ALIMENTAÇÃO
                            </button>
                        </div>
                        <div className="bg-black/90 rounded-2xl p-6 font-mono text-[11px] text-green-400 h-64 overflow-y-auto shadow-inner border border-white/5">
                            {batchLogs.map((log, i) => <div key={i} className="mb-1">{log}</div>)}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button onClick={() => handleBatchGenerate('commentary')} className="group p-8 bg-gradient-to-br from-[#8B0000] to-[#500000] rounded-[2rem] text-white flex flex-col items-center gap-4 hover:shadow-2xl transition-all hover:scale-[1.02] border border-[#C5A059]/20">
                            <MessageSquare className="w-10 h-10 text-[#C5A059]" />
                            <div className="text-center">
                                <p className="font-cinzel font-bold text-lg uppercase tracking-wider">Gerar Comentários Professor</p>
                                <p className="text-[10px] opacity-70 mt-1">Padrão Michel Felix PhD (Este versículo revela...)</p>
                            </div>
                        </button>
                        <button onClick={() => handleBatchGenerate('dictionary')} className="group p-8 bg-gradient-to-br from-[#1a0f0f] to-[#000000] border border-[#C5A059]/40 rounded-[2rem] text-white flex flex-col items-center gap-4 hover:shadow-2xl transition-all hover:scale-[1.02]">
                            <Languages className="w-10 h-10 text-[#C5A059]" />
                            <div className="text-center">
                                <p className="font-cinzel font-bold text-lg uppercase tracking-wider">Gerar Dicionário Original</p>
                                <p className="text-[10px] opacity-70 mt-1">Análise Lexical Profunda (Hebraico/Grego)</p>
                            </div>
                        </button>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}