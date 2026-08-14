import { describe, expect, it } from "vitest";
import { BOOK_PAGES, findPage } from "./book-manifest";
import { connectedGroupsLesson } from "./lesson-connected-groups";
import { illegalMovesLesson } from "./lesson-illegal-moves";
import { koLesson } from "./lesson-ko";
import { libertiesAndCaptureLesson } from "./lesson-liberties-capture";
import { placingStonesLesson } from "./lesson-placing-stones";
import { scoringLesson } from "./lesson-scoring";

describe("book manifest", () => {
  it("orders the book cover -> contents -> contents-2 -> prologue -> six chapters -> closing", () => {
    expect(BOOK_PAGES.map((page) => page.id)).toEqual([
      "cover",
      "contents",
      "contents-2",
      "prologue",
      "placing-stones",
      "liberties-and-capture",
      "connected-groups",
      "illegal-moves",
      "ko",
      "scoring",
      "closing",
    ]);
  });

  it("every chapter id matches its lesson definition's id, so the two never drift apart", () => {
    expect(findPage("placing-stones")?.id).toBe(placingStonesLesson.id);
    expect(findPage("liberties-and-capture")?.id).toBe(libertiesAndCaptureLesson.id);
    expect(findPage("connected-groups")?.id).toBe(connectedGroupsLesson.id);
    expect(findPage("illegal-moves")?.id).toBe(illegalMovesLesson.id);
    expect(findPage("ko")?.id).toBe(koLesson.id);
    expect(findPage("scoring")?.id).toBe(scoringLesson.id);
  });

  it("every page has a unique id and a unique path", () => {
    expect(new Set(BOOK_PAGES.map((page) => page.id)).size).toBe(BOOK_PAGES.length);
    expect(new Set(BOOK_PAGES.map((page) => page.path)).size).toBe(BOOK_PAGES.length);
  });

  it("only the six chapters carry a chapter kicker", () => {
    const withKicker = BOOK_PAGES.filter((page) => page.chapterKicker);
    expect(withKicker.map((page) => page.id)).toEqual([
      "placing-stones",
      "liberties-and-capture",
      "connected-groups",
      "illegal-moves",
      "ko",
      "scoring",
    ]);
  });

  it("findPage returns undefined for an unknown id", () => {
    expect(findPage("nope")).toBeUndefined();
  });

  it("the prologue is registered as its own addressable page", () => {
    expect(findPage("prologue")).toEqual({
      id: "prologue",
      path: "prologue.html",
      title: "Prologue",
    });
  });
});
