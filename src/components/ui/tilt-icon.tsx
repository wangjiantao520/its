"use client";

import { useRef, useState } from "react";

interface TiltIconProps {
  children: React.ReactNode;
  className?: string;
  max?: number; // 最大倾斜角度
  perspective?: number;
  scale?: number;
}

export function TiltIcon({
  children,
  className = "",
  max = 12,
  perspective = 500,
  scale = 1.05,
}: TiltIconProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -max;
    const rotateY = ((x - centerX) / centerX) * max;

    setStyle({
      transform: `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`,
      transition: "transform 150ms ease-out",
    });
  };

  const handleMouseLeave = () => {
    setStyle({
      transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale(1)`,
      transition: "transform 400ms cubic-bezier(0.03, 0.98, 0.52, 0.99)",
    });
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        transformStyle: "preserve-3d",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
}
