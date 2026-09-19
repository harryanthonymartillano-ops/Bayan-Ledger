import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, ExternalLink, FileText, X } from 'lucide-react';

export type MediaLightboxItem = {
  type: 'image' | 'document';
  url: string;
  title: string;
  fileFormat?: string;
};

type MediaLightboxProps = {
  items: MediaLightboxItem[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

export const MediaLightbox: React.FC<MediaLightboxProps> = ({ items, index, onClose, onIndexChange }) => {
  const activeItem = items[index];
  const hasManyItems = items.length > 1;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && hasManyItems) onIndexChange((index - 1 + items.length) % items.length);
      if (event.key === 'ArrowRight' && hasManyItems) onIndexChange((index + 1) % items.length);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [hasManyItems, index, items.length, onClose, onIndexChange]);

  if (!activeItem) return null;

  const goPrevious = () => onIndexChange((index - 1 + items.length) % items.length);
  const goNext = () => onIndexChange((index + 1) % items.length);
  const isExternalUrl = /^https?:\/\//i.test(activeItem.url) || activeItem.url.startsWith('/') || activeItem.url.startsWith('blob:') || activeItem.url.startsWith('data:');
  const isPreviewableDocument =
    activeItem.type === 'document' &&
    isExternalUrl &&
    (
      activeItem.fileFormat?.toUpperCase() === 'PDF' ||
      activeItem.url.toLowerCase().includes('.pdf') ||
      activeItem.url.startsWith('data:application/pdf')
    );

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-5 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
        aria-label="Close preview"
      >
        <X className="h-7 w-7" />
      </button>

      {hasManyItems && (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              goPrevious();
            }}
            className="absolute left-5 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
            aria-label="Previous item"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              goNext();
            }}
            className="absolute right-5 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
            aria-label="Next item"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        </>
      )}

      <div className="flex h-full flex-col items-center justify-center px-4 py-16" onClick={(event) => event.stopPropagation()}>
        <div className="relative flex min-h-0 w-full max-w-5xl flex-1 items-center justify-center">
          {activeItem.type === 'image' ? (
            <img
              src={activeItem.url}
              alt={activeItem.title}
              className="max-h-[78vh] max-w-full rounded-lg object-contain shadow-2xl"
            />
          ) : isPreviewableDocument ? (
            <div className="h-[78vh] w-full overflow-hidden rounded-lg bg-white shadow-2xl">
              <iframe src={activeItem.url} title={activeItem.title} className="h-full w-full bg-white" />
            </div>
          ) : (
            <div className="flex min-h-[420px] w-full max-w-2xl flex-col items-center justify-center rounded-lg bg-white p-8 text-center shadow-2xl">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <FileText className="h-10 w-10" />
              </div>
              <h2 className="mt-5 max-w-xl text-2xl font-bold text-slate-950">{activeItem.title}</h2>
              <p className="mt-2 text-sm text-slate-500">
                This file cannot be previewed inside the gallery. It may be a stored hash reference, a missing file URL, or a non-PDF document.
              </p>
              <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Stored reference</p>
                <p className="mt-1 max-w-xl break-all font-mono text-xs text-slate-700">{activeItem.url || 'No file URL recorded'}</p>
              </div>
              {isExternalUrl && (
                <a
                  href={activeItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-bold text-white transition-colors hover:bg-blue-700"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open file
                </a>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 w-full max-w-5xl">
          <div className="mb-3 text-center">
            <p className="truncate text-sm font-semibold text-white">{activeItem.title}</p>
            <p className="text-xs text-white/70">{index + 1} / {items.length}</p>
          </div>

          {hasManyItems && (
            <div className="mx-auto flex max-w-4xl items-center justify-center gap-2 overflow-x-auto px-2 pb-1">
              {items.map((item, itemIndex) => (
                <button
                  key={`${item.url}-${itemIndex}`}
                  type="button"
                  onClick={() => onIndexChange(itemIndex)}
                  className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                    itemIndex === index ? 'border-blue-500 opacity-100' : 'border-transparent opacity-60 hover:opacity-90'
                  }`}
                  aria-label={`Open ${item.title}`}
                >
                  {item.type === 'image' ? (
                    <img src={item.url} alt={item.title} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-white/15 text-white">
                      <FileText className="h-6 w-6" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
