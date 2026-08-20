import { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Plus, Trash2, Users, X } from 'lucide-react';
import { CURRENT_WORLD_CHARACTER_ID, WORLD_CHARACTER_CATALOG } from '../../features/characters/world-character-catalog';
import { GameItemLightbox } from '../../features/world/components/GameItemImagePreview';
import type { ChildGender } from '../../types';
import { dismissWithAnimation } from '../../lib/utils';

export interface NewChildProfile {
  gender: ChildGender;
  characterId: string;
}

interface ChildSummary {
  id: string;
  name: string;
  loginName?: string | null;
}

interface ParentSettingsChildrenSectionProps {
  children: ChildSummary[];
  childNameDrafts: Record<string, string>;
  onChildNameDraftChange: (childId: string, name: string) => void;
  onChildNameBlur: (childId: string, name: string) => void;
  onDeleteChild: (childId: string) => void;
  onResetPassword: (childId: string) => void;
  onSetupAccount: (childId: string) => void;
  newChildName: string;
  newChildUsername: string;
  newChildPassword: string;
  newChildPasswordConfirmation: string;
  showNewChildPassword: boolean;
  showNewChildPasswordConfirmation: boolean;
  newChildError: string;
  loading: boolean;
  childAccountSubmitting: boolean;
  onNewChildNameChange: (value: string) => void;
  onNewChildUsernameChange: (value: string) => void;
  onNewChildPasswordChange: (value: string) => void;
  onNewChildPasswordConfirmationChange: (value: string) => void;
  onToggleNewChildPassword: () => void;
  onToggleNewChildPasswordConfirmation: () => void;
  onAddChild: (profile?: NewChildProfile) => Promise<boolean> | boolean;
  newChildGender?: ChildGender | '';
  newChildCharacterId?: string;
  onNewChildGenderChange?: (gender: ChildGender) => void;
  onNewChildCharacterChange?: (characterId: string) => void;
  showNewChildForm: boolean;
  onNewChildFormChange: (show: boolean) => void;
}

export function ParentSettingsChildrenSection({ children, childNameDrafts, onChildNameDraftChange, onChildNameBlur, onDeleteChild, onResetPassword, onSetupAccount, newChildName, newChildUsername, newChildPassword, newChildPasswordConfirmation, showNewChildPassword, showNewChildPasswordConfirmation, newChildError, loading, childAccountSubmitting, onNewChildNameChange, onNewChildUsernameChange, onNewChildPasswordChange, onNewChildPasswordConfirmationChange, onToggleNewChildPassword, onToggleNewChildPasswordConfirmation, onAddChild, newChildGender, newChildCharacterId, onNewChildGenderChange, onNewChildCharacterChange, showNewChildForm, onNewChildFormChange }: ParentSettingsChildrenSectionProps) {
  const [localGender, setLocalGender] = useState<ChildGender | ''>('');
  const [previewCharacterId, setPreviewCharacterId] = useState<string | null>(null);
  const selectedGender = newChildGender ?? localGender;
  const selectedCharacterId = newChildCharacterId || WORLD_CHARACTER_CATALOG[0].id || CURRENT_WORLD_CHARACTER_ID;
  const previewCharacter = WORLD_CHARACTER_CATALOG.find((character) => character.id === previewCharacterId) ?? null;

  const closeNewChildForm = () => {
    setPreviewCharacterId(null);
    dismissWithAnimation(() => onNewChildFormChange(false), '.hh-new-child-drawer', 300);
  };

  useEffect(() => {
    if (!showNewChildForm) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (previewCharacterId) {
        setPreviewCharacterId(null);
        return;
      }
      closeNewChildForm();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [previewCharacterId, showNewChildForm]);

  const selectGender = (gender: ChildGender) => {
    setLocalGender(gender);
    onNewChildGenderChange?.(gender);
  };

  const selectCharacter = (characterId: string) => {
    onNewChildCharacterChange?.(characterId);
    setPreviewCharacterId(characterId);
  };

  const handleAddChild = async () => {
    if (!selectedGender || !selectedCharacterId) return;
    const created = await onAddChild({ gender: selectedGender, characterId: selectedCharacterId });
    if (created) closeNewChildForm();
  };

  return (
    <>
      <section>
        <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4"><Users size={18} /> 小孩帳號管理</h4>
        <div className="space-y-4">
          {children.map(child => (
            <div key={child.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <input type="text" value={childNameDrafts[child.id] ?? child.name} onChange={e => onChildNameDraftChange(child.id, e.target.value)} onBlur={e => onChildNameBlur(child.id, e.target.value)} className="font-bold text-lg bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none w-1/2 min-w-0" placeholder="小孩名字" />
                {children.length > 1 && <button type="button" aria-label="刪除小孩" title="刪除小孩" onClick={() => onDeleteChild(child.id)} className="hh-child-delete-action text-red-500 p-1.5 rounded-lg shrink-0"><Trash2 size={20} /></button>}
              </div>
              <div className="flex items-start gap-2 text-xs text-amber-700"><KeyRound size={16} className="mt-0.5 shrink-0" /><span>{child.loginName ? `登入帳號：${child.loginName}。密碼不會顯示在這裡，忘記時請由家長重新設定。` : '此小孩尚未建立登入帳號。'}</span></div>
              {child.loginName ? <button onClick={() => onResetPassword(child.id)} className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-blue-700 shadow-sm ring-1 ring-blue-100 hover:bg-blue-50">重設小孩密碼</button> : <button onClick={() => onSetupAccount(child.id)} className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-bold text-white hover:bg-blue-600">建立小孩帳號</button>}
            </div>
          ))}
        </div>
      </section>
      <button type="button" data-tour="add-child-trigger" className="hh-add-child-trigger" aria-expanded={showNewChildForm} onClick={() => onNewChildFormChange(true)}><Plus size={18} /> 新增小孩</button>
      {showNewChildForm && <div className="hh-new-child-overlay" role="dialog" aria-modal="true" aria-labelledby="new-child-drawer-title">
        <button type="button" className="hh-new-child-backdrop" aria-label="關閉新增小孩" onClick={closeNewChildForm} />
        <section data-tour="add-child" className="hh-new-child-drawer">
          <header className="hh-new-child-drawer-header">
            <div>
              <p>家庭成員</p>
              <h3 id="new-child-drawer-title">新增小孩</h3>
            </div>
            <button type="button" className="hh-new-child-close" onClick={closeNewChildForm} aria-label="關閉新增小孩"><X size={22} /></button>
          </header>
          <div className="hh-new-child-drawer-content">
        <input data-tour="new-child-name" type="text" placeholder="名字" value={newChildName} onChange={e => onNewChildNameChange(e.target.value)} className="mb-2 w-full p-2.5 rounded-xl border border-blue-200 outline-none focus:ring-2 focus:ring-blue-400 min-w-0" />
        <fieldset className="mb-3" aria-required="true">
          <legend className="mb-2 text-sm font-bold text-blue-900">選擇性別</legend>
          <div role="radiogroup" aria-label="小孩性別" className="grid grid-cols-2 gap-2">
            {(['boy', 'girl'] as const).map(gender => (
              <button key={gender} type="button" role="radio" aria-checked={selectedGender === gender} aria-label={gender === 'boy' ? '男孩' : '女孩'} onClick={() => selectGender(gender)} className="hh-gender-option">{gender === 'boy' ? '男孩' : '女孩'}</button>
            ))}
          </div>
        </fieldset>
        <fieldset className="mb-3" aria-required="true">
          <legend className="mb-2 text-sm font-bold text-blue-900">選擇冒險人物</legend>
          <div role="radiogroup" aria-label="冒險人物" className="hh-world-character-options">
            {WORLD_CHARACTER_CATALOG.map((character) => (
              <button
                key={character.id}
                type="button"
                role="radio"
                aria-checked={selectedCharacterId === character.id}
                aria-haspopup="dialog"
                aria-expanded={previewCharacterId === character.id}
                aria-label={character.name}
                onClick={() => selectCharacter(character.id)}
                className="hh-world-character-option"
              >
                <span className="hh-world-character-option-image"><img src={character.thumbnailUrl} alt="" /></span>
                <span className="hh-world-character-option-copy"><strong>{character.name}</strong><small>{character.description}</small></span>
              </button>
            ))}
          </div>
        </fieldset>
        <GameItemLightbox item={previewCharacter} onClose={() => setPreviewCharacterId(null)} />
        <input type="text" autoComplete="username" placeholder="小孩帳號名稱，例如 leo123" value={newChildUsername} onChange={e => onNewChildUsernameChange(e.target.value)} className="mb-2 w-full rounded-xl border border-blue-200 p-2.5 outline-none focus:ring-2 focus:ring-blue-400 min-w-0" />
        <div className="relative mb-2"><input type={showNewChildPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="小孩密碼（至少 6 碼英數）" value={newChildPassword} onChange={e => onNewChildPasswordChange(e.target.value)} className="w-full rounded-xl border border-blue-200 p-2.5 pr-11 outline-none focus:ring-2 focus:ring-blue-400 min-w-0" /><button type="button" onClick={onToggleNewChildPassword} aria-label={showNewChildPassword ? '隱藏小孩密碼' : '顯示小孩密碼'} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 hover:text-gray-700">{showNewChildPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
        <div className="relative mb-2"><input type={showNewChildPasswordConfirmation ? 'text' : 'password'} autoComplete="new-password" placeholder="再次輸入小孩密碼" value={newChildPasswordConfirmation} onChange={e => onNewChildPasswordConfirmationChange(e.target.value)} className="w-full rounded-xl border border-blue-200 p-2.5 pr-11 outline-none focus:ring-2 focus:ring-blue-400 min-w-0" /><button type="button" onClick={onToggleNewChildPasswordConfirmation} aria-label={showNewChildPasswordConfirmation ? '隱藏確認密碼' : '顯示確認密碼'} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 hover:text-gray-700">{showNewChildPasswordConfirmation ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
        {newChildError && <p role="alert" className="mb-3 text-xs leading-5 text-red-600">{newChildError}</p>}
        <p className="mb-3 text-xs leading-5 text-blue-800">帳號名稱需 3–32 碼英數或底線；小孩可在任何裝置用帳號與密碼登入。</p>
        <button data-tour="create-child" onClick={handleAddChild} disabled={!newChildName.trim() || !newChildUsername || !newChildPassword || !newChildPasswordConfirmation || !selectedGender || loading || childAccountSubmitting} aria-busy={childAccountSubmitting} className="w-full rounded-xl bg-blue-500 py-2 font-bold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50">{childAccountSubmitting ? '建立中…' : '建立小孩'}</button>
          </div>
        </section>
      </div>}
    </>
  );
}
