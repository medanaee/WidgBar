import React, { createContext, useContext, useState, ReactNode } from 'react';

type Rect = { width: number; height: number; x: number; y: number } | null;

interface CutoutContextType {
  setCutoutRect: (rect: Rect) => void;
}

const CutoutContext = createContext<CutoutContextType | null>(null);

export function useCutout() {
  const context = useContext(CutoutContext);
  if (!context) {
    throw new Error('useCutout must be used within a CutoutProvider');
  }
  return context;
}

export function CutoutProvider({ children }: { children: ReactNode }) {
  const [rect, setCutoutRect] = useState<Rect>(null);

  let maskStyle: React.CSSProperties = {
    WebkitMaskImage: 'none',
    maskImage: 'none',
  };
  
  if (rect) {
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const svgMask = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${screenW}" height="${screenH}">
        <mask id="hole">
          <rect width="100%" height="100%" fill="white" />
          <rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="12" fill="black" />
        </mask>
        <rect width="100%" height="100%" fill="white" mask="url(#hole)" />
      </svg>
    `;
    const encodedSvg = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMask)}")`;
    maskStyle = {
      WebkitMaskImage: encodedSvg,
      maskImage: encodedSvg,
      WebkitMaskSize: '100% 100%',
      maskSize: '100% 100%',
    };
  }

  const contextValue = React.useMemo(() => ({ setCutoutRect }), []);

  return (
    <CutoutContext.Provider value={contextValue}>
      <div className="w-full h-screen" style={maskStyle}>
        {children}
      </div>
      {/* Portal root for all cutout modals, sibling to the masked container */}
      <div id="cutout-portal-root" className="fixed inset-0 pointer-events-none z-[100]" />
    </CutoutContext.Provider>
  );
}
