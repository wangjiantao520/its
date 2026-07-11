"use client";

import { useRef, useState, useCallback } from "react";

interface TiltOptions {
  max?: number; // 最大倾斜角度
  perspective?: number; // 透视距离
  scale?: number; // hover时缩放
  speed?: number; // 过渡速度(ms)
}

export function useTilt<T extends HTMLElement = HTMLDivElement>(
  options: TiltOptions = {}
) {
  const {
    max = 10,
    perspective = 1000,
    scale = 1.02,
    speed = 400,
  } = options;

  const ref = useRef<T>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<T>) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      // 计算鼠标相对于中心的位置（-1到1之间）
      const rotateX = ((y - centerY) / centerY) * -max;
      const rotateY = ((x - centerX) / centerX) * max;

      setStyle({
        transform: `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`,
        transition: `transform ${speed}ms cubic-bezier(0.03, 0.98, 0.52, 0.99)`,
      });
    },
    [max, perspective, scale, speed]
  );

  const handleMouseLeave = useCallback(() => {
    setStyle({
      transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale(1)`,
      transition: `transform ${speed + 200}ms cubic-bezier(0.03, 0.98, 0.52, 0.99)`,
    });
  }, [perspective, speed]);

  const handleMouseEnter = useCallback(() => {
    setStyle({
      transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale(${scale})`,
      transition: `transform ${speed}ms ease-out`,
    });
  }, [perspective, scale, speed]);

  return {
    ref,
    style,
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
    onMouseEnter: handleMouseEnter,
  };
}

// TiltCard组件的包装器
export function TiltCard({
  children,
  className = "",
  max = 6,
  perspective = 1000,
  scale = 1.02,
  speed = 400,
  glareOpacity = 0.15,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
  perspective?: number;
  scale?: number;
  speed?: number;
  glareOpacity?: number;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -max;
    const rotateY = ((x - centerX) / centerX) * max;

    setGlarePos({ x: (x / rect.width) * 100, y: (y / rect.height) * 100 });
    setStyle({
      transform: `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`,
      transition: `transform ${speed * 0.4}ms ease-out`,
    });
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setStyle({
      transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale(1)`,
      transition: `transform ${speed + 200}ms cubic-bezier(0.03, 0.98, 0.52, 0.99)`,
    });
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  return (
    <div
      ref={cardRef}
      className={`relative ${className}`}
      style={{
        ...style,
        transformStyle: "preserve-3d",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      onClick={onClick}
    >
      {children}
      {/* 高光层 */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
        style={{
          opacity: isHovering ? glareOpacity : 0,
          background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.2) 40%, transparent 70%)`,
          borderRadius: "inherit",
        }}
      />
    </div>
  );
}
