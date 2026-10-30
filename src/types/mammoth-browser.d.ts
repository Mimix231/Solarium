declare module 'mammoth/mammoth.browser' {
  interface Extracted { value: string; messages: { type: string; message: string }[] }
  const mammoth: { extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<Extracted> };
  export default mammoth;
}
declare module 'pdfjs-dist/build/pdf.worker.min.mjs?url' {
  const url: string;
  export default url;
}
