import { MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  getWorldNpcRepeatDialogueLines,
  type WorldNpcDialogueContent,
} from '../world-npc-dialogue-content';

interface WorldNpcDialogueConversationProps {
  npcId: string;
  npcName: string;
  content: WorldNpcDialogueContent;
  talked: boolean;
  busy: boolean;
  hasCompletedAdventureToday: boolean;
  ownedCatalogItemIds: readonly string[];
  onTalk: () => Promise<void>;
  onComplete: () => void;
}

type ConversationPhase = 'first' | 'repeat' | 'complete';

export function WorldNpcDialogueConversation({
  npcId,
  npcName,
  content,
  talked,
  busy,
  hasCompletedAdventureToday,
  ownedCatalogItemIds,
  onTalk,
  onComplete,
}: WorldNpcDialogueConversationProps) {
  const [phase, setPhase] = useState<ConversationPhase>(() => talked ? 'repeat' : 'first');
  const [stage, setStage] = useState<'opening' | 'choice' | 'response' | 'closing'>('opening');
  const [lineIndex, setLineIndex] = useState(0);
  const [choiceResponse, setChoiceResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const repeatLines = getWorldNpcRepeatDialogueLines(npcId, {
    hasCompletedAdventureToday,
    ownedCatalogItemIds,
  });

  useEffect(() => {
    setPhase(talked ? 'repeat' : 'first');
    setStage('opening');
    setLineIndex(0);
    setChoiceResponse(null);
    setError(null);
  }, [npcId]);

  const handleOpeningContinue = () => {
    if (lineIndex < content.opening.length - 1) {
      setLineIndex((current) => current + 1);
      return;
    }
    setStage('choice');
  };

  const handleChoice = (response: string) => {
    setChoiceResponse(response);
    setStage('response');
  };

  const handleResponseContinue = () => {
    setLineIndex(0);
    setStage('closing');
  };

  const handleClosingContinue = () => {
    if (lineIndex < content.closing.length - 1) {
      setLineIndex((current) => current + 1);
      return;
    }
    void handleComplete();
  };

  const handleComplete = async () => {
    if (busy) return;
    setError(null);
    try {
      await onTalk();
      setPhase('complete');
      onComplete();
    } catch {
      setError('對話同步失敗，請稍後再試。');
    }
  };

  if (phase === 'first') {
    let text = content.opening[lineIndex] ?? content.opening[0];
    let actionLabel = '下一步';
    let onAction = handleOpeningContinue;
    let choices: typeof content.choices | undefined;

    if (stage === 'choice') {
      text = content.choicePrompt;
      choices = content.choices;
    } else if (stage === 'response') {
      text = choiceResponse ?? '';
      actionLabel = '下一步';
      onAction = handleResponseContinue;
    } else if (stage === 'closing') {
      text = content.closing[lineIndex] ?? content.closing[content.closing.length - 1];
      actionLabel = lineIndex === content.closing.length - 1 ? '完成對話' : '下一步';
      onAction = handleClosingContinue;
    }

    return (
      <div className="hh-world-npc-dialogue-conversation" aria-live="polite">
        <p className="hh-world-npc-dialogue-speaker"><MessageCircle size={16} aria-hidden="true" /> {npcName}</p>
        <p className="hh-world-npc-dialogue-line">{text}</p>
        {choices ? (
          <div className="hh-world-npc-dialogue-choices" aria-label={`${npcName}的對話選項`}>
            {choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                className="hh-game-action-button hh-world-npc-dialogue-choice"
                onClick={() => handleChoice(choice.response)}
              >
                {choice.label}
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            className="hh-game-action-button hh-game-action-button--primary"
            disabled={busy}
            onClick={onAction}
          >
            <MessageCircle size={17} aria-hidden="true" /> {busy ? '同步中…' : actionLabel}
          </button>
        )}
        {error && <p className="hh-game-field-hint" role="alert">{error}</p>}
      </div>
    );
  }

  if (phase === 'complete') return null;

  const repeatLine = repeatLines[0];

  return (
    <div className="hh-world-npc-dialogue-conversation hh-world-npc-dialogue-conversation--repeat" aria-live="polite">
      <p className="hh-world-npc-dialogue-speaker"><MessageCircle size={16} aria-hidden="true" /> {npcName}</p>
      <p className="hh-world-npc-dialogue-line">{repeatLine?.text ?? '很高興又見到你。'}</p>
      <button
        type="button"
        className="hh-game-action-button hh-game-action-button--primary"
        onClick={() => {
          setPhase('complete');
          onComplete();
        }}
      >
        <MessageCircle size={17} aria-hidden="true" /> 下一步
      </button>
    </div>
  );
}
