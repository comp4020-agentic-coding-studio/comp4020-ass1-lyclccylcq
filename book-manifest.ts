// Single source of truth for the book's page order: cover -> contents ->
// contents-2 -> prologue -> the six chapters -> closing. book-nav.ts reads
// this to find each page's neighbours; nothing else needs to know the
// sequence.

export interface BookPage {
  id: string;
  /** Path relative to the site root, e.g. "lessons/placing-stones.html". */
  path: string;
  /** Traditional chapter numeral + label; only the six chapters carry one. */
  chapterKicker?: string;
  title: string;
}

export const BOOK_PAGES: BookPage[] = [
  { id: "cover", path: "index.html", title: "Learn Go" },
  { id: "contents", path: "contents.html", title: "Contents" },
  { id: "contents-2", path: "contents-2.html", title: "Contents" },
  { id: "prologue", path: "prologue.html", title: "Prologue" },
  {
    id: "placing-stones",
    path: "lessons/placing-stones.html",
    chapterKicker: "第一章 · 着子",
    title: "Placing Stones",
  },
  {
    id: "liberties-and-capture",
    path: "lessons/liberties-and-capture.html",
    chapterKicker: "第二章 · 气",
    title: "Liberties and Capture",
  },
  {
    id: "connected-groups",
    path: "lessons/connected-groups.html",
    chapterKicker: "第三章 · 棋块",
    title: "Connected Groups",
  },
  {
    id: "illegal-moves",
    path: "lessons/illegal-moves.html",
    chapterKicker: "第四章 · 禁着",
    title: "Illegal Moves",
  },
  {
    id: "ko",
    path: "lessons/ko.html",
    chapterKicker: "第五章 · 劫",
    title: "Ko",
  },
  {
    id: "scoring",
    path: "lessons/scoring.html",
    chapterKicker: "第六章 · 数子",
    title: "Winning the Game",
  },
  { id: "closing", path: "closing.html", title: "Closing" },
];

export function findPage(id: string): BookPage | undefined {
  return BOOK_PAGES.find((page) => page.id === id);
}
