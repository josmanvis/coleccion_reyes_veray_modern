"use client";

import Link from "next/link";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 50], [1, 0.8]);
  const y = useTransform(scrollY, [0, 50], [0, -10]);
  
  const pathname = usePathname();

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const navLinks = [
    { name: "Inventory", href: "/gallery" },
    { name: "Exhibition", href: "/exhibition" },
    { name: "Collector", href: "/about" },
    { name: "Contact", href: "/contact" },
  ];

  return (
    <>
      <motion.header 
        style={{ opacity, y }}
        className="fixed top-0 left-0 w-full px-6 md:px-12 py-8 z-50 mix-blend-difference text-white flex justify-between items-start pointer-events-none"
      >
        {/* Branding */}
        <div className="flex flex-col uppercase tracking-[0.2em] pointer-events-auto">
          <Link href="/" className="group z-50" onClick={() => setMenuOpen(false)}>
            <h1 className="font-display font-bold text-[11px] leading-tight">
              Colección<br/>Reyes-Veray
            </h1>
            <div className="h-[1px] w-0 group-hover:w-full bg-white transition-all duration-700 ease-out mt-1"></div>
          </Link>
        </div>

        {/* Desktop Toolbar */}
        <nav className="pointer-events-auto hidden md:block">
          <ul className="flex items-center space-x-12 font-display text-[10px] uppercase tracking-widest font-bold">
            {navLinks.map((link) => (
              <li key={link.name}>
                <Link 
                  href={link.href} 
                  className={`hover:opacity-50 transition-opacity duration-300 ${pathname === link.href ? 'opacity-50' : ''}`}
                >
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Mobile Menu Toggle */}
        <button 
          className="md:hidden pointer-events-auto font-display text-[10px] uppercase tracking-widest font-bold z-50 mix-blend-difference"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
      </motion.header>

      {/* Mobile Fullscreen Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div 
            initial={{ opacity: 0, clipPath: "inset(0% 0% 100% 0%)" }}
            animate={{ opacity: 1, clipPath: "inset(0% 0% 0% 0%)" }}
            exit={{ opacity: 0, clipPath: "inset(0% 0% 100% 0%)" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-40 bg-black text-white flex flex-col justify-center px-6"
          >
            <nav>
              <ul className="flex flex-col space-y-8 font-serif text-5xl font-light">
                {navLinks.map((link, i) => (
                  <motion.li 
                    key={link.name}
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 + (i * 0.1), ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link 
                      href={link.href} 
                      className={`block hover:opacity-50 transition-opacity duration-300 ${pathname === link.href ? 'opacity-50 italic' : ''}`}
                    >
                      {link.name}
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
