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
    target: 'add-child',
    eyebrow: '第 2 步／建立家庭成員',
    title: '新增小孩',
    description: '在這個區塊輸入孩子名字、登入帳號與密碼。任務一定要指定給小孩，所以這是開始使用前最重要的一步。',
    icon: UserRound,
  },
  {
    target: 'create-child',
    eyebrow: '第 3 步／完成建立',
    title: '按下建立小孩',
    description: '確認資料後按這個按鈕。建立完成後，請把登入帳號與密碼交給孩子；密碼之後不會在管理端顯示。',
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
    target: 'tasks-tab',
    eyebrow: '第 5 步／開始派任務',
    title: '切換到任務分頁',
    description: '所有要交給孩子做的事情，都會從任務分頁建立。第一次建議只建立一件簡單、明確的事情。',
    icon: ListChecks,
  },
  {
    target: 'task-add',
    eyebrow: '第 6 步／建立任務',
    title: '按新增任務',
    description: '接下來輸入任務名稱、完成可得的點數，也可以設定開始時間與預估時間。孩子完成後，這個任務就會出現在他的畫面。',
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
    target: 'review-tab',
    eyebrow: '第 8 步／看孩子的回報',
    title: '到審核分頁給回饋',
    description: '孩子完成任務並提交心得後，這裡會出現待審核項目。閱讀孩子的心得，核准後就會得到點數；需要補充時也能退回修改。',
    icon: CheckCircle2,
  },
  {
    target: 'rewards-tab',
    eyebrow: '第 9 步／設定孩子想要的目標',
    title: '設定獎勵完成循環',
    description: '到獎勵分頁新增孩子期待的獎勵並設定點數。孩子存夠點數後可以兌換，你再按「已兌現」。',
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
      target?.scrollIntoView({ block: shouldCenterTarget || shouldCenterTaskField ? 'center' : 'nearest', inline: 'nearest', behavior });
      measureTarget();
    };
    positionTarget('auto');
    // Bottom-sheet forms and the mobile settings drawer animate/scroll into
    // place. Reveal the guide only after their final position is measurable.
    const settleDelay = step.target === 'task-name' || step.target === 'add-child' ? 360 : 0;
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
          <svg key={`guide-backdrop-${stepIndex}-${positionReady ? 'ready' : 'waiting'}`} className="hh-first-use-guide-fade-in pointer-events-none fixed inset-0 h-full w-full" aria-hidden="true">
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
