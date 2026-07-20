import React from 'react';
import { User, Baby } from 'lucide-react';
import { cn } from '../lib/utils';

interface LandingScreenProps {
  onSelectRole: (role: 'parent' | 'child') => void;
}

export function LandingScreen({ onSelectRole }: LandingScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-blue-50 p-6">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-blue-900 mb-2">小任務大願望</h1>
        <p className="text-blue-600">建立家中的小經濟圈</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={() => onSelectRole('parent')}
          className={cn(
            "w-full flex items-center justify-center gap-4 p-6 rounded-2xl",
            "bg-white shadow-sm border border-blue-100",
            "hover:bg-blue-50 hover:border-blue-200 transition-all",
            "active:scale-[0.98]"
          )}
        >
          <div className="bg-blue-100 p-3 rounded-full text-blue-600">
            <User size={32} />
          </div>
          <span className="text-xl font-medium text-blue-900">我是家長</span>
        </button>

        <button
          onClick={() => onSelectRole('child')}
          className={cn(
            "w-full flex items-center justify-center gap-4 p-6 rounded-2xl",
            "bg-white shadow-sm border border-blue-100",
            "hover:bg-blue-50 hover:border-blue-200 transition-all",
            "active:scale-[0.98]"
          )}
        >
          <div className="bg-yellow-100 p-3 rounded-full text-yellow-600">
            <Baby size={32} />
          </div>
          <span className="text-xl font-medium text-blue-900">我是小孩</span>
        </button>
      </div>
    </div>
  );
}
