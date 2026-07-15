"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface TiltOptions {
  max?: number; // 最大倾斜角度（如果设置autoMax则为基础角度）
  perspective?: number; // 透视距离
  scale?: number; // hover时缩放
  speed?: number; // 过渡速度(ms)
  autoMax?: boolean; // 是否根据尺寸自动调整角度
  sizeThresholds?: { minSize: number; maxSize: number; max: number }[]; // 尺寸阈值配置
}

// 默认尺寸阈值配置：按卡片主导尺寸（宽高中较大值）分档
// 规则：卡片越大，倾斜角度越小（大卡片稳重，小卡片灵动）
const DEFAULT_SIZE_THRESHOLDS = [
  { minSize: 0, maxSize: 160, max: 12 },     // 小卡片（<160px）：倾斜12度，灵动
  { minSize: 160, maxSize: 240, max: 8 },    // 中小卡片（160-240px）：倾斜8度
  { minSize: 240, maxSize: 320, max: 5 },    // 中等卡片（240-320px）：倾斜5度
  { minSize: 320, maxSize: 480, max: 3 },    // 大卡片（320-480px）：倾斜3度，稳重
  { minSize: 480, maxSize: 9999, max: 1.5 }, // 超大卡片（>480px）：倾斜1.5度，微倾斜
];

function calculateMaxBySize(
  width: number, 
  height: number, 
  thresholds = DEFAULT_SIZE_THRESHOLDS
): number {
  // 取宽高中的较大值作为判断基准（主导尺寸）
  const dominantSize = Math.max(width, height);
  // 线性插值：在阈值区间内平滑过渡，而非阶梯跳变
  for (const threshold of thresholds) {
    if (dominantSize >= threshold.minSize && dominantSize < threshold.maxSize) {
      // 找到下一个阈值的角度，用于线性插值
      const nextThreshold = thresholds.find(t => t.minSize === threshold.maxSize);
      if (nextThreshold) {
        const ratio = (dominantSize - threshold.minSize) / (threshold.maxSize - threshold.minSize);
        return threshold.max - ratio * (threshold.max - nextThreshold.max);
      }
      return threshold.max;
    }
  }
  return 3; // 默认3度
}

export function useTilt<T extends HTMLElement = HTMLDivElement>(
  ref: React.RefObject<T | null>,
  options: TiltOptions = {}
) {
  const {
    max: baseMax = 6,
    perspective = 1000,
    scale = 1.02,
    speed = 400,
    autoMax = true,
    sizeThresholds = DEFAULT_SIZE_THRESHOLDS,
  } = options;

  const [style, setStyle] = useState<React.CSSProperties>({});
  const [currentMax, setCurrentMax] = useState(baseMax);
  const [glarePos, setGlarePos] = useState({ x: 0, y: 0, opacity: 0 });

  // 当元素挂载时测量尺寸，计算合适的角度
  useEffect(() => {
    if (!autoMax || !ref.current) return;
    
    const measureSize = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const calculatedMax = calculateMaxBySize(rect.width, rect.height, sizeThresholds);
      setCurrentMax(calculatedMax);
    };

    // 首次测量（延迟一帧确保元素已渲染）
    const timer = setTimeout(measureSize, 0);

    // 监听窗口大小变化，重新计算
    const resizeObserver = new ResizeObserver(measureSize);
    resizeObserver.observe(ref.current);

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [autoMax, sizeThresholds]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<T>) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      // 使用计算后的currentMax作为最大倾斜角度
      const activeMax = autoMax ? currentMax : baseMax;
      
      // 计算鼠标相对于中心的位置（-1到1之间）
      const rotateX = ((y - centerY) / centerY) * -activeMax;
      const rotateY = ((x - centerX) / centerX) * activeMax;

      // 计算高光位置（百分比）
      const glareX = (x / rect.width) * 100;
      const glareY = (y / rect.height) * 100;

      setStyle({
        transform: `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`,
        transition: `transform ${speed}ms cubic-bezier(0.03, 0.98, 0.52, 0.99)`,
      });
      setGlarePos({ x: glareX, y: glareY, opacity: 1 });
    },
    [autoMax, baseMax, currentMax, perspective, scale, speed]
  );

  const handleMouseLeave = useCallback(() => {
    setStyle({
      transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale(1)`,
      transition: `transform ${speed + 200}ms cubic-bezier(0.03, 0.98, 0.52, 0.99)`,
    });
    setGlarePos(prev => ({ ...prev, opacity: 0 }));
  }, [perspective, speed]);

  const handleMouseEnter = useCallback(() => {
    // 重新测量尺寸
    if (autoMax && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const calculatedMax = calculateMaxBySize(rect.width, rect.height, sizeThresholds);
      setCurrentMax(calculatedMax);
    }
    
    setStyle({
      transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale(${scale})`,
      transition: `transform ${speed}ms ease-out`,
    });
  }, [autoMax, perspective, scale, speed, sizeThresholds]);

  return {
    style,
    glarePos,
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
    onMouseEnter: handleMouseEnter,
    currentMax,
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
  autoMax = true,
  sizeThresholds,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
  perspective?: number;
  scale?: number;
  speed?: number;
  glareOpacity?: number;
  autoMax?: boolean;
  sizeThresholds?: { minSize: number; maxSize: number; max: number }[];
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const tilt = useTilt<HTMLDivElement>(cardRef, {
    max,
    perspective,
    scale,
    speed,
    autoMax,
    sizeThresholds,
  });

  return (
    <div
      ref={cardRef}
      style={{
        ...tilt.style,
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
      onMouseMove={tilt.onMouseMove}
      onMouseLeave={tilt.onMouseLeave}
      onMouseEnter={tilt.onMouseEnter}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-white via-[#fdfcf9] to-[#faf7f2] shadow-[0_1px_2px_rgba(139,92,60,0.04),0_4px_12px_rgba(139,92,60,0.06),inset_0_1px_0_rgba(255,255,255,0.8),inset_0_-1px_0_rgba(232,221,208,0.3)] hover:border-border hover:shadow-[0_2px_4px_rgba(139,92,60,0.08),0_8px_24px_rgba(139,92,60,0.12),0_0_0_1px_rgba(255,255,255,0.5),inset_0_1px_0_rgba(255,255,255,0.9)] active:shadow-[0_1px_2px_rgba(139,92,60,0.1),inset_0_2px_4px_rgba(139,92,60,0.05)] transition-all duration-200 ${className}`}
    >
      {/* 动态高光层 - 跟随鼠标位置 */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-200"
        style={{
          background: `radial-gradient(circle at ${tilt.glarePos.x}% ${tilt.glarePos.y}%, rgba(255, 255, 255, ${glareOpacity}), transparent 50%)`,
          opacity: tilt.glarePos.opacity,
        }}
      />
      {/* 边缘光效 */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      {children}
    </div>
  );
}
