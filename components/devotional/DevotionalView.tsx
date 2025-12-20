import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Calendar, Loader2, Volume2, VolumeX, Edit3, Settings, RefreshCw, Command, ChevronRight, Lock, AlertCircle, FastForward, Type, Trash2, Flame } from 'lucide-react';
import { generateContent } from '../../services/geminiService';
import { db } from '../../services/database';
import { Devotional } from '../../types';
import { Type as GenType } from "@google/genai";
import { format, addDays, differenceInDays, isAfter } from 'date-fns';

export default function DevotionalView({ onBack, onShowToast, isAdmin }: any) {
  const [devotional, setDevotional] = useState<Devotional | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Carregando...');
  
  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [playbackRate, setPlaybackRate] = useState(1);
  const speechRef = useRef<any>(null); // Referência para controlar o loop de áudio
  
  // NOVA LINHA: Referência para o Fundo Musical Gospel Instrumental (Piano Suave)
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  
  // Admin State
  const [customCommand, setCustomCommand] = useState('');
  const [showAdminControls, setShowAdminControls] = useState(false);
  
  const today = new Date();
  today.setHours(0,0,0,0); // Normaliza para meia-noite
  
  const displayDateStr = format(currentDate, 'yyyy-MM-dd');
  const daysDiff = differenceInDays(currentDate, today);
  
  // Regras de Data
  const isFuture = daysDiff > 0;
  const isExpired = daysDiff < -365; // Mais antigo que 1 ano

  // NOVA LINHA: Sincronização do Fundo Musical com a Narração
  useEffect(() => {
    if (bgMusicRef.current) {
        if (isPlaying) {
            bgMusicRef.current.play().catch(e => console.log("Fundo musical aguardando interação:", e));
        } else {
            bgMusicRef.current.pause();
            bgMusicRef.current.currentTime = 0; // Reinicia para manter a coesão com o início da narração
        }
    }
  }, [isPlaying]);

  useEffect(() => {
    loadDevotional();
    
    // NOVA LINHA: Inicialização do player de fundo musical (Instrumental Suave)
    if (!bgMusicRef.current) {
        bgMusicRef.current = new Audio('https://cdn.pixabay.com/audio/2022/01/18/audio_d0c6ff1bab.mp3'); // Piano suave meditativo
        bgMusicRef.current.loop = true;
        bgMusicRef.current.volume = 0.1; // Volume em 10% conforme solicitado
    }

    // Carregar vozes com prioridade para Humanizadas
    const loadVoices = () => {
        let available = window.speechSynthesis.getVoices().filter(v => v.lang.includes('pt'));
        
        // ORDENAÇÃO DE VOZES MAIS HUMANIZADAS
        available.sort((a, b) => {
            const getScore = (v: SpeechSynthesisVoice) => {
                let score = 0;
                if (v.name.includes('Google')) score += 5;
                if (v.name.includes('Microsoft')) score += 4;
                if (v.name.includes('Luciana')) score += 3; 
                if (v.name.includes('Joana')) score += 3;
                return score;
            };
            return getScore(b) - getScore(a);
        });

        setVoices(available);
        if(available.length > 0 && !selectedVoice) setSelectedVoice(available[0].name);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    return () => {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
        // NOVA LINHA: Limpeza do fundo musical ao desmontar
        if (bgMusicRef.current) {
            bgMusicRef.current.pause();
            bgMusicRef.current = null;
        }
    };
  }, [displayDateStr]);

  useEffect(() => {
    if (isPlaying) {
        window.speechSynthesis.cancel();
        speakText();
    }
  }, [playbackRate, selectedVoice]);

  const loadDevotional = async () => {
    setDevotional(null);
    setIsPlaying(false);
    window.speechSynthesis.cancel();

    // 1. Se for futuro, bloqueia imediatamente
    if (isFuture) {
        setLoading(false);
        return;
    }

    setLoading(true);
    setStatusMessage('Buscando palavra...');

    try {
        const res = await db.entities.Devotional.filter({ date: displayDateStr });
        
        if (res.length > 0) {
            // Conteúdo encontrado!
            const foundDevotional = res[0];

            // Verifica se está expirado para limpar o banco (Policy: 365 dias)
            if (isExpired) {
                setStatusMessage('Limpando registros antigos...');
                await db.entities.Devotional.delete(foundDevotional.id!);
                setDevotional(null);
            } else {
                setDevotional(foundDevotional);
            }
        } else {
            // Nenhum conteúdo encontrado.
            if (!isFuture && !isExpired) {
                // Se for hoje ou passado recente (e não tiver no banco), GERA AUTOMATICAMENTE
                await generateDevotional(); 
            } else {
                setDevotional(null);
            }
        }
    } catch (e) {
        console.error("Error loading devotional", e);
    } finally {
        setLoading(false);
    }
  };

  const generateDevotional = async (customInstruction?: string) => {
    // Se for comando customizado, só admin pode.
    if (customInstruction && !isAdmin) return;

    setStatusMessage('Gerando devocional inédito...');
    setLoading(true);
    
    const themes = ['santidade', 'arrebatamento', 'perseverança', 'amor a Deus', 'conversão', 'arrependimento', 'avivamento', 'fé', 'esperança', 'oração', 'sabedoria', 'perdão'];
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
        type: GenType.OBJECT,
        properties: {
            title: { type: GenType.STRING },
            reference: { type: GenType.STRING },
            verse_text: { type: GenType.STRING },
            body: { type: GenType.STRING, description: "Texto do devocional com parágrafos separados por \\n\\n" },
            prayer: { type: GenType.STRING }
        },
        required: ["title", "reference", "verse_text", "body", "prayer"]
    };

    try {
        const res = await generateContent(prompt, schema);
        
        if (!res || !res.title) throw new Error("Falha na geração");

        const data: Devotional = { ...res, date: displayDateStr, is_published: true };
        
        // NOVA LÓGICA DE PERSISTÊNCIA: Limpeza profunda antes de salvar novo devocional
        const existingItems = await db.entities.Devotional.filter({ date: displayDateStr });
        if (existingItems.length > 0) {
            for (const item of existingItems) {
                if (item.id) await db.entities.Devotional.delete(item.id);
            }
        }

        await db.entities.Devotional.create(data);
        setDevotional(data);
        
        if (customInstruction) {
            onShowToast('Devocional regenerado com nova formatação!', 'success');
            setShowAdminControls(false);
            setCustomCommand('');
        }
    } catch (e) {
        console.error(e);
        if (customInstruction) onShowToast('Erro ao gerar devocional', 'error');
    } finally {
        setLoading(false);
    }
  };

  // --- NOVA LÓGICA DE ÁUDIO ROBUSTA (Chunking) ---
  const speakText = () => {
    if(!devotional) return;
    
    // 1. Prepara o Texto Completo
    const fullText = `
        ${devotional.title}. 
        Leitura de ${devotional.reference}. 
        ${devotional.verse_text}. 
        ${devotional.body}. 
        Vamos orar: ${devotional.prayer}
    `;

    // 2. Limpeza Profunda
    const cleanText = fullText
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/#/g, '')
        .replace(/\n/g, '. ') // Transforma quebras de linha em pausas
        .replace(/\.\./g, '.') // Remove pontos duplos acidentais
        .trim();

    window.speechSynthesis.cancel(); // Limpa fila anterior

    // 3. Chunking (Divide em frases para o navegador não travar)
    const sentences = cleanText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleanText];
    let index = 0;

    const speakNextChunk = () => {
        if (index >= sentences.length) {
            setIsPlaying(false);
            return;
        }

        const chunk = sentences[index];
        if (!chunk.trim()) {
            index++;
            speakNextChunk();
            return;
        }

        const utter = new SpeechSynthesisUtterance(chunk);
        utter.lang = 'pt-BR';
        utter.rate = playbackRate;
        const voice = voices.find(v => v.name === selectedVoice);
        if (voice) utter.voice = voice;

        utter.onend = () => {
            index++;
            speakNextChunk();
        };

        utter.onerror = (e) => {
            console.error("Erro na fala:", e);
            setIsPlaying(false);
        };

        // Guarda ref para evitar garbage collection prematuro em alguns browsers
        speechRef.current = utter;
        window.speechSynthesis.speak(utter);
    };

    setIsPlaying(true);
    speakNextChunk();
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
    return text ? text.replace(/\*\*/g, '').replace(/##/g, '').trim() : '';
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-300">
      <div className="bg-[#8B0000] text-white p-4 flex items-center justify-between sticky top-0 shadow-lg z-10">
        <div className="flex items-center gap-4">
            <button onClick={onBack}><ChevronLeft /></button>
            <h1 className="font-cinzel font-bold">Devocional Diário</h1>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-white/10 rounded-full"><Settings className="w-5 h-5" /></button>
            {isAdmin && <button onClick={() => setShowAdminControls(!showAdminControls)} className="p-2 hover:bg-white/10 rounded-full"><Edit3 className="w-5 h-5" /></button>}
        </div>
      </div>

      <div className="bg-[#1a0f0f] dark:bg-black text-[#C5A059] p-3 flex items-center justify-between shadow-md">
         <button onClick={handlePrevDay} className="p-2 hover:text-white transition"><ChevronLeft /></button>
         <div className="flex items-center gap-2 font-montserrat font-bold uppercase tracking-wider text-sm">
            <Calendar className="w-4 h-4" />
            {currentDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
         </div>
         <button onClick={handleNextDay} className="p-2 hover:text-white transition"><ChevronRight /></button>
      </div>

      {showSettings && (
         <div className="bg-white dark:bg-dark-card p-4 border-b border-[#C5A059] animate-in slide-in-from-top-2 shadow-lg z-20 relative">
            <div className="flex flex-col gap-4">
                {/* Fonte */}
                <div className="flex items-center justify-between">
                    <span className="font-montserrat text-sm font-bold text-[#1a0f0f] dark:text-gray-200 flex items-center gap-2">
                        <Type className="w-4 h-4" /> Tamanho da Letra:
                    </span>
                    <div className="flex items-center gap-4 text-black dark:text-white">
                        <button onClick={() => setFontSize(Math.max(14, fontSize - 2))} className="w-8 h-8 flex items-center justify-center border rounded hover:bg-gray-100 dark:hover:bg-gray-700 font-bold">-</button>
                        <span className="font-bold w-6 text-center">{fontSize}</span>
                        <button onClick={() => setFontSize(Math.min(32, fontSize + 2))} className="w-8 h-8 flex items-center justify-center border rounded hover:bg-gray-100 dark:hover:bg-gray-700 font-bold">+</button>
                    </div>
                </div>

                {/* Voz */}
                <div>
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-200">Voz de Leitura:</label>
                    <select className="w-full p-2 border rounded mt-1 dark:bg-gray-800 dark:text-white" value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}>
                        {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                    </select>
                </div>
                
                {/* Velocidade */}
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
            <h3 className="font-cinzel font-bold text-sm mb-2 flex items-center gap-2"><Command className="w-4 h-4"/> Comandos Admin (Regerar)</h3>
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
                    {customCommand ? 'Executar Comando' : 'Regerar (Admin)'}
                </button>
            </div>
        </div>
      )}

      <div className="p-6 max-w-2xl mx-auto pb-24">
        {loading ? (
            <div className="text-center py-20 animate-in fade-in duration-700">
                <Loader2 className="w-12 h-12 animate-spin mx-auto text-[#8B0000] dark:text-white mb-4"/>
                <p className="font-cinzel text-lg font-bold text-gray-600 dark:text-gray-300">{statusMessage}</p>
                <p className="text-xs text-gray-400 mt-2">Preparando o ambiente espiritual...</p>
            </div>
        ) : isFuture ? (
            <div className="text-center py-20 text-gray-400 border-2 border-dashed border-[#C5A059]/30 rounded-3xl bg-white/50 dark:bg-black/20">
                <Lock className="w-20 h-20 mx-auto mb-6 text-[#C5A059]" />
                <h2 className="font-cinzel text-3xl mb-2 font-bold text-[#8B0000] dark:text-[#ff6b6b]">Aguarde</h2>
                <p className="font-montserrat mb-4 text-gray-600 dark:text-gray-400">Esta mensagem estará disponível em:</p>
                <div className="bg-[#1a0f0f] text-[#C5A059] inline-block px-6 py-3 rounded-xl font-bold font-mono text-xl shadow-lg">
                    {format(currentDate, "dd/MM/yyyy")}
                </div>
                <p className="text-xs mt-6 opacity-60">Liberado automaticamente à meia-noite.</p>
            </div>
        ) : isExpired ? (
            <div className="text-center py-20 text-gray-400">
                <div className="relative inline-block">
                    <Trash2 className="w-20 h-20 mx-auto mb-4 text-gray-300 dark:text-gray-700" />
                    <AlertCircle className="w-8 h-8 absolute -bottom-2 -right-2 text-red-500" />
                </div>
                <h2 className="font-cinzel text-2xl mb-2 font-bold">Arquivo Expirado</h2>
                <p className="max-w-xs mx-auto text-sm">Devocionais com mais de 365 dias são removidos automaticamente para otimizar o aplicativo.</p>
            </div>
        ) : devotional ? (
            <div className="bg-white dark:bg-dark-card p-8 rounded-2xl shadow-xl border border-[#C5A059]/30 animate-in slide-in-from-bottom-5">
                <h2 className="font-cinzel text-3xl font-bold text-[#1a0f0f] dark:text-[#ff6b6b] mb-2">{cleanTextDisplay(devotional.title)}</h2>
                <p className="font-montserrat text-sm text-gray-500 dark:text-gray-400 mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 bg-[#C5A059] rounded-full"></span> {devotional.reference}
                </p>
                
                <blockquote className="border-l-4 border-[#8B0000] pl-4 italic text-lg font-cormorant text-gray-700 dark:text-gray-300 mb-8 bg-[#F5F5DC] dark:bg-gray-800 p-4 rounded-r shadow-inner">
                    "{cleanTextDisplay(devotional.verse_text)}"
                </blockquote>

                <div 
                    className="font-cormorant leading-loose text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-8 text-justify transition-all duration-300"
                    style={{ fontSize: `${fontSize}px` }}
                >
                    {cleanTextDisplay(devotional.body)}
                </div>

                <div className="bg-[#1a0f0f] dark:bg-black text-white p-6 rounded-xl shadow-lg border-l-4 border-[#C5A059]">
                    <h3 className="font-cinzel font-bold mb-3 text-[#C5A059] flex items-center gap-2">
                        <Flame className="w-4 h-4"/> Oração
                    </h3>
                    <p className="font-cormorant italic text-lg leading-relaxed opacity-90">{cleanTextDisplay(devotional.prayer)}</p>
                </div>
            </div>
        ) : (
            <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30 text-[#C5A059]" />
                <p className="font-cinzel font-bold">Não foi possível carregar</p>
                <button 
                    onClick={() => loadDevotional()}
                    className="mt-4 text-sm underline text-[#8B0000] dark:text-[#ff6b6b]"
                >
                    Tentar Novamente
                </button>
            </div>
        )}
      </div>

      {!isFuture && !isExpired && devotional && (
          <button 
            onClick={togglePlay}
            className="fixed bottom-24 right-6 w-14 h-14 bg-[#C5A059] text-[#1a0f0f] rounded-full shadow-2xl flex items-center justify-center z-50 hover:bg-[#d4b97a] transition-all transform hover:scale-110 active:scale-95 border-2 border-white"
            title={isPlaying ? "Parar Leitura" : "Ouvir Devocional"}
          >
            {isPlaying ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </button>
      )}
    </div>
  );
}