// Test-only ambient contracts for desktop/browser dependencies unavailable in the headless test runner.
declare module '@tauri-apps/api/core' {
  export function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  export class Channel<T> { onmessage: (message: T) => void; }
}
declare module 'pdfjs-dist' {
  export const GlobalWorkerOptions: { workerSrc: string };
  export function getDocument(options: Record<string, unknown>): { promise: Promise<{ numPages: number; getPage(page: number): Promise<{getTextContent(): Promise<{items: Array<{str?: string}>}>}>}> };
}
declare module 'pdfjs-dist/build/pdf.worker.min.mjs?url' { const url: string; export default url; }
declare module 'mammoth/mammoth.browser' {
  const mammoth: {extractRawText(input: {arrayBuffer: ArrayBuffer}): Promise<{value:string}>};
  export default mammoth;
}
