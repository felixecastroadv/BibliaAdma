
import React from 'react';
export default function DynamicModuleViewer({ onBack }: any) {
    return (
        <div className="p-6">
            <button onClick={onBack} className="mb-4">Voltar</button>
            <h1 className="text-2xl font-bold">Módulo Dinâmico (Placeholder)</h1>
        </div>
    );
}
