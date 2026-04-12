import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * DaySelectorOverlay — portalled to document.body so it escapes all
 * parent overflow/stacking-context constraints.  Anchors itself below
 * the trigger element via anchorRef.
 */
export default function DaySelectorOverlay({ types, currentTypeName, onSelect, onDismiss, visible, anchorRef }) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!visible || !anchorRef?.current) return;

    const update = () => {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 10,
        left: rect.left + rect.width / 2,
      });
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [visible, anchorRef]);

  return createPortal(
    <AnimatePresence>
      {visible && (
        <>
          {/* Full-screen backdrop — tap to dismiss */}
          <motion.div
            key="day-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0"
            style={{ zIndex: 9998 }}
            onClick={onDismiss}
          />

          {/* Day selector panel — fixed position, centred on anchor */}
          <motion.div
            key="day-selector"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed -translate-x-1/2"
            style={{ zIndex: 9999, top: pos.top, left: pos.left }}
          >
            <div className="bg-black/80 backdrop-blur-xl border border-brand-glass-border rounded-2xl px-4 py-3 shadow-2xl">
              <div className="flex gap-2">
                {types.map((type) => {
                  const isActive = type.name === currentTypeName;
                  return (
                    <motion.button
                      key={type.name}
                      whileTap={{ scale: 0.9 }}
                      animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(type);
                      }}
                      className={`flex flex-col items-center justify-center w-12 h-14 rounded-xl transition-all duration-200 cursor-pointer
                        ${isActive
                          ? 'border-2 border-brand-gold gold-glow bg-brand-gold/10'
                          : 'border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                        }`}
                    >
                      <span className="text-lg leading-none">{type.icon}</span>
                      <span className={`text-[10px] mt-1 font-bold tracking-wide ${isActive ? 'text-brand-gold' : 'text-white/50'}`}>
                        {type.name.replace('星期', '')}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
