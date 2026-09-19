import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface TamperingDetectedBadgeProps {
  visible: boolean;
  className?: string;
}

export const TamperingDetectedBadge: React.FC<TamperingDetectedBadgeProps> = ({ visible, className = '' }) => {
  if (!visible) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-red-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm animate-pulse ${className}`}
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      <span>Tampering Detected</span>
    </span>
  );
};

export default TamperingDetectedBadge;
