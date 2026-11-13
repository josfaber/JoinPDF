import { PDFDocument } from "pdf-lib";

export class PdfInputError extends Error {
  constructor(
    public readonly kind: "encrypted" | "invalid",
    public readonly fileName: string,
  ) {
    super(
      kind === "encrypted"
        ? `${fileName} is password-protected and can't be merged.`
        : `${fileName} is not a valid PDF or is damaged.`,
    );
    this.name = "PdfInputError";
  }
}

export interface PdfInput {
  name: string;
  bytes: Uint8Array;
}

export async function loadPdf(input: PdfInput): Promise<PDFDocument> {
  let doc: PDFDocument;
  try {
    // pdf-lib's EncryptedPDFError doesn't survive `instanceof` (ES5 build), so
    // load with ignoreEncryption and check the flag ourselves.
    doc = await PDFDocument.load(input.bytes, { updateMetadata: false, ignoreEncryption: true });
  } catch {
    throw new PdfInputError("invalid", input.name);
  }
  if (doc.isEncrypted) throw new PdfInputError("encrypted", input.name);
  return doc;
}

export async function countPages(input: PdfInput): Promise<number> {
  return (await loadPdf(input)).getPageCount();
}

export async function mergePdfs(inputs: PdfInput[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const input of inputs) {
    const src = await loadPdf(input);
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const page of pages) out.addPage(page);
  }
  out.setProducer("JoinPDF");
  out.setCreator("JoinPDF");
  return out.save();
}
