/** Portable DOM implementation derived from spica.runtime.ui_button's display contract. */
export function createButton(label: string, onClick: () => void, variant: 'contained'|'outlined'|'text' = 'contained'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';button.textContent = label;button.dataset.variant = variant;
  button.addEventListener('click',onClick);return button;
}
