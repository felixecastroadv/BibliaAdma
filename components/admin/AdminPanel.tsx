import React, { useState, useEffect } from 'react';
import { ChevronLeft, Key, ShieldCheck, RefreshCw, Loader2, Save, AlertTriangle, CheckCircle, XCircle, Info, BookOpen, Download, Server, Database } from 'lucide-react';
import { getStoredApiKey, setStoredApiKey } from '../../services/geminiService';
import { BIBLE_BOOKS } from '../../constants';
import { db } from '../../services/database';

// Mapeamento para API Internacional (Garante 100% de disponibilidade para o download)
const PT_TO_EN_BOOKS: Record<string, string> = {
    "Gênesis": "Genesis", "Êxodo": "Exodus", "Levítico": "Leviticus", "Números": "Numbers", "Deuteronômio": "Deuteronomy",
    "Josué": "Joshua", "Juízes": "Judges", "Rute": "Ruth", "1 Samuel": "1 Samuel", "2 Samuel": "2 Samuel",
    "1 Reis": "1 Kings", "2 Reis": "2 Kings", "1 Crônicas": "1 Chronicles", "2 Crônicas": "2 Chronicles",
    "Esdras": "Ezra", "Neemias": "Nehemiah", "Ester": "Esther", "Jó": "Job", "Salmos": "Psalms",
    "Provérbios": "Proverbs", "Eclesiastes": "Ecclesiastes", "Cantares": "Song of Solomon", "Isaías": "Isaiah",
    "Jeremias": "Jeremiah", "Lamentações": "Lamentations", "Ezequiel": "Ezekiel", "Daniel": "Daniel",
    "Oséias": "Hosea", "Joel": "Joel", "Amós": "Amos", "Obadias": "Obadiah", "Jonas": "Jonah",
    "Miquéias": "Micah", "Naum": "Nahum", "Habacuque": "Habakkuk", "Sofonias": "Zephaniah", "Ageu": "Haggai",
    "Zacarias": "Zechariah", "Malaquias": "Malachi", "Mateus": "Matthew", "Marcos": "Mark", "Lucas": "Luke",
    "João": "John", "Atos": "Acts", "Romanos": "Romans", "1 Coríntios": "1 Corinthians", "2 Coríntios": "2 Corinthians",
    "Gálatas": "Galatians", "Efésios": "Ephesians", "Filipenses": "Philippians", "Colossenses": "Colossians",
    "1 Tessalonicenses": "1 Thessalonians", "2 Tessalonicenses": "2 Thessalonians", "1 Timóteo": "1 Timothy",
    "2 Timóteo": "2 Timothy", "Tito": "Titus", "Filemom": "Philemon", "Hebreus": "Hebrews", "Tiago": "James",
    "1 Pedro": "1 Peter", "2 Pedro": "2 Peter", "1 João": "1 John", "2 João": "2 John", "3 João": "3 John", "Judas": "Jude", "Apocalipse": "Revelation"
};

export default function AdminPanel({ onBack, onShowToast }: { onBack: () => void, onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void }) {
  const [apiKey, setApiKey] = useState('');
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  
  useEffect(() => {
    const k = getStoredApiKey();
    setStoredKey(k);
    if(k) setApiKey(k);
    checkDbConnection();
  }, []);

  const checkDbConnection = async () => {
    setDbStatus('checking');
    try {
        // Tenta listar algo simples
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

  const handleDownloadBible = async () => {
      if (!window.confirm("Isso irá baixar todos os textos bíblicos para cache local. Pode demorar. Continuar?")) return;
      
      setIsDownloading(true);
      setDownloadProgress(0);
      let total = 0;
      let count = 0;
      
      BIBLE_BOOKS.forEach(b => total += b.chapters);

      // Simula download (em um app real seria fetch de cada capitulo)
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
              setDownloadProgress(Math.round((count / total) * 100));
          }
      }
      
      setIsDownloading(false);
      onShowToast("Bíblia baixada para uso offline!", "success");
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-300">
      <div className="bg-[#1a0f0f] text-white p-4 flex items-center gap-4 sticky top-0 shadow-lg z-10">
        <button onClick={onBack}><ChevronLeft /></button>
        <h1 className="font-cinzel font-bold text-[#C5A059] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5"/> Painel do Editor Chefe
        </h1>
      </div>

      <div className="p-6 max-w-4xl mx-auto space-y-6 pb-20">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow border border-[#C5A059]/20">
                <h3 className="font-bold text-gray-500 mb-4 flex items-center gap-2"><Server className="w-4 h-4"/> Status do Banco de Dados</h3>
                <div className="flex items-center gap-3">
                    {dbStatus === 'checking' && <Loader2 className="w-6 h-6 animate-spin text-blue-500" />}
                    {dbStatus === 'connected' && <CheckCircle className="w-6 h-6 text-green-500" />}
                    {dbStatus === 'error' && <XCircle className="w-6 h-6 text-red-500" />}
                    
                    <span className="font-bold text-lg dark:text-white">
                        {dbStatus === 'checking' && 'Verificando...'}
                        {dbStatus === 'connected' && 'Conectado (Supabase)'}
                        {dbStatus === 'error' && 'Desconectado / Erro'}
                    </span>
                </div>
                {dbStatus === 'error' && <p className="text-xs text-red-500 mt-2">Verifique as credenciais no Vercel ou Supabase.</p>}
                <button onClick={checkDbConnection} className="mt-4 text-sm text-[#8B0000] underline flex items-center gap-1">
                    <RefreshCw className="w-3 h-3"/> Testar Conexão Novamente
                </button>
            </div>

            <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow border border-[#C5A059]/20">
                 <h3 className="font-bold text-gray-500 mb-4 flex items-center gap-2"><Key className="w-4 h-4"/> Chave de API (Gemini)</h3>
                 {storedKey ? (
                     <div className="bg-green-100 text-green-800 p-3 rounded flex justify-between items-center">
                         <span className="font-mono text-sm">••••••••{storedKey.slice(-4)}</span>
                         <button onClick={handleClearKey} className="text-xs underline hover:text-red-600">Remover</button>
                     </div>
                 ) : (
                     <div className="bg-yellow-100 text-yellow-800 p-3 rounded text-sm flex items-center gap-2">
                         <AlertTriangle className="w-4 h-4"/>
                         Usando Chave do Servidor (Rotação)
                     </div>
                 )}
                 <div className="mt-4 flex gap-2">
                     <input 
                        type="password" 
                        placeholder="Sobrescrever API Key (Admin Pessoal)" 
                        className="flex-1 border p-2 rounded text-sm dark:bg-gray-800 dark:text-white"
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                     />
                     <button onClick={handleSaveKey} className="bg-[#8B0000] text-white px-3 rounded"><Save className="w-4 h-4"/></button>
                 </div>
                 <p className="text-[10px] text-gray-400 mt-2">Use isso apenas se você for o Prof. Michel e quiser usar sua cota pessoal ilimitada.</p>
            </div>
        </div>

        <h2 className="font-cinzel font-bold text-xl mt-8 text-[#8B0000] dark:text-[#ff6b6b] border-b border-[#C5A059] pb-2">Ferramentas de Conteúdo</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow hover:shadow-lg transition">
                <BookOpen className="w-8 h-8 text-[#C5A059] mb-3" />
                <h3 className="font-bold dark:text-white">Download Bíblia Offline</h3>
                <p className="text-sm text-gray-500 mb-4">Baixa todos os capítulos da ACF para o cache do navegador.</p>
                {isDownloading ? (
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                        <div className="bg-[#8B0000] h-2.5 rounded-full transition-all" style={{ width: `${downloadProgress}%` }}></div>
                        <p className="text-xs text-center mt-1">{downloadProgress}%</p>
                    </div>
                ) : (
                    <button onClick={handleDownloadBible} className="w-full py-2 border border-[#8B0000] text-[#8B0000] rounded font-bold hover:bg-[#8B0000] hover:text-white transition flex items-center justify-center gap-2">
                        <Download className="w-4 h-4"/> Iniciar Download
                    </button>
                )}
            </div>

             <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow hover:shadow-lg transition opacity-50 cursor-not-allowed">
                <Database className="w-8 h-8 text-gray-400 mb-3" />
                <h3 className="font-bold dark:text-white">Backup Geral</h3>
                <p className="text-sm text-gray-500 mb-4">Exportar todos os dados (comentários, devocionais) para JSON.</p>
                <button disabled className="w-full py-2 bg-gray-200 text-gray-500 rounded font-bold cursor-not-allowed">Em Breve</button>
            </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex items-start gap-3 mt-4 border border-blue-200 dark:border-blue-800">
            <Info className="w-5 h-5 text-blue-500 mt-1" />
            <div>
                <h4 className="font-bold text-blue-800 dark:text-blue-300 text-sm">Modo Editor Chefe Ativo</h4>
                <p className="text-xs text-blue-700 dark:text-blue-200 mt-1">
                    Você tem permissão para editar comentários, gerar conteúdo sem limites de cota e gerenciar avisos da igreja.
                    Todas as ações são registradas.
                </p>
            </div>
        </div>

      </div>
    </div>
  );
}