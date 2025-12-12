import React from 'react';
import { ChevronLeft, Mail } from 'lucide-react';

export default function MessagesView({ onBack }: any) {
  return (
    <div className="min-h-screen bg-[#F5F5DC] dark:bg-dark-bg transition-colors duration-300">
        <div className="bg-[#8B0000] text-white p-4 flex items-center gap-4 sticky top-0 shadow-lg">
            <button onClick={onBack}><ChevronLeft /></button>
            <h1 className="font-cinzel font-bold">Mensagens</h1>
        </div>
        <div className="p-10 text-center opacity-50 dark:text-white">
            <Mail className="w-16 h-16 mx-auto mb-4" />
            <p>Caixa de entrada vazia.</p>
        </div>
    </div>
  );
}