import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ 
  currentPage, 
  totalItems, 
  itemsPerPage, 
  onPageChange 
}) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  if (totalPages <= 1) return null;

  const pages = [];
  const maxVisiblePages = 7;
  
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-between px-10 py-6 border-t border-gray-800/50 bg-black/20">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span className="font-bold text-white">{totalItems}</span>
        <span>registros no total</span>
        <span className="mx-2">•</span>
        <span>Página</span>
        <span className="font-bold text-purple-400">{currentPage}</span>
        <span>de</span>
        <span className="font-bold text-purple-400">{totalPages}</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Primeira página */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className={`p-2 rounded-lg border transition-all ${
            currentPage === 1
              ? 'bg-gray-800/50 border-gray-800 text-gray-600 cursor-not-allowed'
              : 'bg-black/40 border-gray-700 text-gray-400 hover:bg-purple-600 hover:border-purple-500 hover:text-white'
          }`}
          title="Primeira página"
        >
          <ChevronsLeft size={16} />
        </button>

        {/* Página anterior */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`p-2 rounded-lg border transition-all ${
            currentPage === 1
              ? 'bg-gray-800/50 border-gray-800 text-gray-600 cursor-not-allowed'
              : 'bg-black/40 border-gray-700 text-gray-400 hover:bg-purple-600 hover:border-purple-500 hover:text-white'
          }`}
          title="Página anterior"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Números das páginas */}
        <div className="flex items-center gap-1">
          {startPage > 1 && (
            <>
              <button
                onClick={() => onPageChange(1)}
                className="w-10 h-10 rounded-lg border border-gray-700 bg-black/40 text-gray-400 hover:bg-purple-600 hover:border-purple-500 hover:text-white transition-all text-sm font-bold"
              >
                1
              </button>
              {startPage > 2 && (
                <span className="px-2 text-gray-600">...</span>
              )}
            </>
          )}

          {pages.map(page => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`w-10 h-10 rounded-lg border transition-all text-sm font-bold ${
                page === currentPage
                  ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/50'
                  : 'bg-black/40 border-gray-700 text-gray-400 hover:bg-purple-600 hover:border-purple-500 hover:text-white'
              }`}
            >
              {page}
            </button>
          ))}

          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && (
                <span className="px-2 text-gray-600">...</span>
              )}
              <button
                onClick={() => onPageChange(totalPages)}
                className="w-10 h-10 rounded-lg border border-gray-700 bg-black/40 text-gray-400 hover:bg-purple-600 hover:border-purple-500 hover:text-white transition-all text-sm font-bold"
              >
                {totalPages}
              </button>
            </>
          )}
        </div>

        {/* Próxima página */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`p-2 rounded-lg border transition-all ${
            currentPage === totalPages
              ? 'bg-gray-800/50 border-gray-800 text-gray-600 cursor-not-allowed'
              : 'bg-black/40 border-gray-700 text-gray-400 hover:bg-purple-600 hover:border-purple-500 hover:text-white'
          }`}
          title="Próxima página"
        >
          <ChevronRight size={16} />
        </button>

        {/* Última página */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className={`p-2 rounded-lg border transition-all ${
            currentPage === totalPages
              ? 'bg-gray-800/50 border-gray-800 text-gray-600 cursor-not-allowed'
              : 'bg-black/40 border-gray-700 text-gray-400 hover:bg-purple-600 hover:border-purple-500 hover:text-white'
          }`}
          title="Última página"
        >
          <ChevronsRight size={16} />
        </button>

        {/* Seletor de itens por página */}
        <select
          value={itemsPerPage}
          onChange={(e) => onPageChange(1)} // Reset para página 1 ao mudar items
          className="ml-4 px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-400 outline-none hover:border-purple-500 transition-colors cursor-pointer"
        >
          <option value={25}>25 por página</option>
          <option value={50}>50 por página</option>
          <option value={100}>100 por página</option>
        </select>
      </div>
    </div>
  );
};
