import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import WelcomeView from './views/WelcomeView';
import ModeSelectionView from './views/ModeSelectionView';
import ScanView from './views/ScanView';
import ResultSingleView from './views/ResultSingleView';
import ResultDualView from './views/ResultDualView';

export default function App() {
  const [sessionState, setSessionState] = useState({
    currentView: 'welcome', // 'welcome' | 'select' | 'scan' | 'result'
    mode: null,             // 'single' | 'couple' | 'family'
    totalPersons: 1,
    currentPersonScanned: 0,
    results: []             
  });

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
          currentView: 'scan' // forces re-render of scan view if needed
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

  return (
    <div className="h-full w-full flex items-center justify-center p-8">
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
            onScanComplete={handleScanComplete} 
          />
        )}
        {sessionState.currentView === 'result' && sessionState.mode === 'single' && (
          <ResultSingleView key="result-single" results={sessionState.results} onReset={resetSession} />
        )}
        {sessionState.currentView === 'result' && sessionState.mode !== 'single' && (
          <ResultDualView key="result-dual" sessionState={sessionState} onReset={resetSession} />
        )}
      </AnimatePresence>
    </div>
  );
}