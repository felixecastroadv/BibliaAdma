
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ShieldCheck, RefreshCw, Loader2, Upload, Download, Server, HardDrive, Flag, CheckCircle, XCircle, MessageSquare, Languages, GraduationCap, Calendar, CloudUpload, Wand2, Play, StopCircle, Trash2, AlertTriangle, FileJson, Save, Users, Lock, Unlock, KeyRound, Search, Cloud, CloudOff } from 'lucide-react';
import { generateContent } from '../../services/geminiService';
import { BIBLE_BOOKS, generateChapterKey, generateVerseKey, TOTAL_CHAPTERS } from '../../constants';
import { db, bibleStorage } from '../../services/database';
import { Type as GenType } from "@google/genai";
import { ContentReport, AppConfig, Devotional, UserProgress } from '../../types';
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
  const [batchLogs, setBatchLogs] = useState<string[]>([]);
  
  // Ref para controle imediato de parada (State não atualiza dentro do loop async)
  const stopBatchRef = useRef(false);

  // --- STATE DE DEVOCIONAL ---
  const [devotionalDate, setDevotionalDate] = useState(new Date().toISOString().split('T')[0]);

  // --- STATES DE RELATÓRIOS ---
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [showReportsModal, setShowReportsModal] = useState(false);

  // --- STATES DE USUÁRIOS (NOVO) ---
  const [usersList, setUsersList] = useState<UserProgress[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // --- BUILDER STATE ---
  const [showBuilder, setShowBuilder] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    checkDbConnection();
    loadReports();
    checkOfflineIntegrity();
    loadAppConfig();
    loadUsers(); // Carrega usuários ao iniciar
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

  const loadUsers = async () => {
      setLoadingUsers(true);
      try {
          // Usa listagem de progresso para pegar usuários (a tabela ReadingProgress armazena os usuários)
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
      } catch(e) {
          onShowToast("Erro ao deletar.", "error");
      }
  };

  // --- AÇÕES DE USUÁRIO ---
  const toggleUserBlock = async (user: UserProgress) => {
      const newStatus = !user.is_blocked;
      if (!window.confirm(newStatus ? `Bloquear ${user.user_name}?` : `Desbloquear ${user.user_name}?`)) return;
      
      try {
          await db.entities.ReadingProgress.update(user.id!, { is_blocked: newStatus });
          setUsersList(prev => prev.map(u => u.id === user.id ? { ...u, is_blocked: newStatus } : u));
          onShowToast(newStatus ? "Usuário bloqueado." : "Usuário desbloqueado.", "success");
      } catch(e) {
          onShowToast("Erro ao atualizar status.", "error");
      }
  };

  const resetUserPassword = async (user: UserProgress) => {
      if (!window.confirm(`Resetar a senha de ${user.user_name}? Ele precisará criar uma nova no próximo login.`)) return;
      
      try {
          await db.entities.ReadingProgress.update(user.id!, { 
              password_pin: "", // Limpa a senha
              reset_requested: false // Remove a flag de pedido
          });
          setUsersList(prev => prev.map(u => u.id === user.id ? { ...u, password_pin: "", reset_requested: false } : u));
          onShowToast("Senha resetada com sucesso.", "success");
      } catch(e) {
          onShowToast("Erro ao resetar senha.", "error");
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
                    await new Promise(r => setTimeout(r, 150)); 
                    const data = await fetchWithRetry(`https://www.abibliadigital.com.br/api/verses/acf/${book.abbrev}/${c}`);
                    if (data && data.verses) {
                        const optimizedVerses = data.verses.map((v: any) => v.text.trim());
                        // Salva UNIVERSALMENTE (Local + Nuvem)
                        await db.entities.BibleChapter.saveUniversal(key, optimizedVerses);
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
      stopBatchRef.current = false;
      await checkOfflineIntegrity(); 
      onShowToast("Bíblia Restaurada e Sincronizada com Sucesso!", "success");
  };

  const handleRestoreFromCloud = async () => {
      if (!window.confirm("Isso irá baixar todo o texto bíblico salvo no seu Banco de Dados na Nuvem para este dispositivo. Continuar?")) return;
      
      setIsProcessing(true);
      setProcessStatus("Conectando à Nuvem...");
      setProgress(0);

      try {
          const result = await db.entities.BibleChapter.list();
          const allChapters = (Array.isArray(result) ? result : []) as any[];
          
          if (!allChapters || allChapters.length === 0) {
              onShowToast("Nenhum capítulo encontrado na nuvem. Use o botão 'Baixar da Web' primeiro.", "error");
              setIsProcessing(false);
              return;
          }

          setProcessStatus(`Sincronizando ${allChapters.length} arquivos...`);
          
          let count = 0;
          const total = allChapters.length;

          await bibleStorage.clear();

          for (const item of allChapters) {
              if (item.id && item.verses) {
                  await bibleStorage.save(item.id, item.verses);
                  count++;
                  
                  if (count % 20 === 0) {
                      setProgress(Math.round((count / total) * 100));
                      setProcessStatus(`Restaurando: ${Math.round((count / total) * 100)}%`);
                      await new Promise(r => setTimeout(r, 0)); 
                  }
              }
          }

          setOfflineCount(count);
          onShowToast(`Sucesso! ${count} capítulos recuperados da nuvem.`, "success");

      } catch (e) {
          console.error(e);
          onShowToast("Erro ao resgatar da nuvem. Verifique a conexão.", "error");
      } finally {
          setIsProcessing(false);
          setProgress(0);
      }
  };

  // --- ALGORITMO INTELIGENTE DE IMPORTAÇÃO (RESOLVE O PROBLEMA DOS 180k CAPS) ---
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      setIsProcessing(true);
      setProcessStatus("Lendo arquivo gigante...");
      
      reader.onload = async (e) => {
          try {
              const jsonText = e.target?.result as string;
              const cleanJson = jsonText.replace(/^\uFEFF/, ''); 
              let rawData;
              try {
                  rawData = JSON.parse(cleanJson);
              } catch (parseError) {
                  throw new Error("Arquivo JSON inválido/corrompido.");
              }
              
              setProcessStatus("Analisando estrutura e versões...");
              let count = 0;

              // --- ESTRATÉGIA 1: DETECÇÃO DE VERSÍCULOS SOLTOS (O PROBLEMA DOS 180k) ---
              // Se for um array gigante plano e tiver 'verse' ou 'versiculo', precisamos agrupar.
              const isFlatVerseList = Array.isArray(rawData) && rawData.length > 5000 && (rawData[0].verse || rawData[0].versiculo);
              
              if (isFlatVerseList) {
                  setProcessStatus("Modo Versículos Detectado. Agrupando capítulos...");
                  // MAPA: Chave = 'gn_1', Valor = ['texto v1', 'texto v2', ...]
                  const chaptersMap: Record<string, string[]> = {};
                  const totalItems = rawData.length;

                  // 1. Agrupamento em Memória
                  for (let i = 0; i < totalItems; i++) {
                      const item = rawData[i];
                      
                      // Filtro de Versão: Prioriza ACF, depois ARA, ARC, NVI. Se tiver version e não for uma dessas, ignora se possível.
                      // Se o usuário só tiver uma versão, aceita qualquer coisa.
                      const version = (item.version || item.versao || "").toLowerCase();
                      const isTargetVersion = version.includes('acf') || version.includes('almeida') || version === ''; 
                      
                      // Se este item não for da versão alvo E soubermos que existe a versão alvo no arquivo, pulamos.
                      // Simplificação: Se não contém 'acf' ou 'almeida', e não é vazio, pula.
                      if (version && !version.includes('acf') && !version.includes('almeida')) {
                          // Opcional: Só pula se tiver certeza que existe ACF no resto do arquivo. 
                          // Para segurança, vamos permitir importar tudo se não tivermos certeza, mas o mapa sobrescreve.
                          // MELHOR: Sobrescrever apenas se a versão atual for prioritária.
                      }

                      // Identifica Livro
                      let bName = (item.book || item.book_name || item.name || "").toLowerCase();
                      const bAbbrevRaw = (item.abbrev || item.abbreviation || "").toLowerCase();
                      
                      // Tenta achar o livro no nosso sistema
                      const foundBook = BIBLE_BOOKS.find(b => 
                          b.abbrev === bAbbrevRaw || 
                          b.name.toLowerCase() === bName || 
                          b.name.toLowerCase().replace(/ê/g,'e').replace(/á/g,'a') === bName
                      );

                      if (!foundBook) continue;

                      const cNum = item.chapter || item.capitulo || item.c;
                      const vNum = item.verse || item.versiculo || item.v;
                      const text = item.text || item.texto;

                      if (foundBook && cNum && text) {
                          const key = `bible_acf_${foundBook.abbrev}_${cNum}`;
                          if (!chaptersMap[key]) chaptersMap[key] = [];
                          // Garante a ordem pelo índice do array (assumindo versículo 1 na posição 0)
                          chaptersMap[key][vNum - 1] = text.trim();
                      }

                      if (i % 5000 === 0) {
                          setProcessStatus(`Processando linha ${i}/${totalItems}...`);
                          await new Promise(r => setTimeout(r, 0));
                      }
                  }

                  // 2. Salvamento dos Capítulos Agrupados
                  const chapterKeys = Object.keys(chaptersMap);
                  const totalChapters = chapterKeys.length;
                  setProcessStatus(`Salvando ${totalChapters} capítulos montados...`);

                  for (let i = 0; i < totalChapters; i++) {
                      const key = chapterKeys[i];
                      // Remove buracos do array (ex: versículo faltante)
                      const verses = chaptersMap[key].filter(v => v !== undefined && v !== null);
                      
                      if (verses.length > 0) {
                          await db.entities.BibleChapter.saveUniversal(key, verses);
                          count++;
                      }

                      if (i % 10 === 0) {
                          setProgress(Math.round(((i + 1) / totalChapters) * 100));
                          setProcessStatus(`Implantando: ${i}/${totalChapters}`);
                          await new Promise(r => setTimeout(r, 0));
                      }
                  }

              } 
              // --- ESTRATÉGIA 2: HIERÁRQUICO (LIVROS -> CAPÍTULOS) ---
              else if (Array.isArray(rawData) && rawData.length > 0 && (rawData[0].capítulos || rawData[0].chapters)) {
                  const totalBooks = rawData.length;
                  setProcessStatus("Modo Hierárquico detectado...");
                  
                  for (let i = 0; i < totalBooks; i++) {
                      const bookItem = rawData[i];
                      const abbrev = (bookItem.abbrev || bookItem.abbreviation || "").toLowerCase();
                      const chapters = bookItem.capítulos || bookItem.chapters || [];
                      const bookName = bookItem.nome || bookItem.name;

                      if (abbrev && Array.isArray(chapters)) {
                          for (let cIndex = 0; cIndex < chapters.length; cIndex++) {
                              const chapterNum = cIndex + 1;
                              const versesRaw = chapters[cIndex];
                              
                              if (Array.isArray(versesRaw) && versesRaw.length > 0) {
                                  const cleanVerses = versesRaw.map((v: any) => typeof v === 'string' ? v.trim() : (v.text || "").trim());
                                  const key = `bible_acf_${abbrev}_${chapterNum}`;
                                  await db.entities.BibleChapter.saveUniversal(key, cleanVerses);
                                  count++;
                              }
                          }
                      }
                      
                      const pct = Math.round(((i + 1) / totalBooks) * 100);
                      setProgress(pct);
                      setProcessStatus(`Importando ${bookName || abbrev}...`);
                      if (i % 2 === 0) await new Promise(r => setTimeout(r, 0));
                  }
              } 
              // --- ESTRATÉGIA 3: LISTA PLANA DE CAPÍTULOS (JÁ PRONTOS) ---
              else {
                  const flatList = Array.isArray(rawData) ? rawData : (rawData.verses || rawData.chapters || []);
                  
                  const total = flatList.length;
                  for (let i = 0; i < total; i++) {
                      const item = flatList[i];
                      let key = item.key;
                      let verses = item.verses || item.text;

                      // Lógica de fallback para gerar chave se não existir
                      if (!key) {
                          let bName = item.book || item.book_name || item.name;
                          const abbrev = item.abbrev || (item.book && item.book.abbrev);
                          const cNum = item.chapter || item.c || item.number;

                          if (!bName && abbrev) {
                              const foundBook = BIBLE_BOOKS.find(b => b.abbrev.toLowerCase() === abbrev.toLowerCase());
                              if (foundBook) bName = foundBook.name;
                          }

                          if (bName && cNum) {
                              key = generateChapterKey(bName, cNum);
                          } else if (abbrev && cNum) {
                              key = `bible_acf_${abbrev.toLowerCase()}_${cNum}`;
                          }
                      }

                      if (key && verses && Array.isArray(verses)) {
                          if (typeof verses[0] === 'object' && verses[0].text) {
                              verses = verses.map((v: any) => v.text);
                          }
                          await db.entities.BibleChapter.saveUniversal(key, verses);
                          count++;
                      }

                      if (i % 20 === 0) {
                          setProgress(Math.round((i / total) * 100));
                          setProcessStatus(`Importando: ${i}/${total}`);
                          await new Promise(r => setTimeout(r, 0));
                      }
                  }
              }
              
              setOfflineCount(await bibleStorage.count());
              if (count === 0) {
                  onShowToast("Nenhum dado compatível encontrado no arquivo.", "error");
              } else {
                  onShowToast(`Sucesso! ${count} capítulos implantados na Nuvem e Local.`, "success");
              }

          } catch (error: any) {
              console.error(error);
              onShowToast(`Erro crítico: ${error.message}`, "error");
          } finally {
              setIsProcessing(false);
              setProgress(0);
              if (fileInputRef.current) fileInputRef.current.value = '';
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
                      allData.push({ key, verses, book: book.name, chapter: c });
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

  const handleStopBatch = () => {
      stopBatchRef.current = true;
      addLog("🛑 Solicitando parada... Aguarde a conclusão do item atual.");
  };

  const handleBatchGenerate = async (type: 'commentary' | 'dictionary') => {
      setIsGeneratingBatch(true);
      setBatchType(type);
      stopBatchRef.current = false; // Reset stop flag
      
      const bookMeta = BIBLE_BOOKS.find(b => b.name === batchBook);
      if (!bookMeta) {
          setIsGeneratingBatch(false);
          onShowToast("Livro não encontrado.", "error");
          return;
      }

      let processed = 0;
      const c = batchStartChapter; // Foca APENAS no capítulo selecionado

      try {
          const chapKey = `bible_acf_${bookMeta.abbrev}_${c}`;
          // Tenta pegar versículos (Nuvem ou Local)
          let verses = (await bibleStorage.get(chapKey)) as any[]; 
          
          if (!verses || verses.length === 0) {
              // Tenta fallback nuvem se local falhar
              verses = (await db.entities.BibleChapter.getCloud(chapKey)) as any[];
          }

          if (!verses || verses.length === 0) {
              addLog(`❌ Erro: Texto bíblico de ${bookMeta.name} ${c} não encontrado.`);
              onShowToast(`Texto de ${bookMeta.name} ${c} não encontrado. Faça o download/upload da Bíblia primeiro.`, "error");
              setIsGeneratingBatch(false);
              return;
          }

          addLog(`🚀 Iniciando lote para ${bookMeta.name} ${c} (${verses.length} versículos)...`);

          // Itera sobre CADA VERSÍCULO do capítulo
          for (let i = 0; i < verses.length; i++) {
              if (stopBatchRef.current) { 
                  addLog("🛑 Processo interrompido pelo usuário."); 
                  break; 
              }

              const verseNum = i + 1;
              const verseText = verses[i];
              const verseKey = generateVerseKey(bookMeta.name, c, verseNum);

              addLog(`Processando ${bookMeta.name} ${c}:${verseNum}...`);

              try {
                  if (type === 'commentary') {
                        // --- PROMPT UNIFICADO (MESMO DO VERSEPANEL) ---
                        const prompt = `
                            ATUE COMO: Professor Michel Felix.
                            TAREFA: Escrever um comentário EXEGÉTICO para um aluno estudioso da Bíblia.
                            TEXTO BÍBLICO: "${verseText}"

                            --- REGRAS DE INÍCIO (SEM ENROLACÃO) ---
                            1. ZERO SAUDAÇÕES: É PROIBIDO começar com "Olá", "Queridos alunos", "Paz do Senhor", "Que bom estarmos juntos".
                            2. TEXTO DIRETO: Comece IMEDIATAMENTE com a explicação do versículo. Ex: "Este versículo revela..." ou "A expressão original indica...".
                            3. ECONOMIA DE PALAVRAS: Não use frases de transição vazias ou introduções sociais ("Enfeitar o pavão"). Vá direto ao que de fato importa.

                            --- OBJETIVO SUPREMO: O EFEITO "AH! ENTENDI!" ---
                            1. O aluno deve terminar a leitura e pensar: "Ah! Agora tudo faz sentido!".
                            2. NÃO seja genérico. Traga DETALHES que iluminam o texto (costumes da época, geografia, ou o sentido exato de uma palavra original que muda tudo).
                            3. Explique de forma INDUBITÁVEL. O texto deve eliminar as dúvidas, não criar novas. Descomplique o difícil.

                            --- PROTOCOLO DE SEGURANÇA HERMENÊUTICA (PRIORIDADE TOTAL) ---
                            1. A BÍBLIA EXPLICA A BÍBLIA: Antes de formular o comentário, verifique mentalmente versículos conexos. A interpretação NÃO pode contradizer o restante das Escrituras.
                            2. ZERO POLÊMICAS/ESPECULAÇÕES: Rejeite interpretações baseadas em livros apócrifos, mitologia (ex: anjos coabitando com humanos) ou cultura judaica extra-bíblica. 
                            3. ORTODOXIA: Em textos difíceis (ex: Gn 6:2), opte SEMPRE pela linha teológica mais conservadora e segura (ex: Linhagem de Sete x Caim), evitando sensacionalismo.
                            4. FOCO NA INTENÇÃO ORIGINAL: O que o autor sagrado quis ensinar sobre Deus e o homem? Fique nisso.

                            --- LINGUAGEM E TOM ---
                            1. PÚBLICO: Alunos de 16 a 76 anos, escolaridade média.
                            2. CLAREZA: Profundo, mas simples e didático. Sem "teologês" desnecessário.
                            3. IMPLICITAMENTE PENTECOSTAL: Ensine a doutrina correta sem usar rótulos ("Arminiano", "Dispensacionalista"). Deixe a teologia fluir naturalmente no texto.

                            --- USO DOS ORIGINAIS ---
                            Cite palavras chaves em Hebraico/Grego (transliteradas) apenas quando iluminarem o sentido, de forma natural (ex: "O termo original *palavra* sugere...").

                            --- ESTRUTURA BLINDADA (3 PARÁGRAFOS - Max 250 Palavras) ---
                            
                            1. PARÁGRAFO 1 (O DESVENDAR DO TEXTO): 
                               - Explique o que está acontecendo com clareza cristalina. Traga aquele detalhe histórico ou linguístico que faz a diferença. Responda: O que isso significava para quem ouviu pela primeira vez?

                            2. PARÁGRAFO 2 (A CONEXÃO TEOLÓGICA): 
                               - Aprofunde o ensino. Conecte com outros textos bíblicos (Analogia da Fé) para confirmar a interpretação correta. Mostre como isso se encaixa no plano de Deus.

                            3. PARÁGRAFO 3 (APLICAÇÃO): 
                               - Curto e prático. Como essa verdade bíblica transforma a vida do aluno hoje? (Max 15% do texto).

                            --- ESTILO VISUAL ---
                            Texto corrido, elegante, inspirador e fácil de ler.
                        `;
                        const text = await generateContent(prompt);
                        await db.entities.Commentary.create({
                            book: bookMeta.name, chapter: c, verse: verseNum, verse_key: verseKey, commentary_text: text
                        });
                  } else {
                        const prompt = `
                            Análise lexical JSON de ${bookMeta.name} ${c}:${verseNum} ("${verseText}").
                            Idioma original: ${bookMeta.testament === 'old' ? 'Hebraico' : 'Grego'}.
                            Retorne JSON com: hebrewGreekText, phoneticText, words (array).
                        `;
                        const schema = {
                            type: GenType.OBJECT,
                            properties: {
                                hebrewGreekText: { type: GenType.STRING },
                                phoneticText: { type: GenType.STRING },
                                words: {
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
                                        },
                                        required: ["original", "transliteration", "portuguese", "polysemy", "etymology", "grammar"]
                                    }
                                }
                            },
                            required: ["hebrewGreekText", "phoneticText", "words"]
                        };
                        const res = await generateContent(prompt, schema);
                        await db.entities.Dictionary.create({
                            book: bookMeta.name, chapter: c, verse: verseNum, verse_key: verseKey,
                            original_text: res.hebrewGreekText, transliteration: res.phoneticText, key_words: res.words
                        });
                  }
                  processed++;
                  // Pausa pequena para evitar Rate Limit excessivo
                  await new Promise(r => setTimeout(r, 1000)); 

              } catch (err: any) {
                  addLog(`⚠️ Falha em ${c}:${verseNum}: ${err.message}`);
              }
          }

      } catch (e: any) {
          addLog(`Erro crítico: ${e.message}`);
      }

      setIsGeneratingBatch(false);
      onShowToast(`Processo finalizado. ${processed} itens gerados em ${bookMeta.name} ${c}.`, 'success');
  };

  const handleGenerateDevotional = async () => {
      if (!devotionalDate) return;
      setIsGeneratingBatch(true);
      stopBatchRef.current = false;
      setBatchType(null);
      const dateStr = devotionalDate;
      const displayDate = new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
      addLog(`Gerando devocional para ${displayDate}...`);
      try {
         const existing = await db.entities.Devotional.filter({ date: dateStr });
         if(existing.length > 0) await db.entities.Devotional.delete(existing[0].id);
         const prompt = `ATUE COMO: Michel Felix. TAREFA: Devocional para ${displayDate}. JSON FORMAT: { title, reference, verse_text, body (com \\n\\n), prayer }.`;
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

  const filteredUsers = usersList.filter(u => 
      u.user_name.toLowerCase().includes(userSearch.toLowerCase()) || 
      u.user_email.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-dark-bg transition-colors duration-300">
      
      {/* MODAL DE RELATÓRIOS (Mantido) */}
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
                      {reports.length === 0 ? <p className="text-center text-gray-400 py-10">Nenhum reporte pendente.</p> : reports.map(report => (
                          <div key={report.id} className="bg-gray-50 dark:bg-black/20 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                              <div className="flex justify-between">
                                  <span className="font-bold text-sm text-[#8B0000] dark:text-[#ff6b6b]">{report.reference_text}</span>
                                  <span className="text-xs text-gray-400">{new Date(report.date).toLocaleDateString()}</span>
                              </div>
                              <p className="text-gray-700 dark:text-gray-300 italic mb-3">"{report.report_text}"</p>
                              <button onClick={() => handleDeleteReport(report.id!)} className="w-full bg-green-600 text-white py-1 rounded text-xs font-bold hover:bg-green-700 flex items-center justify-center gap-2"><CheckCircle className="w-3 h-3"/> Marcar como Resolvido</button>
                          </div>
                      ))}
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
        
        {/* BOTÃO BUILDER */}
        <div className="bg-gradient-to-r from-[#C5A059] to-[#8B0000] p-6 rounded-xl shadow-xl text-white flex justify-between items-center transform hover:scale-[1.01] transition-transform cursor-pointer" onClick={() => setShowBuilder(true)}>
            <div>
                <h2 className="font-cinzel font-bold text-2xl flex items-center gap-2"><Wand2 className="w-6 h-6"/> ADMA Builder AI</h2>
                <p className="text-sm opacity-90">Crie módulos, altere cores e gerencie o app conversando com a IA.</p>
            </div>
            <button className="bg-white text-[#8B0000] px-6 py-3 rounded-lg font-bold shadow-lg">Abrir Builder</button>
        </div>

        {/* SEÇÃO 1: INFRAESTRUTURA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow border border-[#C5A059]/20">
                <h3 className="font-bold text-gray-500 mb-4 flex items-center gap-2"><Server className="w-4 h-4"/> Status Banco de Dados</h3>
                <div className="flex items-center gap-3">
                    {dbStatus === 'checking' && <Loader2 className="w-6 h-6 animate-spin text-blue-500" />}
                    {dbStatus === 'connected' && <CheckCircle className="w-6 h-6 text-green-500" />}
                    {dbStatus === 'error' && <XCircle className="w-6 h-6 text-red-500" />}
                    <span className="font-bold dark:text-white">{dbStatus === 'connected' ? 'Conectado (Supabase)' : 'Verificando...'}</span>
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

        {/* SEÇÃO 2: BÍBLIA OFFLINE */}
        <h2 className="font-cinzel font-bold text-xl text-[#8B0000] dark:text-[#ff6b6b] border-b border-[#C5A059] pb-2">1. Gestão da Bíblia (JSON)</h2>
        
        {/* NOVO: Botão de Resgate + Upload Corrigido */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <button onClick={handleDownloadBible} disabled={isProcessing} className="bg-white dark:bg-dark-card p-4 rounded-xl shadow border border-[#C5A059]/30 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                 {isProcessing ? <Loader2 className="w-8 h-8 animate-spin text-[#C5A059]" /> : <CloudUpload className="w-8 h-8 text-[#C5A059]" />}
                 <span className="font-bold text-xs text-center dark:text-white">Baixar da Web</span>
             </button>
             
             {/* BOTÃO RESGATAR DA NUVEM */}
             <button onClick={handleRestoreFromCloud} disabled={isProcessing} className="bg-[#8B0000] text-white p-4 rounded-xl shadow border border-[#C5A059]/30 flex flex-col items-center justify-center gap-2 hover:bg-[#600018] transition animate-pulse">
                 {isProcessing ? <Loader2 className="w-8 h-8 animate-spin text-white" /> : <Cloud className="w-8 h-8 text-white" />}
                 <span className="font-bold text-xs text-center">Resgatar da Nuvem</span>
             </button>

             <div className="bg-white dark:bg-dark-card p-4 rounded-xl shadow border border-[#C5A059]/30 flex flex-col items-center justify-center gap-2 relative overflow-hidden group hover:bg-gray-50 cursor-pointer">
                 <Upload className="w-8 h-8 text-blue-500" />
                 <span className="font-bold text-xs text-center dark:text-white">Upload JSON (4MB)</span>
                 <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="absolute inset-0 opacity-0 cursor-pointer" disabled={isProcessing} />
             </div>
             
             <button onClick={handleExportJson} disabled={isProcessing} className="bg-white dark:bg-dark-card p-4 rounded-xl shadow border border-[#C5A059]/30 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                 <Download className="w-8 h-8 text-green-500" />
                 <span className="font-bold text-xs text-center dark:text-white">Backup Local</span>
             </button>
        </div>
        
        {/* Barra de Progresso Visual */}
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

        {/* SEÇÃO 3: FÁBRICA DE CONTEÚDO */}
        <h2 className="font-cinzel font-bold text-xl text-[#8B0000] dark:text-[#ff6b6b] border-b border-[#C5A059] pb-2 mt-8">2. Fábrica de Conteúdo (IA)</h2>
        <div className="bg-white dark:bg-dark-card p-6 rounded-xl shadow border-l-4 border-[#8B0000]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="text-xs font-bold text-gray-500">Livro</label>
                    <select value={batchBook} onChange={e => setBatchBook(e.target.value)} className="w-full p-2 border rounded mt-1 dark:bg-gray-800 dark:text-white">
                        {BIBLE_BOOKS.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500">Capítulo Alvo</label>
                    <input type="number" value={batchStartChapter} onChange={e => setBatchStartChapter(Number(e.target.value))} className="w-full p-2 border rounded mt-1 dark:bg-gray-800 dark:text-white" min={1}/>
                </div>
            </div>
            {isGeneratingBatch ? (
                 <div className="text-center py-6">
                     <Loader2 className="w-10 h-10 animate-spin mx-auto text-[#8B0000] mb-2"/>
                     <p className="font-cinzel font-bold dark:text-white">Gerando Conteúdo para {batchBook} {batchStartChapter}...</p>
                     <button onClick={handleStopBatch} className="mt-4 bg-red-600 text-white px-4 py-2 rounded flex items-center justify-center gap-2 mx-auto"><StopCircle className="w-4 h-4" /> Parar Processo</button>
                     <div className="mt-4 h-32 overflow-y-auto bg-black text-green-400 p-2 rounded text-xs text-left font-mono">{batchLogs.map((log, i) => <div key={i}>{log}</div>)}</div>
                 </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button onClick={() => handleBatchGenerate('commentary')} className="bg-[#8B0000] text-white py-3 rounded font-bold flex flex-col items-center justify-center gap-1 hover:bg-[#600018]"><MessageSquare className="w-5 h-5" /> Gerar Comentários (Cap. Inteiro)</button>
                    <button onClick={() => handleBatchGenerate('dictionary')} className="bg-[#C5A059] text-white py-3 rounded font-bold flex flex-col items-center justify-center gap-1 hover:bg-[#a88645]"><Languages className="w-5 h-5" /> Gerar Dicionários (Cap. Inteiro)</button>
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded border border-purple-200 dark:border-purple-800 flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1"><Calendar className="w-3 h-3" /> Gerador de Devocional</label>
                        <input type="date" value={devotionalDate} onChange={e => setDevotionalDate(e.target.value)} className="p-1.5 text-xs border rounded w-full dark:bg-gray-900 dark:text-white"/>
                        <button onClick={handleGenerateDevotional} className="bg-purple-700 text-white py-1.5 rounded text-xs font-bold hover:bg-purple-800 w-full">Gerar para esta Data</button>
                    </div>
                </div>
            )}
        </div>

        {/* SEÇÃO 4: GESTÃO DE USUÁRIOS (NOVO) */}
        <h2 className="font-cinzel font-bold text-xl text-[#8B0000] dark:text-[#ff6b6b] border-b border-[#C5A059] pb-2 mt-8">3. Gestão de Usuários</h2>
        <div className="bg-white dark:bg-dark-card rounded-xl shadow border border-[#C5A059]/20 overflow-hidden">
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-[#C5A059]/20 flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                        value={userSearch} 
                        onChange={e => setUserSearch(e.target.value)}
                        placeholder="Buscar por nome ou email..."
                        className="w-full pl-9 p-2 rounded border text-sm dark:bg-gray-800 dark:text-white dark:border-gray-700"
                    />
                </div>
                <button onClick={loadUsers} className="p-2 bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300"><RefreshCw className="w-4 h-4 text-gray-600 dark:text-gray-300"/></button>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
                {loadingUsers ? (
                    <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#C5A059]"/></div>
                ) : filteredUsers.length === 0 ? (
                    <div className="p-10 text-center text-gray-400">Nenhum usuário encontrado.</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-black/20 text-gray-500 font-bold text-left sticky top-0">
                            <tr>
                                <th className="p-3">Nome</th>
                                <th className="p-3">Status</th>
                                <th className="p-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {filteredUsers.map(user => (
                                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                                    <td className="p-3">
                                        <div className="font-bold dark:text-white">{user.user_name}</div>
                                        <div className="text-xs text-gray-400">{user.user_email}</div>
                                        {user.reset_requested && (
                                            <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded-full mt-1">
                                                <KeyRound className="w-3 h-3"/> Pediu Reset
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        {user.is_blocked ? (
                                            <span className="text-red-500 font-bold flex items-center gap-1"><Lock className="w-3 h-3"/> Bloqueado</span>
                                        ) : (
                                            <span className="text-green-500 font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Ativo</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button 
                                                onClick={() => resetUserPassword(user)}
                                                className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded" 
                                                title="Resetar Senha"
                                            >
                                                <KeyRound className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => toggleUserBlock(user)}
                                                className={`p-1.5 rounded ${user.is_blocked ? 'text-green-600 hover:bg-green-50' : 'text-red-600 hover:bg-red-50'}`} 
                                                title={user.is_blocked ? "Desbloquear" : "Bloquear"}
                                            >
                                                {user.is_blocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            <div className="bg-gray-50 dark:bg-black/20 p-2 text-xs text-gray-500 text-center border-t border-[#C5A059]/20">
                Total de usuários: {usersList.length}
            </div>
        </div>

      </div>
    </div>
  );
}
