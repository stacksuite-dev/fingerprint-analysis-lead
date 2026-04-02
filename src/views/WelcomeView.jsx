import { motion } from 'framer-motion';

export default function WelcomeView({ onStart }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center text-center w-full"
    >
      <motion.img 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        src="/reference/logo1.jpeg" 
        alt="JW Logo" 
        className="w-80 h-80 object-cover rounded-full mb-8 shadow-2xl border-4 border-brand-glass-border"
      />
      <motion.h1 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="font-cormorant text-6xl font-bold mb-4 tracking-wide"
      >
        發掘你的隱藏潛能
      </motion.h1>
      <motion.p 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="text-brand-mint text-xl mb-12 max-w-2xl font-light"
      >
        透過先進指紋分析與專業教練引導，深入了解你的先天優勢與獨特天賦。
      </motion.p>
      
      <motion.button 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onStart} 
        className="bg-brand-gold text-brand-teal font-bold text-2xl py-4 px-12 rounded-full hover:bg-white transition-colors duration-300 gold-glow"
      >
        開始分析
      </motion.button>
    </motion.div>
  );
}