import { useState, useRef, useEffect } from 'react';
import { getSvgPath } from 'figma-squircle';

interface UseSquircleProps {
  cornerRadius?: number;
  cornerSmoothing?: number;
}

export function useSquircle<T extends HTMLElement = HTMLDivElement>({
  cornerRadius = 16,
  cornerSmoothing = 1,
}: UseSquircleProps = {}) {
  const [clipPath, setClipPath] = useState('');
  const [svgPath, setSvgPath] = useState('');
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;
    
    const element = ref.current;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = element.offsetWidth;
        const height = element.offsetHeight;
        
        if (width > 0 && height > 0) {
            const pathData = getSvgPath({
              width,
              height,
              cornerRadius,
              cornerSmoothing,
            });
            setSvgPath(pathData);
            setClipPath(`path('${pathData}')`);
        }
      }
    });
    
    observer.observe(element);
    
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    if (width > 0 && height > 0) {
      const pathData = getSvgPath({ width, height, cornerRadius, cornerSmoothing });
      setSvgPath(pathData);
      setClipPath(`path('${pathData}')`);
    }

    return () => observer.disconnect();
  }, [cornerRadius, cornerSmoothing]);

  return { ref, clipPath, svgPath };
}
