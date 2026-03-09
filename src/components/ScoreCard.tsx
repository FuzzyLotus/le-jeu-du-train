import { useEffect, useRef } from 'react';
import { motion, animate } from 'motion/react';
import clsx from 'clsx';

interface ScoreCardProps {
  points: number;
  highestScore?: number;
  label?: string;
  className?: string;
  shakeTrigger?: number;
}

export function ScoreCard({ points, highestScore, label = "POINTS", className, shakeTrigger = 0 }: ScoreCardProps) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shakeTrigger > 0 && containerRef.current) {
      animate(containerRef.current, { x: [-10, 10, -10, 10, 0] }, { duration: 0.4 });
      animate(containerRef.current, { backgroundColor: ["#ef4444", "#18181b"] }, { duration: 0.5 }); // Flash red
    }
  }, [shakeTrigger]);

  useEffect(() => {
    const node = nodeRef.current;
    if (node) {
      const currentVal = parseInt(node.textContent || "0");
      const controls = animate(currentVal, points, {
        duration: 1.5,
        ease: "easeOut",
        onUpdate(value) {
          node.textContent = Math.round(value).toString();
        }
      });
      
      // Scale animation on change
      animate(node, { scale: [1, 1.2, 1] }, { duration: 0.3 });

      return () => controls.stop();
    }
  }, [points]);

  return (
    <div ref={containerRef} className={clsx("flex flex-col items-center justify-center p-8 rounded-3xl bg-surface border border-white/5 shadow-2xl relative overflow-hidden group", className)}>
      {/* Subtle glow effect behind the number */}
      <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
        <div className="w-40 h-40 bg-primary rounded-full blur-3xl animate-pulse"></div>
      </div>
      
      <motion.span 
        ref={nodeRef}
        className="font-display text-7xl md:text-8xl text-primary drop-shadow-[0_0_15px_rgba(255,193,7,0.5)] z-10"
      >
        {points}
      </motion.span>
      <span className="font-sans font-bold text-white/70 tracking-[0.2em] uppercase text-sm mt-2 z-10 group-hover:text-white transition-colors">
        {label}
      </span>
      {highestScore !== undefined && highestScore > 0 && (
        <div className="absolute top-4 right-4 bg-white/5 border border-white/10 rounded-full px-3 py-1 flex items-center gap-1.5 z-10">
          <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Record</span>
          <span className="text-xs font-mono text-primary font-bold">{highestScore}</span>
        </div>
      )}
    </div>
  );
}
