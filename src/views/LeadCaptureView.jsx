import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function LeadCaptureView({ results, sdk, onReset }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [submitState, setSubmitState] = useState('idle'); // 'idle' | 'submitting' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const nameRef = useRef(null);

  // Auto-focus name field after entrance animation
  useEffect(() => {
    const timer = setTimeout(() => nameRef.current?.focus(), 600);
    return () => clearTimeout(timer);
  }, []);

  // Auto-reset 5s after successful submission
  useEffect(() => {
    if (submitState !== 'success') return;
    const timer = setTimeout(onReset, 5000);
    return () => clearTimeout(timer);
  }, [submitState, onReset]);

  const updateField = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const buildResultSummary = () => {
    if (!results || results.length === 0) return '指紋分析查詢';
    return results
      .map((r, i) => `參加者 ${i + 1}: ${r.name} - ${r.desc}`)
      .join('\n');
  };

  const savePendingLead = () => {
    try {
      const pending = JSON.parse(localStorage.getItem('pending_leads') || '[]');
      pending.push({
        ...form,
        results: results.map((r) => ({ name: r.name, desc: r.desc })),
        timestamp: new Date().toISOString(),
      });
      localStorage.setItem('pending_leads', JSON.stringify(pending));
    } catch {
      // localStorage unavailable in kiosk mode
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      setErrorMsg('請輸入姓名');
      return;
    }
    if (!form.phone.trim() && !form.email.trim()) {
      setErrorMsg('請輸入電話號碼或電郵地址');
      return;
    }

    setSubmitState('submitting');
    setErrorMsg('');

    try {
      // Backend requires email — synthesise one from phone if not provided
      const email = form.email.trim() || `${form.phone.trim().replace(/[^0-9]/g, '')}@lead.local`;

      await sdk.contact.submit({
        name: form.name.trim(),
        email,
        phone: form.phone.trim() || undefined,
        subject: '指紋分析展銷查詢',
        message: buildResultSummary(),
      });

      setSubmitState('success');
    } catch (err) {
      console.error('Lead submission failed:', err);
      setSubmitState('error');
      setErrorMsg(err?.message || '提交失敗，請稍後再試');
      savePendingLead();
    }
  };

  if (submitState === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center justify-center w-full"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-24 h-24 rounded-full border-4 border-brand-gold flex items-center justify-center mb-8 gold-glow"
        >
          <svg className="w-12 h-12 text-brand-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </motion.div>
        <h2 className="font-cormorant text-4xl text-brand-gold mb-4">多謝您的興趣</h2>
        <p className="text-brand-mint text-lg mb-2">我們的專家將會盡快聯絡您</p>
        <p className="text-white/40 text-sm">自動返回中...</p>
      </motion.div>
    );
  }

  const isSubmitting = submitState === 'submitting';
  const inputClasses = "w-full bg-black/20 border border-brand-glass-border rounded-xl px-5 py-3 text-white placeholder-white/30 focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-all";

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
        className="font-cormorant text-4xl mb-2 text-center text-brand-gold"
      >
        免費獲取完整報告
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-brand-mint mb-8 text-center"
      >
        留下聯絡方式，我們將專人跟進為您詳細解讀
      </motion.p>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        onSubmit={handleSubmit}
        className="glass-card rounded-3xl w-full max-w-lg p-10"
      >
        <div className="mb-6">
          <label className="block text-xs text-brand-gold uppercase tracking-wider mb-2">
            姓名 <span className="text-red-400">*</span>
          </label>
          <input
            ref={nameRef}
            type="text"
            value={form.name}
            onChange={updateField('name')}
            placeholder="請輸入您的姓名"
            className={inputClasses}
            autoComplete="off"
          />
        </div>

        <div className="mb-6">
          <label className="block text-xs text-brand-gold uppercase tracking-wider mb-2">
            電話號碼
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={updateField('phone')}
            placeholder="e.g. 9123 4567"
            className={inputClasses}
            autoComplete="off"
          />
        </div>

        <div className="mb-8">
          <label className="block text-xs text-brand-gold uppercase tracking-wider mb-2">
            電郵地址
          </label>
          <input
            type="email"
            value={form.email}
            onChange={updateField('email')}
            placeholder="email@example.com"
            className={inputClasses}
            autoComplete="off"
          />
        </div>

        {errorMsg && (
          <div className="mb-4 text-red-400 text-sm text-center">{errorMsg}</div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 rounded-full bg-brand-gold text-brand-teal font-bold text-lg tracking-wider hover:bg-brand-gold/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
              </svg>
              提交中...
            </span>
          ) : (
            '確認提交'
          )}
        </button>

        <button
          type="button"
          onClick={onReset}
          className="w-full mt-4 py-3 rounded-full border border-brand-glass-border text-white/50 text-sm hover:text-white/80 hover:border-white/30 transition-all"
        >
          略過，開始新分析
        </button>
      </motion.form>
    </motion.div>
  );
}
