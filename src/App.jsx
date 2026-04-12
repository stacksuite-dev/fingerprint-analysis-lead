import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { FavCRM } from '@favcrm/sdk';
import WelcomeView from './views/WelcomeView';
import ModeSelectionView from './views/ModeSelectionView';
import ScanView from './views/ScanView';
import ResultSingleView from './views/ResultSingleView';
import ResultDualView from './views/ResultDualView';
import LeadCaptureView from './views/LeadCaptureView';
import DisclaimerView from './views/DisclaimerView';
import DebugUsbView from './views/DebugUsbView';
import ScannerStatusBar from './components/ScannerStatusBar';
import useFingerprintScanner from './hooks/useFingerprintScanner';

// SDK configuration — update these for your deployment
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.favcrm.io';
const COMPANY_ID = import.meta.env.VITE_COMPANY_ID || '6fde1755-292d-4264-ad13-85eec9230f85';

export default function App() {
  const scanner = useFingerprintScanner();

  const sdk = useMemo(() => new FavCRM({
    baseUrl: API_BASE_URL,
    companyId: COMPANY_ID,
  }), []);

  const [sessionState, setSessionState] = useState({
    currentView: 'welcome', // 'welcome' | 'disclaimer' | 'select' | 'scan' | 'result' | 'lead-capture' | 'debug'
    mode: null,             // 'single' | 'couple' | 'family'
    totalPersons: 1,
    currentPersonScanned: 0,
    results: [],
    dualMeta: null          // { score, synergyText } — set by ResultDualView
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

  const handleDualMeta = (meta) => {
    setSessionState(prev => ({ ...prev, dualMeta: meta }));
  };

  const handleResultOverride = (personIndex, newType) => {
    setSessionState(prev => {
      const newResults = [...prev.results];
      newResults[personIndex] = {
        ...newResults[personIndex],
        ...newType,
      };
      return { ...prev, results: newResults };
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
            <WelcomeView key="welcome" onStart={() => navigate('disclaimer')} />
          )}
          {sessionState.currentView === 'disclaimer' && (
            <DisclaimerView key="disclaimer" onAccept={() => navigate('select')} onBack={() => navigate('welcome')} />
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
            <ResultSingleView key="result-single" results={sessionState.results} onResultOverride={handleResultOverride} onLeadCapture={() => navigate('lead-capture')} onReset={resetSession} />
          )}
          {sessionState.currentView === 'result' && sessionState.mode !== 'single' && (
            <ResultDualView key="result-dual" sessionState={sessionState} onResultOverride={handleResultOverride} onDualMeta={handleDualMeta} onLeadCapture={() => navigate('lead-capture')} onReset={resetSession} />
          )}
          {sessionState.currentView === 'lead-capture' && (
            <LeadCaptureView key="lead-capture" results={sessionState.results} mode={sessionState.mode} dualMeta={sessionState.dualMeta} sdk={sdk} onReset={resetSession} />
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
