import React, { useState } from 'react';
import { BookOpen, User, ArrowRight, Loader2, Lock, ShieldAlert, KeyRound, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../services/database';

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
    const email = generateEmail(firstName, lastName);

    try {
        const users = await db.entities.ReadingProgress.filter({ user_email: email });
        if (users.length > 0) {
            const user = users[0];
            setUserData(user);
            if (user.is_blocked) setStep('BLOCKED');
            else if (!user.password_pin) setStep('CREATE_PIN');
            else setStep('ENTER_PIN');
        } else {
            setStep('CREATE_PIN');
        }
    } catch (err) {
        setErrorMsg('Erro ao conectar.');
    } finally {
        setIsProcessing(false);
    }
  };

  const handleCreatePin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (pin.length !== 6 || isNaN(Number(pin))) {
          setErrorMsg('A senha deve ter 6 números.');
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
                  total_chapters: 0
              });
          }
          onLogin(firstName, lastName);
      } catch (e) {
          setErrorMsg('Erro ao salvar.');
      } finally {
          setIsProcessing(false);
      }
  };

  const handleEnterPin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (pin === userData?.password_pin) onLogin(firstName, lastName);
      else {
          setErrorMsg('Senha incorreta.');
          setPin('');
      }
  };

  return (
    <div className="min-h-screen bg-[#F5F5DC] dark:bg-[#121212] flex items-center justify-center p-6 transition-colors duration-500">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#1E1E1E] rounded-[32px] p-8 shadow-2xl border border-[#C5A059]/20 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8B0000] via-[#C5A059] to-[#8B0000]" />
          
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-[#8B0000] rounded-3xl mx-auto mb-4 flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-[#F5F5DC]" />
            </div>
            <h1 className="font-cinzel text-3xl font-bold dark:text-white mb-1">Bíblia ADMA</h1>
            <p className="font-cormorant dark:text-white/70 text-lg italic">Prof. Michel Felix</p>
          </div>

          <AnimatePresence mode="wait">
            {step === 'IDENTIFY' && (
                <motion.form key="id" onSubmit={handleIdentitySubmit} className="space-y-4">
                    <input value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-[#252525] dark:text-white" placeholder="Nome" required />
                    <input value={lastName} onChange={e => setLastName(e.target.value)} className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-[#252525] dark:text-white" placeholder="Sobrenome" required />
                    <button type="submit" disabled={isProcessing} className="w-full bg-[#8B0000] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2">
                        {isProcessing ? <Loader2 className="animate-spin" /> : <>Continuar <ArrowRight /></>}
                    </button>
                </motion.form>
            )}

            {step === 'ENTER_PIN' && (
                <motion.form key="pin" onSubmit={handleEnterPin} className="space-y-6">
                    <h2 className="text-center dark:text-white font-cinzel font-bold">Digite seu PIN</h2>
                    <input type="password" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,''))} className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-[#252525] dark:text-white text-center tracking-[1em]" placeholder="******" required />
                    {errorMsg && <p className="text-red-500 text-center font-bold text-xs">{errorMsg}</p>}
                    <button type="submit" className="w-full bg-[#8B0000] text-white font-bold py-4 rounded-2xl">Entrar</button>
                </motion.form>
            )}

            {step === 'CREATE_PIN' && (
                <motion.form key="cp" onSubmit={handleCreatePin} className="space-y-4">
                    <h2 className="text-center dark:text-white font-cinzel font-bold">Crie seu PIN (6 dígitos)</h2>
                    <input type="password" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,''))} className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-[#252525] dark:text-white text-center" placeholder="Novo PIN" required />
                    <input type="password" maxLength={6} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g,''))} className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-[#252525] dark:text-white text-center" placeholder="Confirmar PIN" required />
                    {errorMsg && <p className="text-red-500 text-center font-bold text-xs">{errorMsg}</p>}
                    <button type="submit" className="w-full bg-[#8B0000] text-white font-bold py-4 rounded-2xl">Salvar e Entrar</button>
                </motion.form>
            )}

            {step === 'BLOCKED' && (
                <div className="text-center">
                    <ShieldAlert className="w-16 h-16 mx-auto text-red-600 mb-4" />
                    <h2 className="font-cinzel font-bold text-red-600">Acesso Bloqueado</h2>
                    <p className="text-gray-500 text-sm mt-2">Sua conta foi suspensa pelo administrador.</p>
                </div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}