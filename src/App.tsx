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
  const { clearProtectedState, hasSession, loading, initialLoading, dataReady, role, error, retry } = useAppStore();
  
  const [currentView, setCurrentView] = useState<'login' | 'parentSetup' | 'parentDashboard' | 'childDashboard'>('login');
  const [loginMode, setLoginMode] = useState<'parent' | 'child'>('parent');
  const [pendingView, setPendingView] = useState<'parentDashboard' | 'childDashboard' | null>(null);
  const [signupConsentAccepted, setSignupConsentAccepted] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!loading && hasSession && error?.includes('尚未加入家庭')) {
      clearProtectedState();
      void signOut();
      setCurrentView('login');
      return;
    }
    const waitingForExplicitLogin = currentView === 'login' && loginMode === 'child' && !pendingView;
    if (!loading && dataReady && hasSession && role && !signingOut && !waitingForExplicitLogin) {
      setCurrentView(role === 'parent' ? 'parentDashboard' : 'childDashboard');
      setPendingView(null);
    }
    if (!loading && !hasSession && !['parentSetup', 'login'].includes(currentView)) {
      setCurrentView('login');
    }
    if (!hasSession && signingOut) setSigningOut(false);
  }, [clearProtectedState, currentView, dataReady, error, hasSession, loading, loginMode, pendingView, role, signingOut]);

  const handleSwitchToChild = () => {
    setLoginMode('child');
    setCurrentView('login');
    setPendingView(null);
    setSignupConsentAccepted(false);
    setSigningOut(true);
    void signOut();
  };

  const handleLogout = () => {
    setLoginMode('parent');
    setCurrentView('login');
    setPendingView(null);
    setSignupConsentAccepted(false);
    setSigningOut(true);
    clearProtectedState();
    void signOut();
  };

  if (initialLoading) {
    return (
      <div className="hh-sprite-theme flex min-h-[100dvh] flex-col items-center justify-center bg-blue-50">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 animate-pulse text-3xl">
          ⭐
        </div>
        <p className="text-lg font-bold text-blue-900">HabitHero 習慣小英雄</p>
        <p className="mt-2 text-sm text-blue-400">啟動中…</p>
      </div>
    );
  }

  if (loading) return <div className="hh-sprite-theme flex min-h-[100dvh] items-center justify-center bg-blue-50 text-blue-700">正在更新資料…</div>;
  if (error && hasSession && currentView === 'login') {
    return <div className="hh-sprite-theme flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-blue-50 p-6 text-center text-blue-900"><p role="alert">{error}</p><button onClick={() => void retry()} className="rounded-xl bg-blue-500 px-5 py-3 text-white">重試</button></div>;
  }

  switch (currentView) {
    case 'login':
      return <AccountLogin initialMode={loginMode} onGoSignup={() => setCurrentView('parentSetup')} onComplete={(mode) => { setPendingView(mode === 'parent' ? 'parentDashboard' : 'childDashboard'); setSigningOut(false); }} />;
    case 'parentSetup':
      return <ParentSetup onBack={() => setCurrentView('login')} onGoLogin={() => { setLoginMode('parent'); setCurrentView('login'); }} onComplete={(consentAccepted) => { setSignupConsentAccepted(Boolean(consentAccepted)); setPendingView('parentDashboard'); setSigningOut(false); }} />;
    case 'parentDashboard':
      return <ParentDashboard onSwitchToChild={handleSwitchToChild} onLogout={handleLogout} signupConsentAccepted={signupConsentAccepted} />;
    case 'childDashboard':
      return <ChildDashboard onLogout={handleLogout} onSwitchChild={handleSwitchToChild} />;
    default:
      return <AccountLogin initialMode={loginMode} onGoSignup={() => setCurrentView('parentSetup')} onComplete={(mode) => { setPendingView(mode === 'parent' ? 'parentDashboard' : 'childDashboard'); setSigningOut(false); }} />;
  }
}

export default function App() {
  return (
    <AppProvider>
      <div className="hh-sprite-theme min-h-[100dvh]">
        <MainApp />
      </div>
    </AppProvider>
  );
}
