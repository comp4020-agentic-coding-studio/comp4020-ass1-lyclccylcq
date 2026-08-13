// Renders the Previous/Next "turn the page" footer shared by the four
// chapter pages and the closing page. Because each turn is a real
// cross-document navigation (a plain <a href>, never intercepted with
// preventDefault), rapid clicks can't corrupt in-page state — the browser's
// own navigation model supersedes an in-flight load with the next one — and
// keyboard/no-JS access comes for free.
//
// Direction (turning forward vs back) has to be known by the *next* page
// before it paints, so the outgoing page tags it into sessionStorage here;
// a matching small inline script on every page (see the HTML files) reads
// it back on arrival and sets `data-turn` on <html> for styles.css's
// view-transition keyframes to key off. Direct links (contents list, the
// header nav, the cover) are never tagged, so they fall back to the
// shorter, untagged transition intentionally.

import { BOOK_PAGES, findPage, type BookPage } from "./book-manifest";

export const TURN_STORAGE_KEY = "learn-go:page-turn";

export interface Adjacent {
  prev: BookPage | null;
  next: BookPage | null;
}

export function getAdjacent(id: string): Adjacent {
  const index = BOOK_PAGES.findIndex((page) => page.id === id);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? BOOK_PAGES[index - 1] : null,
    next: index < BOOK_PAGES.length - 1 ? BOOK_PAGES[index + 1] : null,
  };
}

/** Relative link from one root-relative path to another, e.g.
 * ("lessons/a.html", "contents.html") -> "../contents.html", and
 * ("lessons/a.html", "lessons/b.html") -> "./b.html". */
export function relativeHref(fromPath: string, toPath: string): string {
  const fromDir = fromPath.split("/").slice(0, -1);
  const toParts = toPath.split("/");
  const toFile = toParts.pop() as string;
  const toDir = toParts;

  let shared = 0;
  while (shared < fromDir.length && shared < toDir.length && fromDir[shared] === toDir[shared]) {
    shared++;
  }

  const ups = fromDir.length - shared;
  const segments = [...Array<string>(ups).fill(".."), ...toDir.slice(shared), toFile];
  const joined = segments.join("/");
  return joined.startsWith("..") ? joined : `./${joined}`;
}

function tagDirection(direction: "prev" | "next"): void {
  try {
    window.sessionStorage.setItem(TURN_STORAGE_KEY, direction);
  } catch {
    // sessionStorage can be unavailable (private browsing); the navigation
    // still proceeds, it just falls back to the untagged transition.
  }
}

function createLink(current: BookPage, target: BookPage, direction: "prev" | "next"): HTMLAnchorElement {
  const link = document.createElement("a");
  link.className = `book-nav-link book-nav-${direction}`;
  link.href = relativeHref(current.path, target.path);
  link.textContent = direction === "prev" ? `‹ ${target.title}` : `${target.title} ›`;
  link.addEventListener("click", (event) => {
    if (link.dataset.turning === "true") {
      event.preventDefault();
      return;
    }
    link.dataset.turning = "true";
    tagDirection(direction);
  });
  return link;
}

/** Mounts the Prev/Next footer for `currentId` into `container`. A no-op if
 * the container is missing or `currentId` isn't a known page, so a stray or
 * unmounted #book-nav placeholder never throws. */
export function mount(currentId: string, container: HTMLElement | null): void {
  if (!container) return;
  const current = findPage(currentId);
  if (!current) return;

  const { prev, next } = getAdjacent(currentId);
  container.textContent = "";
  container.classList.add("book-nav");

  container.appendChild(prev ? createLink(current, prev, "prev") : document.createElement("span"));
  container.appendChild(next ? createLink(current, next, "next") : document.createElement("span"));
}
