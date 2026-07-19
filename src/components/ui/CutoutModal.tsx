import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCutout } from './CutoutProvider';

interface CutoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  contentClassName?: string;
  topOffset?: number;
}

export function CutoutModal({ isOpen, onClose, children, contentClassName = "", topOffset = 30 }: CutoutModalProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const { setCutoutRect } = useCutout();
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
    } else if (shouldRender) {
      // Drop the hole immediately; modal can finish its exit animation after
      setCutoutRect(null);
      setIsVisible(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, shouldRender, setCutoutRect]);

  useEffect(() => {
    return () => {
      setCutoutRect(null);
    };
  }, [setCutoutRect]);

  useEffect(() => {
    // Only punch the hole while open — never during the close animation
    if (!isOpen || !shouldRender) {
      if (!isOpen) setCutoutRect(null);
      return;
    }

    const calculateRect = () => {
      if (!popupRef.current) return;
      const el = popupRef.current;
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      // Since the wrapper is 'fixed left-0 right-0 bottom-0 flex items-center justify-center'
      // the final position at scale-100 will be exactly in the center of the available space.
      const x = (window.innerWidth - width) / 2;
      const y = topOffset + (window.innerHeight - topOffset - height) / 2;

      setCutoutRect({ width, height, x, y });
    };

    // Short delay to let the DOM paint the element before measuring
    const timer = setTimeout(calculateRect, 10);

    window.addEventListener('resize', calculateRect);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculateRect);
    };
  }, [isOpen, shouldRender, topOffset, setCutoutRect]);

  if (!shouldRender) return null;

  const portalRoot = document.getElementById('cutout-portal-root');
  if (!portalRoot) return null;

  return createPortal(
    <div 
        className={`fixed left-0 right-0 bottom-0 z-[100] flex items-center justify-center pointer-events-none transition-opacity duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        style={{ top: topOffset }}
    >
      <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />
      <div 
        ref={popupRef}
        className={`relative z-10 pointer-events-auto transition-all duration-200 ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'} ${contentClassName}`}
      >
        {children}
      </div>
    </div>,
    portalRoot
  );
}
