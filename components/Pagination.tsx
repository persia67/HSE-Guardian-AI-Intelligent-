import React from 'react';
import { ChevronLeft, ChevronRight } from './Icons';
import { theme } from '../theme';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange
}) => {
  const buttonStyle = (disabled: boolean) => ({
    padding: '6px',
    backgroundColor: theme.colors.border,
    color: theme.colors.textMuted,
    border: 'none',
    borderRadius: '4px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.3 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  });

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      backgroundColor: 'rgba(15, 23, 42, 0.5)',
      padding: '4px',
      borderRadius: '8px',
      border: `1px solid ${theme.colors.border}`
    }}>
      <button
        onClick={() => onPageChange(Math.max(0, currentPage - 1))}
        disabled={currentPage === 0}
        style={buttonStyle(currentPage === 0)}
      >
        <ChevronLeft size={16} />
      </button>
      
      <span style={{
        fontSize: '12px',
        fontWeight: 500,
        color: theme.colors.textMuted,
        minWidth: '4rem',
        textAlign: 'center'
      }}>
        Page {currentPage + 1} / {totalPages}
      </span>
      
      <button
        onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
        disabled={currentPage === totalPages - 1}
        style={buttonStyle(currentPage === totalPages - 1)}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
};
