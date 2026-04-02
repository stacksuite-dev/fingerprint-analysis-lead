import { motion } from 'framer-motion';

export default function ResultSingleView({ results, onReset }) {
  const res = results[0];

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
        className="font-cormorant text-4xl mb-8 text-center text-brand-gold"
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
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.5 }}
            className="w-32 h-32 rounded-full border-4 border-brand-gold flex items-center justify-center mb-6 gold-glow"
          >
            <span className="text-4xl">{res.icon}</span>
          </motion.div>
          <div className="text-brand-mint tracking-widest uppercase text-xs font-bold mb-2">主導特質</div>
          <h3 className="font-cormorant text-4xl font-bold text-white mb-2">{res.name}</h3>
        </div>
        
        <div className="w-2/3 pl-10">
          <h4 className="text-xl font-bold mb-4 text-brand-gold">先天特質</h4>
          <p className="text-brand-mint leading-relaxed mb-6">
            {res.desc}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-black/20 p-4 rounded-xl"
            >
              <div className="text-xs text-brand-gold uppercase tracking-wider mb-1">優勢與強項</div>
              <div className="font-bold">{res.strengths}</div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-black/20 p-4 rounded-xl"
            >
              <div className="text-xs text-brand-gold uppercase tracking-wider mb-1">盲點與成長空間</div>
              <div className="font-bold">{res.weak}</div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      <motion.button 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        onClick={onReset} 
        className="mt-10 px-8 py-3 rounded-full border border-brand-mint text-brand-mint hover:bg-brand-mint hover:text-brand-teal transition-all"
      >
        開始全新分析
      </motion.button>
    </motion.div>
  );
}