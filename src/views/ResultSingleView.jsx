import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useLongPress from '../hooks/useLongPress';
import DaySelectorOverlay from '../components/DaySelectorOverlay';
import { personalityTypes } from '../data/personalityTypes';

export default function ResultSingleView({ results, onResultOverride, onLeadCapture, onReset }) {
  const res = results[0];
  const [showSelector, setShowSelector] = useState(false);
  const fpCircleRef = useRef(null);

  const longPressProps = useLongPress(() => setShowSelector(true));

  const handleSelect = (type) => {
    if (type.name !== res.name) {
      onResultOverride(0, type);
    }
    setShowSelector(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.6 }}
      className="flex flex-col items-center justify-center w-full"
    >
      <motion.h2
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="font-cormorant text-4xl mb-8 text-center text-brand-gold select-none"
      >
        分析完成
      </motion.h2>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card rounded-3xl w-full max-w-4xl p-12 flex items-center"
      >
        <div className="w-1/3 flex flex-col items-center border-r border-brand-glass-border pr-8">
          {/* Fingerprint circle — long-press to open day selector */}
          <div className="relative">
            <motion.div
              ref={fpCircleRef}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.5 }}
              className="w-32 h-32 rounded-full border-4 border-brand-gold flex items-center justify-center mb-6 gold-glow overflow-hidden cursor-pointer"
              {...longPressProps}
            >
              {res.fingerprintImage ? (
                <img
                  src={res.fingerprintImage}
                  alt="指紋"
                  className="w-full h-full object-cover pointer-events-none"
                  style={{ imageRendering: 'auto' }}
                />
              ) : (
                <span className="text-4xl">{res.icon}</span>
              )}
            </motion.div>

            <DaySelectorOverlay
              types={personalityTypes}
              currentTypeName={res.name}
              onSelect={handleSelect}
              onDismiss={() => setShowSelector(false)}
              visible={showSelector}
              anchorRef={fpCircleRef}
            />
          </div>

          <div className="text-brand-mint tracking-widest uppercase text-xs font-bold mb-2">主導特質</div>
          <AnimatePresence mode="wait">
            <motion.h3
              key={res.name}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="font-cormorant text-4xl font-bold text-white mb-2"
            >
              {res.name}
            </motion.h3>
          </AnimatePresence>
        </div>

        <div className="w-2/3 pl-10">
          <h4 className="text-xl font-bold mb-4 text-brand-gold">先天特質</h4>
          <AnimatePresence mode="wait">
            <motion.div
              key={res.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <p className="text-brand-mint leading-relaxed mb-6">
                {res.desc}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/20 p-4 rounded-xl">
                  <div className="text-xs text-brand-gold uppercase tracking-wider mb-1">優勢與強項</div>
                  <div className="font-bold">{res.strengths}</div>
                </div>
                <div className="bg-black/20 p-4 rounded-xl">
                  <div className="text-xs text-brand-gold uppercase tracking-wider mb-1">盲點與成長空間</div>
                  <div className="font-bold">{res.weak}</div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      <div className="flex flex-col items-center gap-3 mt-10">
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onLeadCapture}
          className="px-10 py-3.5 rounded-full bg-brand-gold text-brand-teal font-bold text-lg gold-glow hover:bg-white transition-colors duration-300"
        >
          免費獲取完整報告
        </motion.button>
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          onClick={onReset}
          className="px-8 py-2.5 rounded-full border border-brand-glass-border text-white/40 text-sm hover:text-white/70 hover:border-white/30 transition-all"
        >
          開始全新分析
        </motion.button>
      </div>
    </motion.div>
  );
}
