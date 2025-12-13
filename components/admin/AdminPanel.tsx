import React, { useState, useEffect } from 'react';
import { ChevronLeft, Key, ShieldCheck, RefreshCw, Calendar, Loader2, Save, AlertTriangle, Database, CheckCircle, XCircle, Info, BookOpen } from 'lucide-react';
import { getStoredApiKey, setStoredApiKey, generateContent } from '../../services/geminiService';
import { BIBLE_BOOKS, generateVerseKey } from '../../constants';
import { db } from '../../services/database';
import { addDays, format } from 'date-fns';
import { Type } from "@google/genai";

export default function AdminPanel({ onShowToast, onBack }: any) {
  const [apiKey, setApiKey] = useState('');
  const [activeTab, setActiveTab] = useState('settings'); 
  const [dictBook, setDictBook] = useState('Gênesis');
  const [dictChapter, setDictChapter] = useState(1);
  const [dictVerses, setDictVerses] = useState(1);
  const [commentBook, setCommentBook] = useState('Gênesis');
  const [commentChapter, setCommentChapter] = useState(1);
  const [commentVerses, setCommentVerses] = useState(1);
  const [devotionalDays, setDevotionalDays] = useState(7);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dbStatus, setDbStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [dbMessage, setDbMessage] = useState('');

  useEffect(() => {
    const k = getStoredApiKey();
    if (k) setApiKey(k);
  }, []);

  const handleSaveKey = () => {
    setStoredApiKey(apiKey);
    onShowToast('Chave salva! O App agora usará esta chave diretamente.', 'success');
  };

  const handleClearKey = () => {
    setApiKey('');
    setStoredApiKey('');
    onShowToast('Chave removida. Voltando a usar a chave do servidor.', 'info');
  };

  const testDbConnection = async () => {
    setDbStatus('testing');
    setDbMessage('');
    try {
        const res = await fetch('/api/storage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'ping' })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            setDbStatus('success');
            setDbMessage(data.message || 'Conexão OK');
            onShowToast('Banco de Dados Conectado e Operacional!', 'success');
        } else {
            setDbStatus('error');
            setDbMessage(data.error || 'Erro desconhecido');
            throw new Error(data.error);
        }
    } catch (e: any) {
        setDbStatus('error');
        setDbMessage(e.message || 'Erro de rede ou configuração');
        onShowToast('Erro de Conexão com Banco de Dados.', 'error');
    }
  };

  const generateDictionaryBatch = async () => {
    setIsGenerating(true);
    onShowToast(`Gerando dicionário para ${dictBook} ${dictChapter} (Versos 1-${dictVerses})...`, 'info');
    const isOT = BIBLE_BOOKS.find(b => b.name === dictBook)?.testament === 'old';
    const lang = isOT ? 'HEBRAICO' : 'GREGO';

    for(let i=1; i<=dictVerses; i++) {
        const verseKey = generateVerseKey(dictBook, dictChapter, i);
        const prompt = `
            HEBRAÍSTA/HELENISTA EXPERT. Análise de ${dictBook} ${dictChapter}:${i} em ${lang}.
            JSON Obrigatório: { "hebrewGreekText", "phoneticText", "words": [{ "original", "transliteration", "portuguese", "polysemy", "etymology", "grammar" }] }
        `;
        try {
            const resultRaw = await generateContent(prompt); 
            const jsonStr = resultRaw.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(jsonStr);
            const data = {
                book: dictBook, chapter: dictChapter, verse: i, verse_key: verseKey,
                original_text: result.hebrewGreekText,
                transliteration: result.phoneticText,
                key_words: result.words
            };
            const existing = await db.entities.Dictionary.filter({ verse_key: verseKey });
            if(existing.length > 0) await db.entities.Dictionary.delete(existing[0].id);
            await db.entities.Dictionary.create(data);
        } catch(e) {
            console.error(`Error generating verse ${i}`, e);
        }
    }
    setIsGenerating(false);
    onShowToast('Geração em lote concluída.', 'success');
  };

  const generateCommentaryBatch = async () => {
    setIsGenerating(true);
    onShowToast(`Gerando comentários para ${commentBook} ${commentChapter} (Versos 1-${commentVerses})...`, 'info');

    for(let i=1; i<=commentVerses; i++) {
        const verseKey = generateVerseKey(commentBook, commentChapter, i);
        const prompt = `
            ATUE COMO: Professor Michel Felix (Teólogo Conservador).
            TAREFA: Comentário bíblico ortodoxo sobre ${commentBook} ${commentChapter}:${i}.

            --- SEGURANÇA DOUTRINÁRIA (CRÍTICO) ---
            1. ORTODOXIA: Rejeite interpretações baseadas em apócrifos.
            2. PASSAGENS POLÊMICAS: Em textos como Gênesis 6 ("Filhos de Deus"), use a interpretação SETISTA (Linhagem de Sete), rejeitando a ideia de anjos terem filhos (Heresia contrária a Mateus 22:30).
            3. SEMPRE verifique a consistência com o Novo Testamento.

            --- ESTILO ---
            - Vibrante, acessível e ungido.
            - NUNCA use frases de auto-identificação ("Eu acredito", "Para nós").
            - Explicativo e prático.

            ESTRUTURA:
            - 2 a 3 parágrafos.
        `;
        try {
            const text = await generateContent(prompt);
            const data = { 
                book: commentBook, 
                chapter: commentChapter, 
                verse: i, 
                verse_key: verseKey, 
                commentary_text: text 
            };
            
            const existing = await db.entities.Commentary.filter({ verse_key: verseKey });
            if(existing.length > 0) await db.entities.Commentary.delete(existing[0].id);
            
            await db.entities.Commentary.create(data);
        } catch(e) {
            console.error(`Error generating comment for verse ${i}`, e);
        }
    }
    setIsGenerating(false);
    onShowToast('Lote de comentários gerado!', 'success');
  };

  const generateDevotionalBatch = async () => {
    setIsGenerating(true);
    onShowToast(`Gerando ${devotionalDays} devocionais futuros...`, 'info');
    const today = new Date();
    
    // Schema estrito igual ao do gerador individual
    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            reference: { type: Type.STRING },
            verse_text: { type: Type.STRING },
            body: { type: Type.STRING, description: "Texto com parágrafos separados por \\n\\n" },
            prayer: { type: Type.STRING }
        },
        required: ["title", "reference", "verse_text", "body", "prayer"]
    };

    for (let i = 0; i < devotionalDays; i++) {
        const date = addDays(today, i);
        const dateKey = format(date, 'yyyy-MM-dd');
        
        const prompt = `
            ATUE COMO: Michel Felix, teólogo Pentecostal Clássico.
            TAREFA: Criar um devocional para ${format(date, 'dd/MM/yyyy')}.
            TEMA: Livre escolha teológica edificante e encorajadora.
            
            REGRAS DE FORMATAÇÃO VISUAL (CRÍTICO):
            1. O campo 'body' DEVE conter quebras de linha duplas (\n\n) para separar os parágrafos. O texto NÃO pode ser um bloco único.
            2. SEM MARKDOWN.

            ESTRUTURA OBRIGATÓRIA DO CORPO (3 PARÁGRAFOS):
            - Parágrafo 1: Contexto e Exegese.
            - Parágrafo 2: Aplicação cotidiana.
            - Parágrafo 3: Conclusão prática.

            Retorne JSON.
        `;

        try {
            const res = await generateContent(prompt, schema);
            // Se veio string direta (fallback), tenta parsear, senão usa o objeto
            const resObj = (typeof res === 'string') ? JSON.parse(res) : res;

            const data = { date: dateKey, ...resObj, is_published: true };
            
            const existing = await db.entities.Devotional.filter({ date: dateKey });
            if(existing.length > 0) await db.entities.Devotional.delete(existing[0].id);
            
            await db.entities.Devotional.create(data);
        } catch(e) { console.error(`Erro ao gerar devocional para ${dateKey}`, e); }
    }
    setIsGenerating(false);
    onShowToast('Lote de devocionais gerado com sucesso!', 'success');
  };

  return (
    <div className="min-h-screen bg-[#F5F5DC] dark:bg-dark-bg p-4 transition-colors duration-300">
        <div className="flex items-center justify-between mb-8">
            <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><ChevronLeft className="text-[#8B0000] dark:text-[#ff6b6b]" /></button>
            <h1 className="font-cinzel text-2xl font-bold text-[#8B0000] dark:text-[#ff6b6b]">Painel Admin</h1>
            <div className="w-8" />
        </div>

        <div className="flex mb-6 border-b border-[#C5A059] overflow-x-auto dark:border-gray-700">
            <button onClick={() => setActiveTab('settings')} className={`flex-1 py-3 px-4 font-cinzel font-bold whitespace-nowrap flex items-center gap-1 ${activeTab === 'settings' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 dark:text-gray-400'}`}>
                <AlertTriangle className="w-4 h-4"/> Configuração
            </button>
            <button onClick={() => setActiveTab('ebd')} className={`flex-1 py-3 px-4 font-cinzel font-bold whitespace-nowrap ${activeTab === 'ebd' ? 'text-[#8B0000] dark:text-[#ff6b6b] border-b-2 border-[#8B0000]' : 'text-gray-500 dark:text-gray-400'}`}>Editor Chefe</button>
            <button onClick={() => setActiveTab('comment')} className={`flex-1 py-3 px-4 font-cinzel font-bold whitespace-nowrap ${activeTab === 'comment' ? 'text-[#8B0000] dark:text-[#ff6b6b] border-b-2 border-[#8B0000]' : 'text-gray-500 dark:text-gray-400'}`}>Comentário</button>
            <button onClick={() => setActiveTab('dict')} className={`flex-1 py-3 px-4 font-cinzel font-bold whitespace-nowrap ${activeTab === 'dict' ? 'text-[#8B0000] dark:text-[#ff6b6b] border-b-2 border-[#8B0000]' : 'text-gray-500 dark:text-gray-400'}`}>Dicionário</button>
            <button onClick={() => setActiveTab('devo')} className={`flex-1 py-3 px-4 font-cinzel font-bold whitespace-nowrap ${activeTab === 'devo' ? 'text-[#8B0000] dark:text-[#ff6b6b] border-b-2 border-[#8B0000]' : 'text-gray-500 dark:text-gray-400'}`}>Devocional</button>
        </div>

        {activeTab === 'settings' && (
            <div className="space-y-6">
                 {/* Database Section */}
                 <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-md border border-[#C5A059]/30">
                    <div className="flex items-center gap-2 mb-4 text-[#8B0000] dark:text-[#ff6b6b]">
                        <Database className="w-6 h-6" />
                        <h2 className="font-cinzel font-bold text-lg">Banco de Dados (Supabase)</h2>
                    </div>
                    <p className="font-montserrat text-sm text-gray-600 dark:text-gray-300 mb-4">
                        Status da conexão com o banco de dados da nuvem. Necessário para que os usuários vejam o conteúdo gerado.
                    </p>
                    <button 
                        onClick={testDbConnection} 
                        disabled={dbStatus === 'testing'}
                        className={`w-full py-3 rounded font-bold font-cinzel flex justify-center items-center gap-2 border transition-all ${
                            dbStatus === 'success' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-300' :
                            dbStatus === 'error' ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border-red-300' :
                            'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300'
                        }`}
                    >
                        {dbStatus === 'testing' ? <Loader2 className="animate-spin" /> : 
                         dbStatus === 'success' ? <CheckCircle className="w-5 h-5" /> : 
                         dbStatus === 'error' ? <XCircle className="w-5 h-5" /> : 
                         <RefreshCw className="w-5 h-5" />}
                        {dbStatus === 'testing' ? 'Verificando...' : 'Testar Conexão'}
                    </button>
                    {dbMessage && (
                        <div className={`mt-3 p-2 rounded text-xs font-mono break-all ${dbStatus === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                            {dbMessage}
                        </div>
                    )}
                </div>

                {/* API Key Section */}
                <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-md border border-[#C5A059]/30">
                    <div className="flex items-center gap-2 mb-4 text-[#8B0000] dark:text-[#ff6b6b]">
                        <Key className="w-6 h-6" />
                        <h2 className="font-cinzel font-bold text-lg">Chave de Inteligência Artificial</h2>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 p-4 mb-6">
                        <div className="flex gap-2">
                            <Info className="w-5 h-5 text-blue-800 dark:text-blue-300 flex-shrink-0" />
                            <p className="font-montserrat text-sm text-blue-800 dark:text-blue-200">
                                <strong>Nota:</strong> Por padrão, o app usa a chave configurada no servidor (Vercel). 
                                Se ela falhar ou atingir o limite, você pode inserir sua chave pessoal abaixo para continuar usando o app imediatamente.
                            </p>
                        </div>
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-xs text-blue-900 dark:text-blue-300 underline mt-2 block font-bold ml-7">
                            Obter chave gratuita (Gemini 2.5 Flash)
                        </a>
                    </div>

                    <label className="block font-montserrat text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Chave Personalizada (Substitui Servidor):</label>
                    <input 
                        type="text" 
                        value={apiKey} 
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Cole aqui (Começa com AIza...)"
                        className="w-full p-3 border border-[#C5A059] rounded mb-4 font-mono text-sm dark:bg-gray-800 dark:text-white"
                    />
                    
                    <div className="flex gap-2">
                        <button onClick={handleSaveKey} className="flex-1 bg-[#8B0000] text-white py-3 rounded font-bold font-cinzel hover:bg-[#600018] transition flex justify-center gap-2">
                            <Save className="w-5 h-5" /> Salvar & Ativar
                        </button>
                        {apiKey && (
                            <button onClick={handleClearKey} className="px-4 border border-red-500 text-red-500 rounded font-bold hover:bg-red-50 dark:hover:bg-red-900/20">
                                Remover
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'ebd' && (
             <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-md text-center">
                <ShieldCheck className="w-12 h-12 text-[#8B0000] dark:text-[#ff6b6b] mx-auto mb-4" />
                <h3 className="font-cinzel text-xl font-bold mb-2 dark:text-white">Editor Chefe Integrado</h3>
                <p className="font-montserrat text-gray-600 dark:text-gray-300 mb-6">
                    A geração de conteúdo EBD agora é feita diretamente na tela <strong>"Panorama EBD"</strong>.
                </p>
                <button onClick={() => onBack()} className="text-[#8B0000] dark:text-[#ff6b6b] underline text-sm font-bold">Voltar para o Menu e acessar EBD</button>
             </div>
        )}

        {activeTab === 'comment' && (
            <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-md border border-[#C5A059]/30">
                 <h2 className="font-cinzel font-bold text-lg mb-4 flex items-center gap-2 dark:text-white"><BookOpen/> Gerador de Comentários (Prof.)</h2>
                 <div className="grid grid-cols-2 gap-4 mb-4">
                         <select value={commentBook} onChange={(e) => setCommentBook(e.target.value)} className="p-2 border rounded dark:bg-gray-800 dark:text-white">
                            {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                         </select>
                         <input type="number" value={commentChapter} onChange={(e) => setCommentChapter(Number(e.target.value))} className="p-2 border rounded dark:bg-gray-800 dark:text-white" min={1} placeholder="Capítulo" />
                </div>
                <div className="mb-4">
                    <label className="block text-sm font-bold mb-1 dark:text-gray-300">Qtd Versículos:</label>
                    <input type="number" value={commentVerses} onChange={(e) => setCommentVerses(Number(e.target.value))} className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white" min={1} max={50} />
                </div>
                <button onClick={generateCommentaryBatch} disabled={isGenerating} className="w-full bg-[#8B0000] text-white py-3 rounded font-bold font-cinzel flex justify-center items-center gap-2">
                    {isGenerating ? <Loader2 className="animate-spin"/> : 'Gerar Comentários em Lote'}
                </button>
            </div>
        )}

        {activeTab === 'dict' && (
            <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-md border border-[#C5A059]/30">
                 <h2 className="font-cinzel font-bold text-lg mb-4 flex items-center gap-2 dark:text-white"><RefreshCw/> Gerador de Dicionário em Lote</h2>
                 <div className="grid grid-cols-2 gap-4 mb-4">
                         <select value={dictBook} onChange={(e) => setDictBook(e.target.value)} className="p-2 border rounded dark:bg-gray-800 dark:text-white">
                            {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                         </select>
                         <input type="number" value={dictChapter} onChange={(e) => setDictChapter(Number(e.target.value))} className="p-2 border rounded dark:bg-gray-800 dark:text-white" min={1} placeholder="Capítulo" />
                </div>
                <div className="mb-4">
                    <label className="block text-sm font-bold mb-1 dark:text-gray-300">Qtd Versículos:</label>
                    <input type="number" value={dictVerses} onChange={(e) => setDictVerses(Number(e.target.value))} className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white" min={1} max={50} />
                </div>
                <button onClick={generateDictionaryBatch} disabled={isGenerating} className="w-full bg-[#8B0000] text-white py-3 rounded font-bold font-cinzel flex justify-center items-center gap-2">
                    {isGenerating ? <Loader2 className="animate-spin"/> : 'Gerar Dicionários em Lote'}
                </button>
            </div>
        )}

        {activeTab === 'devo' && (
            <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow-md border border-[#C5A059]/30">
                <h2 className="font-cinzel font-bold text-lg mb-4 flex items-center gap-2 dark:text-white"><Calendar/> Devocionais em Lote</h2>
                <div className="mb-4">
                    <label className="block text-sm font-bold mb-1 dark:text-gray-300">Dias à frente (incluindo hoje):</label>
                    <input type="number" value={devotionalDays} onChange={(e) => setDevotionalDays(Number(e.target.value))} className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white" min={1} max={30} />
                </div>
                <button onClick={generateDevotionalBatch} disabled={isGenerating} className="w-full bg-[#8B0000] text-white py-3 rounded font-bold font-cinzel flex justify-center items-center gap-2">
                    {isGenerating ? <Loader2 className="animate-spin"/> : 'Gerar Devocionais'}
                </button>
            </div>
        )}
    </div>
  );
}