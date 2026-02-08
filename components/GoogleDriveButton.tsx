import React from 'react';
import { Loader2 } from 'lucide-react';

interface GoogleDriveButtonProps {
  onClick: () => void;
  isLoading: boolean;
  disabled?: boolean;
  variant?: 'default' | 'compact';
}

const GoogleDriveButton: React.FC<GoogleDriveButtonProps> = ({
  onClick,
  isLoading,
  disabled = false,
  variant = 'default',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-surface-border bg-surface hover:border-accent/30 hover:bg-surface text-text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-accent" />
          <span className="text-sm font-medium">Connecting...</span>
        </>
      ) : (
        <>
          <svg className="w-5 h-5" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
            <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H1.2c0 1.55.4 3.1 1.2 4.5l4.2 9.35z" fill="#0066DA"/>
            <path d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.5c-.8 1.4-1.2 2.95-1.2 4.5h27.5L43.65 25z" fill="#00AC47"/>
            <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L86.1 57c.8-1.4 1.2-2.95 1.2-4.5H59.85L67 66.85l6.55-13.35" fill="#EA4335"/>
            <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.85 0H34.45c-1.65 0-3.2.45-4.55 1.2L43.65 25z" fill="#00832D"/>
            <path d="M59.85 53H27.5l-13.75 23.8c1.35.8 2.9 1.2 4.55 1.2h50.3c1.65 0 3.2-.45 4.55-1.2L59.85 53z" fill="#2684FC"/>
            <path d="M73.4 26.5l-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.2 28h27.45c0-1.55-.4-3.1-1.2-4.5l-12.7-22z" fill="#FFBA00"/>
          </svg>
          <span className="text-sm font-medium">
            {variant === 'compact' ? 'Google Drive' : 'Import from Google Drive'}
          </span>
        </>
      )}
    </button>
  );
};

export default GoogleDriveButton;
