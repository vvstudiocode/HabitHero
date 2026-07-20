/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AppProvider, useAppStore } from './store';
import { signOut } from './auth';
import { LandingScreen } from './components/LandingScreen';
import { ParentSetup } from './components/ParentSetup';
import { ParentLogin } from './components/ParentLogin';
import { ChildLogin } from './components/ChildLogin';
import { ParentDashboard } from './components/ParentDashboard';
import { ChildDashboard } from './components/ChildDashboard';

function MainApp() {
  const { clearProtectedState, hasSession, loading, role, error, retry } = useAppStore();
  
  // 'landing' | 'parentSetup' | 'parentLogin' | 'childLogin' | 'parentDashboard' | 'childDashboard'
  const [currentView, setCurrentView] = useState<'landing' | 'parentSetup' | 'parentLogin' | 'childLogin' | 'parentDashboard' | 'childDashboard'>('landing');

  useEffect(() => {
    if (!loading && hasSession && error?.includes('尚未加入家庭')) {
      clearProtectedState();
      void signOut();
      setCurrentView('landing');
      return;
    }
    if (!loading && hasSession && role) setCurrentView(role === 'parent' ? 'parentDashboard' : 'childDashboard');
    if (!loading && !hasSession) setCurrentView('landing');
  }, [clearProtectedState, error, hasSession, loading, role]);

  const handleSelectRole = (selectedRole: 'parent' | 'child') => {
    if (selectedRole === 'parent') {
      if (hasSession && role === 'parent') {
        setCurrentView('parentDashboard');
      } else {
        setCurrentView('parentSetup');
      }
    } else {
      if (hasSession && role === 'child') {
        setCurrentView('childDashboard');
      } else {
        setCurrentView('childLogin');
      }
    }
  };

  const handleSwitchToChild = () => {
    setCurrentView('childLogin');
  };

  const handleLogout = () => {
    setCurrentView('landing');
    clearProtectedState();
    void signOut();
  };

  if (loading) return <div className="flex min-h-[100dvh] items-center justify-center bg-blue-50 text-blue-700">正在載入家庭資料…</div>;
  if (error && hasSession && currentView === 'landing') {
    return <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-blue-50 p-6 text-center text-blue-900"><p role="alert">{error}</p><button onClick={() => void retry()} className="rounded-xl bg-blue-500 px-5 py-3 text-white">重試</button></div>;
  }

  switch (currentView) {
    case 'landing':
      return <LandingScreen onSelectRole={handleSelectRole} onParentLogin={() => setCurrentView('parentLogin')} />;
    case 'parentSetup':
      return <ParentSetup onBack={() => setCurrentView('landing')} onGoLogin={() => setCurrentView('parentLogin')} onComplete={() => setCurrentView('parentDashboard')} />;
    case 'parentLogin':
      return <ParentLogin onBack={() => setCurrentView('landing')} onGoSignup={() => setCurrentView('parentSetup')} onComplete={() => setCurrentView('parentDashboard')} />;
    case 'childLogin':
      return <ChildLogin onBack={() => setCurrentView('landing')} onComplete={() => setCurrentView('childDashboard')} />;
    case 'parentDashboard':
      return <ParentDashboard onSwitchToChild={handleSwitchToChild} onLogout={handleLogout} />;
    case 'childDashboard':
      return <ChildDashboard onLogout={handleLogout} onSwitchChild={() => setCurrentView('childLogin')} />;
    default:
      return <LandingScreen onSelectRole={handleSelectRole} onParentLogin={() => setCurrentView('parentLogin')} />;
  }
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
