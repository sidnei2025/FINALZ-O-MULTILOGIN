
import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import { PopupConfig } from '../types';

interface AnnouncementPopupProps {
  config: PopupConfig;
  onClose: () => void;
}

export const AnnouncementPopup: React.FC<AnnouncementPopupProps> = ({ config, onClose }) => {
  // REMOVIDO: if (!config.enabled) return null; 
  // O controle de exibição deve ser feito pelo pai (showAnnouncement) para permitir o Preview.

  // Tamanhos
  const sizeClasses = {
    sm: 'max-w-md h-auto',
    md: 'max-w-2xl h-auto',
    lg: 'max-w-4xl h-auto',
    fullscreen: 'w-[95vw] h-[90vh]'
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
      <div className={`relative ${sizeClasses[config.size]} w-full bg-[#141414] border border-purple-500/30 rounded-2xl shadow-[0_0_50px_rgba(168,85,247,0.3)] overflow-hidden flex flex-col animate-scale-up`}>
        
        {/* Botão Fechar - Z-Index Aumentado */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 z-[100] p-2 bg-black/60 hover:bg-red-600 rounded-full text-white backdrop-blur-md border border-white/20 transition-all hover:scale-110 shadow-lg cursor-pointer"
          title="Fechar Aviso"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Conteúdo */}
        <div className="w-full h-full flex flex-col relative bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f]">
          
          <div className="flex-1 relative flex items-center justify-center overflow-hidden min-h-[300px]">
             {config.type === 'image' && config.contentUrl && (
                <img 
                  src={config.contentUrl} 
                  alt="Aviso" 
                  className="w-full h-full object-contain max-h-[80vh]"
                />
             )}

             {config.type === 'video' && config.contentUrl && (
                <video 
                  src={config.contentUrl} 
                  className="w-full h-full object-contain max-h-[80vh]"
                  controls
                  autoPlay
                  muted 
                />
             )}

             {config.type === 'text' && (
                <div className="p-12 w-full h-full flex flex-col items-center justify-center overflow-y-auto custom-scrollbar">
                   {/* Fundo decorativo sutil */}
                   <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/10 via-transparent to-transparent pointer-events-none"></div>
                   
                   <p 
                    style={{ 
                      fontFamily: config.textStyle.fontFamily,
                      fontSize: `${config.textStyle.fontSize}rem`,
                      textAlign: config.textStyle.textAlign,
                      lineHeight: 1.4,
                      whiteSpace: 'pre-wrap',
                      background: `linear-gradient(${config.textStyle.gradientDirection}, ${config.textStyle.gradientFrom}, ${config.textStyle.gradientTo})`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      color: 'transparent' // Fallback
                    }}
                    className="relative z-10 drop-shadow-2xl font-bold"
                   >
                     {config.textContent || "Pré-visualização do texto aparecerá aqui."}
                   </p>
                </div>
             )}
          </div>

          {/* Área do Botão de Ação (CTA) */}
          {config.actionUrl && config.actionText && (
             <div className="p-6 bg-[#0f0f0f] border-t border-gray-800 flex justify-center z-20">
                <a 
                  href={config.actionUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-lg shadow-lg shadow-purple-900/50 transform hover:scale-105 transition-all flex items-center gap-2"
                >
                   {config.actionText} <ExternalLink className="w-4 h-4" />
                </a>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
