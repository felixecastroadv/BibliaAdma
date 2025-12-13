import React, { useState, useEffect } from 'react';
import { X, BookOpen, Languages, Loader2, RefreshCw, AlertTriangle, Send, Lock, Save, Sparkles, Volume2, Pause, Play, FastForward } from 'lucide-react';
import { db } from '../../services/database';
import { generateContent } from '../../services/geminiService';
import { generateVerseKey } from '../../constants';
import { DictionaryEntry, Commentary } from '../../types';
import { Type } from "@google/genai";

interface VersePanelProps {
  isOpen: boolean;
  onClose: () => void;
  verse: string;
  verseNumber: number;
  book: string;
  chapter: number;
  isAdmin: boolean;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  userName?: string;
}

const OLD_TESTAMENT_BOOKS = ['Gênesis', 'Êxodo', 'Levítico', 'Números', 'Deuteronômio', 'Josué', 'Juízes', 'Rute', '1 Samuel', '2 Samuel', '1 Reis', '2 Reis', '1 Crônicas', '2 Crônicas', 'Esdras', 'Neemias', 'Ester', 'Jó', 'Salmos', 'Provérbios', 'Eclesiastes', 'Cantares', 'Isaías', 'Jeremias', 'Lamentações', 'Ezequiel', 'Daniel', 'Oséias', 'Joel', 'Amós', 'Obadias', 'Jonas', 'Miquéias', 'Naum', 'Habacuque', 'Sofonias', 'Ageu', 'Zacarias', 'Malaquias'];

export default function VersePanel({ isOpen, onClose, verse, verseNumber, book, chapter, isAdmin, onShowToast }: VersePanelProps) {
  const [activeTab, setActiveTab] = useState<'professor' | 'dicionario'>('professor');
  const [commentary, setCommentary] = useState<Commentary | null>(null);
  const [dictionary, setDictionary] = useState<DictionaryEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportText, setReportText] = useState('');

  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showAudioSettings, setShowAudioSettings] = useState(false);

  const verseKey = generateVerseKey(book, chapter, verseNumber);
  const isOT = OLD_TESTAMENT_BOOKS.includes(book);
  const lang = isOT ? 'hebraico' : 'grego';

  useEffect(() => {
    if (isOpen && verse) {
        loadContent();
    }
    // Stop audio when closing
    if (!isOpen) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
    }
  }, [isOpen, verse, activeTab]);

  useEffect(() => {
    const loadVoices = () => {
        const available = window.speechSynthesis.getVoices().filter(v => v.lang.includes('pt'));
        setVoices(available);
        if(available.length > 0) setSelectedVoice(available[0].name);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  useEffect(() => {
    if (isPlaying) {
        window.speechSynthesis.cancel();
        speakText();
    }
  }, [playbackRate]);

  const loadContent = async () => {
    setLoading(true);
    try {
        if (activeTab === 'professor') {
            const existing = await db.entities.Commentary.filter({ verse_key: verseKey });
            if (existing && existing.length > 0) {
                setCommentary(existing[0]);
            } else {
                setCommentary(null);
            }
        } else {
            const existing = await db.entities.Dictionary.filter({ verse_key: verseKey });
            if (existing && existing.length > 0) {
                setDictionary(existing[0]);
            } else {
                setDictionary(null);
            }
        }
    } catch (e) {
        console.error("Erro ao carregar", e);
    } finally {
        setLoading(false);
    }
  };

  const generateDictionary = async () => {
    setLoading(true);
    onShowToast(`Analisando texto original em ${lang}...`, 'info');

    const prompt = `
      Você é um HEBRAÍSTA e HELENISTA SÊNIOR com doutorado em línguas bíblicas.
      TAREFA: Análise lexical COMPLETA de ${book} ${chapter}:${verseNumber}
      Texto em português: "${verse}"
      Idioma original: ${lang.toUpperCase()}

      Analise TODAS as palavras principais do versículo.
      Preencha TODOS os campos: original, transliteration, portuguese, polysemy, etymology, grammar.
    `;

    const schema = {
      type: Type.OBJECT,
      properties: {
        hebrewGreekText: { type: Type.STRING },
        phoneticText: { type: Type.STRING },
        words: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              original: { type: Type.STRING },
              transliteration: { type: Type.STRING },
              portuguese: { type: Type.STRING },
              polysemy: { type: Type.STRING },
              etymology: { type: Type.STRING },
              grammar: { type: Type.STRING }
            },
            required: ["original", "transliteration", "portuguese", "polysemy", "etymology", "grammar"]
          }
        }
      },
      required: ["hebrewGreekText", "phoneticText", "words"]
    };

    try {
      const response = await generateContent(prompt, schema);
      
      const data: DictionaryEntry = {
        book, chapter, verse: verseNumber, verse_key: verseKey,
        original_text: response.hebrewGreekText,
        transliteration: response.phoneticText,
        key_words: response.words || []
      };

      setIsSaving(true);
      await db.entities.Dictionary.create(data);
      setDictionary(data);
      onShowToast('Dicionário gerado e salvo para todos!', 'success');
    } catch (e: any) {
      console.error(e);
      onShowToast(`Erro: ${e.message}`, 'error');
    } finally {
      setLoading(false);
      setIsSaving(false);
    }
  };

  const generateCommentary = async () => {
    setLoading(true);

    try {
        const prompt = `
            ATUE COMO: Professor Michel Felix (Teólogo Conservador).
            TAREFA: Comentário bíblico ortodoxo e vibrante sobre ${book} ${chapter}:${verseNumber}.
            TEXTO BÍBLICO: "${verse}"

            --- SEGURANÇA DOUTRINÁRIA (CRÍTICO) ---
            1. ORTODOXIA ESTRITA: Interprete a Bíblia com a Bíblia. Rejeite interpretações baseadas em livros apócrifos (como Enoque) ou mitologias que contradigam o restante das Escrituras.
            2. CHECAGEM DE HERESIAS: 
               - Se o texto for polêmico (ex: Gênesis 6, "Filhos de Deus"), ADOTE A VISÃO CONSERVADORA (Linhagem de Sete x Caim) e REJEITE a visão de híbridos anjos-humanos, pois Jesus afirmou que anjos não se casam (Mt 22:30).
               - Evite especulações fantásticas. Fique no "assim diz o Senhor".
            3. VIÉS: Arminiano e Pentecostal Clássico (Foque na graça, responsabilidade humana e poder de Deus, mas com equilíbrio e sanidade bíblica).

            --- ESTILO DE ESCRITA ---
            - Vibrante, Pastoral e Acessível (como um professor apaixonado em sala de aula).
            - Use exclamações moderadas para enfatizar verdades espirituais.
            - NUNCA use frases de auto-identificação ("Eu como teólogo...", "Nós cremos...", "Prezados"). Apenas ENTREGUE o conteúdo.

            ESTRUTURA:
            - 2 a 3 parágrafos fluídos.
            - Comece contextualizando e termine com aplicação prática para a Igreja hoje.
        `;
        const text = await generateContent(prompt);
        const data = { book, chapter, verse: verseNumber, verse_key: verseKey, commentary_text: text };
        
        setIsSaving(true);
        await db.entities.Commentary.create(data);
        setCommentary(data as Commentary);
        onShowToast('Comentário gerado e salvo para todos!', 'success');
    } catch (e: any) {
        onShowToast(`Erro: ${e.message}`, 'error');
    } finally {
        setLoading(false);
        setIsSaving(false);
    }
  };

  const speakText = () => {
    // Only speak commentary for now
    if (!commentary || activeTab !== 'professor') return;
    
    const utter = new SpeechSynthesisUtterance(commentary.commentary_text);
    utter.lang = 'pt-BR';
    utter.rate = playbackRate;
    const voice = voices.find(v => v.name === selectedVoice);
    if (voice) utter.voice = voice;
    utter.onend = () => setIsPlaying(false);
    window.speechSynthesis.speak(utter);
    setIsPlaying(true);
  };

  const togglePlay = () => {
    if (isPlaying) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
    } else {
        speakText();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative w-full md:w-[600px] h-full bg-[#FDFBF7] dark:bg-dark-card shadow-2xl overflow-y-auto flex flex-col animate-in slide-in-from-right duration-300">
            <div className="sticky top-0 bg-[#8B0000] text-white p-4 z-10 flex justify-between items-start shadow-md">
                <div>
                    <h3 className="font-cinzel text-xl font-bold">{book} {chapter}:{verseNumber}</h3>
                    <p className="font-cormorant text-sm opacity-90 mt-1 line-clamp-2">{verse}</p>
                </div>
                <div className="flex gap-2">
                    {/* Audio Controls for Commentary */}
                    {activeTab === 'professor' && commentary && (
                        <button onClick={() => setShowAudioSettings(!showAudioSettings)} className="p-1 hover:bg-white/20 rounded-full">
                            <Volume2 className={isPlaying ? "w-6 h-6 animate-pulse" : "w-6 h-6"} />
                        </button>
                    )}
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full"><X className="w-6 h-6" /></button>
                </div>
            </div>

            {/* Audio Settings Panel */}
            {showAudioSettings && activeTab === 'professor' && (
                <div className="bg-white dark:bg-gray-900 p-3 border-b border-[#C5A059] flex flex-col gap-2 animate-in slide-in-from-top-2">
                    <div className="flex items-center justify-between">
                        <button 
                            onClick={togglePlay}
                            className="bg-[#C5A059] text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 hover:bg-[#a88645]"
                        >
                            {isPlaying ? <Pause className="w-3 h-3"/> : <Play className="w-3 h-3"/>} 
                            {isPlaying ? 'Pausar' : 'Ouvir Comentário'}
                        </button>
                        <select className="p-1 text-xs border rounded w-1/2 dark:bg-gray-800 dark:text-white" value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}>
                            {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <FastForward className="w-3 h-3" /> Vel:
                        </span>
                        <div className="flex gap-1 flex-1">
                            {[0.75, 1, 1.25, 1.5, 2].map(rate => (
                                <button 
                                    key={rate}
                                    onClick={() => setPlaybackRate(rate)}
                                    className={`flex-1 py-1 text-[10px] font-bold rounded border ${playbackRate === rate ? 'bg-[#8B0000] text-white border-[#8B0000]' : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'}`}
                                >
                                    {rate}x
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex bg-[#F5F5DC] dark:bg-black border-b border-[#C5A059]">
                <button 
                    onClick={() => setActiveTab('professor')}
                    className={`flex-1 py-3 font-montserrat font-medium text-sm flex items-center justify-center gap-2 transition-colors ${activeTab === 'professor' ? 'bg-[#8B0000] text-white' : 'text-[#8B0000] dark:text-[#C5A059] hover:bg-[#C5A059]/20'}`}
                >
                    <BookOpen className="w-4 h-4" /> Professor
                </button>
                <button 
                    onClick={() => setActiveTab('dicionario')}
                    className={`flex-1 py-3 font-montserrat font-medium text-sm flex items-center justify-center gap-2 transition-colors ${activeTab === 'dicionario' ? 'bg-[#8B0000] text-white' : 'text-[#8B0000] dark:text-[#C5A059] hover:bg-[#C5A059]/20'}`}
                >
                    <Languages className="w-4 h-4" /> Dicionário Original
                </button>
            </div>

            <div className="flex-1 p-5 dark:text-gray-200">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center text-[#8B0000] dark:text-white">
                        <Loader2 className="w-10 h-10 animate-spin mb-2" />
                        <p className="font-cinzel">Consultando o Mestre...</p>
                        {isSaving && <p className="text-xs mt-2 font-bold animate-pulse">Salvando no Banco de Dados...</p>}
                    </div>
                ) : (
                    <>
                        {activeTab === 'professor' && (
                            <div className="space-y-4">
                                {commentary ? (
                                    <>
                                        <div className="prose prose-lg font-cormorant text-gray-900 dark:text-gray-200">
                                            <p className="whitespace-pre-line leading-relaxed text-justify">{commentary.commentary_text}</p>
                                        </div>
                                        {isAdmin && (
                                            <button onClick={generateCommentary} className="w-full mt-4 py-2 border border-[#8B0000] text-[#8B0000] dark:text-[#ff6b6b] dark:border-[#ff6b6b] rounded font-cinzel text-sm flex items-center justify-center gap-2 hover:bg-[#8B0000]/5">
                                                <RefreshCw className="w-4 h-4"/> Regenerar e Salvar (Admin)
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center py-10 text-gray-400">
                                       <Sparkles className="w-12 h-12 mx-auto mb-3 text-[#C5A059]" />
                                       <p className="font-cinzel font-bold text-gray-500">Conteúdo Inédito</p>
                                       <p className="text-sm mt-2 max-w-xs mx-auto">Seja o primeiro a gerar este comentário e disponibilizá-lo para todos.</p>
                                       <button onClick={generateCommentary} className="mt-4 px-6 py-3 bg-[#8B0000] text-white rounded font-bold text-sm shadow-lg hover:bg-[#600018] flex items-center justify-center gap-2 mx-auto animate-pulse">
                                            <Save className="w-4 h-4"/> Gerar Conteúdo (Universal)
                                       </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'dicionario' && (
                            <div className="space-y-6">
                                {dictionary ? (
                                    <>
                                        <div className="bg-gradient-to-br from-[#8B0000] to-black p-4 rounded-lg text-white text-center shadow-lg">
                                            <p className="font-montserrat text-xs uppercase opacity-70 mb-1">Texto Original</p>
                                            <p className="font-cinzel text-2xl mb-2" dir="auto">{dictionary.original_text}</p>
                                            <div className="border-t border-white/20 pt-2">
                                                <p className="font-cormorant text-lg italic">{dictionary.transliteration}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            {dictionary.key_words.map((word, idx) => (
                                                <div key={idx} className="bg-white dark:bg-gray-800 border border-[#C5A059]/30 rounded-lg overflow-hidden shadow-sm">
                                                    <div className="bg-[#FDFBF7] dark:bg-gray-900 p-3 border-b border-[#C5A059]/20 flex justify-between items-center">
                                                        <div>
                                                            <span className="font-cinzel font-bold text-[#8B0000] dark:text-[#ff6b6b] text-lg">{word.original}</span>
                                                            <span className="text-xs text-gray-500 ml-2 font-montserrat">({word.transliteration})</span>
                                                        </div>
                                                        <span className="font-bold text-gray-900 dark:text-black font-cormorant bg-[#C5A059]/20 dark:bg-[#C5A059] px-2 py-1 rounded">{word.portuguese}</span>
                                                    </div>
                                                    <div className="p-4 space-y-3">
                                                        <div>
                                                            <p className="text-xs font-bold text-[#8B0000] dark:text-[#ff6b6b] uppercase font-montserrat mb-1">Significados & Polissemia</p>
                                                            <p className="font-cormorant text-gray-900 dark:text-gray-300 leading-relaxed">{word.polysemy}</p>
                                                        </div>
                                                        <div className="bg-[#F5F5DC] dark:bg-gray-700 p-2 rounded">
                                                            <p className="text-xs font-bold text-[#C5A059] uppercase font-montserrat mb-1">Etimologia</p>
                                                            <p className="font-cormorant text-gray-900 dark:text-gray-300 italic">{word.etymology}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase font-montserrat mb-1">Gramática</p>
                                                            <p className="font-cormorant text-gray-900 dark:text-gray-300">{word.grammar}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        {isAdmin && (
                                            <button onClick={generateDictionary} className="w-full mt-4 py-3 border border-[#8B0000] text-[#8B0000] dark:text-[#ff6b6b] dark:border-[#ff6b6b] hover:bg-[#8B0000]/5 rounded font-cinzel font-bold flex items-center justify-center gap-2">
                                                <RefreshCw className="w-4 h-4" /> Regenerar e Salvar (Admin)
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center py-10 text-gray-400">
                                       <Sparkles className="w-12 h-12 mx-auto mb-3 text-[#C5A059]" />
                                       <p className="font-cinzel font-bold text-gray-500">Dicionário Inédito</p>
                                       <p className="text-sm mt-2 max-w-xs mx-auto">Gere a primeira análise lexical deste versículo.</p>
                                       <button onClick={generateDictionary} className="mt-4 px-6 py-3 bg-[#8B0000] text-white rounded font-bold text-sm shadow-lg hover:bg-[#600018] flex items-center justify-center gap-2 mx-auto animate-pulse">
                                            <Save className="w-4 h-4"/> Gerar Dicionário (Universal)
                                       </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {!isAdmin && (commentary || dictionary) && (
                            <div className="mt-8 pt-4 border-t border-[#C5A059]/20">
                                <button onClick={() => setShowReport(!showReport)} className="text-xs text-gray-500 hover:text-[#8B0000] flex items-center gap-1 mx-auto">
                                    <AlertTriangle className="w-3 h-3" /> Reportar erro neste conteúdo
                                </button>
                                {showReport && (
                                    <div className="mt-2 bg-[#F5F5DC] dark:bg-gray-800 p-2 rounded">
                                        <textarea 
                                            value={reportText} 
                                            onChange={e => setReportText(e.target.value)} 
                                            placeholder="Descreva o erro..." 
                                            className="w-full p-2 text-sm border border-[#C5A059] rounded dark:bg-gray-900 dark:text-white"
                                        />
                                        <button className="mt-2 bg-[#8B0000] text-white px-3 py-1 rounded text-xs flex items-center gap-1">
                                            <Send className="w-3 h-3" /> Enviar
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    </div>
  );
}