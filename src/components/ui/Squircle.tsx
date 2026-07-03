import React, { HTMLAttributes } from 'react';
import { useSquircle } from '../../hooks/useSquircle';

export interface SquircleProps extends React.HTMLAttributes<HTMLElement> {
  cornerRadius?: number;
  cornerSmoothing?: number;
  borderClassName?: string;
  borderWidth?: number;
  as?: React.ElementType;
}

export function Squircle({
  cornerRadius = 16,
  cornerSmoothing = 1,
  borderClassName,
  borderWidth = 0,
  className = '',
  children,
  style,
  as: Component = 'div',
  ...props
}: SquircleProps) {
  const { ref, clipPath, svgPath } = useSquircle<HTMLElement>({ 
    cornerRadius, 
    cornerSmoothing 
  });

  return (
    <Component
  ref={ref as any}
  style={style} 
  className={`relative overflow-visible`}
  {...props}
>
  <div 
    className={`relative z-10 w-full h-full no-clip-transition ${className}`}
    style={{ clipPath }} 
  >
    {children}
  </div>

  {/* SVG Border overlay */}
  {borderWidth > 0 && svgPath && (
    <svg 
      className="absolute inset-0 pointer-events-none w-full h-full z-20 overflow-visible no-clip-transition" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        d={svgPath} 
        fill="none" 
        stroke="currentColor" 
        strokeWidth={borderWidth} 
        className={borderClassName} 
      />
    </svg>
  )}
</Component>
  );
}
