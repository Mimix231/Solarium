/** Standalone preview compilation. Never resolve packages or fetch remote resources. */
export type PreviewKind = 'html' | 'css' | 'javascript' | 'unsupported' | 'incomplete';
export interface PreviewSource { kind: PreviewKind; html: string; description: string }
const DOCUMENT = /<(?:!doctype|html|head|body|div|main|section|article|button|svg|h[1-6]|p|span|style|script|canvas|form|input|ul|header|footer)\b/i;
const REACT_IMPORT = /\b(?:import\s+.*?(?:from\s+)?['"](?:react|@mui\/|react-dom)|export\s+default\s+function\s+[A-Z]|ReactDOM\.|createRoot\s*\()/s;
const JS = /\b(?:document\.(?:querySelector|getElementById|createElement|body)|addEventListener\s*\(|function\s+\w+\s*\(|const\s+\w+\s*=.*=>)/;
const CSS = /(?:[.#][\w-]+|\b(?:body|html|button|div|:root))\s*(?:\.[\w-]+|:[\w-]+|\[[^\]]+\])?\s*\{[^}]*\}/s;

/** A partial, unfinished stream is not a runnable preview; do not show a blank iframe. */
export function describePreviewSource(input: string, finished = true): PreviewSource {
  const raw = input.trim().replace(/^```(?:html|css|javascript|js)\s*\n/i, '').replace(/\n```\s*$/, '');
  if (!raw) return { kind: 'incomplete', html: '', description: 'Waiting for generated preview content…' };
  if (REACT_IMPORT.test(raw) || /<(?:[A-Z][\w]*)(?:\s|\/>)/.test(raw)) return { kind: 'unsupported', html: '', description: 'React/TSX requires a compiled application bundle. Use an HTML/CSS/JavaScript preview, or save the React files and run the project build. Solarium will not pretend raw TSX can run in an HTML iframe.' };
  if (!finished && (raw.endsWith('<') || /<\/?[\w-]+(?:\s+[^<>]*)?$/.test(raw))) return { kind: 'incomplete', html: '', description: 'Waiting for the rest of the HTML tag…' };
  // Models sometimes output only a <style> element and no visible DOM.
  // Supply a sample so users can actually evaluate the resulting materials.
  const styleOnly = /^<style\b[^>]*>[\s\S]*?<\/style>$/i.test(raw);
  if (styleOnly) return { kind: 'css', html: `${raw}<main class="preview-sample"><h2>Live style preview</h2><p>Preview the generated style on this sample panel.</p><button>Sample button</button></main>`, description: 'Stylesheet applied to sample interface' };
  if (DOCUMENT.test(raw)) return { kind: 'html', html: raw, description: 'Isolated HTML/CSS/JavaScript preview' };
  if (CSS.test(raw)) return { kind: 'css', html: `<style>${raw}</style><main class="preview-sample"><h2>Live style preview</h2><p>Changes to the stylesheet update this isolated sample.</p><button>Sample button</button></main>`, description: 'CSS stylesheet applied to demonstration elements' };
  if (JS.test(raw)) return { kind: 'javascript', html: `<main id="app"></main><script>${raw.replace(/<\/script/gi, '<\\/script')}</script>`, description: 'Standalone JavaScript preview (no package imports)' };
  return { kind: finished ? 'unsupported' : 'incomplete', html: '', description: finished ? 'No runnable HTML, CSS or standalone JavaScript found. Open the editor to inspect or correct the source.' : 'Waiting for runnable preview markup…' };
}
/** Unique nonce is checked with event.source, so unrelated windows cannot impersonate preview events. */
export function createPreviewDocument(preview: PreviewSource, nonce: string): string {
  const key = JSON.stringify(nonce).replace(/</g, '\\u003c');
  const report = `<script>\n(function(){var id=${key};function send(type,message){parent.postMessage({solariumPreview:true,id:id,type:type,message:String(message||'')},'*');}window.addEventListener('error',function(e){send('error',e.message||'Unknown script error');});window.addEventListener('unhandledrejection',function(e){send('error',e.reason&&e.reason.message||e.reason||'Promise rejected');});document.addEventListener('DOMContentLoaded',function(){send('ready','Preview loaded');if(!document.body||!document.body.innerText.trim()&&!document.body.querySelector('canvas,svg,img,video,button,input'))send('empty','The preview loaded, but contains no visible elements.');});})();\n</script>`;
  const csp = `default-src 'none'; base-uri 'none'; connect-src 'none'; form-action 'none'; frame-src 'none'; font-src data:; img-src data: blob:; media-src data: blob:; object-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'`;
  // Prepend CSP before the model's markup, including any generated <head>.
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:18px;font:14px system-ui;color:#1e293b;background:#fff}.preview-sample{max-width:520px;margin:4rem auto;padding:2rem;border:1px solid #ddd;border-radius:15px}.preview-sample button{padding:8px 18px}</style>${report}</head><body>${preview.html}</body></html>`;
}

/** Build a preview from independently streamed code files without executing source in Solarium. */
export function composeWebPreview(files: { language: string; content: string }[]): string {
  const by = (languages: string[]) => files.filter((f) => languages.includes(f.language.toLowerCase())).map((f) => f.content).join('\n');
  const markup = by(['html', 'htm']);
  const styles = by(['css']);
  const javascript = by(['js', 'javascript']);
  if (!markup && !styles && !javascript) return '';
  const escapedScript = javascript.replace(/<\/script/gi, '<\\/script');
  return `${markup || '<main class="preview-sample"><h2>Preview</h2><button>Example</button></main>'}\n${styles ? `<style>${styles}</style>` : ''}\n${javascript ? `<script>${escapedScript}</script>` : ''}`;
}
