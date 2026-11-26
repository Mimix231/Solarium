/** Portable DOM implementation derived from spica.runtime.layout_row. */
export function createLayoutRow(children: readonly HTMLElement[], spacing = 2): HTMLDivElement {
  if (!Number.isInteger(spacing) || spacing < 0 || spacing > 8) throw Error('Invalid layout spacing');
  const row = document.createElement('div');row.style.display = 'flex';row.style.flexDirection = 'row';row.style.gap = `${spacing * 4}px`;
  for(const child of children) row.appendChild(child);return row;
}
