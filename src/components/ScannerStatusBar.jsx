import { motion, AnimatePresence } from 'framer-motion';
import { ScannerStatus } from '../hooks/useFingerprintScanner';

/**
 * Persistent thin status bar at the bottom of the screen.
 * Shows scanner connection state — admin clicks "連接" to pair via WebUSB.
 * Unobtrusive for customers, clearly actionable for the admin.
 */
export default function ScannerStatusBar({ scanner }) {
  const { status, error, isConnected, isSupported } = scanner;

  // Don't render at all if WebUSB is unsupported
  if (!isSupported) return null;

  const isConnecting = status === ScannerStatus.CONNECTING;
  const isError = status === ScannerStatus.ERROR;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.8, duration: 0.4 }}
      className="flex-none"
    >
      <div className="mx-auto max-w-md px-4 pb-4">
        <div className={`
          flex items-center justify-center gap-3 px-5 py-2.5 rounded-full text-xs tracking-wide
          transition-all duration-500 backdrop-blur-md
          ${isConnected
            ? 'bg-emerald-900/30 border border-emerald-500/20 text-emerald-300'
            : isError
              ? 'bg-red-900/20 border border-red-500/20 text-red-300'
              : 'bg-white/[0.04] border border-white/10 text-brand-mint/60'
          }
        `}>
          {/* Status indicator dot */}
          <div className="relative flex items-center justify-center">
            <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${
              isConnected ? 'bg-emerald-400' :
              isConnecting ? 'bg-amber-400' :
              isError ? 'bg-red-400' :
              'bg-white/30'
            }`} />
            {/* Pulse ring for connecting state */}
            <AnimatePresence>
              {isConnecting && (
                <motion.div
                  initial={{ scale: 1, opacity: 0.6 }}
                  animate={{ scale: 2.5, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="absolute w-2 h-2 rounded-full bg-amber-400"
                />
              )}
            </AnimatePresence>
            {/* Steady glow for connected */}
            {isConnected && (
              <div className="absolute w-2 h-2 rounded-full bg-emerald-400 blur-[3px] opacity-60" />
            )}
          </div>

          {/* Status text */}
          <span className="font-outfit select-none">
            {isConnected && '指紋掃描器已就緒'}
            {isConnecting && '正在連接掃描器...'}
            {isError && (
              <span className="flex items-center gap-1.5">
                連接失敗
                <span className="opacity-50 max-w-[120px] truncate" title={error}>
                  {error}
                </span>
              </span>
            )}
            {status === ScannerStatus.IDLE && '掃描器未連接'}
          </span>

          {/* Action button — only when not connected and not connecting */}
          {!isConnected && !isConnecting && (
            <button
              onClick={() => scanner.connect()}
              className={`
                ml-1 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase
                transition-all duration-200
                ${isError
                  ? 'bg-red-500/20 text-red-200 hover:bg-red-500/30 border border-red-500/20'
                  : 'bg-brand-gold/15 text-brand-gold hover:bg-brand-gold/25 border border-brand-gold/20'
                }
              `}
            >
              {isError ? '重試' : '連接'}
            </button>
          )}

          {/* Disconnect button — when connected */}
          {isConnected && (
            <button
              onClick={() => scanner.disconnect()}
              className="ml-1 px-2 py-0.5 rounded-full text-[10px] text-emerald-400/40 hover:text-emerald-300/70 transition-colors"
            >
              中斷
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
