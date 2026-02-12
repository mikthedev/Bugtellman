'use client';

import { useEffect, useState } from 'react';

interface LoadingBarProps {
  isActive: boolean;
  message?: string;
}

export function LoadingBar({ isActive, message = 'Analyzing...' }: LoadingBarProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      return;
    }
    setProgress(5);
    const interval = setInterval(() => {
      setProgress(p => (p >= 90 ? p : p + Math.random() * 8 + 2));
    }, 400);
    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="mt-4 space-y-2">
      <div className="flex justify-between text-xs text-zinc-500">
        <span className="animate-pulse-soft">{message}</span>
        <span className="tabular-nums font-medium">{Math.round(progress)}%</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-zinc-800/80 border border-zinc-700/60">
        <div
          className="h-full rounded-full bg-[#CAF76F] transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
