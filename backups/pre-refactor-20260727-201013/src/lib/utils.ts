import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Keep a modal mounted long enough to play its directional exit animation. */
export function dismissWithAnimation(onDismiss: () => void, selector = '.hh-form-modal-panel', duration = 300) {
  const panel = document.querySelector<HTMLElement>(selector);
  if (!panel) {
    onDismiss();
    return;
  }

  panel.classList.add('hh-modal-exit');
  window.setTimeout(onDismiss, duration);
}
