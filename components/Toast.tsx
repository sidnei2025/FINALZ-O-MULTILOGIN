
import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, X, Star, Info } from 'lucide-react';

interface ToastProps {
  title?: string;
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ title, message, type, onClose }) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const duration = 3000;
    const interval = 10;
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - step;
      });
    }, interval);

    // Backup forçado de fechamento
    const fallback = setTimeout(onClose, duration + 100);

    return () => {
      clearInterval(timer);
      clearTimeout(fallback);
    };
  }, [onClose]);

  const config = {
    success: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-900/90 border-green-500/50', bar: 'bg-green-500' },
    error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-900/90 border-red-500/50', bar: 'bg-red-500' },
    info: { icon: Info, color: 'text-purple-400', bg: 'bg-purple-900/90 border-purple-500/50', bar: 'bg-purple-500' }
  }[type];

  return (
    <div className="fixed top-6 right-6 z-[9999] animate-fade-in-right">
      <div className={`relative flex items-center gap-4 p-5 rounded-2xl border ${config.bg} backdrop-blur-xl shadow-2xl min-w-[320px] overflow-hidden`}>
        <div className={`p-2 rounded-full bg-white/10 ${config.color}`}>
          <config.icon size={20} />
        </div>
        <div className="flex-1 pr-6">
          <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-1">{title || (type === 'success' ? 'Sucesso' : type === 'error' ? 'Erro' : 'Aviso')}</h4>
          <p className="text-xs text-gray-200 font-medium">{message}</p>
        </div>
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white">
          <X size={14} />
        </button>
        {/* Barra de progresso visual */}
        <div className="absolute bottom-0 left-0 h-1 bg-white/10 w-full">
           <div className={`h-full ${config.bar} transition-all duration-75`} style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
};
