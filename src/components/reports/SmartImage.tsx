'use client';

import React, { useState, useCallback, memo } from 'react';

interface SmartImageProps {
  src: string;
  alt?: string;
  className?: string;
  /** Portrait threshold ratio (height/width). Default: 1.2 — if image ratio >= this, treated as portrait */
  portraitThreshold?: number;
  /** Callback when orientation is detected */
  onOrientationDetected?: (isPortrait: boolean) => void;
}

/**
 * SmartImage — detects photo orientation and adapts the rendering:
 * - Landscape photos: `object-cover` (fills container, may crop edges)
 * - Portrait/square photos: `object-contain` (shows full photo, no crop)
 *
 * Drops-in as a replacement for <img> — same size, same position.
 * The parent container stays the SAME SIZE always — grid pattern is never broken.
 */
const SmartImage = memo(function SmartImage({
  src,
  alt = '',
  className = '',
  portraitThreshold = 1.2,
  onOrientationDetected,
}: SmartImageProps) {
  const [isPortrait, setIsPortrait] = useState<boolean | null>(null);

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      const ratio = img.naturalHeight / img.naturalWidth;
      const portrait = ratio >= portraitThreshold;
      setIsPortrait(portrait);
      onOrientationDetected?.(portrait);
    },
    [portraitThreshold, onOrientationDetected]
  );

  // Default to object-cover (landscape behavior) until we detect orientation
  const objectFit = isPortrait === true ? 'object-contain' : 'object-cover';

  return (
    <img
      src={src}
      alt={alt}
      className={`${className} ${objectFit}`}
      onLoad={handleLoad}
    />
  );
});

export default SmartImage;