import React, { useState, useEffect } from 'react';
import { ChevronLeft, Calendar, Loader2, Volume2, VolumeX, Edit3, Settings, RefreshCw, Command, ChevronRight, Lock, AlertCircle, FastForward } from 'lucide-react';
import { generateContent } from '../../services/geminiService';
import { db } from '../../services/database';
import { Devotional } from '../../types';
import { Type } from "@google/genai";
import { format, addDays, differenceInDays } from 'date-fns';

export default function DevotionalView({ onBack, onShowToast, isAdmin }: any) {
  const [devotional, setDevotional] = useState<Devotional | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [customCommand, setCustomCommand] = useState('');
  const [showAdminControls, setShowAdminControls] = useState(false);
  
  const today = new Date();
  today.setHours(0,0,0,0);
  const displayDateStr = format(currentDate, 'yyyy-MM-dd');

  const daysDiff = differenceInDays(currentDate, today);
  const isFuture = daysDiff > 0;
  const isExpired = daysDiff < -365;

  useEffect(() => {
    loadDevotional();
    const loadVoices = () => {
        const available = window.speechSynthesis.getVoices().filter(v => v.lang.includes('pt'));
        setVoices(available);
        if(available.length > 0) setSelectedVoice(available[0].name);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => window.speechSynthesis.cancel();
  }, [displayDateStr]);

  // Atualiza áudio em tempo real se mudar a velocidade
  useEffect(() => {
    if (isPlaying) {
        window.speechSynthesis.cancel();
        speakText();
    }
  }, [playbackRate]);

  const loadDevotional = async () => {
    setDevotional(null);
    if (isFuture || isExpired) return;

    setLoading(true);
    try {
        const res = await db.entities.Devotional.filter({ date: displayDateStr });
        if (res.length > 0) {
            setDevotional(res[0]);
        } else {
            setDevotional(null);
        }
    } catch (e) {
        console.error("Error loading devotional", e);
    } finally {
        setLoading(false);
    }
  };

  const generateDevotional = async (customInstruction?: string) => {
    if (!isAdmin) return;
    
    const themes = ['santidade', 'arrebatamento', 'perseverança', 'amor a Deus', 'conversão', 'arrependimento', 'avivamento', 'fé', 'esperança', 'oração'];
    const randomTheme = themes[Math.floor(Math.random() * themes.length)];
    const instruction = customInstruction || `TEMA CENTRAL: ${randomTheme}`;
    
    const prompt = `
        ATUE COMO: Michel Felix, teólogo Pentecostal Clássico.
        TAREFA: Criar um devocional para ${format(currentDate, 'dd/MM/yyyy')}.
        ${instruction}
        
        REGRAS DE FORMATAÇÃO VISUAL (CRÍTICO):
        1. O campo 'body' DEVE conter quebras de linha duplas (\n\n) para separar os parágrafos. O texto NÃO pode ser um bloco único.
        2. SEM MARKDOWN: Não use asteriscos (**), negrito ou caracteres especiais. Apenas texto puro.
        3. TAMANHO: Aprox. 500 palavras no total.

        ESTRUTURA OBRIGATÓRIA DO CORPO (3 PARÁGRAFOS DISTINTOS):
        - Parágrafo 1 (O Texto): Explique o texto base, focando na intenção do autor, contexto histórico/cultural e análise das palavras originais.
        - Parágrafo 2 (A Aplicação): Aplique essa verdade teológica à vida cotidiana do leitor hoje. Use exemplos práticos.
        - Parágrafo 3 (A Prática): Conclusão reflexiva que leve à prática ("melhor do que ouvir é praticar"), visando o crescimento espiritual.

        ORAÇÃO:
        - Uma oração contextualizada com o ensino acima.

        Retorne JSON válido.
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            reference: { type: Type.STRING },
            verse_text: { type: Type.STRING },
            body: { type: Type.STRING, description: "Texto do devocional com parágrafos separados por \\n\\n" },
            prayer: { type: Type.STRING }
        },
        required: ["title", "reference", "verse_text", "body", "prayer"]
    };

    try {
        setLoading(true);
        const res = await generateContent(prompt, schema);
        const data: Devotional = { ...res, date: displayDateStr, is_published: true };
        const existing = await db.entities.Devotional.filter({ date: displayDateStr });
        if(existing.length > 0) await db.entities.Devotional.delete(existing[0].id!);
        await db.entities.Devotional.create(data);
        setDevotional(data);
        if (customInstruction) onShowToast('Devocional regenerado com nova formatação!', 'success');
        setShowAdminControls(false);
    } catch (e) {
        console.error(e);
        if (customInstruction) onShowToast('Erro ao gerar devocional', 'error');
    } finally {
        setLoading(false);
    }
  };

  const speakText = () => {
    if(!devotional) return;
    const cleanBody = devotional.body.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\n/g, ' ');
    const text = `${devotional.title}. ${devotional.reference}. ${devotional.verse_text}. ${cleanBody}. Oração: ${devotional.prayer}`;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'pt-BR';
    utter.rate = playbackRate;
    const voice = voices.find(v => v.name === selectedVoice);
    if (voice) utter.voice = voice;
    utter.onend = () => setIsPlaying(false);
    window.speechSynthesis.speak(utter);
    setIsPlaying(true);
  };

  const togglePlay = () => {
    if(!devotional) return;
    if (isPlaying) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
    } else {
        speakText();
    }
  };

  const handlePrevDay = () => setCurrentDate(addDays(currentDate, -1));
  const handleNextDay = () => setCurrentDate(addDays(currentDate, 1));

  const cleanTextDisplay = (text: string) => {
    return text.replace(/\*\*/g, '').replace(/##/g, '').trim();
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-300">
      <div className="bg-[#8B0000] text-white p-4 flex items-center justify-between sticky top-0 shadow-lg z-10">
        <div className="flex items-center gap-4">
            <button onClick={onBack}><ChevronLeft /></button>
            <h1 className="font-cinzel font-bold">Devocional Diário</h1>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setShowSettings(!showSettings)}><Settings className="w-5 h-5" /></button>
            {isAdmin && <button onClick={() => setShowAdminControls(!showAdminControls)}><Edit3 className="w-5 h-5" /></button>}
        </div>
      </div>

      <div className="bg-[#1a0f0f] dark:bg-black text-[#C5A059] p-3 flex items-center justify-between">
         <button onClick={handlePrevDay} className="p-2"><ChevronLeft /></button>
         <div className="flex items-center gap-2 font-montserrat font-bold">
            <Calendar className="w-4 h-4" />
            {currentDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
         </div>
         <button onClick={handleNextDay} className="p-2"><ChevronRight /></button>
      </div>

      {showSettings && (
         <div className="bg-white dark:bg-dark-card p-4 border-b border-[#C5A059] animate-in slide-in-from-top-2">
            <div className="flex flex-col gap-4">
                <div>
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-200">Voz de Leitura:</label>
                    <select className="w-full p-2 border rounded mt-1 dark:bg-gray-800 dark:text-white" value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}>
                        {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                    </select>
                </div>
                <div>
                    <span className="font-montserrat text-sm font-bold text-[#1a0f0f] dark:text-gray-200 flex items-center gap-2 mb-1">
                        <FastForward className="w-4 h-4" /> Velocidade:
                    </span>
                    <div className="flex gap-2">
                        {[0.75, 1, 1.25, 1.5, 2].map(rate => (
                            <button 
                                key={rate}
                                onClick={() => setPlaybackRate(rate)}
                                className={`flex-1 py-1 text-xs font-bold rounded border ${playbackRate === rate ? 'bg-[#8B0000] text-white border-[#8B0000]' : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'}`}
                            >
                                {rate}x
                            </button>
                        ))}
                    </div>
                </div>
            </div>
         </div>
      )}

      {isAdmin && showAdminControls && !isFuture && !isExpired && (
        <div className="bg-[#F5F5DC] dark:bg-gray-900 p-4 text-[#1a0f0f] dark:text-white border-b border-[#C5A059]">
            <h3 className="font-cinzel font-bold text-sm mb-2 flex items-center gap-2"><Command className="w-4 h-4"/> Comandos Admin</h3>
            <textarea 
                value={customCommand} 
                onChange={e => setCustomCommand(e.target.value)} 
                placeholder="Ex: Refaça focando em escatologia..." 
                className="w-full p-2 text-black rounded text-sm mb-2 border border-gray-300"
            />
            <div className="flex gap-2">
                <button 
                    onClick={() => generateDevotional(customCommand)} 
                    disabled={loading}
                    className="flex-1 bg-[#8B0000] text-white font-bold py-2 rounded text-xs flex items-center justify-center gap-2"
                >
                    {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <RefreshCw className="w-4 h-4"/>} 
                    {customCommand ? 'Executar Comando' : 'Gerar Novo (Admin)'}
                </button>
            </div>
        </div>
      )}

      <div className="p-6 max-w-2xl mx-auto pb-24">
        {loading ? (
            <div className="text-center py-20">
                <Loader2 className="w-10 h-10 animate-spin mx-auto text-[#8B0000] dark:text-white"/>
                <p className="mt-4 font-cinzel text-gray-500 dark:text-gray-400">Buscando devocional...</p>
            </div>
        ) : isFuture ? (
            <div className="text-center py-20 text-gray-400">
                <Lock className="w-16 h-16 mx-auto mb-4 text-[#C5A059]" />
                <h2 className="font-cinzel text-2xl mb-2">Bloqueado</h2>
                <p>Este devocional estará disponível em {format(currentDate, "dd/MM/yyyy")}.</p>
            </div>
        ) : isExpired ? (
            <div className="text-center py-20 text-gray-400">
                <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-900 opacity-30" />
                <h2 className="font-cinzel text-2xl mb-2">Expirado</h2>
            </div>
        ) : devotional ? (
            <div className="bg-white dark:bg-dark-card p-8 rounded-2xl shadow-xl border border-[#C5A059]/30 animate-in slide-in-from-bottom-5">
                <h2 className="font-cinzel text-3xl font-bold text-[#1a0f0f] dark:text-[#ff6b6b] mb-2">{cleanTextDisplay(devotional.title)}</h2>
                <p className="font-montserrat text-sm text-gray-500 dark:text-gray-400 mb-6">{devotional.reference}</p>
                
                <blockquote className="border-l-4 border-[#8B0000] pl-4 italic text-lg font-cormorant text-gray-700 dark:text-gray-300 mb-6 bg-[#F5F5DC] dark:bg-gray-800 p-4 rounded-r shadow-inner">
                    "{cleanTextDisplay(devotional.verse_text)}"
                </blockquote>

                <div className="font-cormorant text-lg leading-loose text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-8 text-justify">
                    {cleanTextDisplay(devotional.body)}
                </div>

                <div className="bg-[#1a0f0f] dark:bg-black text-white p-6 rounded-xl shadow-lg">
                    <h3 className="font-cinzel font-bold mb-2 text-[#C5A059]">Oração</h3>
                    <p className="font-cormorant italic">{cleanTextDisplay(devotional.prayer)}</p>
                </div>
            </div>
        ) : (
            <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                <Lock className="w-12 h-12 mx-auto mb-3 opacity-30 text-[#C5A059]" />
                <p className="font-cinzel font-bold">Devocional Indisponível</p>
                {isAdmin && (
                    <button 
                        onClick={() => generateDevotional()}
                        className="mt-4 px-6 py-2 bg-[#8B0000] text-white rounded font-bold shadow hover:bg-[#600018]"
                    >
                        Gerar Agora (Admin)
                    </button>
                )}
            </div>
        )}
      </div>

      {!isFuture && !isExpired && devotional && (
          <button 
            onClick={togglePlay}
            className="fixed bottom-6 right-6 w-14 h-14 bg-[#C5A059] text-[#1a0f0f] rounded-full shadow-2xl flex items-center justify-center z-30 hover:bg-[#d4b97a] transition-all"
          >
            {isPlaying ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </button>
      )}
    </div>
  );
}