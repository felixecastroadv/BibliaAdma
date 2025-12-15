
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
          
          <div className="text-center mb-10">
            <motion.div 
                initial={{ rotate: -5, scale: 0.9 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ duration: 0.8, type: "spring" }}
                className="w-24 h-24 bg-gradient-to-br from-[#8B0000] to-[#500000] rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-red-900/30"
            >
              <BookOpen className="w-12 h-12 text-[#F5F5DC]" />
            </motion.div>
            
            <h1 className="font-cinzel text-4xl font-bold text-[#1a0f0f] dark:text-white mb-2 tracking-tight">Bíblia ADMA</h1>
            <p className="font-cormorant text-[#1a0f0f]/70 dark:text-white/70 text-xl italic tracking-wide">Prof. Michel Felix</p>
            
            <div className="mt-6 flex flex-col items-center gap-1">
                <span className="px-3 py-1 rounded-full bg-[#8B0000]/5 dark:bg-[#C5A059]/10 border border-[#8B0000]/10 dark:border-[#C5A059]/20 font-montserrat text-[10px] font-bold text-[#8B0000] dark:text-[#C5A059] uppercase tracking-[0.2em]">
                    {CHURCH_NAME}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-montserrat font-medium mt-1">
                    Presidente: {PASTOR_PRESIDENT}
                </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading || !firstName || !lastName}
              className="w-full bg-gradient-to-r from-[#8B0000] to-[#600018] hover:to-[#800000] text-white font-cinzel font-bold py-4 rounded-2xl shadow-[0_10px_20px_-5px_rgba(139,0,0,0.3)] mt-8 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 tracking-wide"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Entrar no App <ArrowRight className="w-5 h-5" />
                </>
              )}
            </motion.button>
          </form>

          <div className="mt-8 text-center opacity-60">
             <p className="font-cormorant text-sm italic text-gray-600 dark:text-gray-400">
                "Lâmpada para os meus pés é a tua palavra..."
             </p>
             <p className="font-montserrat text-[10px] text-gray-400 mt-1">Salmos 119:105</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
