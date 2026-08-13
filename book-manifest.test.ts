import { describe, expect, it } from "vitest";
import { BOOK_PAGES, findPage } from "./book-manifest";
import { connectedGroupsLesson } from "./lesson-connected-groups";
import { illegalMovesLesson } from "./lesson-illegal-moves";
import { libertiesAndCaptureLesson } from "./lesson-liberties-capture";
import { placingStonesLesson } from "./lesson-placing-stones";

describe("book manifest", () => {
  it("orders the book cover -> contents -> four chapters -> closing", () => {
    expect(BOOK_PAGES.map((page) => page.id)).toEqual([
      "cover",
      "contents",
      "placing-stones",
      "liberties-and-capture",
      "connected-groups",
      "illegal-moves",
      "closing",
    ]);
  });

  it("every chapter id matches its lesson definition's id, so the two never drift apart", () => {
    expect(findPage("placing-stones")?.id).toBe(placingStonesLesson.id);
    expect(findPage("liberties-and-capture")?.id).toBe(libertiesAndCaptureLesson.id);
    expect(findPage("connected-groups")?.id).toBe(connectedGroupsLesson.id);
    expect(findPage("illegal-moves")?.id).toBe(illegalMovesLesson.id);
  });

  it("every page has a unique id and a unique path", () => {
    expect(new Set(BOOK_PAGES.map((page) => page.id)).size).toBe(BOOK_PAGES.length);
    expect(new Set(BOOK_PAGES.map((page) => page.path)).size).toBe(BOOK_PAGES.length);
  });

  it("only the four chapters carry a chapter kicker", () => {
    const withKicker = BOOK_PAGES.filter((page) => page.chapterKicker);
    expect(withKicker.map((page) => page.id)).toEqual([
      "placing-stones",
      "liberties-and-capture",
      "connected-groups",
      "illegal-moves",
    ]);
  });

  it("findPage returns undefined for an unknown id", () => {
    expect(findPage("nope")).toBeUndefined();
  });
});
