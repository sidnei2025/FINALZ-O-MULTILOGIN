
import React from 'react';
import { X } from 'lucide-react';

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }> = ({ 
  children, 
  variant = 'primary', 
  className = '', 
  ...props 
}) => {
  const baseStyle = "px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all duration-300 flex items-center justify-center gap-3 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed select-none";
  
  const variants = {
    primary: "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-xl shadow-purple-900/30 border border-white/10 active:scale-95",
    secondary: "bg-[#1a1a1a] hover:bg-[#252525] text-gray-300 border border-gray-800 shadow-lg active:scale-95",
    danger: "bg-red-900/30 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 shadow-xl active:scale-95",
    ghost: "bg-transparent hover:bg-white/5 text-gray-500 hover:text-white"
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, className = '', ...props }) => (
  <div className="flex flex-col gap-2 w-full">
    {label && <label className="text-[10px] font-black uppercase text-gray-600 tracking-widest ml-1">{label}</label>}
    <input 
      className={`bg-[#0d0d0d] border border-gray-800 rounded-2xl px-5 py-4 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all placeholder-gray-700 shadow-inner text-sm ${className}`}
      {...props}
    />
  </div>
);

export const Switch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">{label}</span>
    <button 
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-12 h-7 flex items-center rounded-full p-1 transition-all duration-500 ${checked ? 'bg-purple-600 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'bg-gray-800'}`}
    >
      <div className={`bg-white w-5 h-5 rounded-full shadow-lg transform transition-transform duration-500 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  </div>
);

export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode, size?: 'md' | 'lg' | 'xl' | 'full' }> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;
  
  const sizes = {
    md: 'max-w-xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-[95vw] h-[95vh]'
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md animate-fade-in">
      <div className={`${sizes[size]} w-full bg-[#0f0f0f] border border-gray-800 rounded-[40px] shadow-[0_50px_150px_rgba(0,0,0,1)] overflow-hidden flex flex-col max-h-full border-t border-t-white/5`}>
        <div className="flex items-center justify-between px-10 py-8 border-b border-gray-800 bg-white/5">
          <h2 className="text-2xl font-black text-white flex items-center gap-4 uppercase tracking-tighter">
            <span className="w-1 h-8 bg-purple-500 rounded-full"></span>
            {title}
          </h2>
          <button onClick={onClose} className="p-3 bg-white/5 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-lg text-gray-500">
            <X size={20} />
          </button>
        </div>
        <div className="p-10 overflow-y-auto custom-scrollbar flex-1 bg-gradient-to-b from-transparent to-black/20">
          {children}
        </div>
      </div>
    </div>
  );
};
