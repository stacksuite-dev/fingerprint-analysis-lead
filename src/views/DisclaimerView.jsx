import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

export default function DisclaimerView({ onAccept, onBack }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center text-center w-full max-w-2xl mx-auto"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
        className="w-16 h-16 rounded-full bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center mb-6"
      >
        <ShieldCheck size={32} className="text-brand-gold" strokeWidth={1.5} />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="font-cormorant text-4xl font-bold mb-3"
      >
        開始前請閱讀
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-brand-mint/70 text-sm mb-8"
      >
        繼續即表示您已閱讀並同意以下條款
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="glass-card rounded-2xl p-8 w-full text-left mb-8"
      >
        <ul className="space-y-4 text-sm text-brand-mint/80 leading-relaxed">
          <li className="flex gap-3">
            <span className="text-brand-gold mt-0.5 flex-shrink-0">•</span>
            <span>
              本系統透過指紋紋理分析提供<strong className="text-white/90">先天特質參考</strong>，
              分析結果僅供個人成長探索之用，不構成任何醫療、心理或專業診斷建議。
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-brand-gold mt-0.5 flex-shrink-0">•</span>
            <span>
              您的指紋影像僅用於<strong className="text-white/90">即時分析</strong>，
              分析完成後不會儲存於系統中，亦不會用於其他用途。
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-brand-gold mt-0.5 flex-shrink-0">•</span>
            <span>
              如您選擇留下聯絡資訊以獲取完整報告，我們將依據
              <strong className="text-white/90">個人資料保護相關規定</strong>妥善處理您的資料。
            </span>
          </li>
        </ul>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex flex-col items-center gap-3"
      >
        <button
          onClick={onAccept}
          className="bg-brand-gold text-brand-teal font-bold text-lg py-3.5 px-12 rounded-full hover:bg-white transition-colors duration-300 gold-glow"
        >
          我已了解，開始分析
        </button>
        <button
          onClick={onBack}
          className="text-brand-mint/50 hover:text-white/70 text-sm flex items-center gap-1.5 transition-colors mt-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回
        </button>
      </motion.div>
    </motion.div>
  );
}
