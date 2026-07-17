import React, { useState, useEffect, useRef } from 'react';
import { BotSparkleColor, CloudRegular } from '@fluentui/react-icons';

interface CompanyLogoProps {
  providerId: string;
  size?: number;
  className?: string;
  fallbackIcon?: 'bot' | 'cloud';
}

const PROVIDER_DOMAINS: Record<string, string> = {
  'openai-api': 'openai.com',
  'gemini-api': 'google.com',
  'anthropic-api': 'anthropic.com',
  'deepseek-api': 'deepseek.com',
  'mistral-api': 'mistral.ai',
  'groq-api': 'groq.com',
  'xai-api': 'x.ai',
  'openrouter-api': 'openrouter.ai',
  'nvidia-api': 'nvidia.com',
};

export function CompanyLogo({ providerId, size = 24, className = '', fallbackIcon = 'bot' }: CompanyLogoProps) {
  const [hasError, setHasError] = useState(false);
  const [analysis, setAnalysis] = useState<{ isGrayscale: boolean; isDark: boolean; isLight: boolean } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const domain = PROVIDER_DOMAINS[providerId];

  // Monitor system/app dark mode
  const [isDarkMode, setIsDarkMode] = useState(() => 
    document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const handleImageLoad = () => {
    const img = imgRef.current;
    if (!img) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw image
      ctx.drawImage(img, 0, 0, 16, 16);
      const imgData = ctx.getImageData(0, 0, 16, 16).data;

      let totalR = 0, totalG = 0, totalB = 0;
      let grayDiff = 0;
      let count = 0;

      for (let i = 0; i < imgData.length; i += 4) {
        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];
        const a = imgData[i + 3];

        if (a < 30) continue; // Skip transparency

        totalR += r;
        totalG += g;
        totalB += b;
        grayDiff += Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
        count++;
      }

      if (count === 0) return;

      const avgR = totalR / count;
      const avgG = totalG / count;
      const avgB = totalB / count;
      const brightness = (avgR * 299 + avgG * 587 + avgB * 114) / 1000;
      const avgGrayDiff = grayDiff / (count * 3);

      // Low saturation = grayscale-ish
      const isGrayscale = avgGrayDiff < 25; 
      const isDark = brightness < 110;
      const isLight = brightness > 160;

      setAnalysis({ isGrayscale, isDark, isLight });
    } catch (e) {
      console.warn("Failed canvas analysis (CORS/security context), using fallback defaults:", e);
      // Fail-soft: assume some known dark domains need inverting in dark mode
      const darkDomains = ['openai.com', 'anthropic.com', 'mistral.ai', 'groq-api', 'x.ai'];
      const isKnownDark = darkDomains.includes(domain);
      setAnalysis({
        isGrayscale: isKnownDark,
        isDark: isKnownDark,
        isLight: false
      });
    }
  };

  const shouldInvert = analysis?.isGrayscale && (
    (isDarkMode && analysis.isDark) ||
    (!isDarkMode && analysis.isLight)
  );

  if (!domain || hasError) {
    return fallbackIcon === 'cloud' 
      ? <CloudRegular fontSize={size} className={className} />
      : <BotSparkleColor fontSize={size} className={className} />;
  }

  return (
    <img 
      ref={imgRef}
      src={`https://img.logo.dev/${domain}?token=pk_KuYW7hXGSm2zXMfa-0f-Ew&size=${size * 2}&format=png`} 
      alt={providerId}
      crossOrigin="anonymous"
      onLoad={handleImageLoad}
      style={{ 
        width: size, 
        height: size, 
        minWidth: size, 
        minHeight: size,
        filter: shouldInvert ? 'invert(1)' : 'none'
      }}
      className={`object-contain rounded-sm ${className}`}
      onError={() => setHasError(true)}
    />
  );
}
