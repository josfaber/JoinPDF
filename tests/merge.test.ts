import { describe, expect, it } from "vitest";
import { PDFDocument, PDFName, degrees } from "pdf-lib";
import { countPages, mergePdfs, PdfInputError } from "../src/merge";

async function makePdf(sizes: [number, number][], rotate = 0): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const size of sizes) {
    const page = doc.addPage(size);
    if (rotate) page.setRotation(degrees(rotate));
  }
  return doc.save();
}

describe("mergePdfs", () => {
  it("concatenates pages in the given order", async () => {
    const a = await makePdf([[100, 100], [100, 100]]);
    const b = await makePdf([[200, 300]]);
    const merged = await PDFDocument.load(
      await mergePdfs([
        { name: "b.pdf", bytes: b },
        { name: "a.pdf", bytes: a },
      ]),
    );
    const sizes = merged.getPages().map((p) => [p.getWidth(), p.getHeight()]);
    expect(sizes).toEqual([[200, 300], [100, 100], [100, 100]]);
  });

  it("keeps page rotation", async () => {
    const r = await makePdf([[100, 200]], 90);
    const merged = await PDFDocument.load(await mergePdfs([{ name: "r.pdf", bytes: r }]));
    expect(merged.getPage(0).getRotation().angle).toBe(90);
  });

  it("names the file that is not a PDF", async () => {
    const bad = new TextEncoder().encode("hello, not a pdf");
    const good = await makePdf([[100, 100]]);
    await expect(
      mergePdfs([
        { name: "good.pdf", bytes: good },
        { name: "bad.pdf", bytes: bad },
      ]),
    ).rejects.toMatchObject({ kind: "invalid", fileName: "bad.pdf" });
  });

  it("rejects encrypted PDFs", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.context.trailerInfo.Encrypt = doc.context.obj({ Filter: PDFName.of("Standard") });
    const bytes = await doc.save();
    const err = await countPages({ name: "secret.pdf", bytes }).catch((e) => e);
    expect(err).toBeInstanceOf(PdfInputError);
    expect(err.kind).toBe("encrypted");
  });
});

describe("countPages", () => {
  it("returns the page count", async () => {
    expect(await countPages({ name: "x.pdf", bytes: await makePdf([[1, 1], [1, 1], [1, 1]]) })).toBe(3);
  });
});
