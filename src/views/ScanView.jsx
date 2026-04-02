import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Mock Data for "Weekday" personality types
const types = [
  { name: "星期一", icon: "🌙", desc: "直覺敏銳，極具同理心且適應力強。在充滿支持的環境中如魚得水，重視情感連結。", strengths: "同理心、適應力", weak: "容易受他人情緒影響" },
  { name: "星期二", icon: "🔥", desc: "充滿活力，具備勇氣與行動力。面對挑戰時會迎難而上，喜歡主動出擊。", strengths: "勇氣、決斷力", weak: "有時缺乏耐性" },
  { name: "星期三", icon: "💬", desc: "善於溝通，理性且才思敏捷。是交換意見與創意思維的大師。", strengths: "溝通能力、邏輯思維", weak: "容易流於空談而缺乏行動" },
  { name: "星期四", icon: "⛰️", desc: "心胸廣闊，具備哲學思維與成長導向。總是著眼於大局並追求真理。", strengths: "遠見、樂觀", weak: "容易忽略執行細節" },
  { name: "星期五", icon: "🌸", desc: "追求和諧，具有藝術氣質且重視人際關係。為日常生活帶來美感。", strengths: "創造力、人際手腕", weak: "優柔寡斷、避免衝突" },
  { name: "星期六", icon: "🪐", desc: "紀律嚴明，有條理且負責任。善於建立持久而穩固的基礎。", strengths: "自律、耐力", weak: "過於固執、缺乏彈性" },
  { name: "星期日", icon: "☀️", desc: "光芒四射，精力充沛且自然成為焦點。以溫暖與清晰的願景啟發他人。", strengths: "個人魅力、領導力", weak: "偶爾會過度自我中心" },
];

export default function ScanView({ sessionState, onScanComplete }) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatusText, setScanStatusText] = useState("等待感應中...");
  const [isComplete, setIsComplete] = useState(false);

  const currentPersonIndex = sessionState.currentPersonScanned;
  const isFamily = sessionState.mode === 'family';
  const isSingle = sessionState.mode === 'single';

  let badgeText = isSingle ? "個人分析" : `參加者 ${currentPersonIndex} / 2`;
  if (isFamily) {
      badgeText = currentPersonIndex === 1 ? "家長 / 成人" : "孩子";
  }

  const simulateScan = () => {
    setIsScanning(true);
    let dots = 0;
    setScanStatusText("正在分析指紋特徵...");

    const scanInterval = setInterval(() => {
      dots = (dots + 1) % 4;
      setScanStatusText("正在比對先天紋理" + ".".repeat(dots));
    }, 600);

    setTimeout(() => {
      clearInterval(scanInterval);
      setIsScanning(false);
      setIsComplete(true);
      setScanStatusText("掃描完成！");
      
      const randomType = types[Math.floor(Math.random() * types.length)];
      
      setTimeout(() => {
        onScanComplete(randomType);
      }, 1500);
    }, 3000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.5 }}
      className="flex items-center justify-center w-full"
    >
      <div className="w-full max-w-6xl glass-card rounded-[40px] p-12 flex h-[80vh]">
        {/* Left Info */}
        <div className="w-1/2 pr-12 flex flex-col justify-center border-r border-brand-glass-border">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block bg-brand-glass text-brand-gold px-4 py-1 rounded-full text-sm font-bold tracking-widest uppercase mb-6 w-max"
          >
            {badgeText}
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="font-cormorant text-5xl font-bold mb-6"
          >
            擷取左手拇指指紋
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="text-brand-mint text-lg mb-10 leading-relaxed"
          >
            請將左手拇指平放於掃描區，並保持穩定，直到系統確認擷取完成。
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-black/20 rounded-2xl p-6 mb-10"
          >
            <ul className="space-y-4 text-sm text-brand-mint">
                <li className="flex items-center"><div className="w-2 h-2 rounded-full bg-brand-gold mr-3"></div> 確保手指清潔與乾燥</li>
                <li className="flex items-center"><div className="w-2 h-2 rounded-full bg-brand-gold mr-3"></div> 輕輕按壓並保持自然</li>
                <li className="flex items-center"><div className="w-2 h-2 rounded-full bg-brand-gold mr-3"></div> 將指紋中心點對準感應區</li>
            </ul>
          </motion.div>

          <motion.button 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            disabled={isScanning || isComplete}
            onClick={simulateScan} 
            className={`bg-brand-glass border border-brand-gold font-bold py-4 rounded-xl transition-all duration-300 w-full text-lg 
              ${(isScanning || isComplete) 
                ? 'opacity-50 cursor-not-allowed text-brand-gold' 
                : 'text-brand-gold hover:bg-brand-gold hover:text-brand-teal'}`}
          >
            [ 演示模式：點擊以模擬掃描 ]
          </motion.button>
        </div>
        
        {/* Right Visual */}
        <div className="w-1/2 pl-12 flex flex-col items-center justify-center relative">
          <div className={`w-64 h-80 rounded-[50px] border-2 border-brand-glass-border flex items-center justify-center relative overflow-hidden transition-all duration-500 
            ${isScanning ? 'border-brand-gold bg-black/30' : 'bg-black/10'} 
            ${isComplete ? 'gold-glow border-brand-gold' : ''}`}
          >
            {/* Fingerprint SVG Placeholder */}
            <svg 
              className={`w-32 h-48 transition-all duration-500 
                ${isScanning || isComplete ? 'text-brand-gold opacity-100' : 'text-brand-mint opacity-50'}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.5" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"></path>
            </svg>
            
            {/* Scanning Line Element */}
            {isScanning && (
              <div className="scanner-line"></div>
            )}
          </div>
          <div className={`mt-8 font-cormorant text-2xl italic h-8 transition-colors duration-300 ${isComplete ? 'text-brand-gold' : 'text-brand-mint'}`}>
            {scanStatusText}
          </div>
        </div>
      </div>
    </motion.div>
  );
}