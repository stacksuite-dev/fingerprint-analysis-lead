import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useLongPress from '../hooks/useLongPress';
import DaySelectorOverlay from '../components/DaySelectorOverlay';
import { personalityTypes } from '../data/personalityTypes';

const synergyDescriptions = [
  "優勢互補。一方提供宏觀願景，另一方提供穩定的情感支持與執行力。",
  "高度共鳴。雙方擁有相似的價值觀，能迅速理解對方的想法並付諸行動。",
  "激發創意。不同的思考模式碰撞出新的火花，適合共同開創全新計畫。",
  "穩定成長。建立在互信與責任基礎上的關係，共同穩步邁向長遠目標。"
];

export default function ResultDualView({ sessionState, onResultOverride, onDualMeta, onLeadCapture, onReset }) {
  const { results, mode } = sessionState;
  const res1 = results[0];
  const res2 = results[1];

  const [score, setScore] = useState(0);
  const [synergyText, setSynergyText] = useState("");
  const [showSelector1, setShowSelector1] = useState(false);
  const [showSelector2, setShowSelector2] = useState(false);

  const fpCircleRef1 = useRef(null);
  const fpCircleRef2 = useRef(null);

  const longPressProps1 = useLongPress(() => setShowSelector1(true));
  const longPressProps2 = useLongPress(() => setShowSelector2(true));

  useEffect(() => {
    const s = Math.floor(Math.random() * (98 - 75 + 1)) + 75;
    const t = synergyDescriptions[Math.floor(Math.random() * synergyDescriptions.length)];
    setScore(s);
    setSynergyText(t);
    onDualMeta?.({ score: s, synergyText: t });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect1 = (type) => {
    if (type.name !== res1.name) onResultOverride(0, type);
    setShowSelector1(false);
  };

  const handleSelect2 = (type) => {
    if (type.name !== res2.name) onResultOverride(1, type);
    setShowSelector2(false);
  };

  const title = mode === 'family' ? "親子協同分析" : "合作夥伴協同分析";
  const p1Label = mode === 'family' ? "家長 / 成人" : "參加者 1";
  const p2Label = mode === 'family' ? "孩子" : "參加者 2";

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
        className="font-cormorant text-4xl mb-6 text-center text-brand-gold select-none"
      >
        {title}
      </motion.h2>

      <div className="w-full max-w-6xl flex items-stretch gap-6 h-[60vh]">
        {/* Person 1 */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card rounded-3xl p-8 flex-1 flex flex-col items-center text-center relative overflow-visible"
        >
          <div className="bg-brand-glass px-4 py-1 rounded-full text-xs text-brand-mint mb-6">{p1Label}</div>

          <div className="relative">
            <motion.div
              ref={fpCircleRef1}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.6 }}
              className="w-20 h-20 rounded-full border-2 border-brand-gold flex items-center justify-center mb-4 overflow-hidden gold-glow cursor-pointer"
              {...longPressProps1}
            >
              {res1.fingerprintImage ? (
                <img src={res1.fingerprintImage} alt="指紋" className="w-full h-full object-cover pointer-events-none" style={{ imageRendering: 'auto' }} />
              ) : (
                <span className="text-5xl">{res1.icon}</span>
              )}
            </motion.div>

            <DaySelectorOverlay
              types={personalityTypes}
              currentTypeName={res1.name}
              onSelect={handleSelect1}
              onDismiss={() => setShowSelector1(false)}
              visible={showSelector1}
              anchorRef={fpCircleRef1}
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={res1.name}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center"
            >
              <h3 className="font-cormorant text-3xl font-bold mb-4">{res1.name}</h3>
              <p className="text-sm text-brand-mint leading-relaxed">{res1.desc}</p>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Connector / Synergy */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, type: 'spring' }}
          className="flex-none w-48 flex flex-col items-center justify-center z-10"
        >
          <div className="w-32 h-32 rounded-full bg-[#1e5c5f] border border-brand-gold flex flex-col items-center justify-center gold-glow shadow-2xl relative">
            <svg className="absolute w-full h-full text-brand-gold opacity-20 animate-pulse-slow" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
            </svg>
            <div className="text-sm text-brand-mint font-bold uppercase tracking-widest mb-1">契合度</div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="text-3xl font-cormorant font-bold text-brand-gold"
            >
              {score}%
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4 }}
            className="mt-8 text-center bg-black/30 p-4 rounded-xl border border-brand-glass-border w-full"
          >
            <div className="text-xs text-brand-gold font-bold mb-1">互動關係</div>
            <div className="text-sm leading-tight text-brand-mint">{synergyText}</div>
          </motion.div>
        </motion.div>

        {/* Person 2 */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card rounded-3xl p-8 flex-1 flex flex-col items-center text-center relative overflow-visible"
        >
          <div className="bg-brand-glass px-4 py-1 rounded-full text-xs text-brand-mint mb-6">{p2Label}</div>

          <div className="relative">
            <motion.div
              ref={fpCircleRef2}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.7 }}
              className="w-20 h-20 rounded-full border-2 border-brand-gold flex items-center justify-center mb-4 overflow-hidden gold-glow cursor-pointer"
              {...longPressProps2}
            >
              {res2.fingerprintImage ? (
                <img src={res2.fingerprintImage} alt="指紋" className="w-full h-full object-cover pointer-events-none" style={{ imageRendering: 'auto' }} />
              ) : (
                <span className="text-5xl">{res2.icon}</span>
              )}
            </motion.div>

            <DaySelectorOverlay
              types={personalityTypes}
              currentTypeName={res2.name}
              onSelect={handleSelect2}
              onDismiss={() => setShowSelector2(false)}
              visible={showSelector2}
              anchorRef={fpCircleRef2}
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={res2.name}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center"
            >
              <h3 className="font-cormorant text-3xl font-bold mb-4">{res2.name}</h3>
              <p className="text-sm text-brand-mint leading-relaxed">{res2.desc}</p>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      <div className="flex flex-col items-center gap-3 mt-8">
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
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
          transition={{ delay: 1.7 }}
          onClick={onReset}
          className="px-8 py-2.5 rounded-full border border-brand-glass-border text-white/40 text-sm hover:text-white/70 hover:border-white/30 transition-all"
        >
          開始全新分析
        </motion.button>
      </div>
    </motion.div>
  );
}
