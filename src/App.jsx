import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import WelcomeView from './views/WelcomeView';
import ModeSelectionView from './views/ModeSelectionView';
import ScanView from './views/ScanView';
import ResultSingleView from './views/ResultSingleView';
import ResultDualView from './views/ResultDualView';
import DebugUsbView from './views/DebugUsbView';
import ScannerStatusBar from './components/ScannerStatusBar';
import useFingerprintScanner from './hooks/useFingerprintScanner';

export default function App() {
  const scanner = useFingerprintScanner();

  const [sessionState, setSessionState] = useState({
    currentView: 'welcome', // 'welcome' | 'select' | 'scan' | 'result' | 'debug'
    mode: null,             // 'single' | 'couple' | 'family'
    totalPersons: 1,
    currentPersonScanned: 0,
    results: []             
  });

  // Silent reconnect on app mount — no popup, uses previously-paired device
  useEffect(() => {
    scanner.reconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const navigate = (view) => {
    setSessionState(prev => ({ ...prev, currentView: view }));
  };

  const startSession = (mode) => {
    setSessionState({
      currentView: 'scan',
      mode,
      totalPersons: mode === 'single' ? 1 : 2,
      currentPersonScanned: 1,
      results: []
    });
  };

  const handleScanComplete = (result) => {
    setSessionState(prev => {
      const newResults = [...prev.results, result];
      if (prev.currentPersonScanned < prev.totalPersons) {
        return {
          ...prev,
          currentPersonScanned: prev.currentPersonScanned + 1,
          results: newResults,
          currentView: 'scan'
        };
      } else {
        return {
          ...prev,
          results: newResults,
          currentView: 'result'
        };
      }
    });
  };

  const resetSession = () => {
    setSessionState({
      currentView: 'welcome',
      mode: null,
      totalPersons: 1,
      currentPersonScanned: 0,
      results: []
    });
  };

  // Ctrl+Shift+D to toggle debug USB view
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setSessionState(prev => ({
          ...prev,
          currentView: prev.currentView === 'debug' ? 'welcome' : 'debug'
        }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isDebug = sessionState.currentView === 'debug';

  return (
    <div className="h-full w-full flex flex-col">
      {/* Main content area */}
      <div className="flex-1 flex items-center justify-center p-8 min-h-0">
        <AnimatePresence mode="wait">
          {sessionState.currentView === 'welcome' && (
            <WelcomeView key="welcome" onStart={() => navigate('select')} />
          )}
          {sessionState.currentView === 'select' && (
            <ModeSelectionView key="select" onSelect={startSession} onBack={() => navigate('welcome')} />
          )}
          {sessionState.currentView === 'scan' && (
            <ScanView 
              key={`scan-${sessionState.currentPersonScanned}`} 
              sessionState={sessionState} 
              scanner={scanner}
              onScanComplete={handleScanComplete} 
            />
          )}
          {sessionState.currentView === 'result' && sessionState.mode === 'single' && (
            <ResultSingleView key="result-single" results={sessionState.results} onReset={resetSession} />
          )}
          {sessionState.currentView === 'result' && sessionState.mode !== 'single' && (
            <ResultDualView key="result-dual" sessionState={sessionState} onReset={resetSession} />
          )}
          {isDebug && (
            <DebugUsbView key="debug-usb" onBack={() => navigate('welcome')} />
          )}
        </AnimatePresence>
      </div>

      {/* Persistent scanner status bar — always visible except in debug */}
      {!isDebug && (
        <ScannerStatusBar scanner={scanner} />
      )}
    </div>
  );
}
