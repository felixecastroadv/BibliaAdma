
import React, { useState } from 'react';
import { BookOpen, User, ArrowRight, Loader2, Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';
import { CHURCH_NAME, PASTOR_PRESIDENT } from '../../constants';

interface LoginScreenProps {
  onLogin: (firstName: string, lastName: string) => void;
  loading: boolean;
}

export default function LoginScreen({ onLogin, loading }: LoginScreenProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (firstName.trim() && lastName.trim()) {
      onLogin(firstName.trim(), lastName.trim());
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5DC] dark:bg-[#121212] flex items-center justify-center p-4 transition-colors duration-300">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#1E1E1E] rounded-3xl shadow-2xl p-8 border border-[#C5A059]/30 dark:border-[#C5A059]/10 relative overflow-hidden"
        >
          {/* Decorative Header */}
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#8B0000] via-[#C5A059] to-[#8B0000]" />
          
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-[#8B0000] to-[#600018] rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg transform rotate-3">
              <BookOpen className="w-10 h-10 text-white" />
            </div>
            <h1 className="font-cinzel text-3xl font-bold text-[#1a0f0f] dark:text-white mb-1">Bíblia ADMA</h1>
            <p className="font-cormorant text-[#1a0f0f]/60 dark:text-white/60 text-lg italic">Prof. Michel Felix</p>
            
            <div className="mt-4 border-t border-[#C5A059]/20 pt-4">
                <p className="font-montserrat text-xs text-[#8B0000] dark:text-[#C5A059] uppercase tracking-widest font-bold">{CHURCH_NAME}</p>
                <p className="font-cinzel text-[10px] text-gray-500 dark:text-gray-400 mt-1 uppercase">Presidente: {PASTOR_PRESIDENT}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="font-montserrat text-xs font-bold text-[#1a0f0f]/60 dark:text-white/60 uppercase ml-1">Nome</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#C5A059]" />
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-[#FDFBF7] dark:bg-[#2A2A2A] text-gray-900 dark:text-white border border-[#C5A059]/50 dark:border-[#C5A059]/20 rounded-xl py-3 pl-12 pr-4 font-montserrat focus:outline-none focus:ring-2 focus:ring-[#8B0000] focus:border-transparent transition-all placeholder-gray-400 dark:placeholder-gray-600"
                  placeholder="Seu primeiro nome"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-montserrat text-xs font-bold text-[#1a0f0f]/60 dark:text-white/60 uppercase ml-1">Sobrenome</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#C5A059]" />
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-[#FDFBF7] dark:bg-[#2A2A2A] text-gray-900 dark:text-white border border-[#C5A059]/50 dark:border-[#C5A059]/20 rounded-xl py-3 pl-12 pr-4 font-montserrat focus:outline-none focus:ring-2 focus:ring-[#8B0000] focus:border-transparent transition-all placeholder-gray-400 dark:placeholder-gray-600"
                  placeholder="Seu sobrenome"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !firstName || !lastName}
              className="w-full bg-gradient-to-r from-[#8B0000] to-[#600018] text-white font-cinzel font-bold py-4 rounded-xl shadow-lg mt-6 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Entrar no App <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <p className="text-center font-cormorant text-sm text-[#1a0f0f]/40 dark:text-white/40 mt-6 italic">
            "Lâmpada para os meus pés é a tua palavra..." Salmos 119:105
          </p>
        </motion.div>
      </div>
    </div>
  );
}
