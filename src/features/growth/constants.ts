import { BookOpen, Brush, Dumbbell, HeartHandshake, Home, Sparkles, type LucideIcon } from 'lucide-react';
import type { FeedbackTone, GrowthMood, GrowthTaskStatus, TaskCategory } from './types';

export interface CategoryMeta {
  id: TaskCategory;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  badgeClassName: string;
}

export const TASK_CATEGORIES: CategoryMeta[] = [
  {
    id: 'life_habit',
    label: '生活自理',
    shortLabel: '生活',
    description: '整理、衛生、時間與日常照顧。',
    icon: Home,
    badgeClassName: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    id: 'learning',
    label: '學習成長',
    shortLabel: '學習',
    description: '閱讀、作業、練習與知識探索。',
    icon: BookOpen,
    badgeClassName: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    id: 'health',
    label: '健康體能',
    shortLabel: '健康',
    description: '運動、睡眠、飲食與身體照顧。',
    icon: Dumbbell,
    badgeClassName: 'bg-lime-50 text-lime-700 border-lime-200',
  },
  {
    id: 'relationship',
    label: '人際情緒',
    shortLabel: '情緒',
    description: '表達、同理、情緒調節與人際互動。',
    icon: HeartHandshake,
    badgeClassName: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  {
    id: 'family_contribution',
    label: '家庭貢獻',
    shortLabel: '家庭',
    description: '家事、協助家人與共同生活責任。',
    icon: Sparkles,
    badgeClassName: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    id: 'creativity',
    label: '創造探索',
    shortLabel: '創造',
    description: '畫畫、音樂、手作、實驗與自由創作。',
    icon: Brush,
    badgeClassName: 'bg-violet-50 text-violet-700 border-violet-200',
  },
];

export const DEFAULT_TASK_CATEGORY: TaskCategory = 'life_habit';

export const MOOD_CHOICES: { id: GrowthMood; label: string }[] = [
  { id: 'proud', label: '很有成就' },
  { id: 'happy', label: '開心' },
  { id: 'calm', label: '平穩' },
  { id: 'okay', label: '還可以' },
  { id: 'tired', label: '有點累' },
  { id: 'frustrated', label: '有點挫折' },
];

export const FEEDBACK_TONE_CHOICES: { id: FeedbackTone; label: string }[] = [
  { id: 'encouraging', label: '鼓勵' },
  { id: 'coaching', label: '引導' },
  { id: 'corrective', label: '批改' },
  { id: 'celebratory', label: '慶祝' },
];

export const getTaskCategoryMeta = (category?: string | null) => {
  return TASK_CATEGORIES.find((item) => item.id === category) ?? TASK_CATEGORIES[0];
};

export const getTaskStatusLabel = (status: GrowthTaskStatus) => {
  const labels: Record<GrowthTaskStatus, string> = {
    proposed: '等待確認',
    proposal_revision_requested: '目標需補充',
    todo: '今日目標',
    pending: '等待審核',
    revision_requested: '需要補充',
    completed: '已完成',
  };
  return labels[status];
};

export const getMoodLabel = (mood?: string | null) => {
  return MOOD_CHOICES.find((item) => item.id === mood)?.label ?? '尚未選擇';
};

export const getFeedbackToneLabel = (tone?: string | null) => {
  return FEEDBACK_TONE_CHOICES.find((item) => item.id === tone)?.label ?? '回饋';
};
