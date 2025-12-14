
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Key, ShieldCheck, RefreshCw, Loader2, Save, AlertTriangle, CheckCircle, XCircle, Info, BookOpen, Download, Server, Database, Upload, FileJson } from 'lucide-react';
import { getStoredApiKey, setStoredApiKey } from '../../services/geminiService';
import { BIBLE_BOOKS } from '../../constants';
import { db } from '../../services/database';

export default function AdminPanel({ onBack, onShowToast }: { onBack: () => void, onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void }) {
  const [apiKey, setApiKey] = useState('');
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  
  // States de Download/Upload
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  // --- LÓGICA DE IMPORTAÇÃO DE JSON LOCAL ---
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
              onShowToast("Erro ao ler JSON. Formato inválido.", "error");
              setIsProcessing(false);
          }
      };
      
      reader.readAsText(file);
  };

  const processBibleJSON = async (data: any[]) => {
      setProcessStatus("Processando livros...");
      let booksProcessed = 0;
      let totalChapters = 0;
      
      // Validação básica
      if (!Array.isArray(data)) {
          onShowToast("O JSON deve ser uma lista (Array) de livros.", "error");
          setIsProcessing(false);
          return;
      }

      // Normaliza nomes para comparação (remove acentos, lowercase)
      const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      for (const bookData of data) {
          // Tenta encontrar o livro correspondente nas nossas constantes
          const bookName = bookData.name || bookData.book;
          if (!bookName) continue;

          const targetBook = BIBLE_BOOKS.find(b => normalize(b.name) === normalize(bookName));
          
          if (targetBook && bookData.chapters) {
              // Processa capítulos
              bookData.chapters.forEach((chapterContent: any, index: number) => {
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
                       formattedVerses = chapterContent.map((v: any) => ({
                          number: v.number || parseInt(v.verse),
                          text: v.text.trim()
                      }));
                  }

                  if (formattedVerses.length > 0) {
                      localStorage.setItem(key, JSON.stringify(formattedVerses));
                      totalChapters++;
                  }
              });
              booksProcessed++;
          }
          
          // Atualiza progresso visual a cada livro
          const percentage = Math.round((booksProcessed / BIBLE_BOOKS.length) * 100);
          setProgress(percentage);
          await new Promise(r => setTimeout(r, 10)); // Pequena pausa para UI não travar
      }

      setIsProcessing(false);
      onShowToast(`Sucesso! ${totalChapters} capítulos importados de ${booksProcessed} livros.`, "success");
      
      // Limpa o input para permitir re-upload
      if (fileInputRef.current) fileInputRef.current.value = "";
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
            {/* Status DB */}
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

            {/* API Key */}
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
            </div>
        </div>

        <h2 className="font-cinzel font-bold text-xl mt-8 text-[#8B0000] dark:text-[#ff6b6b] border-b border-[#C5A059] pb-2">Gestão de Conteúdo</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* CARD DE UPLOAD DE JSON (Novo) */}
            <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow hover:shadow-lg transition border border-[#C5A059]">
                <FileJson className="w-8 h-8 text-[#C5A059] mb-3" />
                <h3 className="font-bold dark:text-white text-lg">Importar Bíblia (JSON)</h3>
                <p className="text-sm text-gray-500 mb-4">Carregue seu arquivo <code>.json</code> para acesso offline imediato. Ideal para arquivos grandes (+4MB).</p>
                
                {isProcessing ? (
                    <div className="w-full bg-gray-200 rounded-full h-12 flex items-center justify-center relative overflow-hidden">
                        <div className="absolute left-0 top-0 h-full bg-[#C5A059] transition-all duration-300" style={{ width: `${progress}%`, opacity: 0.3 }}></div>
                        <div className="relative z-10 flex items-center gap-2 text-sm font-bold text-[#8B0000]">
                            <Loader2 className="w-4 h-4 animate-spin"/> {processStatus} {progress}%
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <input 
                            type="file" 
                            accept=".json" 
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileUpload}
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            className="w-full py-3 bg-[#8B0000] text-white rounded font-bold hover:bg-[#600018] transition flex items-center justify-center gap-2"
                        >
                            <Upload className="w-5 h-5"/> Selecionar Arquivo
                        </button>
                    </div>
                )}
                <p className="text-[10px] text-gray-400 mt-2 text-center">Formato suportado: Array de Livros (com campo 'chapters')</p>
            </div>

            {/* CARD DE DOWNLOAD DA API (Fallback) */}
            <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow hover:shadow-lg transition">
                <BookOpen className="w-8 h-8 text-gray-400 mb-3" />
                <h3 className="font-bold dark:text-white text-lg">Download da Nuvem</h3>
                <p className="text-sm text-gray-500 mb-4">Baixa capitulo por capitulo da API pública. Mais lento, use se não tiver o JSON.</p>
                
                {isProcessing ? (
                    <button disabled className="w-full py-3 bg-gray-200 text-gray-500 rounded font-bold cursor-not-allowed">
                        Aguarde...
                    </button>
                ) : (
                    <button onClick={handleDownloadBible} className="w-full py-3 border border-gray-400 text-gray-600 dark:text-gray-300 rounded font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition flex items-center justify-center gap-2">
                        <Download className="w-5 h-5"/> Baixar da API
                    </button>
                )}
            </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex items-start gap-3 mt-4 border border-blue-200 dark:border-blue-800">
            <Info className="w-5 h-5 text-blue-500 mt-1" />
            <div>
                <h4 className="font-bold text-blue-800 dark:text-blue-300 text-sm">Como usar o Arquivo JSON?</h4>
                <p className="text-xs text-blue-700 dark:text-blue-200 mt-1">
                    Se você já tem a bíblia em JSON no seu PC, use o botão "Selecionar Arquivo". O sistema irá ler, identificar os livros automaticamente e salvar tudo no navegador.
                    Isso torna o app "nativo" e ultra-rápido, sem depender de internet para leitura.
                </p>
            </div>
        </div>

      </div>
    </div>
  );
}
