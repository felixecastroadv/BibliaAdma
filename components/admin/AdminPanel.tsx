import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ShieldCheck, RefreshCw, Loader2, Upload, Download, Server, HardDrive, Flag, CheckCircle, XCircle, MessageSquare, Languages, GraduationCap, Calendar, CloudUpload, Wand2, StopCircle, Trash2, AlertTriangle, Save, Lock, Unlock, KeyRound, Search, Cloud, Activity, Zap, Battery, Info, Database } from 'lucide-react';
import { generateContent } from '../../services/geminiService';
import { BIBLE_BOOKS, generateChapterKey, generateVerseKey, TOTAL_CHAPTERS } from '../../constants';
import { db, bibleStorage } from '../../services/database';
import { Type as GenType } from "@google/genai";
import { ContentReport, AppConfig, UserProgress } from '../../types';
import AppBuilder from './AppBuilder';

const TOTAL_VERSES = 31102;

export default function AdminPanel({ onBack, onShowToast }: { onBack: () => void, onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void }) {
  // --- STATES DE INFRAESTRUTURA ---
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [counts, setCounts] = useState({ chapters: 0, commentaries: 0, dictionaries: 0 });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCheckingDb, setIsCheckingDb] = useState(false);
  
  // --- STATES DE CHAVES API ---
  const [keysStatus, setKeysStatus] = useState<any>(null);
  const [isCheckingKeys, setIsCheckingKeys] = useState(false);

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
  const [batchLogs, setBatchLogs] = useState<string[]>([]);
  const stopBatchRef = useRef(false);

  // --- STATE DE DEVOCIONAL ---
  const [devotionalDate, setDevotionalDate] = useState(new Date().toISOString().split('T')[0]);

  // --- STATES DE RELATÓRIOS ---
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [showReportsModal, setShowReportsModal] = useState(false);

  // --- STATES DE USUÁRIOS ---
  const [usersList, setUsersList] = useState<UserProgress[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // --- BUILDER STATE ---
  const [showBuilder, setShowBuilder] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    refreshRealData();
    loadReports();
    checkOfflineIntegrity();
    loadAppConfig();
    loadUsers(); 
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
      } catch (e) { console.error("Erro ao contar itens reais na nuvem:", e); }
  };

  const checkKeysHealth = async () => {
      setIsCheckingKeys(true);
      try {
          const res = await fetch('/api/keys-status');
          const data = await res.json();
          setKeysStatus(data);
          onShowToast(`Monitoramento Real: ${data.healthy} chaves ativas.`, data.healthy > 0 ? "success" : "error");
      } catch (e) { onShowToast("Falha na checagem de APIs.", "error"); } finally { setIsCheckingKeys(false); }
  };

  const checkOfflineIntegrity = async () => {
      try {
          const count = await bibleStorage.count();
          setOfflineCount(count);
      } catch (e) { setOfflineCount(0); }
  };

  const loadReports = async () => {
      try {
          const data = await db.entities.ContentReports.list();
          setReports(data || []);
      } catch (e) {}
  };

  const loadUsers = async () => {
      setLoadingUsers(true);
      try {
          const data = await db.entities.ReadingProgress.list('chapters', 1000); 
          setUsersList(data || []);
      } catch(e) {
          onShowToast("Erro ao carregar usuários.", "error");
      } finally {
          setLoadingUsers(false);
      }
  };

  const handleDeleteReport = async (id: string) => {
      if(!window.confirm("Marcar como resolvido e apagar?")) return;
      try {
          await db.entities.ContentReports.delete(id);
          setReports(prev => prev.filter(r => r.id !== id));
          onShowToast("Resolvido.", "success");
      } catch(e) { onShowToast("Erro ao deletar.", "error"); }
  };

  const toggleUserBlock = async (user: UserProgress) => {
      const newStatus = !user.is_blocked;
      if (!window.confirm(newStatus ? `Bloquear ${user.user_name}?` : `Desbloquear ${user.user_name}?`)) return;
      try {
          await db.entities.ReadingProgress.update(user.id!, { is_blocked: newStatus });
          setUsersList(prev => prev.map(u => u.id === user.id ? { ...u, is_blocked: newStatus } : u));
          onShowToast(newStatus ? "Usuário bloqueado." : "Usuário desbloqueado.", "success");
      } catch(e) { onShowToast("Erro ao atualizar status.", "error"); }
  };

  const resetUserPassword = async (user: UserProgress) => {
      if (!window.confirm(`Resetar a senha de ${user.user_name}? Ele precisará criar uma nova no próximo login.`)) return;
      try {
          await db.entities.ReadingProgress.update(user.id!, { password_pin: "", reset_requested: false });
          setUsersList(prev => prev.map(u => u.id === user.id ? { ...u, password_pin: "", reset_requested: false } : u));
          onShowToast("Senha resetada.", "success");
      } catch(e) { onShowToast("Erro ao resetar senha.", "error"); }
  };

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
      if (!window.confirm("Isso baixará toda a Bíblia da API externa e salvará na NUVEM e no dispositivo. Isso restaura textos perdidos. Continuar?")) return;
      setIsProcessing(true);
      setProcessStatus("Preparando...");
      setProgress(0);
      let count = 0;
      await bibleStorage.clear();
      setOfflineCount(0); 
      stopBatchRef.current = false;
      try {
        for (const book of BIBLE_BOOKS) {
            if (stopBatchRef.current) break;
            for (let c = 1; c <= book.chapters; c++) {
                if (stopBatchRef.current) break;
                const key = `bible_acf_${book.abbrev}_${c}`;
                try {
                    setProcessStatus(`Baixando ${book.name} ${c}...`);
                    const data = await fetchWithRetry(`https://www.abibliadigital.com.br/api/verses/acf/${book.abbrev}/${c}`);
                    if (data && data.verses) {
                        const optimizedVerses = data.verses.map((v: any) => v.text.trim());
                        await db.entities.BibleChapter.saveUniversal(key, optimizedVerses);
                        setOfflineCount(prev => (prev || 0) + 1);
                    }
                } catch(e: any) { console.error(`Falha em ${book.name} ${c}:`, e); }
                count++;
                setProgress(Math.round((count / TOTAL_CHAPTERS) * 100));
            }
        }
      } catch (err: any) { onShowToast("Erro no download.", "error"); }
      setIsProcessing(false);
      stopBatchRef.current = false;
      await refreshRealData();
      onShowToast("Bíblia Restaurada e Sincronizada com Sucesso!", "success");
  };

  const handleRestoreFromCloud = async () => {
      if (!window.confirm("Isso irá verificar a BASE DE DADOS NA NUVEM e baixar todo o texto bíblico salvo para o seu dispositivo. Continuar?")) return;
      setIsProcessing(true);
      setProcessStatus("Conectando à Base de Dados...");
      setProgress(0);
      stopBatchRef.current = false;
      try {
          let totalRestored = 0;
          for (let i = 0; i < BIBLE_BOOKS.length; i++) {
              if (stopBatchRef.current) break;
              const book = BIBLE_BOOKS[i];
              for (let c = 1; c <= book.chapters; c++) {
                  if (stopBatchRef.current) break;
                  const key = `bible_acf_${book.abbrev}_${c}`;
                  const verses = await db.entities.BibleChapter.getCloud(key);
                  if (verses && Array.isArray(verses) && verses.length > 0) {
                      await bibleStorage.save(key, verses);
                      totalRestored++;
                  }
              }
              setProgress(Math.round(((i + 1) / BIBLE_BOOKS.length) * 100));
              setProcessStatus(`Restaurando: ${book.name}`);
          }
          setOfflineCount(await bibleStorage.count());
          onShowToast(`Restauração Completa! ${totalRestored} capítulos recuperados.`, "success");
      } catch (e: any) { onShowToast(`Erro na restauração: ${e.message}`, "error"); } finally { setIsProcessing(false); setProgress(0); }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      setIsProcessing(true);
      setProcessStatus("Lendo arquivo gigante...");
      stopBatchRef.current = false;
      reader.onload = async (e) => {
          try {
              const jsonText = e.target?.result as string;
              const cleanJson = jsonText.replace(/^\uFEFF/, ''); 
              const rawData = JSON.parse(cleanJson);
              
              setProcessStatus("Analisando estrutura e versões...");
              let count = 0;
              const isFlatVerseList = Array.isArray(rawData) && rawData.length > 1000 && (rawData[0].verse || rawData[0].versiculo);
              
              if (isFlatVerseList) {
                  const chaptersMap: Record<string, string[]> = {};
                  for (let i = 0; i < rawData.length; i++) {
                      if (stopBatchRef.current) break;
                      const item = rawData[i];
                      const bAbbrevRaw = (item.abbrev || item.abbreviation || "").toLowerCase();
                      const foundBook = BIBLE_BOOKS.find(b => b.abbrev === bAbbrevRaw || b.name.toLowerCase() === (item.book || "").toLowerCase());
                      if (!foundBook) continue;
                      const cNum = item.chapter || item.capitulo || item.c;
                      const vNum = item.verse || item.versiculo || item.v;
                      const text = item.text || item.texto;
                      if (cNum && text) {
                          const key = `bible_acf_${foundBook.abbrev}_${cNum}`;
                          if (!chaptersMap[key]) chaptersMap[key] = [];
                          chaptersMap[key][vNum - 1] = text.trim();
                      }
                  }
                  const chapterKeys = Object.keys(chaptersMap);
                  for (let i = 0; i < chapterKeys.length; i++) {
                      if (stopBatchRef.current) break;
                      const key = chapterKeys[i];
                      const verses = chaptersMap[key].filter(v => v !== undefined);
                      await db.entities.BibleChapter.saveUniversal(key, verses);
                      count++;
                      if (i % 10 === 0) setProgress(Math.round((i / chapterKeys.length) * 100));
                  }
              } else {
                  const list = Array.isArray(rawData) ? rawData : (rawData.verses || rawData.chapters || []);
                  for (let i = 0; i < list.length; i++) {
                      if (stopBatchRef.current) break;
                      const item = list[i];
                      const key = item.key || generateChapterKey(item.book, item.chapter);
                      const verses = item.verses || item.text;
                      if (key && Array.isArray(verses)) {
                          await db.entities.BibleChapter.saveUniversal(key, verses);
                          count++;
                      }
                      if (i % 50 === 0) setProgress(Math.round((i / list.length) * 100));
                  }
              }
              setOfflineCount(await bibleStorage.count());
              onShowToast(`Sucesso! ${count} capítulos salvos.`, "success");
          } catch (error: any) { onShowToast(`Erro crítico: ${error.message}`, "error"); } finally { setIsProcessing(false); setProgress(0); }
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
                  if (verses) allData.push({ key, verses, book: book.name, chapter: c });
              }
          }
          const blob = new Blob([JSON.stringify(allData)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `backup_biblia_adma_${new Date().toISOString().split('T')[0]}.json`;
          a.click();
          onShowToast("Exportação concluída.", "success");
      } catch (e) { onShowToast("Erro ao exportar.", "error"); } finally { setIsProcessing(false); }
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
          addLog(`🚀 Iniciando Lote: ${bookMeta.name} ${c} (${verses.length} versículos).`);
          for (let i = 0; i < verses.length; i++) {
              if (stopBatchRef.current) { addLog("🛑 Processamento Interrompido."); break; }
              const verseNum = i + 1;
              const vKey = generateVerseKey(bookMeta.name, c, verseNum);
              const textBase = verses[i];
              addLog(`⏳ Alimentando ${bookMeta.name} ${c}:${verseNum}...`);
              try {
                  if (type === 'commentary') {
                        const prompt = `ATUE COMO: Professor Michel Felix, PhD em Teologia. TAREFA: Escrever um comentário EXEGÉTICO para o sistema ADMA. TEXTO BÍBLICO: "${textBase}" REFERÊNCIA: ${bookMeta.name} ${c}:${verseNum} --- REGRAS DE OURO (NÃO NEGOCIÁVEL) --- 1. INÍCIO OBRIGATÓRIO: "Este versículo revela...". 2. ZERO SAUDAÇÕES: Proibido "Olá", "A Paz do Senhor" ou introduções sociais. 3. TONE: Magistral, Acadêmico, Erudito mas Claro. --- PROTOCOLO DE HERMENÊUTICA ADMA --- - USO IMPLÍCITO: A Bíblia explica a Bíblia. Verifique o contexto remoto. - PRECISÃO CRONOLÓGICA: Sem anacronismos históricos. - ORTODOXIA: Linha pentecostal conservadora (Assembleiana). - EFEITO "AH! ENTENDI!": Descomplique o texto sem perder a profundidade. --- ESTRUTURA (3 Parágrafos) --- O Desvendar do Texto, Conexão Teológica e Aplicação Prática.`;
                        const resText = await generateContent(prompt);
                        await db.entities.Commentary.create({ book: bookMeta.name, chapter: c, verse: verseNum, verse_key: vKey, commentary_text: resText });
                  } else {
                        const lang = bookMeta.testament === 'old' ? 'HEBRAICO' : 'GREGO';
                        const prompt = `Você é um HEBRAÍSTA e HELENISTA SÊNIOR. Realize análise lexical de ${bookMeta.name} ${c}:${verseNum}. Texto: "${textBase}". Idioma: ${lang}. Retorne JSON.`;
                        const schema = {
                            type: GenType.OBJECT,
                            properties: {
                                hebrewGreekText: { type: GenType.STRING },
                                phoneticText: { type: GenType.STRING },
                                words: { type: GenType.ARRAY, items: { type: GenType.OBJECT, properties: { original: { type: GenType.STRING }, transliteration: { type: GenType.STRING }, portuguese: { type: GenType.STRING }, polysemy: { type: GenType.STRING }, etymology: { type: GenType.STRING }, grammar: { type: GenType.STRING } } } }
                            }
                        };
                        const resJson = await generateContent(prompt, schema);
                        await db.entities.Dictionary.create({ book: bookMeta.name, chapter: c, verse: verseNum, verse_key: vKey, original_text: resJson.hebrewGreekText, transliteration: resJson.phoneticText, key_words: resJson.words });
                  }
                  addLog(`✅ Sucesso em ${c}:${verseNum}`);
                  await new Promise(r => setTimeout(r, 850)); 
              } catch (err: any) { addLog(`⚠️ Falha em ${c}:${verseNum}: ${err.message}`); }
          }
      } catch (e: any) { addLog(`Erro Crítico de Rede: ${e.message}`); }
      setIsGeneratingBatch(false);
      updateRealCounts();
  };

  const handleGenerateDevotional = async () => {
      if (!devotionalDate) return;
      setIsGeneratingBatch(true);
      stopBatchRef.current = false;
      const dateStr = devotionalDate;
      addLog(`Gerando devocional para ${dateStr}...`);
      try {
         const prompt = `ATUE COMO: Michel Felix. TAREFA: Devocional para ${dateStr}. JSON: { title, reference, verse_text, body, prayer }.`;
         const schema = {
            type: GenType.OBJECT,
            properties: {
                title: {type: GenType.STRING},
                reference: {type: GenType.STRING},
                verse_text: {type: GenType.STRING},
                body: {type: GenType.STRING},
                prayer: {type: GenType.STRING}
            }
         };
         const res = await generateContent(prompt, schema);
         await db.entities.Devotional.create({ ...res, date: dateStr, is_published: true });
         addLog(`Devocional criado!`);
         onShowToast(`Devocional gerado!`, "success");
      } catch (e: any) { addLog(`Erro: ${e.message}`); }
      setIsGeneratingBatch(false);
  };

  const addLog = (msg: string) => setBatchLogs(prev => [msg, ...prev].slice(0, 30));
  const handleStopBatch = () => { stopBatchRef.current = true; addLog("🛑 Solicitando parada..."); };

  const bibleProgress = Math.round((counts.chapters / 1189) * 100);
  const commentaryProgress = Math.round((counts.commentaries / TOTAL_VERSES) * 100);
  const reqsRemaining = Math.max(0, (TOTAL_VERSES * 2) - (counts.commentaries + counts.dictionaries));

  if (showBuilder) return <AppBuilder onBack={() => { setShowBuilder(false); loadAppConfig(); }} onShowToast={onShowToast} currentConfig={appConfig} />;

  const filteredUsers = usersList.filter(u => u.user_name.toLowerCase().includes(userSearch.toLowerCase()) || u.user_email.toLowerCase().includes(userSearch.toLowerCase()));

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-[#121212] transition-colors duration-300">
      
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
                      {reports.length === 0 ? <p className="text-center text-gray-400 py-10">Vazio.</p> : reports.map(report => (
                          <div key={report.id} className="bg-gray-50 dark:bg-black/20 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                              <div className="flex justify-between"><span className="font-bold text-[#8B0000]">{report.reference_text}</span></div>
                              <p className="text-gray-700 dark:text-gray-300 italic mb-3">"{report.report_text}"</p>
                              <button onClick={() => handleDeleteReport(report.id!)} className="w-full bg-green-600 text-white py-1 rounded text-xs font-bold hover:bg-green-700 flex items-center justify-center gap-2"><CheckCircle className="w-3 h-3"/> Marcar como Resolvido</button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* HEADER */}
      <div className="bg-[#1a0f0f] text-white p-4 flex items-center gap-4 sticky top-0 shadow-lg z-30 border-b border-[#C5A059]/30">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full"><ChevronLeft /></button>
        <h1 className="font-cinzel font-bold text-[#C5A059] flex items-center gap-2 tracking-widest text-xs md:text-sm uppercase"><ShieldCheck className="w-5 h-5"/> Painel do Editor Chefe ADMA</h1>
        <div className="ml-auto flex gap-2">
            <button onClick={() => setShowReportsModal(true)} className="relative p-2 hover:bg-white/10 rounded-full">
                <Flag className="w-5 h-5 text-red-500" />
                {reports.length > 0 && <span className="absolute top-0 right-0 w-3 h-3 bg-red-600 rounded-full animate-pulse border border-white"></span>}
            </button>
            <button onClick={refreshRealData} className={`p-2 rounded-full ${isRefreshing ? 'animate-spin text-[#C5A059]' : 'text-white'}`}><RefreshCw className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto space-y-8 pb-32">
        
        {/* BOTÃO BUILDER AI */}
        <div className="bg-gradient-to-r from-[#C5A059] to-[#8B0000] p-6 rounded-3xl shadow-xl text-white flex justify-between items-center transform hover:scale-[1.01] transition-transform cursor-pointer" onClick={() => setShowBuilder(true)}>
            <div>
                <h2 className="font-cinzel font-bold text-2xl flex items-center gap-2"><Wand2 className="w-6 h-6"/> ADMA Builder AI</h2>
                <p className="text-sm opacity-90">Conversar com a IA para customizar o app.</p>
            </div>
            <button className="bg-white text-[#8B0000] px-6 py-3 rounded-xl font-bold shadow-lg">Abrir</button>
        </div>

        {/* ESTRATÉGIA DE ALIMENTAÇÃO REALISTA */}
        <div className="bg-[#8B0000] text-white p-6 rounded-3xl shadow-2xl relative overflow-hidden group border border-[#C5A059]/30">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform"><Activity className="w-32 h-32" /></div>
            <div className="relative z-10">
                <h2 className="font-cinzel font-bold text-xl flex items-center gap-2 mb-4"><Info className="w-5 h-5 text-[#C5A059]"/> Estratégia Real de Alimentação</h2>
                <div className="space-y-4 mb-6">
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest"><span>Base de Capítulos (Supabase)</span><span>{counts.chapters} / 1189 ({bibleProgress}%)</span></div>
                        <div className="w-full bg-black/30 rounded-full h-2 overflow-hidden border border-white/5"><div className="bg-[#C5A059] h-full transition-all duration-1000" style={{ width: `${bibleProgress}%` }}></div></div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest"><span>Exegese Comentada (Versículos)</span><span>{counts.commentaries} / ~31.100 ({commentaryProgress}%)</span></div>
                        <div className="w-full bg-black/30 rounded-full h-2 overflow-hidden border border-white/5"><div className="bg-green-500 h-full transition-all duration-1000" style={{ width: `${commentaryProgress}%` }}></div></div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-white/10 pt-4">
                    <div className="bg-black/20 p-4 rounded-2xl border border-white/10"><p className="text-[10px] uppercase font-bold text-[#C5A059] mb-1">Capacidade Diária</p><p className="text-2xl font-montserrat font-black">30.000 <span className="text-xs font-normal opacity-70">REQS</span></p></div>
                    <div className="bg-black/20 p-4 rounded-2xl border border-white/10"><p className="text-[10px] uppercase font-bold text-[#C5A059] mb-1">Faltam Gerar</p><p className="text-2xl font-montserrat font-black">~{reqsRemaining} <span className="text-xs font-normal opacity-70">ITENS</span></p></div>
                    <div className="bg-black/20 p-4 rounded-2xl border border-white/10"><p className="text-[10px] uppercase font-bold text-[#C5A059] mb-1">Tempo Estimado</p><p className="text-2xl font-montserrat font-black">~{Math.ceil(reqsRemaining / 30000)} DIAS</p></div>
                </div>
            </div>
        </div>

        {/* STATUS TILES FUNCIONAIS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-[#1E1E1E] p-5 rounded-2xl shadow-lg border border-[#C5A059]/20 flex items-center justify-between group">
                <div className="flex items-center gap-4"><div className={`p-3 rounded-xl ${dbStatus === 'connected' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}><Server className="w-6 h-6" /></div><div><p className="text-[10px] font-bold text-gray-400 uppercase">Banco de Dados</p><p className="font-cinzel font-bold dark:text-white uppercase">{dbStatus === 'connected' ? 'Online' : dbStatus === 'checking' ? 'Testando...' : 'Offline'}</p></div></div>
                <button onClick={checkDbConnection} disabled={isCheckingDb} className="p-2 text-gray-300 hover:text-[#C5A059] transition-all"><RefreshCw className={`w-4 h-4 ${isCheckingDb ? 'animate-spin' : ''}`} /></button>
            </div>
            <div className="bg-white dark:bg-[#1E1E1E] p-5 rounded-2xl shadow-lg border border-[#C5A059]/20 flex items-center justify-between group">
                <div className="flex items-center gap-4"><div className="p-3 rounded-xl bg-blue-100 text-blue-600"><Database className="w-6 h-6" /></div><div><p className="text-[10px] font-bold text-gray-400 uppercase">Base (Nuvem)</p><p className="font-cinzel font-bold dark:text-white">{counts.chapters} Capítulos</p></div></div>
                <button onClick={updateRealCounts} disabled={isRefreshing} className="p-2 text-gray-300 hover:text-[#C5A059] transition-all"><RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /></button>
            </div>
            <button onClick={checkKeysHealth} disabled={isCheckingKeys} className="bg-white dark:bg-[#1E1E1E] p-5 rounded-2xl shadow-lg border border-[#C5A059]/20 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-left">
                <div className={`p-3 rounded-xl ${keysStatus?.healthy > 0 ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-600'}`}>{isCheckingKeys ? <Loader2 className="w-6 h-6 animate-spin" /> : <Activity className="w-6 h-6" />}</div>
                <div><p className="text-[10px] font-bold text-gray-400 uppercase">Saúde das APIs</p><p className="font-cinzel font-bold dark:text-white uppercase">{keysStatus ? `${keysStatus.healthy} Chaves OK` : 'Testar Agora'}</p></div>
            </button>
        </div>

        {/* GESTÃO DA BÍBLIA */}
        <h2 className="font-cinzel font-bold text-xl text-[#8B0000] dark:text-[#ff6b6b] border-b border-[#C5A059] pb-2">1. Gestão da Bíblia (JSON / Big Data)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <button onClick={handleDownloadBible} disabled={isProcessing} className="bg-white dark:bg-dark-card p-4 rounded-xl shadow border border-[#C5A059]/30 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                 {isProcessing ? <Loader2 className="w-8 h-8 animate-spin text-[#C5A059]" /> : <CloudUpload className="w-8 h-8 text-[#C5A059]" />}
                 <span className="font-bold text-xs text-center dark:text-white">Baixar da Web</span>
             </button>
             <button onClick={handleRestoreFromCloud} disabled={isProcessing} className="bg-[#8B0000] text-white p-4 rounded-xl shadow border border-[#C5A059]/30 flex flex-col items-center justify-center gap-2 hover:bg-[#600018] transition animate-pulse">
                 {isProcessing ? <Loader2 className="w-8 h-8 animate-spin text-white" /> : <Cloud className="w-8 h-8 text-white" />}
                 <span className="font-bold text-xs text-center">Resgatar da Nuvem</span>
             </button>
             <div className="bg-white dark:bg-dark-card p-4 rounded-xl shadow border border-[#C5A059]/30 flex flex-col items-center justify-center gap-2 relative overflow-hidden group hover:bg-gray-50 cursor-pointer">
                 <Upload className="w-8 h-8 text-blue-500" />
                 <span className="font-bold text-xs text-center dark:text-white">Upload JSON</span>
                 <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="absolute inset-0 opacity-0 cursor-pointer" disabled={isProcessing} />
             </div>
             <button onClick={handleExportJson} disabled={isProcessing} className="bg-white dark:bg-dark-card p-4 rounded-xl shadow border border-[#C5A059]/30 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                 <Download className="w-8 h-8 text-green-500" />
                 <span className="font-bold text-xs text-center dark:text-white">Backup Local</span>
             </button>
        </div>

        {/* PROGRESSO DE PROCESSAMENTO */}
        {isProcessing && (
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl border border-[#C5A059]/30 mt-4">
                <div className="flex justify-between text-xs mb-1 font-bold dark:text-white">
                    <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin"/> {processStatus}</span>
                    <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-full h-3 overflow-hidden border border-gray-400 dark:border-gray-500">
                    <div className="bg-gradient-to-r from-[#C5A059] to-[#8B0000] h-3 rounded-full transition-all duration-300 shadow-[0_0_10px_#C5A059]" style={{ width: `${progress}%` }}></div>
                </div>
            </div>
        )}

        {/* GERAÇÃO EM LOTE - PROMPTS RESTAURADOS */}
        <h2 className="font-cinzel font-bold text-xl text-[#8B0000] dark:text-[#ff6b6b] border-b border-[#C5A059] pb-2 mt-8">2. Fábrica de Conteúdo (IA)</h2>
        <div className="bg-white dark:bg-[#1E1E1E] rounded-[2rem] shadow-xl border border-[#C5A059]/30 overflow-hidden">
            <div className="bg-[#1a0f0f] p-6 flex justify-between items-center border-b border-[#C5A059]/20">
                <div><h3 className="font-cinzel font-bold text-white text-lg">Gerador de Massa (Padrão ADMA)</h3><p className="text-[10px] text-[#C5A059] uppercase tracking-widest font-bold">Processamento Sequencial com Rigor Exegético</p></div>
                <div className="flex gap-2">
                    <select value={batchBook} onChange={e => setBatchBook(e.target.value)} className="bg-gray-800 text-white text-[11px] border-none rounded-lg p-2 font-cinzel outline-none">{BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}</select>
                    <input type="number" value={batchStartChapter} onChange={e => setBatchStartChapter(Number(e.target.value))} className="bg-gray-800 text-white text-xs border-none rounded-lg w-14 p-2 font-cinzel text-center outline-none" min={1}/>
                </div>
            </div>
            <div className="p-8">
                {isGeneratingBatch ? (
                    <div className="space-y-6">
                        <div className="flex flex-col items-center justify-center py-6 text-center"><Loader2 className="w-12 h-12 animate-spin text-[#8B0000] mb-3" /><p className="font-cinzel font-bold dark:text-white text-xl">Gerindo Massa: {batchBook} {batchStartChapter}...</p><button onClick={handleStopBatch} className="mt-6 flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-full font-bold hover:bg-red-700 transition-all text-xs"><StopCircle className="w-4 h-4" /> PARAR LOTE</button></div>
                        <div className="bg-black/90 rounded-2xl p-6 font-mono text-[11px] text-green-400 h-64 overflow-y-auto shadow-inner border border-white/5">{batchLogs.map((log, i) => <div key={i} className="mb-1">{log}</div>)}</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button onClick={() => handleBatchGenerate('commentary')} className="group p-8 bg-gradient-to-br from-[#8B0000] to-[#500000] rounded-[2rem] text-white flex flex-col items-center gap-4 hover:shadow-2xl transition-all hover:scale-[1.02] border border-[#C5A059]/20"><MessageSquare className="w-10 h-10 text-[#C5A059]" /><div className="text-center"><p className="font-cinzel font-bold text-lg uppercase tracking-wider">Gerar Comentários Professor</p><p className="text-[10px] opacity-70 mt-1">Padrão Michel Felix PhD (Este versículo revela...)</p></div></button>
                        <button onClick={() => handleBatchGenerate('dictionary')} className="group p-8 bg-gradient-to-br from-[#1a0f0f] to-[#000000] border border-[#C5A059]/40 rounded-[2rem] text-white flex flex-col items-center gap-4 hover:shadow-2xl transition-all hover:scale-[1.02]"><Languages className="w-10 h-10 text-[#C5A059]" /><div className="text-center"><p className="font-cinzel font-bold text-lg uppercase tracking-wider">Gerar Dicionário Original</p><p className="text-[10px] opacity-70 mt-1">Análise Lexical Profunda (Hebraico/Grego)</p></div></button>
                    </div>
                )}
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border-t flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-purple-700 flex items-center gap-1"><Calendar className="w-3 h-3"/> Gerador Devocional:</span>
                    <input type="date" value={devotionalDate} onChange={e => setDevotionalDate(e.target.value)} className="p-1 text-xs border rounded"/>
                </div>
                <button onClick={handleGenerateDevotional} className="bg-purple-700 text-white px-6 py-1 rounded text-xs font-bold hover:bg-purple-800 transition-colors">Gerar para esta Data</button>
            </div>
        </div>

        {/* GESTÃO DE USUÁRIOS */}
        <h2 className="font-cinzel font-bold text-xl text-[#8B0000] dark:text-[#ff6b6b] border-b border-[#C5A059] pb-2 mt-8">3. Gestão de Usuários</h2>
        <div className="bg-white dark:bg-dark-card rounded-xl shadow border border-[#C5A059]/20 overflow-hidden">
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-[#C5A059]/20 flex gap-2">
                <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Buscar usuários..." className="w-full pl-9 p-2 rounded border text-sm dark:bg-gray-800 dark:text-white dark:border-gray-700" /></div>
                <button onClick={loadUsers} className="p-2 bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300"><RefreshCw className="w-4 h-4 text-gray-600 dark:text-gray-300"/></button>
            </div>
            <div className="max-h-96 overflow-y-auto">
                {loadingUsers ? <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#C5A059]"/></div> : filteredUsers.length === 0 ? <div className="p-10 text-center text-gray-400">Vazio.</div> : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-black/20 text-gray-500 font-bold text-left sticky top-0"><tr><th className="p-3">Nome</th><th className="p-3">Status</th><th className="p-3 text-right">Ações</th></tr></thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">{filteredUsers.map(user => (
                            <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                                <td className="p-3">
                                    <div className="font-bold dark:text-white">{user.user_name}</div>
                                    <div className="text-xs text-gray-400">{user.user_email}</div>
                                    {user.reset_requested && <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded-full mt-1"><KeyRound className="w-3 h-3"/> Pediu Reset</span>}
                                </td>
                                <td className="p-3">{user.is_blocked ? <span className="text-red-500 font-bold flex items-center gap-1"><Lock className="w-3 h-3"/> Bloqueado</span> : <span className="text-green-500 font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Ativo</span>}</td>
                                <td className="p-3 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => resetUserPassword(user)} className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded" title="Resetar Senha"><KeyRound className="w-4 h-4" /></button>
                                        <button onClick={() => toggleUserBlock(user)} className={`p-1.5 rounded ${user.is_blocked ? 'text-green-600 hover:bg-green-50' : 'text-red-600 hover:bg-red-50'}`} title={user.is_blocked ? "Desbloquear" : "Bloquear"}>{user.is_blocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}</button>
                                    </div>
                                </td>
                            </tr>
                        ))}</tbody>
                    </table>
                )}
            </div>
            <div className="bg-gray-50 dark:bg-black/20 p-2 text-xs text-gray-500 text-center border-t border-[#C5A059]/20">Total de usuários: {usersList.length}</div>
        </div>
      </div>
    </div>
  );
}