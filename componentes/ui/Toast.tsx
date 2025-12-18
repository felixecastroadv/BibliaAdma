
import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
  const isError = type === 'error' || message.toLowerCase().includes('erro');
  const bgColor = isError ? 'bg-[#ff3b30]' : 'bg-green-600';
  
  return (
    <div className="fixed bottom-24 right-4 left-4 flex justify-end z-[9999] pointer-events-none">
      <motion.div 
        initial={{ opacity: 0, y: 50, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className={`${bgColor} text-white p-4 pr-12 rounded-[2rem] shadow-2xl pointer-events-auto min-w-[200px] max-w-[90%] relative`}
      >
        <p className="font-bold text-sm leading-tight">
          {isError ? `Erro: ${message}` : message}
        </p>
        <button 
          onClick={onClose} 
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-black/10 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </motion.div>
    </div>
  );
}
