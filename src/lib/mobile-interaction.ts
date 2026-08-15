export const APP_EDITABLE_TARGET_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[data-allow-text-selection="true"]',
].join(', ');

export interface AppInteractionEvent {
  target: EventTarget | null;
  preventDefault: () => void;
}

export function isEditableInteractionTarget(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false;
  return Boolean(target.closest(APP_EDITABLE_TARGET_SELECTOR));
}

export function preventNativeAppContextMenu(event: AppInteractionEvent): void {
  if (!isEditableInteractionTarget(event.target)) event.preventDefault();
}

export function preventNativeAppTextSelection(event: AppInteractionEvent): void {
  if (!isEditableInteractionTarget(event.target)) event.preventDefault();
}

export function preventNativeAppDragStart(event: AppInteractionEvent): void {
  if (!isEditableInteractionTarget(event.target)) event.preventDefault();
}
