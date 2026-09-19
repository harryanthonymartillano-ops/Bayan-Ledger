import React, { useEffect, useState } from 'react';
import { BellRing, CheckCheck, CircleAlert, CircleSlash, TriangleAlert, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type FlashToastVariant = 'neutral' | 'info' | 'success' | 'warning' | 'error';

type FlashToastInput = {
  title?: string;
  description: string;
  variant?: FlashToastVariant;
  duration?: number;
};

type FlashToastRecord = {
  id: string;
  title: string;
  description: string;
  variant: FlashToastVariant;
  duration: number;
};

type FlashToastListener = (toasts: FlashToastRecord[]) => void;

const listeners = new Set<FlashToastListener>();
let toastQueue: FlashToastRecord[] = [];

const DEFAULT_TITLES: Record<FlashToastVariant, string> = {
  neutral: 'Notice',
  info: 'Information',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
};

const DEFAULT_DURATIONS: Record<FlashToastVariant, number> = {
  neutral: 4500,
  info: 5000,
  success: 4500,
  warning: 6000,
  error: 7000,
};

const VARIANT_STYLES: Record<
  FlashToastVariant,
  {
    container: string;
    iconWrap: string;
    closeButton: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  neutral: {
    container: 'border-slate-200/70 bg-slate-100/95 text-slate-900',
    iconWrap: 'bg-white text-slate-500 ring-1 ring-slate-200',
    closeButton: 'text-slate-400 hover:bg-white hover:text-slate-700',
    icon: CircleAlert,
  },
  info: {
    container: 'border-blue-100 bg-blue-50/95 text-slate-900',
    iconWrap: 'bg-white text-blue-500 ring-1 ring-blue-100',
    closeButton: 'text-slate-500 hover:bg-blue-100 hover:text-slate-900',
    icon: BellRing,
  },
  success: {
    container: 'border-emerald-100 bg-emerald-50/95 text-slate-900',
    iconWrap: 'bg-white text-emerald-500 ring-1 ring-emerald-100',
    closeButton: 'text-slate-400 hover:bg-emerald-100 hover:text-emerald-700',
    icon: CheckCheck,
  },
  warning: {
    container: 'border-amber-100 bg-amber-50/95 text-slate-900',
    iconWrap: 'bg-white text-amber-500 ring-1 ring-amber-100',
    closeButton: 'text-slate-400 hover:bg-amber-100 hover:text-amber-700',
    icon: TriangleAlert,
  },
  error: {
    container: 'border-red-100 bg-red-50/95 text-slate-900',
    iconWrap: 'bg-white text-red-500 ring-1 ring-red-100',
    closeButton: 'text-slate-400 hover:bg-red-100 hover:text-red-700',
    icon: CircleSlash,
  },
};

const emit = () => {
  listeners.forEach((listener) => listener([...toastQueue]));
};

const subscribe = (listener: FlashToastListener) => {
  listeners.add(listener);
  listener([...toastQueue]);
  return () => {
    listeners.delete(listener);
  };
};

const dismiss = (id: string) => {
  toastQueue = toastQueue.filter((toast) => toast.id !== id);
  emit();
};

const inferVariantFromMessage = (message: string): FlashToastVariant => {
  const normalized = message.trim().toLowerCase();

  if (/(failed|error|unable|can't|cannot|blocked|mismatch|not found|unauthorized)/.test(normalized)) {
    return 'error';
  }

  if (/(success|successfully|approved|saved|submitted|processed|recorded|executed|verified|resolved|created)/.test(normalized)) {
    return 'success';
  }

  if (/(please|select|enter|switch|missing|required|must|thank you)/.test(normalized)) {
    return 'warning';
  }

  if (/(connecting|review|pending|notice|submitted to)/.test(normalized)) {
    return 'info';
  }

  return 'neutral';
};

const shortenWalletAddress = (value: string) => {
  if (!/^0x[a-fA-F0-9]{10,}$/.test(value)) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const compactToastText = (message: string) => {
  const compactedAddresses = message.replace(/0x[a-fA-F0-9]{10,}/g, shortenWalletAddress);
  const strippedTechnicalTail = compactedAddresses
    .replace(/\s*\(action=.*$/i, '')
    .replace(/\s*transaction=\{.*$/i, '')
    .replace(/\s*code=[A-Z0-9_:-]+.*$/i, '');
  const normalizedWhitespace = strippedTechnicalTail.replace(/\s+/g, ' ').trim();
  if (normalizedWhitespace.length <= 140) {
    return normalizedWhitespace;
  }
  return `${normalizedWhitespace.slice(0, 137).trimEnd()}...`;
};

const extractToastCopy = (message: string, variant: FlashToastVariant) => {
  const compactMessage = compactToastText(message);
  const lines = compactMessage
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 1 && lines[0].length <= 72) {
    return {
      title: lines[0],
      description: lines.slice(1).join(' '),
      variant,
    };
  }

  return {
    title: DEFAULT_TITLES[variant],
    description: compactMessage,
    variant,
  };
};

const show = ({ title, description, variant = 'neutral', duration }: FlashToastInput) => {
  const resolvedVariant = variant;
  const toast: FlashToastRecord = {
    id: `flash-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title: title || DEFAULT_TITLES[resolvedVariant],
    description,
    variant: resolvedVariant,
    duration: duration || DEFAULT_DURATIONS[resolvedVariant],
  };

  toastQueue = [toast, ...toastQueue].slice(0, 5);
  emit();

  window.setTimeout(() => dismiss(toast.id), toast.duration);
};

export const flashToast = {
  show,
  neutral: (title: string, description: string, duration?: number) => show({ title, description, variant: 'neutral', duration }),
  info: (title: string, description: string, duration?: number) => show({ title, description, variant: 'info', duration }),
  success: (title: string, description: string, duration?: number) => show({ title, description, variant: 'success', duration }),
  warning: (title: string, description: string, duration?: number) => show({ title, description, variant: 'warning', duration }),
  error: (title: string, description: string, duration?: number) => show({ title, description, variant: 'error', duration }),
  dismiss,
};

const showAlertToast = (message?: unknown) => {
  const text = typeof message === 'string' ? message : String(message ?? '');
  const variant = inferVariantFromMessage(text);
  const copy = extractToastCopy(text, variant);
  show(copy);
};

const FlashToastViewport = () => {
  const [toasts, setToasts] = useState<FlashToastRecord[]>([]);

  useEffect(() => subscribe(setToasts), []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-5 z-[99999] flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-2xl flex-col gap-3">
        {toasts.map((toast) => {
          const { container, iconWrap, closeButton, icon: Icon } = VARIANT_STYLES[toast.variant];

          return (
            <div
              key={toast.id}
              className={cn(
                'pointer-events-auto flex items-start gap-4 rounded-2xl border px-4 py-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm transition-all',
                container
              )}
            >
              <div className={cn('mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', iconWrap)}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold leading-6 text-slate-900">{toast.title}</div>
                <div className="whitespace-pre-line text-sm leading-5 text-slate-600">{toast.description}</div>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  dismiss(toast.id);
                }}
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                  closeButton
                )}
                aria-label="Dismiss notification"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const FlashToastProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    const originalAlert = window.alert.bind(window);

    window.alert = ((message?: unknown) => {
      showAlertToast(message);
    }) as typeof window.alert;

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  return (
    <>
      {children}
      <FlashToastViewport />
    </>
  );
};
