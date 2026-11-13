// Generates test-pdfs/1.pdf … 5.pdf, each an A4 page with one big number.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { writeFileSync } from "node:fs";

for (let n = 1; n <= 5; n++) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]);
  const text = String(n), size = 400;
  page.drawText(text, {
    x: (595 - font.widthOfTextAtSize(text, size)) / 2,
    y: (842 - font.heightAtSize(size)) / 2,
    size, font, color: rgb(0.1, 0.1, 0.1),
  });
  writeFileSync(new URL(`${n}.pdf`, import.meta.url), await doc.save());
}
