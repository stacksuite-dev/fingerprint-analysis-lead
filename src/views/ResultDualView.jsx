import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const synergyDescriptions = [
  "優勢互補。一方提供宏觀願景，另一方提供穩定的情感支持與執行力。",
  "高度共鳴。雙方擁有相似的價值觀，能迅速理解對方的想法並付諸行動。",
  "激發創意。不同的思考模式碰撞出新的火花，適合共同開創全新計畫。",
  "穩定成長。建立在互信與責任基礎上的關係，共同穩步邁向長遠目標。"
];

export default function ResultDualView({ sessionState, onReset }) {
  const { results, mode } = sessionState;
  const res1 = results[0];
  const res2 = results[1];

  const [score, setScore] = useState(0);
  const [synergyText, setSynergyText] = useState("");

  useEffect(() => {
    // Randomize score and description
    setScore(Math.floor(Math.random() * (98 - 75 + 1)) + 75);
    setSynergyText(synergyDescriptions[Math.floor(Math.random() * synergyDescriptions.length)]);
  }, []);

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
        className="font-cormorant text-4xl mb-6 text-center text-brand-gold"
      >
        {title}
      </motion.h2>
      
      <div className="w-full max-w-6xl flex items-stretch gap-6 h-[60vh]">
        {/* Person 1 */}
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card rounded-3xl p-8 flex-1 flex flex-col items-center text-center relative overflow-hidden"
        >
          <div className="bg-brand-glass px-4 py-1 rounded-full text-xs text-brand-mint mb-6">{p1Label}</div>
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.6 }}
            className="text-5xl mb-4"
          >
            {res1.icon}
          </motion.div>
          <h3 className="font-cormorant text-3xl font-bold mb-4">{res1.name}</h3>
          <p className="text-sm text-brand-mint leading-relaxed">{res1.desc}</p>
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
          className="glass-card rounded-3xl p-8 flex-1 flex flex-col items-center text-center relative overflow-hidden"
        >
          <div className="bg-brand-glass px-4 py-1 rounded-full text-xs text-brand-mint mb-6">{p2Label}</div>
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.7 }}
            className="text-5xl mb-4"
          >
            {res2.icon}
          </motion.div>
          <h3 className="font-cormorant text-3xl font-bold mb-4">{res2.name}</h3>
          <p className="text-sm text-brand-mint leading-relaxed">{res2.desc}</p>
        </motion.div>
      </div>
      
      <motion.button 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6 }}
        onClick={onReset} 
        className="mt-8 px-8 py-3 rounded-full border border-brand-mint text-brand-mint hover:bg-brand-mint hover:text-brand-teal transition-all"
      >
        開始全新分析
      </motion.button>
    </motion.div>
  );
}