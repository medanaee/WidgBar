import React, { useEffect, useRef, useState, useCallback } from 'react';
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

  // Freeze children snapshot when open so content NEVER changes or shifts during exit animation
  const activeChildrenRef = useRef<React.ReactNode>(children);
  if (isOpen && children) {
    activeChildrenRef.current = children;
  }

  const calculateRect = useCallback(() => {
    if (!popupRef.current) return;
    const el = popupRef.current;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const x = (window.innerWidth - width) / 2;
    const y = topOffset + (window.innerHeight - topOffset - height) / 2;
    setCutoutRect({ width, height, x, y });
  }, [topOffset, setCutoutRect]);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      
      // 1. Calculate & punch cutout hole FIRST
      const holeTimer = setTimeout(() => {
        calculateRect();
        // 2. Animate modal in right after hole is created
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      }, 30);

      return () => clearTimeout(holeTimer);
    } else if (shouldRender) {
      // 1. Remove cutout hole immediately on close
      setCutoutRect(null);
      // 2. Start smooth exit animation (scale-95, opacity-0, translate-y-2)
      setIsVisible(false);
      // 3. Unmount after animation completes
      const unmountTimer = setTimeout(() => {
        setShouldRender(false);
      }, 300);

      return () => clearTimeout(unmountTimer);
    }
  }, [isOpen, shouldRender, setCutoutRect, calculateRect]);

  useEffect(() => {
    return () => {
      setCutoutRect(null);
    };
  }, [setCutoutRect]);

  useEffect(() => {
    if (!isOpen || !shouldRender) return;

    window.addEventListener('resize', calculateRect);
    return () => {
      window.removeEventListener('resize', calculateRect);
    };
  }, [isOpen, shouldRender, calculateRect]);

  if (!shouldRender) return null;

  const portalRoot = document.getElementById('cutout-portal-root');
  if (!portalRoot) return null;

  return createPortal(
    <div 
        className={`fixed left-0 right-0 bottom-0 z-[100] flex items-center justify-center pointer-events-none transition-opacity duration-300 ease-in-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        style={{ top: topOffset }}
    >
      <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />
      <div 
        ref={popupRef}
        className={`relative z-10 pointer-events-auto transition-all duration-300 ease-out transform ${isVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-2'} ${contentClassName}`}
      >
        {activeChildrenRef.current}
      </div>
    </div>,
    portalRoot
  );
}
