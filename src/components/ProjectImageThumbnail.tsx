import React, { useState, useEffect } from 'react';
import { ImagePlus } from 'lucide-react';

interface ProjectImageThumbnailProps {
  src: string;
  alt: string;
  className?: string;
  fallbackHeight?: string;
  fallbackLabel?: string;
}

export const ProjectImageThumbnail: React.FC<ProjectImageThumbnailProps> = ({
  src,
  alt,
  className = 'h-28 w-full object-cover',
  fallbackHeight = 'h-28',
  fallbackLabel,
}) => {
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
  }, [src]);

  if (error || !src) {
    return (
      <div className={`flex ${fallbackHeight} w-full flex-col items-center justify-center bg-slate-100 dark:bg-slate-800/80 p-3 text-center text-slate-400 dark:text-slate-500`}>
        <ImagePlus className="mb-1 h-6 w-6 text-slate-400 dark:text-slate-500" />
        <span className="line-clamp-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setError(true)}
    />
  );
};
