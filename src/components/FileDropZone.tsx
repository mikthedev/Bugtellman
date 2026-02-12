'use client';

import { useCallback, useState } from 'react';

interface FileDropZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export function FileDropZone({ onFiles, disabled }: FileDropZoneProps) {
  const [isDrag, setIsDrag] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDrag(true);
  }, [disabled]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDrag(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    const webFiles = files.filter(f => /\.(html?|css|js)$/i.test(f.name));
    if (webFiles.length) onFiles(webFiles);
  }, [onFiles, disabled]);

  const handleLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDrag(false);
  }, []);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    const webFiles = files.filter(f => /\.(html?|css|js)$/i.test(f.name));
    if (webFiles.length) onFiles(webFiles);
    e.target.value = '';
  }, [onFiles]);

  return (
    <label
      onDragOver={handleDrag}
      onDragLeave={handleLeave}
      onDrop={handleDrop}
        className={`
        group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed py-14 transition-all duration-300
        ${isDrag 
          ? 'scale-[1.01] border-[#CAF76F]/60 bg-[#CAF76F]/5' 
          : 'border-zinc-600/60 bg-zinc-800/30 hover:border-[#CAF76F]/40 hover:bg-zinc-800/50'
        }
        ${disabled ? 'cursor-not-allowed opacity-50' : ''}
      `}
    >
      <input
        type="file"
        multiple
        accept=".html,.htm,.css,.js"
        onChange={handleInput}
        disabled={disabled}
        className="sr-only"
      />
      <div className={`absolute inset-0 bg-[#CAF76F]/5 opacity-0 transition-opacity duration-300 ${isDrag ? 'opacity-100' : 'group-hover:opacity-100'}`} />
      
      <div className={`relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-600/60 bg-zinc-800/80 transition-all ${isDrag ? 'scale-110 border-[#CAF76F]/50 bg-[#CAF76F]/20' : ''}`}>
        <svg className={`h-8 w-8 transition-colors duration-300 ${isDrag ? 'text-[#CAF76F]' : 'text-zinc-500 group-hover:text-zinc-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </div>
      <span className="relative z-10 mt-4 text-base font-medium text-zinc-400 transition-colors group-hover:text-zinc-300">
        Drop files or click to browse
      </span>
      <span className="relative z-10 mt-2 text-sm text-zinc-500">
        HTML, CSS, JS
      </span>
    </label>
  );
}
