import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Baby, CheckCircle2, Gift, ListChecks, Settings, Sparkles, UserRound } from 'lucide-react';

export const FIRST_USE_GUIDE_STORAGE_KEY = 'habithero:first-use-guide:v1';

type GuideStep = {
  target: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof Sparkles;
};

const guideSteps: GuideStep[] = [
  {
    target: 'settings',
    eyebrow: '第 1 步／先從這裡開始',
    title: '先開啟設定',
    description: '這個齒輪是家長的設定入口。建立小孩帳號、修改孩子資料與重新觀看新手指引，都在這裡。',
    icon: Settings,
  },
  {
    target: 'add-child-trigger',
    eyebrow: '第 2 步／建立家庭成員',
    title: '找到新增小孩',
    description: '設定裡的「新增小孩」會開啟家庭成員表單。任務一定要指定給小孩，所以這是開始使用前最重要的一步。',
    icon: UserRound,
  },
  {
    target: 'add-child',
    eyebrow: '第 3 步／完成建立',
    title: '建立小孩帳號',
    description: '在這個抽屜填寫名字、性別、人物、登入帳號與密碼。建立後，請把登入帳號與密碼交給孩子；密碼之後不會在管理端顯示。',
    icon: UserRound,
  },
  {
    target: 'child-view',
    eyebrow: '第 4 步／讓孩子知道怎麼用',
    title: '孩子可以登入自己的畫面',
    description: '孩子在登入頁選「小孩登入」，輸入你剛剛建立的帳號。你也可以按這個小孩圖示預覽孩子看到的畫面。',
    icon: Baby,
  },
  {
    target: 'tasks-menu',
    eyebrow: '第 5 步／開始派任務',
    title: '開啟任務選單',
    description: '家長首頁的「任務」選單可以查看今日任務、常用模板，以及建立新的任務。',
    icon: ListChecks,
  },
  {
    target: 'add-task-menu',
    eyebrow: '第 6 步／建立任務',
    title: '選擇新增任務',
    description: '從任務子選單選擇「新增任務」，接著輸入任務名稱、完成可得的點數，也可以設定開始時間與預估時間。',
    icon: ListChecks,
  },
  {
    target: 'task-name',
    eyebrow: '第 7 步／填寫第一個任務',
    title: '輸入一件具體的小事',
    description: '在這裡輸入孩子看得懂、做得到的事情，例如「睡前刷牙」或「整理書包」。完成後按表單下方的「新增」。',
    icon: CheckCircle2,
  },
  {
    target: 'review-menu',
    eyebrow: '第 8 步／看孩子的回報',
    title: '開啟審核選單',
    description: '孩子完成任務並提交心得後，從家長首頁的「審核」選單查看待確認目標、待審核完成與待兌換獎勵。',
    icon: CheckCircle2,
  },
  {
    target: 'rewards-menu',
    eyebrow: '第 9 步／設定孩子想要的目標',
    title: '開啟獎勵選單',
    description: '從家長首頁的「獎勵」選單查看待兌換項目、獎勵清單，或新增孩子期待的獎勵並設定點數。',
    icon: Gift,
  },
  {
    target: 'growth-menu',
    eyebrow: '第 10 步／觀察家庭成長',
    title: '開啟成長選單',
    description: '從家長首頁的「成長」選單查看成長紀錄與完成任務，幫助你看見孩子持續努力的進步。',
    icon: Sparkles,
  },
  {
    target: 'wishlist-menu',
    eyebrow: '第 11 步／回應孩子的期待',
    title: '開啟許願選單',
    description: '從家長首頁的「許願」選單查看孩子提出的願望，設定點數後就能把願望加入獎勵清單。',
    icon: Gift,
  },
];

interface FirstUseGuideProps {
  onClose: () => void;
  onStepChange?: (stepIndex: number) => void;
}

export function hasCompletedFirstUseGuide() {
  try {
    return window.localStorage.getItem(FIRST_USE_GUIDE_STORAGE_KEY) === 'completed';
  } catch {
    return false;
  }
}

export function completeFirstUseGuide() {
  try {
    window.localStorage.setItem(FIRST_USE_GUIDE_STORAGE_KEY, 'completed');
  } catch {
    // Private browsing or restricted storage should not prevent using the app.
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function FirstUseGuide({ onClose, onStepChange }: FirstUseGuideProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [positionReady, setPositionReady] = useState(true);
  const [activeTarget, setActiveTarget] = useState('settings');
  const copyRef = useRef<HTMLDivElement>(null);
  const [copyHeight, setCopyHeight] = useState(150);
  const step = guideSteps[stepIndex];
  const StepIcon = step.icon;
  const isLastStep = stepIndex === guideSteps.length - 1;

  const measureTarget = () => {
    const primaryTarget = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    const fallbackTarget = step.target === 'task-name'
      ? document.querySelector<HTMLElement>('[data-tour="task-card"]')
      : null;
    const target = primaryTarget ?? fallbackTarget;
    if (!target) {
      setTargetRect(null);
      return;
    }
    setActiveTarget(primaryTarget ? step.target : 'task-card');
    setTargetRect(target.getBoundingClientRect());
  };

  useLayoutEffect(() => {
    setPositionReady(false);
    setActiveTarget(step.target);
    const shouldCenterTarget = step.target === 'add-child' && window.innerWidth <= 640;
    const shouldCenterTaskField = step.target === 'task-name';
    const positionTarget = (behavior: ScrollBehavior) => {
      const target = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
        ?? (step.target === 'task-name' ? document.querySelector<HTMLElement>('[data-tour="task-card"]') : null);
      if (target && getComputedStyle(target).position !== 'fixed') {
        target.scrollIntoView({ block: shouldCenterTarget || shouldCenterTaskField ? 'center' : 'nearest', inline: 'nearest', behavior });
      }
      measureTarget();
    };
    positionTarget('auto');
    // Bottom-sheet forms and the mobile settings drawer animate/scroll into
    // place. Reveal the guide only after their final position is measurable.
    const settleDelay = [
      'add-child-trigger',
      'add-child',
      'tasks-menu',
      'add-task-menu',
      'task-name',
      'review-menu',
      'rewards-menu',
      'growth-menu',
      'wishlist-menu',
    ].includes(step.target) ? 240 : 0;
    const settleTimer = settleDelay > 0
      ? window.setTimeout(() => {
        positionTarget('auto');
        setPositionReady(true);
      }, settleDelay)
      : undefined;
    if (settleDelay === 0) setPositionReady(true);
    const handleViewportChange = () => measureTarget();
    const observer = new MutationObserver(measureTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      if (settleTimer !== undefined) window.clearTimeout(settleTimer);
      observer.disconnect();
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [step.target]);

  useEffect(() => {
    copyRef.current?.focus();
  }, [stepIndex]);

  useLayoutEffect(() => {
    const copy = copyRef.current;
    if (!copy) return undefined;
    const updateCopyHeight = () => setCopyHeight(copy.offsetHeight);
    updateCopyHeight();
    const observer = new ResizeObserver(updateCopyHeight);
    observer.observe(copy);
    return () => observer.disconnect();
  }, [stepIndex, targetRect]);

  const finish = () => {
    completeFirstUseGuide();
    onClose();
  };

  const goToStep = (nextIndex: number) => {
    onStepChange?.(nextIndex);
    setStepIndex(nextIndex);
  };

  const spotlightPadding = 8;
  const visibleTargetRect = positionReady ? targetRect : null;
  const left = visibleTargetRect ? visibleTargetRect.left - spotlightPadding : 16;
  const top = visibleTargetRect ? visibleTargetRect.top - spotlightPadding : 16;
  const width = visibleTargetRect ? visibleTargetRect.width + spotlightPadding * 2 : 0;
  const height = visibleTargetRect ? visibleTargetRect.height + spotlightPadding * 2 : 0;
  const copyWidth = Math.min(390, window.innerWidth - 32);
  const copyLeft = visibleTargetRect ? clamp(visibleTargetRect.left + visibleTargetRect.width / 2 - copyWidth / 2, 16, window.innerWidth - copyWidth - 16) : 16;
  const copyTopLimit = 16;
  const copyBottomLimit = window.innerHeight - 16;
  const copyBelowTop = visibleTargetRect ? visibleTargetRect.bottom + 18 : 24;
  const copyAboveTop = visibleTargetRect ? visibleTargetRect.top - copyHeight - 18 : 24;
  const copyTop = visibleTargetRect && copyBelowTop + copyHeight <= copyBottomLimit
    ? copyBelowTop
    : visibleTargetRect && copyAboveTop >= 16
      ? copyAboveTop
    : copyTopLimit;
  const copyStyle = { left: copyLeft, top: copyTop, width: copyWidth, maxHeight: 'calc(100dvh - 32px)' };
  const showingCreatedTask = activeTarget === 'task-card';

  return (
    <div className="fixed inset-0 z-[80]" role="presentation">
          <svg key={`guide-backdrop-${stepIndex}-${positionReady ? 'ready' : 'waiting'}`} className="pointer-events-none fixed inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <mask id="first-use-guide-mask">
            <rect width="100%" height="100%" fill="white" />
            {visibleTargetRect && <rect x={left} y={top} width={width} height={height} rx="18" fill="black" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(7, 24, 38, 0.68)" mask="url(#first-use-guide-mask)" />
      </svg>

      {visibleTargetRect && (
        <div
          key={`guide-spotlight-${stepIndex}-${activeTarget}-${positionReady ? 'ready' : 'waiting'}`}
          className="hh-first-use-guide-fade-in pointer-events-none fixed rounded-[18px] border-2 border-white shadow-[0_0_0_4px_rgba(31,186,208,0.95),0_0_24px_8px_rgba(31,186,208,0.5)]"
          style={{ left, top, width, height }}
          aria-hidden="true"
        />
      )}

      <section
        key={`guide-copy-${stepIndex}-${positionReady ? 'ready' : 'waiting'}`}
        ref={copyRef}
        tabIndex={-1}
        className="hh-first-use-guide-fade-in pointer-events-auto fixed overflow-y-auto p-1 text-white outline-none [text-shadow:0_2px_8px_rgba(0,0,0,0.9)] sm:p-2"
        style={{ ...copyStyle, visibility: positionReady ? 'visible' : 'hidden' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-use-guide-title"
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <StepIcon size={21} aria-hidden="true" />
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-cyan-200">{step.eyebrow}</p>
              <p className="mt-1 text-xs font-bold text-white/75">{stepIndex + 1} / {guideSteps.length}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <button type="button" onClick={finish} className="min-h-8 rounded-lg px-2 text-[11px] font-bold text-white/80 transition-colors hover:bg-black/20 hover:text-white">跳過</button>
            <div className="flex gap-1">
              <button type="button" onClick={() => goToStep(Math.max(0, stepIndex - 1))} disabled={stepIndex === 0} className="flex min-h-8 items-center gap-0.5 rounded-lg border border-white/60 bg-black/20 px-1.5 text-[11px] font-bold text-white transition-colors hover:bg-black/40 disabled:cursor-not-allowed disabled:opacity-40">
                <ArrowLeft size={13} aria-hidden="true" /> 上一步
              </button>
              <button type="button" onClick={() => isLastStep ? finish() : goToStep(stepIndex + 1)} className="flex min-h-8 items-center gap-0.5 rounded-lg border border-cyan-200 bg-cyan-600/90 px-1.5 text-[11px] font-bold text-white transition-colors hover:bg-cyan-500">
                {isLastStep ? '完成' : '下一步'}
                {!isLastStep && <ArrowRight size={13} aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>
        <h2 id="first-use-guide-title" className="text-xl font-black leading-tight text-white">{showingCreatedTask ? '任務已經建立' : step.title}</h2>
        <p className="mt-2 text-sm leading-6 text-white/95">{showingCreatedTask ? '這張就是剛剛建立的任務卡片。孩子完成任務並提交心得後，你會在審核分頁看到回報。' : step.description}</p>
      </section>

    </div>
  );
}
