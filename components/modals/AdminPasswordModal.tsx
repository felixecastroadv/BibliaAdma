import React, { useState } from 'react';
export default function AdminPasswordModal({ isOpen, onClose, onSuccess }: any) {
  const [pass, setPass] = useState('');
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white dark:bg-dark-card p-6 rounded-2xl w-full max-w-sm">
        <h2 className="font-cinzel text-xl mb-4">Acesso Admin</h2>
        <input type="password" value={pass} onChange={e => setPass(e.target.value)} className="w-full p-3 border rounded mb-4 dark:bg-gray-800"/>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2">Cancelar</button>
          <button onClick={() => pass === 'LoloikiJ10@@' ? onSuccess() : alert('Senha incorreta')} className="flex-1 py-2 bg-primary text-white rounded">Entrar</button>
        </div>
      </div>
    </div>
  );
}