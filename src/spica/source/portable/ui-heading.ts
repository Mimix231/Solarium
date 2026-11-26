/** Portable DOM implementation derived from spica.runtime.ui_heading. */
export function createHeading(text: string, level: 1|2|3|4|5|6 = 2): HTMLHeadingElement {
  if (!Number.isInteger(level) || level < 1 || level > 6) throw Error('Invalid heading level');
  const heading = document.createElement(`h${level}`) as HTMLHeadingElement;
  heading.textContent = text;return heading;
}
