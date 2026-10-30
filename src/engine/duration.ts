/** Human-readable elapsed duration, without exposing internal inference segment boundaries. */
export function formatThinkingDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hour = Math.floor(seconds / 3600);
  const minute = Math.floor((seconds % 3600) / 60);
  const second = seconds % 60;
  if (hour) return `${hour}h ${minute}m ${second}s`;
  if (minute) return `${minute}m ${second}s`;
  return `${second}s`;
}
