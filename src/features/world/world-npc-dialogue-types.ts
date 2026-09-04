export type WorldNpcDialogueRepeatCondition =
  | 'completed_adventure_today'
  | 'not_completed_adventure_today'
  | 'owns_oum'
  | 'owns_arcadia'
  | 'owns_jasmine'
  | 'owns_qifu_er'
  | 'owns_nibus'
  | 'owns_orian'
  | 'owns_christo'
  | 'owns_kaldo'
  | 'owns_moko';

export interface WorldNpcDialogueChoice {
  id: string;
  label: string;
  response: string;
}

export interface WorldNpcDialogueRepeatLine {
  id: string;
  text: string;
  condition?: WorldNpcDialogueRepeatCondition;
}

export interface WorldNpcDialogueContent {
  opening: readonly string[];
  choicePrompt: string;
  choices: readonly WorldNpcDialogueChoice[];
  closing: readonly string[];
  repeat: readonly WorldNpcDialogueRepeatLine[];
}

export interface WorldNpcDialogueContentContext {
  hasCompletedAdventureToday?: boolean;
  ownedCatalogItemIds?: readonly string[];
}
