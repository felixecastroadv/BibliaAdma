
import React, { useState } from 'react';
import { BookOpen, User, ArrowRight, Loader2, Lock, ShieldAlert, KeyRound, CheckCircle, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, generateUserId } from '@/services/database';

interface LoginScreenProps {
  onLogin: (firstName: string, lastName: string) => void;
  loading: boolean;
}

type LoginStep = 'IDENTIFY' | 'CREATE_PIN' | 'ENTER_PIN' | 'BLOCKED' | 'FORGOT_PIN_SENT';

export default function LoginScreen({ onLogin, loading }: LoginScreenProps) {
  const [step, setStep] = useState<LoginStep>('IDENTIFY');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [userData, setUserData] = useState<any>(null);

  const generateEmail = (first: string, last: string) => `${first.trim().toLowerCase()}.${last.trim().toLowerCase()}@adma.local`;

  const handleIdentitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;

    setIsProcessing(true);
    setErrorMsg('');
    
    try {
        const targetEmail = generateEmail(firstName, lastName);
        const targetId = generateUserId(targetEmail);
        
        console.log("Tentando login para:", targetEmail, "ID:", targetId);

        // 1. Busca Direta por ID (Prioritária)
        // A nova lógica de banco garante que se existir localmente, retorna.
        let foundUser = await db.entities.ReadingProgress.get(targetId);

        // 2. Busca Fuzzy (Backup se ID direto falhar)
        if (!foundUser) {
            const allUsers = await db.entities.ReadingProgress.list();
            const norm = (s: string) => s ? s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
            const tEmailNorm = norm(targetEmail);
            const tNameNorm = norm(`${firstName} ${lastName}`);

            const candidates = allUsers.filter(u => {
                const uEmail = norm(u.user_email);
                const uName = norm(u.user_name);
                return uEmail === tEmailNorm || (tNameNorm.length > 5 && uName === tNameNorm);
            });

            if (candidates.length > 0) {
                candidates.sort((a: any, b: any) => (b.total_chapters || 0) - (a.total_chapters || 0));
                foundUser = candidates[0];
            }
        }

        if (foundUser) {
            console.log("Usuário encontrado:", foundUser);
            setUserData(foundUser);

            if (foundUser.is_blocked) {
                setStep('BLOCKED');
            } else if (!foundUser.password_pin || foundUser.password_pin === '') {
                // Usuário encontrado mas sem senha (Legado) -> Pede para definir
                setStep('CREATE_PIN');
            } else {
                // Usuário com senha -> Pede senha
                setStep('ENTER_PIN');
            }
        } else {
            console.log("Nenhum usuário encontrado. Criando novo.");
            // Nenhum registro encontrado -> Cria nova conta
            setStep('CREATE_PIN');
        }
    } catch (err) {
        setErrorMsg('Erro de conexão. Verifique sua internet.');
        console.error(err);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleCreatePin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (pin.length !== 6 || isNaN(Number(pin))) {
          setErrorMsg('A senha deve ter exatamente 6 números.');
          return;
      }
      if (pin !== confirmPin) {
          setErrorMsg('As senhas não conferem.');
          return;
      }

      setIsProcessing(true);
      
      try {
          if (userData) {
              // Atualiza usuário existente
              console.log("Atualizando PIN para usuário existente:", userData.id);
              await db.entities.ReadingProgress.update(userData.id, { 
                  password_pin: pin,
                  reset_requested: false 
              });
          } else {
              // Cria novo usuário
              const email = generateEmail(firstName, lastName);
              const fullName = `${firstName.trim()} ${lastName.trim()}`;
              const userId = generateUserId(email);
              
              console.log("Criando novo usuário:", userId);

              await db.entities.ReadingProgress.create({
                  id: userId,
                  user_email: email,
                  user_name: fullName,
                  password_pin: pin,
                  chapters_read: [],
                  total_chapters: 0
              });
          }
          
          onLogin(firstName, lastName);
      } catch (e) {
          console.error("Erro ao salvar PIN:", e);
          setErrorMsg('Erro ao salvar. Tente novamente.');
      } finally {
          setIsProcessing(false);
      }
  };

  const handleEnterPin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!userData) return;

      if (pin === userData.password_pin) {
          onLogin(firstName, lastName);
      } else {
          setErrorMsg('Senha incorreta.');
          setPin('');
      }
  };

  const handleForgotPassword = async () => {
      if (!userData) return;
      setIsProcessing(true);
      try {
          await db.entities.ReadingProgress.update(userData.id, { reset_requested: true });
          setStep('FORGOT_PIN_SENT');
      } catch (e) {
          setErrorMsg('Erro ao solicitar reset.');
      } finally {
          setIsProcessing(false);
      }
  };

  const resetForm = () => {
      setStep('IDENTIFY');
      setPin('');
      setConfirmPin('');
      setErrorMsg('');
      setUserData(null);
  };

  return (
    <div className="min-h-screen bg-[#F5F5DC] dark:bg-[#121212] flex items-center justify-center p-6 transition-colors duration-500 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="bg-white/80 dark:bg-[#1E1E1E]/90 backdrop-blur-xl rounded-[32px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] p-8 md:p-10 border border-white/50 dark:border-white/5 relative overflow-hidden"
        >
          {/* Decorative Gradient Line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8B0000] via-[#C5A059] to-[#8B0000]" />
          
          {step !== 'IDENTIFY' && (
              <button onClick={resetForm} className="absolute top-4 left-4 text-gray-400 hover:text-[#8B0000] text-xs font-bold uppercase tracking-wider">
                  Voltar
              </button>
          )}

          <div className="text-center mb-8">
            <motion.div 
                initial={{ rotate: -5, scale: 0.9 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ duration: 0.8, type: "spring" }}
                className="w-20 h-20 bg-gradient-to-br from-[#8B0000] to-[#500000] rounded-3xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-red-900/30"
            >
              <BookOpen className="w-10 h-10 text-[#F5F5DC]" />
            </motion.div>
            
            <h1 className="font-cinzel text-3xl font-bold text-[#1a0f0f] dark:text-white mb-1 tracking-tight">Bíblia ADMA</h1>
            <p className="font-cormorant text-[#1a0f0f]/70 dark:text-white/70 text-lg italic tracking-wide">Prof. Michel Felix</p>
          </div>

          <AnimatePresence mode="wait">
            
            {/* ETAPA 1: IDENTIFICAÇÃO */}
            {step === 'IDENTIFY' && (
                <motion.form 
                    key="identify"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleIdentitySubmit} 
                    className="space-y-4"
                >
                    <div className="space-y-2">
                    <label className="font-montserrat text-xs font-bold text-gray-500 dark:text-gray-400 uppercase ml-2 tracking-wider">Nome</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <User className="w-5 h-5 text-[#C5A059] group-focus-within:text-[#8B0000] transition-colors" />
                        </div>
                        <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="block w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-[#252525] border border-transparent focus:bg-white dark:focus:bg-[#2A2A2A] text-gray-900 dark:text-white rounded-2xl font-montserrat text-sm transition-all duration-300 focus:ring-2 focus:ring-[#C5A059]/50 focus:border-[#C5A059]/30 placeholder-gray-400 dark:placeholder-gray-600 shadow-inner"
                        placeholder="Seu primeiro nome"
                        required
                        />
                    </div>
                    </div>

                    <div className="space-y-2">
                    <label className="font-montserrat text-xs font-bold text-gray-500 dark:text-gray-400 uppercase ml-2 tracking-wider">Sobrenome</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <User className="w-5 h-5 text-[#C5A059] group-focus-within:text-[#8B0000] transition-colors" />
                        </div>
                        <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="block w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-[#252525] border border-transparent focus:bg-white dark:focus:bg-[#2A2A2A] text-gray-900 dark:text-white rounded-2xl font-montserrat text-sm transition-all duration-300 focus:ring-2 focus:ring-[#C5A059]/50 focus:border-[#C5A059]/30 placeholder-gray-400 dark:placeholder-gray-600 shadow-inner"
                        placeholder="Seu sobrenome"
                        required
                        />
                    </div>
                    </div>

                    <button
                    type="submit"
                    disabled={isProcessing || !firstName || !lastName}
                    className="w-full bg-gradient-to-r from-[#8B0000] to-[#600018] hover:to-[#800000] text-white font-cinzel font-bold py-4 rounded-2xl shadow-[0_10px_20px_-5px_rgba(139,0,0,0.3)] mt-4 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continuar <ArrowRight className="w-5 h-5" /></>}
                    </button>
                </motion.form>
            )}

            {/* ETAPA 2: CRIAR PIN (NOVO USUÁRIO OU RESET) */}
            {step === 'CREATE_PIN' && (
                <motion.form 
                    key="create-pin"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleCreatePin} 
                    className="space-y-4"
                >
                    {userData ? (
                        <div className="bg-[#8B0000]/5 dark:bg-[#8B0000]/20 border border-[#8B0000]/20 dark:border-[#8B0000]/40 p-4 rounded-2xl mb-4 text-center animate-in zoom-in duration-300">
                            <div className="flex items-center justify-center gap-2 text-[#8B0000] dark:text-[#C5A059] mb-1">
                                <Database className="w-4 h-4" />
                                <span className="font-bold text-xs uppercase tracking-wider">Conta Recuperada</span>
                            </div>
                            <p className="text-3xl font-cinzel font-black text-[#1a0f0f] dark:text-white mt-1">
                                {userData.total_chapters || 0} <span className="text-xs font-sans font-normal opacity-70">Capítulos</span>
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-300 mt-2 font-bold">Crie uma senha para proteger este progresso.</p>
                        </div>
                    ) : (
                        <div className="text-center mb-4">
                            <h2 className="font-cinzel font-bold text-xl text-[#8B0000] dark:text-[#C5A059]">Nova Conta</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Nenhum registro encontrado. Crie seu PIN para começar.</p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="font-montserrat text-xs font-bold text-gray-500 uppercase ml-2">Senha (6 números)</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#C5A059]" />
                            <input
                                type="password" inputMode="numeric" maxLength={6}
                                value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                className="block w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-[#252525] rounded-2xl font-mono text-lg tracking-widest text-center focus:ring-2 focus:ring-[#C5A059]"
                                placeholder="******" required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="font-montserrat text-xs font-bold text-gray-500 uppercase ml-2">Confirmar Senha</label>
                        <div className="relative">
                            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#C5A059]" />
                            <input
                                type="password" inputMode="numeric" maxLength={6}
                                value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                                className="block w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-[#252525] rounded-2xl font-mono text-lg tracking-widest text-center focus:ring-2 focus:ring-[#C5A059]"
                                placeholder="******" required
                            />
                        </div>
                    </div>

                    {errorMsg && <p className="text-red-500 text-xs text-center font-bold">{errorMsg}</p>}

                    <button type="submit" disabled={isProcessing} className="w-full bg-[#8B0000] text-white font-bold py-4 rounded-2xl mt-4 flex justify-center items-center gap-2">
                        {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle />} {userData ? 'Salvar Senha' : 'Criar Conta'}
                    </button>
                </motion.form>
            )}

            {/* ETAPA 3: DIGITAR PIN */}
            {step === 'ENTER_PIN' && (
                <motion.form 
                    key="enter-pin"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleEnterPin} 
                    className="space-y-6"
                >
                    <div className="text-center">
                        <h2 className="font-cinzel font-bold text-xl text-[#1a0f0f] dark:text-white">Bem-vindo de volta, {firstName}!</h2>
                        <p className="text-xs text-gray-500 mt-1">Digite sua senha numérica.</p>
                    </div>

                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8B0000]" />
                        <input
                            type="password" inputMode="numeric" maxLength={6}
                            value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                            className="block w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-[#252525] rounded-2xl font-mono text-xl tracking-[0.5em] text-center focus:ring-2 focus:ring-[#8B0000]"
                            placeholder="******" autoFocus
                        />
                    </div>

                    {errorMsg && (
                        <div className="text-center animate-shake">
                            <p className="text-red-500 text-sm font-bold">{errorMsg}</p>
                            <button type="button" onClick={handleForgotPassword} className="text-xs text-[#C5A059] underline mt-1 hover:text-[#8B0000]">
                                Esqueci minha senha
                            </button>
                        </div>
                    )}

                    <button type="submit" disabled={pin.length < 6} className="w-full bg-[#8B0000] text-white font-bold py-4 rounded-2xl flex justify-center items-center gap-2 disabled:opacity-50">
                        Entrar <ArrowRight />
                    </button>
                </motion.form>
            )}

            {/* ETAPA 4: BLOQUEADO */}
            {step === 'BLOCKED' && (
                <motion.div key="blocked" className="text-center py-6">
                    <ShieldAlert className="w-20 h-20 text-red-600 mx-auto mb-4" />
                    <h2 className="font-cinzel font-bold text-xl text-red-600">Acesso Bloqueado</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
                        Sua conta foi temporariamente suspensa pelo administrador. Entre em contato com a liderança.
                    </p>
                    <button onClick={resetForm} className="mt-6 text-sm underline">Voltar</button>
                </motion.div>
            )}

            {/* ETAPA 5: CONFIRMAÇÃO DE RESET */}
            {step === 'FORGOT_PIN_SENT' && (
                <motion.div key="forgot" className="text-center py-6">
                    <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
                    <h2 className="font-cinzel font-bold text-xl text-green-600">Solicitação Enviada</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
                        O administrador recebeu seu pedido de reset de senha. Aguarde a aprovação e tente entrar novamente mais tarde para criar uma nova senha.
                    </p>
                    <button onClick={resetForm} className="mt-6 bg-gray-200 dark:bg-gray-800 px-6 py-2 rounded-full text-sm font-bold">Voltar ao Início</button>
                </motion.div>
            )}

          </AnimatePresence>

        </motion.div>
      </div>
    </div>
  );
}
