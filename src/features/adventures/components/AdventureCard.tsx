import { ChevronDown, Plus } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { AdventureProgress, AdventureTask } from '../types';
import { AdventureTaskRow } from './AdventureTaskRow';

interface AdventureCardProps {
  id: string;
  title: string;
  emptyMessage: string;
  tasks: AdventureTask[];
  progress: AdventureProgress;
  expanded: boolean;
  allowCreate?: boolean;
  onToggle: () => void;
  onTaskSelect: (task: AdventureTask) => void;
  onCreate?: () => void;
}

export function AdventureCard({
  id,
  title,
  emptyMessage,
  tasks,
  progress,
  expanded,
  allowCreate = false,
  onToggle,
  onTaskSelect,
  onCreate,
}: AdventureCardProps) {
  const generatedId = useId();
  const contentId = `${id}-${generatedId.replace(/:/g, '')}`;
  const [mounted, setMounted] = useState(expanded);
  const [visible, setVisible] = useState(false);
  const openFrame = useRef<number | null>(null);
  const closeFallback = useRef<number | null>(null);

  useEffect(() => {
    if (openFrame.current !== null) {
      cancelAnimationFrame(openFrame.current);
      openFrame.current = null;
    }
    if (closeFallback.current !== null) {
      window.clearTimeout(closeFallback.current);
      closeFallback.current = null;
    }

    if (expanded) {
      setMounted(true);
      openFrame.current = requestAnimationFrame(() => {
        setVisible(true);
        openFrame.current = null;
      });
    } else {
      setVisible(false);
      closeFallback.current = window.setTimeout(() => {
        setMounted(false);
        closeFallback.current = null;
      }, 260);
    }

    return () => {
      if (openFrame.current !== null) cancelAnimationFrame(openFrame.current);
      if (closeFallback.current !== null) window.clearTimeout(closeFallback.current);
    };
  }, [expanded]);

  return (
    <section className={`hh-adventure-card${expanded ? ' is-expanded' : ''}`}>
      <button
        type="button"
        className="hh-adventure-button hh-adventure-card-trigger"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={onToggle}
      >
        <span className="hh-adventure-card-title">{title}</span>
        <span className="hh-adventure-card-progress" aria-label={`完成 ${progress.completed} 個，共 ${progress.total} 個`}>
          {progress.completed}/{progress.total}
        </span>
        <ChevronDown className="hh-adventure-card-chevron" size={20} aria-hidden="true" />
      </button>

      {mounted && (
        <div
          id={contentId}
          className={`hh-adventure-card-content${visible ? ' is-visible' : ' is-leaving'}`}
          aria-hidden={!expanded}
          inert={!expanded}
          onTransitionEnd={(event) => {
            if (event.target !== event.currentTarget || event.propertyName !== 'opacity') return;
            if (!expanded) setMounted(false);
          }}
        >
          {tasks.length === 0 ? (
            <p className="hh-adventure-empty">{emptyMessage}</p>
          ) : (
            <ul className="hh-adventure-task-list">
              {tasks.map((task) => (
                <AdventureTaskRow
                  key={task.id}
                  task={task}
                  tabIndex={expanded ? 0 : -1}
                  onSelect={onTaskSelect}
                />
              ))}
            </ul>
          )}
          {allowCreate && onCreate && (
            <button
              type="button"
              className="hh-adventure-button hh-adventure-task-control hh-adventure-create"
              tabIndex={expanded ? 0 : -1}
              onClick={onCreate}
            >
              <Plus className="hh-adventure-create-icon" size={20} aria-hidden="true" />
              <span className="hh-adventure-create-label">我想新增冒險</span>
            </button>
          )}
        </div>
      )}
    </section>
  );
}
