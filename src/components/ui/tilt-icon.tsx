"use client";

import { useRef, useState, useEffect } from "react";

interface TiltIconProps {
  children: React.ReactNode;
  className?: string;
  max?: number; // 最大倾斜角度（autoMax开启时为基础角度）
  perspective?: number;
  scale?: number;
  autoMax?: boolean; // 是否根据尺寸自动调整角度
  sizeThresholds?: { minSize: number; maxSize: number; max: number }[]; // 尺寸阈值
}

// 图标尺寸阈值（图标通常比卡片小，角度更大）
const ICON_SIZE_THRESHOLDS = [
  { minSize: 0, maxSize: 24, max: 8 },     // 小图标（<24px）：倾斜8度
  { minSize: 24, maxSize: 32, max: 12 },   // 中图标（24-32px）：倾斜12度
  { minSize: 32, maxSize: 48, max: 15 },   // 大图标（32-48px）：倾斜15度
  { minSize: 48, maxSize: 9999, max: 18 }, // 超大图标（>48px）：倾斜18度
];

function calculateMaxBySize(
  width: number, 
  height: number, 
  thresholds: { minSize: number; maxSize: number; max: number }[]
): number {
  const dominantSize = Math.max(width, height);
  for (const threshold of thresholds) {
    if (dominantSize >= threshold.minSize && dominantSize < threshold.maxSize) {
      return threshold.max;
    }
  }
  return 12;
}

export function TiltIcon({
  children,
  className = "",
  max = 12,
  perspective = 500,
  scale = 1.05,
  autoMax = true,
  sizeThresholds = ICON_SIZE_THRESHOLDS,
}: TiltIconProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [currentMax, setCurrentMax] = useState(max);

  // 测量图标尺寸，自动计算角度
  useEffect(() => {
    if (!autoMax || !ref.current) return;
    
    const measureSize = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const calculatedMax = calculateMaxBySize(rect.width, rect.height, sizeThresholds);
      setCurrentMax(calculatedMax);
    };

    const timer = setTimeout(measureSize, 0);
    const resizeObserver = new ResizeObserver(measureSize);
    resizeObserver.observe(ref.current);

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [autoMax, sizeThresholds]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const activeMax = autoMax ? currentMax : max;
    const rotateX = ((y - centerY) / centerY) * -activeMax;
    const rotateY = ((x - centerX) / centerX) * activeMax;

    setStyle({
      transform: `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`,
      transition: "transform 150ms ease-out",
    });
  };

  const handleMouseEnter = () => {
    if (autoMax && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const calculatedMax = calculateMaxBySize(rect.width, rect.height, sizeThresholds);
      setCurrentMax(calculatedMax);
    }
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
        willChange: "transform",
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
}
