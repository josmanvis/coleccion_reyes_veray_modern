"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function InteractiveCanvas({ src, alt }: { src: string; alt: string }) {
  const [isHovered, setIsHovered] = useState(false);
  
  // Create a spring-based scale for buttery smooth zooming
  const scale = useSpring(1, { stiffness: 100, damping: 20 });

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Increase/decrease scale based on scroll direction
      const currentScale = scale.get();
      const newScale = Math.min(Math.max(1, currentScale - e.deltaY * 0.01), 5);
      scale.set(newScale);
    };
    
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [scale]);

  return (
    <motion.div 
      className="w-full h-full relative flex items-center justify-center pointer-events-auto"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ scale }}
      drag
      dragConstraints={{ top: -1000, left: -1000, right: 1000, bottom: 1000 }}
      dragElastic={0.1}
      whileTap={{ cursor: "grabbing" }}
    >
      <Image 
        src={src} 
        alt={alt}
        fill
        quality={100}
        priority
        className="object-contain drop-shadow-2xl mix-blend-multiply" 
        draggable={false}
      />
      
      {/* Interaction Hint */}
      {scale.get() === 1 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
           <div className="bg-black/50 backdrop-blur-md text-white px-6 py-3 rounded-full font-display text-[10px] uppercase tracking-widest font-bold flex items-center space-x-3">
             <span className="w-2 h-2 bg-white rounded-full animate-ping"></span>
             <span>Scroll to Zoom &bull; Drag to Pan</span>
           </div>
        </motion.div>
      )}
    </motion.div>
  );
}
