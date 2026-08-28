"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { usePathname } from "next/navigation";

export default function Header() {
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 50], [1, 0.8]);
  const y = useTransform(scrollY, [0, 50], [0, -10]);
  
  const pathname = usePathname();

  return (
    <motion.header 
      style={{ opacity, y }}
      className="fixed top-0 left-0 w-full px-6 md:px-12 py-8 z-50 mix-blend-difference text-white flex justify-between items-start pointer-events-none"
    >
      {/* Branding */}
      <div className="flex flex-col uppercase tracking-[0.2em] pointer-events-auto">
        <Link href="/" className="group">
          <h1 className="font-display font-bold text-[11px] leading-tight">
            Colección<br/>Reyes-Veray
          </h1>
          <div className="h-[1px] w-0 group-hover:w-full bg-white transition-all duration-700 ease-out mt-1"></div>
        </Link>
      </div>

      {/* Toolbar / Actions */}
      <nav className="pointer-events-auto">
        <ul className="flex items-center space-x-6 md:space-x-12 font-display text-[10px] uppercase tracking-widest font-bold">
          <li>
            <Link 
              href="/gallery" 
              className={`hover:opacity-50 transition-opacity duration-300 ${pathname === '/gallery' ? 'opacity-50' : ''}`}
            >
              Inventory
            </Link>
          </li>
          <li>
            <Link 
              href="/exhibition" 
              className={`hover:opacity-50 transition-opacity duration-300 ${pathname === '/exhibition' ? 'opacity-50' : ''}`}
            >
              Exhibition
            </Link>
          </li>
          <li>
            <Link 
              href="/about" 
              className={`hover:opacity-50 transition-opacity duration-300 ${pathname === '/about' ? 'opacity-50' : ''}`}
            >
              Collector
            </Link>
          </li>
          <li>
            <Link 
              href="/contact" 
              className={`hover:opacity-50 transition-opacity duration-300 ${pathname === '/contact' ? 'opacity-50' : ''}`}
            >
              Contact
            </Link>
          </li>
        </ul>
      </nav>
    </motion.header>
  );
}
