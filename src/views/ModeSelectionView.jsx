import { motion } from 'framer-motion';
import { User, Users, Baby } from 'lucide-react';

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: i => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.15,
      duration: 0.5,
    },
  }),
};

export default function ModeSelectionView({ onSelect, onBack }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center w-full"
    >
      <div className="w-full max-w-6xl mx-auto">
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
          <h2 className="font-cormorant text-5xl font-bold mb-4 text-center">選擇分析模式</h2>
          <p className="text-brand-mint text-lg mb-12 text-center">請選擇您想進行的分析組合。</p>
        </motion.div>
        
        <div className="grid grid-cols-3 gap-8">
          {/* 1 Person */}
          <motion.div 
            custom={0}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -8, borderColor: '#E5C158' }}
            onClick={() => onSelect('single')} 
            className="glass-card rounded-3xl p-10 flex flex-col items-center text-center cursor-pointer transition-colors duration-300 group"
          >
            <div className="w-24 h-24 rounded-full bg-brand-glass flex items-center justify-center mb-6 group-hover:bg-brand-gold group-hover:text-brand-teal transition-colors">
              <User size={48} strokeWidth={1.5} />
            </div>
            <h3 className="font-cormorant text-3xl font-bold mb-2">個人潛能探索</h3>
            <p className="text-brand-mint text-sm">了解個人性格強項與盲點，為事業與生活建立清晰規劃。</p>
          </motion.div>

          {/* 2 Persons */}
          <motion.div 
            custom={1}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -8, borderColor: '#E5C158' }}
            onClick={() => onSelect('couple')} 
            className="glass-card rounded-3xl p-10 flex flex-col items-center text-center cursor-pointer transition-colors duration-300 group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 bg-brand-gold text-brand-teal text-xs font-bold px-3 py-1 rounded-bl-xl">最受歡迎</div>
            <div className="w-24 h-24 rounded-full bg-brand-glass flex items-center justify-center mb-6 group-hover:bg-brand-gold group-hover:text-brand-teal transition-colors">
              <Users size={48} strokeWidth={1.5} />
            </div>
            <h3 className="font-cormorant text-3xl font-bold mb-2">伴侶 / 合作夥伴</h3>
            <p className="text-brand-mint text-sm">交叉分析雙方溝通模式，發掘最佳合作潛力與默契。</p>
          </motion.div>

          {/* Family */}
          <motion.div 
            custom={2}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -8, borderColor: '#E5C158' }}
            onClick={() => onSelect('family')} 
            className="glass-card rounded-3xl p-10 flex flex-col items-center text-center cursor-pointer transition-colors duration-300 group"
          >
            <div className="w-24 h-24 rounded-full bg-brand-glass flex items-center justify-center mb-6 group-hover:bg-brand-gold group-hover:text-brand-teal transition-colors">
              <Baby size={48} strokeWidth={1.5} />
            </div>
            <h3 className="font-cormorant text-3xl font-bold mb-2">親子天賦發展</h3>
            <p className="text-brand-mint text-sm">深入了解孩子專屬優勢，提供精準且個人化的教養方向。</p>
          </motion.div>
        </div>

        <motion.button 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          onClick={onBack} 
          className="mt-12 text-brand-mint hover:text-white flex items-center mx-auto transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          返回首頁
        </motion.button>
      </div>
    </motion.div>
  );
}