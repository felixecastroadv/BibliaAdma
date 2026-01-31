
import React, { useState } from 'react';
import { BookOpen, User, ArrowRight, Loader2, Lock, ShieldAlert, KeyRound, CheckCircle, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CHURCH_NAME, PASTOR_PRESIDENT } from '../../constants';
import { db } from '../../services/database';

interface LoginScreenProps {
  onLogin: (firstName: string, lastName: string) => void;
  loading: boolean;
}

type LoginStep = 'IDENTIFY' | 'CREATE_PIN' | 'ENTER_PIN' | 'BLOCKED' | 'FORGOT_PIN_SENT' | 'OFFLINE_ERROR';

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

    if (!navigator.onLine) {
        setStep('OFFLINE_ERROR');
        return;
    }

    setIsProcessing(true);
    setErrorMsg('');
    const email = generateEmail(firstName, lastName);

    try {
        // Busca obrigatória na Nuvem (ajustada no database.ts)
        const users = await db.entities.ReadingProgress.filter({ user_email: email });
        
        if (users.length > 0) {
            const user = users[0];
            setUserData(user);

            if (user.is_blocked) {
                setStep('BLOCKED');
            } else if (!user.password_pin || user.password_pin === '') {
                // Resetado ou Migração
                setStep('CREATE_PIN');
            } else {
                // Usuário reconhecido na nuvem
                setStep('ENTER_PIN');
            }
        } else {
            // Novo usuário de fato
            setStep('CREATE_PIN');
        }
    } catch (err) {
        setErrorMsg('Falha ao conectar com o servidor universal. Tente novamente.');
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
              await db.entities.ReadingProgress.update(userData.id, { 
                  password_pin: pin,
                  reset_requested: false 
              });
          } else {
              const email = generateEmail(firstName, lastName);
              const fullName = `${firstName.trim()} ${lastName.trim()}`;
              await db.entities.ReadingProgress.create({
                  user_email: email,
                  user_name: fullName,
                  password_pin: pin,
                  chapters_read: [],
                  total_chapters: 0,
                  ebd_read: [],
                  total_ebd_read: 0
              });
          }
          onLogin(firstName, lastName);
      } catch (e) {
          setErrorMsg('Erro ao salvar senha.');
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
            <p className="font-cormorant text-[#1a0f0f]/70 dark:text-white/70 text-lg italic tracking-wide">Universal Sync v11.4</p>
          </div>

          <AnimatePresence mode="wait">
            
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

                    {errorMsg && <p className="text-red-500 text-xs text-center font-bold px-2">{errorMsg}</p>}

                    <button
                    type="submit"
                    disabled={isProcessing || !firstName || !lastName}
                    className="w-full bg-gradient-to-r from-[#8B0000] to-[#600018] hover:to-[#800000] text-white font-cinzel font-bold py-4 rounded-2xl shadow-[0_10px_20px_-5px_rgba(139,0,0,0.3)] mt-4 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Identificar e Sincronizar <ArrowRight className="w-5 h-5" /></>}
                    </button>
                </motion.form>
            )}

            {step === 'CREATE_PIN' && (
                <motion.form 
                    key="create-pin"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleCreatePin} 
                    className="space-y-4"
                >
                    <div className="text-center mb-4">
                        <h2 className="font-cinzel font-bold text-xl text-[#8B0000] dark:text-[#C5A059]">Criar Senha de Acesso</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Sua conta será vinculada universalmente com este PIN.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="font-montserrat text-xs font-bold text-gray-500 uppercase ml-2">Senha (6 números)</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#C5A059]" />
                            <input
                                type="password" inputMode="numeric" maxLength={6}
                                value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                className="block w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-[#252525] rounded-2xl font-mono text-lg tracking-widest text-center focus:ring-2 focus:ring-[#C5A059] dark:text-white"
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
                                className="block w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-[#252525] rounded-2xl font-mono text-lg tracking-widest text-center focus:ring-2 focus:ring-[#C5A059] dark:text-white"
                                placeholder="******" required
                            />
                        </div>
                    </div>

                    {errorMsg && <p className="text-red-500 text-xs text-center font-bold">{errorMsg}</p>}

                    <button type="submit" disabled={isProcessing} className="w-full bg-[#8B0000] text-white font-bold py-4 rounded-2xl mt-4 flex justify-center items-center gap-2">
                        {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle />} Concluir Cadastro
                    </button>
                </motion.form>
            )}

            {step === 'ENTER_PIN' && (
                <motion.form 
                    key="enter-pin"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleEnterPin} 
                    className="space-y-6"
                >
                    <div className="text-center">
                        <h2 className="font-cinzel font-bold text-xl text-[#1a0f0f] dark:text-white">Conta Encontrada!</h2>
                        <p className="text-xs text-gray-500 mt-1">Bem-vindo(a), {firstName}. Digite sua senha.</p>
                    </div>

                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8B0000]" />
                        <input
                            type="password" inputMode="numeric" maxLength={6}
                            value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                            className="block w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-[#252525] rounded-2xl font-mono text-xl tracking-[0.5em] text-center focus:ring-2 focus:ring-[#8B0000] dark:text-white"
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
                        Acessar Conta <ArrowRight />
                    </button>
                </motion.form>
            )}

            {step === 'BLOCKED' && (
                <motion.div key="blocked" className="text-center py-6">
                    <ShieldAlert className="w-20 h-20 text-red-600 mx-auto mb-4" />
                    <h2 className="font-cinzel font-bold text-xl text-red-600">Acesso Bloqueado</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
                        Esta conta foi suspensa por motivos administrativos.
                    </p>
                    <button onClick={resetForm} className="mt-6 text-sm underline">Voltar</button>
                </motion.div>
            )}

            {step === 'OFFLINE_ERROR' && (
                <motion.div key="offline" className="text-center py-6">
                    <WifiOff className="w-20 h-20 text-orange-500 mx-auto mb-4" />
                    <h2 className="font-cinzel font-bold text-xl text-orange-600">Sem Conexão</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
                        A primeira identificação exige internet para sincronizar seus dados universais.
                    </p>
                    <button onClick={resetForm} className="mt-6 bg-gray-200 dark:bg-gray-800 px-6 py-2 rounded-full text-sm font-bold">Tentar Novamente</button>
                </motion.div>
            )}

            {step === 'FORGOT_PIN_SENT' && (
                <motion.div key="forgot" className="text-center py-6">
                    <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
                    <h2 className="font-cinzel font-bold text-xl text-green-600">Solicitação Enviada</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
                        O administrador foi notificado. Tente entrar em breve para criar um novo PIN.
                    </p>
                    <button onClick={resetForm} className="mt-6 bg-gray-200 dark:bg-gray-800 px-6 py-2 rounded-full text-sm font-bold">Voltar</button>
                </motion.div>
            )}

          </AnimatePresence>

        </motion.div>
      </div>
    </div>
  );
}
