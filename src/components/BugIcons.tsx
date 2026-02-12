'use client';

import { Bug } from 'lucide-react';
import { Icon } from 'lucide-react';
import { beetleScarab, bee, butterfly } from '@lucide/lab';

const accent = '#CAF76F';
const dark = '#52525b'; // zinc-600 for bright mode icons

/** Lucide Bug - classic beetle/insect icon from Lucide (used in dev tools) */
export function BugIcon({ className = 'h-8 w-8', color }: { className?: string; color?: string }) {
  return <Bug className={className} stroke={color ?? accent} />;
}

/** Lucide Lab Beetle Scarab */
export function BeetleIcon({ className = 'h-8 w-8', color }: { className?: string; color?: string }) {
  return <Icon iconNode={beetleScarab} className={className} color={color ?? accent} />;
}

/** Lucide Lab Bee */
export function BeeIcon({ className = 'h-8 w-8', color }: { className?: string; color?: string }) {
  return <Icon iconNode={bee} className={className} color={color ?? accent} />;
}

/** Lucide Lab Butterfly */
export function ButterflyIcon({ className = 'h-8 w-8', color }: { className?: string; color?: string }) {
  return <Icon iconNode={butterfly} className={className} color={color ?? accent} />;
}

/** Alias - LadybugIcon uses Bug */
export function LadybugIcon({ className = 'h-8 w-8', accent: useAccent = true, color }: { className?: string; accent?: boolean; color?: string }) {
  return <Bug className={className} stroke={color ?? (useAccent ? accent : dark)} />;
}

/** Alias - AntIcon uses Bug */
export function AntIcon({ className = 'h-6 w-6', accent: useAccent = true }: { className?: string; accent?: boolean }) {
  return <Bug className={className} stroke={useAccent ? accent : dark} />;
}
