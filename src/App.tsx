/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AppProvider, useAppStore } from './store';
import { signOut, switchChildToParent, verifyCurrentParentPassword, toAuthErrorMessage } from './auth';
import { AccountLogin } from './components/AccountLogin';
import { ParentSetup } from './components/ParentSetup';
import { ParentDashboard } from './components/ParentDashboard';
import { ChildDashboard } from './components/ChildDashboard';
import { ParentUnlockModal } from './components/ParentUnlockModal';
import { FamilyChildPicker } from './components/FamilyChildPicker';
import { PARENT_IDLE_LOCK_MS } from './lib/view-access';
import { canOpenFamilyPicker, resolveActiveChildId } from './lib/family-switch';

function MainApp() {
  const { state, clearProtectedState, hasSession, loading, initialLoading, dataReady, role, error, retry, setChildLoggedIn, setParentActiveChild } = useAppStore();
  
  const [currentView, setCurrentView] = useState<'login' | 'parentSetup' | 'parentDashboard' | 'childDashboard'>('login');
  const [loginMode, setLoginMode] = useState<'parent' | 'child'>('parent');
  const [pendingView, setPendingView] = useState<'parentDashboard' | 'childDashboard' | null>(null);
  const [signupConsentAccepted, setSignupConsentAccepted] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [unlockPurpose, setUnlockPurpose] = useState<'parent-view' | 'family-switch' | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [parentUnlockedAt, setParentUnlockedAt] = useState<number | null>(null);
  const [showFamilyPicker, setShowFamilyPicker] = useState(false);
  const [familyPickerRequested, setFamilyPickerRequested] = useState(false);
  const [childPreview, setChildPreview] = useState(false);

  useEffect(() => {
    if (!loading && hasSession && error?.includes('尚未加入家庭')) {
      clearProtectedState();
      void signOut();
      setCurrentView('login');
      return;
    }
    const waitingForExplicitLogin = currentView === 'login' && loginMode === 'child' && !pendingView;
    if (!loading && dataReady && hasSession && role && !signingOut && !waitingForExplicitLogin && !(role === 'parent' && childPreview)) {
      setCurrentView(role === 'parent' ? 'parentDashboard' : 'childDashboard');
      setPendingView(null);
    }
    if (!loading && !hasSession && !['parentSetup', 'login'].includes(currentView)) {
      setCurrentView('login');
    }
    if (!hasSession && signingOut) setSigningOut(false);
  }, [childPreview, clearProtectedState, currentView, dataReady, error, hasSession, loading, loginMode, pendingView, role, signingOut]);

  useEffect(() => {
    if (currentView === 'parentDashboard' && role === 'parent' && dataReady && !showFamilyPicker && parentUnlockedAt === null) {
      setParentUnlockedAt(Date.now());
    }
  }, [currentView, dataReady, parentUnlockedAt, role, showFamilyPicker]);

  useEffect(() => {
    if (currentView !== 'parentDashboard' || role !== 'parent' || parentUnlockedAt === null) return undefined;
    const remaining = Math.max(0, PARENT_IDLE_LOCK_MS - (Date.now() - parentUnlockedAt));
    const timer = window.setTimeout(() => setParentUnlockedAt(null), remaining);
    const refreshActivity = () => setParentUnlockedAt((value) => value === null ? value : Date.now());
    window.addEventListener('pointerdown', refreshActivity);
    window.addEventListener('keydown', refreshActivity);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', refreshActivity);
      window.removeEventListener('keydown', refreshActivity);
    };
  }, [currentView, parentUnlockedAt, role]);

  useEffect(() => {
    if (!familyPickerRequested) return;
    if (!canOpenFamilyPicker({ role, dataReady, childCount: state.children.length })) return;
    setFamilyPickerRequested(false);
    setShowFamilyPicker(true);
  }, [dataReady, familyPickerRequested, role, state.children.length]);

  const handleSwitchToChild = (childId?: string) => {
    const targetChildId = resolveActiveChildId(childId ?? state.parentActiveChildId, state.children);
    if (!targetChildId) return;
    setChildLoggedIn(targetChildId);
    setParentActiveChild(targetChildId);
    setChildPreview(true);
    setParentUnlockedAt(null);
    setCurrentView('childDashboard');
  };

  const handleSwitchFromChild = () => {
    setUnlockError(null);
    setUnlockPurpose(role === 'parent' ? 'parent-view' : 'family-switch');
  };

  const handleUnlock = async (password: string) => {
    setUnlockLoading(true);
    setUnlockError(null);
    try {
      if (unlockPurpose === 'family-switch') {
        await switchChildToParent(password);
        setChildPreview(false);
        setParentUnlockedAt(Date.now());
        setShowFamilyPicker(false);
        setFamilyPickerRequested(true);
      } else {
        await verifyCurrentParentPassword(password);
        setChildPreview(false);
        setParentUnlockedAt(Date.now());
        setCurrentView('parentDashboard');
      }
      setUnlockPurpose(null);
    } catch (unlockFailure) {
      setUnlockError(toAuthErrorMessage(unlockFailure));
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleLogout = () => {
    setUnlockPurpose(null);
    setShowFamilyPicker(false);
    setFamilyPickerRequested(false);
    setChildPreview(false);
    setParentUnlockedAt(null);
    setLoginMode('parent');
    setCurrentView('login');
    setPendingView(null);
    setSignupConsentAccepted(false);
    setSigningOut(true);
    clearProtectedState();
    void signOut();
  };

  const handleSelectFamilyChild = (childId: string) => {
    setShowFamilyPicker(false);
    setChildPreview(false);
    handleSwitchToChild(childId);
  };

  const handleStayInParentMode = () => {
    setShowFamilyPicker(false);
    setCurrentView('parentDashboard');
    setParentUnlockedAt(Date.now());
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
      return (
        <>
          {parentUnlockedAt !== null && <ParentDashboard onSwitchToChild={handleSwitchToChild} onLogout={handleLogout} signupConsentAccepted={signupConsentAccepted} />}
          {parentUnlockedAt === null && <ParentUnlockModal title="家長模式已鎖定" description="為了保護家庭資料，請輸入家長密碼解鎖。" loading={unlockLoading} error={unlockError} onUnlock={handleUnlock} />}
          {showFamilyPicker && <FamilyChildPicker children={state.children} onSelect={handleSelectFamilyChild} onParentMode={handleStayInParentMode} />}
        </>
      );
    case 'childDashboard':
      return (
        <>
          <ChildDashboard onLogout={handleLogout} onSwitchChild={handleSwitchFromChild} />
          {unlockPurpose && (
            <ParentUnlockModal
              title="切換家庭模式"
              description={unlockPurpose === 'family-switch' ? '輸入家長密碼後，可以選擇其他孩子或進入家長管理端。' : '輸入家長密碼後回到家長管理端。'}
              loading={unlockLoading}
              error={unlockError}
              onCancel={() => { setUnlockPurpose(null); setUnlockError(null); }}
              onUnlock={handleUnlock}
            />
          )}
          {showFamilyPicker && (
            <FamilyChildPicker
              children={state.children}
              onSelect={handleSelectFamilyChild}
              onParentMode={handleStayInParentMode}
            />
          )}
        </>
      );
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
