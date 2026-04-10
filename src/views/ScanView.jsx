import { useState, useCallback } from 'react';
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

/**
 * ScanView — fingerprint capture screen.
 *
 * Flow:
 *   waiting → (scanner not connected? show waiting message)
 *   waiting → (click "開始掃描") → scanning → confirming → (admin confirms) → analyzing → complete → onScanComplete
 *                                                         → (admin recaptures) → back to waiting
 *
 * Props:
 *   scanner       — shared useFingerprintScanner instance from App
 *   sessionState  — current session state (mode, currentPersonScanned, etc.)
 *   onScanComplete — callback with result object
 */
export default function ScanView({ sessionState, scanner, onScanComplete }) {
  // 'waiting' | 'scanning' | 'confirming' | 'analyzing' | 'complete'
  const [scanPhase, setScanPhase] = useState('waiting');
  const [statusText, setStatusText] = useState('請將手指放在掃描器上');
  const [capturedImage, setCapturedImage] = useState(null);

  const currentPersonIndex = sessionState.currentPersonScanned;
  const isFamily = sessionState.mode === 'family';
  const isSingle = sessionState.mode === 'single';

  let badgeText = isSingle ? '個人分析' : `參加者 ${currentPersonIndex} / 2`;
  if (isFamily) {
    badgeText = currentPersonIndex === 1 ? '家長 / 成人' : '孩子';
  }

  // ── Capture flow ────────────────────────────────────────────────────────────
  const startCapture = useCallback(async () => {
    if (!scanner.isConnected) return;

    setScanPhase('scanning');
    setStatusText('正在擷取指紋...');

    const result = await scanner.capture();

    if (!result) {
      setScanPhase('waiting');
      setStatusText(scanner.error || '擷取失敗，請重試');
      return;
    }

    // Show captured image — enter confirming phase for admin review
    setCapturedImage(result.dataUrl);
    setScanPhase('confirming');
    setStatusText('請確認指紋擷取品質');
  }, [scanner]);

  // ── Admin confirms the capture is good ──────────────────────────────────────
  const confirmCapture = useCallback(() => {
    setScanPhase('analyzing');

    // Animate the analysis phase
    let dots = 0;
    const analyzeInterval = setInterval(() => {
      dots = (dots + 1) % 4;
      setStatusText('正在比對先天紋理' + '.'.repeat(dots));
    }, 600);

    // After analysis delay, complete
    setTimeout(() => {
      clearInterval(analyzeInterval);
      setScanPhase('complete');
      setStatusText('掃描完成！');

      const randomType = types[Math.floor(Math.random() * types.length)];

      setTimeout(() => {
        onScanComplete({ ...randomType, fingerprintImage: capturedImage });
      }, 1500);
    }, 3000);
  }, [onScanComplete, capturedImage]);

  // ── Admin wants to recapture ────────────────────────────────────────────────
  const recapture = useCallback(() => {
    setCapturedImage(null);
    setScanPhase('waiting');
    setStatusText('請將手指放在掃描器上');
  }, []);

  // ── Derived state ───────────────────────────────────────────────────────────
  const isBusy = scanPhase !== 'waiting';
  const isComplete = scanPhase === 'complete';
  const isConfirming = scanPhase === 'confirming';
  const showFingerprint = capturedImage && (scanPhase === 'confirming' || scanPhase === 'analyzing' || scanPhase === 'complete');
  const scannerReady = scanner.isConnected;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.5 }}
      className="flex items-center justify-center w-full"
    >
      <div className="w-full max-w-6xl glass-card rounded-[40px] p-12 flex h-[80vh]">
        {/* ── Left panel ── */}
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

          {/* Instructions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-black/20 rounded-2xl p-6 mb-10"
          >
            <ul className="space-y-4 text-sm text-brand-mint">
              <li className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-brand-gold mr-3 flex-shrink-0"></div>
                確保手指清潔與乾燥
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-brand-gold mr-3 flex-shrink-0"></div>
                輕輕按壓並保持自然
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-brand-gold mr-3 flex-shrink-0"></div>
                將指紋中心點對準感應區中央
              </li>
            </ul>
          </motion.div>

          {/* ── Action area ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="space-y-3"
          >
            <AnimatePresence mode="wait">
              {/* ── State: Scanner not connected ── */}
              {!scannerReady && !isBusy && (
                <motion.div
                  key="waiting-scanner"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col items-center gap-4 py-6"
                >
                  {/* Pulsing ring */}
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-brand-mint/20 flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-brand-mint/30 animate-pulse" />
                    </div>
                    <div className="absolute inset-0 w-12 h-12 rounded-full border border-brand-mint/10 animate-ping" style={{ animationDuration: '2s' }} />
                  </div>
                  <div className="text-center">
                    <p className="text-brand-mint/70 text-lg font-outfit">等待掃描器連接</p>
                    <p className="text-brand-mint/40 text-sm mt-1">請使用底部工具列連接指紋掃描器</p>
                  </div>
                </motion.div>
              )}

              {/* ── State: Ready to scan / scanning ── */}
              {scannerReady && (scanPhase === 'waiting' || scanPhase === 'scanning') && (
                <motion.div
                  key="scan-action"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <button
                    disabled={isBusy}
                    onClick={startCapture}
                    className={`bg-brand-glass border border-brand-gold font-bold py-4 rounded-xl transition-all duration-300 w-full text-lg
                      ${isBusy
                        ? 'opacity-50 cursor-not-allowed text-brand-gold'
                        : 'text-brand-gold hover:bg-brand-gold hover:text-brand-teal'}`}
                  >
                    {scanPhase === 'scanning' ? '正在擷取...' : '開始掃描指紋'}
                  </button>
                </motion.div>
              )}

              {/* ── State: Confirming — admin reviews the captured image ── */}
              {isConfirming && (
                <motion.div
                  key="confirm-action"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  <p className="text-center text-brand-mint/80 text-sm mb-2">
                    請確認指紋影像清晰、完整
                  </p>
                  <button
                    onClick={confirmCapture}
                    className="w-full bg-brand-gold text-brand-teal font-bold py-4 rounded-xl text-lg transition-all duration-300 hover:bg-white gold-glow"
                  >
                    確認繼續
                  </button>
                  <button
                    onClick={recapture}
                    className="w-full bg-brand-glass border border-brand-mint/30 text-brand-mint font-bold py-3 rounded-xl text-base transition-all duration-300 hover:bg-white/10"
                  >
                    重新擷取
                  </button>
                </motion.div>
              )}

              {/* ── State: Analyzing / Complete — progress indicator ── */}
              {(scanPhase === 'analyzing' || scanPhase === 'complete') && (
                <motion.div
                  key="progress"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center justify-center gap-3 py-4"
                >
                  {scanPhase === 'analyzing' && (
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 rounded-full bg-brand-gold"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                        />
                      ))}
                    </div>
                  )}
                  {isComplete && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      <svg className="w-6 h-6 text-brand-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </motion.div>
                  )}
                  <span className={`text-lg font-outfit ${isComplete ? 'text-brand-gold' : 'text-brand-mint/70'}`}>
                    {statusText}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* ── Right panel — fingerprint visual ── */}
        <div className="w-1/2 pl-12 flex flex-col items-center justify-center relative">
          <motion.div
            layout
            className={`w-64 h-80 rounded-[50px] border-2 flex items-center justify-center relative overflow-hidden transition-all duration-500
              ${scanPhase === 'scanning' ? 'border-brand-gold bg-black/30' : 'border-brand-glass-border bg-black/10'}
              ${isConfirming ? 'border-brand-gold/60 ring-2 ring-brand-gold/20' : ''}
              ${isComplete ? 'gold-glow border-brand-gold' : ''}`}
          >
            {/* Show real fingerprint image */}
            <AnimatePresence>
              {showFingerprint && (
                <motion.img
                  key="fingerprint"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4 }}
                  src={capturedImage}
                  alt="Fingerprint"
                  className="w-full h-full object-cover rounded-[48px]"
                  style={{ imageRendering: 'auto' }}
                />
              )}
            </AnimatePresence>

            {/* SVG placeholder when no image */}
            {!showFingerprint && (
              <svg
                className={`w-32 h-48 transition-all duration-500
                  ${scanPhase === 'scanning' ? 'text-brand-gold opacity-100' : 'text-brand-mint opacity-50'}
                  ${!scannerReady ? 'opacity-20' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="0.5"
                  d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"
                />
              </svg>
            )}

            {/* Scanning line animation */}
            {scanPhase === 'scanning' && !showFingerprint && (
              <div className="scanner-line"></div>
            )}

            {/* Confirming overlay badge */}
            <AnimatePresence>
              {isConfirming && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-brand-gold text-xs font-bold px-4 py-1.5 rounded-full border border-brand-gold/30 whitespace-nowrap"
                >
                  待確認
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Status text below the scan area */}
          <div
            className={`mt-8 font-cormorant text-2xl italic h-8 transition-colors duration-300 text-center ${
              isComplete ? 'text-brand-gold' :
              isConfirming ? 'text-brand-gold/80' :
              'text-brand-mint'
            }`}
          >
            {scanPhase === 'waiting' && !scannerReady ? '' : statusText}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
