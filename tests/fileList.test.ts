import { describe, expect, it } from "vitest";
import { FileList } from "../src/fileList";

const names = (l: FileList) => l.items.map((e) => e.name);

describe("FileList", () => {
  it("adds paths once and keeps order", () => {
    const l = new FileList();
    l.add(["/a/1.pdf", "C:\\b\\2.pdf", "/a/1.pdf"]);
    expect(names(l)).toEqual(["1.pdf", "2.pdf"]);
  });

  it("setOrder follows the given ids", () => {
    const l = new FileList();
    l.add(["1.pdf", "2.pdf", "3.pdf"]);
    const [a, b, c] = l.items.map((e) => e.id);
    l.setOrder([c, a, b]);
    expect(names(l)).toEqual(["3.pdf", "1.pdf", "2.pdf"]);
  });

  it("setOrder keeps entries missing from ids at the end", () => {
    const l = new FileList();
    l.add(["1.pdf", "2.pdf", "3.pdf"]);
    const [, b] = l.items.map((e) => e.id);
    l.setOrder([b, 9999]);
    expect(names(l)).toEqual(["2.pdf", "1.pdf", "3.pdf"]);
  });
});
