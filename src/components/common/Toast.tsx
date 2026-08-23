'use client';

import React, { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';

interface ToastProps {
  message: string | null;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, onClose, duration = 2000 }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  if (!message) return null;

  return (
    <div
      onClick={onClose}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[10000] cursor-pointer animate-fadeIn"
    >
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/95 text-white text-xs font-bold rounded-full shadow-xl border border-slate-700/80 backdrop-blur-md">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>{message}</span>
      </div>
    </div>
  );
}
