/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AppProvider, useAppStore } from './store';
import { signOut } from './auth';
import { AccountLogin } from './components/AccountLogin';
import { ParentSetup } from './components/ParentSetup';
import { ParentDashboard } from './components/ParentDashboard';
import { ChildDashboard } from './components/ChildDashboard';

function MainApp() {
  const { clearProtectedState, hasSession, loading, role, error, retry } = useAppStore();
  
  const [currentView, setCurrentView] = useState<'login' | 'parentSetup' | 'parentDashboard' | 'childDashboard'>('login');
  const [loginMode, setLoginMode] = useState<'parent' | 'child'>('parent');
  const [pendingView, setPendingView] = useState<'parentDashboard' | 'childDashboard' | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!loading && hasSession && error?.includes('尚未加入家庭')) {
      clearProtectedState();
      void signOut();
      setCurrentView('login');
      return;
    }
    const waitingForExplicitLogin = currentView === 'login' && loginMode === 'child' && !pendingView;
    if (!loading && hasSession && role && !signingOut && !waitingForExplicitLogin) {
      setCurrentView(role === 'parent' ? 'parentDashboard' : 'childDashboard');
      setPendingView(null);
    }
    if (!loading && !hasSession && !['parentSetup', 'login'].includes(currentView)) {
      setCurrentView('login');
    }
    if (!hasSession && signingOut) setSigningOut(false);
  }, [clearProtectedState, currentView, error, hasSession, loading, loginMode, pendingView, role, signingOut]);

  const handleSwitchToChild = () => {
    setLoginMode('child');
    setCurrentView('login');
    setPendingView(null);
    setSigningOut(true);
    void signOut();
  };

  const handleLogout = () => {
    setLoginMode('parent');
    setCurrentView('login');
    setPendingView(null);
    setSigningOut(true);
    clearProtectedState();
    void signOut();
  };

  if (loading) return <div className="flex min-h-[100dvh] items-center justify-center bg-blue-50 text-blue-700">正在載入家庭資料…</div>;
  if (error && hasSession && currentView === 'login') {
    return <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-blue-50 p-6 text-center text-blue-900"><p role="alert">{error}</p><button onClick={() => void retry()} className="rounded-xl bg-blue-500 px-5 py-3 text-white">重試</button></div>;
  }

  switch (currentView) {
    case 'login':
      return <AccountLogin initialMode={loginMode} onGoSignup={() => setCurrentView('parentSetup')} onComplete={(mode) => { setPendingView(mode === 'parent' ? 'parentDashboard' : 'childDashboard'); setSigningOut(false); }} />;
    case 'parentSetup':
      return <ParentSetup onBack={() => setCurrentView('login')} onGoLogin={() => { setLoginMode('parent'); setCurrentView('login'); }} onComplete={() => { setPendingView('parentDashboard'); setSigningOut(false); }} />;
    case 'parentDashboard':
      return <ParentDashboard onSwitchToChild={handleSwitchToChild} onLogout={handleLogout} />;
    case 'childDashboard':
      return <ChildDashboard onLogout={handleLogout} onSwitchChild={handleSwitchToChild} />;
    default:
      return <AccountLogin initialMode={loginMode} onGoSignup={() => setCurrentView('parentSetup')} onComplete={(mode) => { setPendingView(mode === 'parent' ? 'parentDashboard' : 'childDashboard'); setSigningOut(false); }} />;
  }
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
