// A visual, interactive 9x9 Go board. This module only renders: given a
// board state (from go-rules.ts) it draws stones and, optionally, highlighted
// points and a set of points that respond to activation. It has no opinion
// about whose turn it is, what a legal move is, or what happens next — the
// caller (a lesson, or later a free-play sandbox) owns that.

import { pointKey, type Board, type Point } from "./go-rules";

const SVG_NS = "http://www.w3.org/2000/svg";

export interface RenderOptions {
  board: Board;
  /** Points to visually mark, e.g. a group's current liberties. */
  highlights?: Point[];
  /** Points that respond to click/keyboard activation. Omitted = none. */
  interactive?: Point[];
  onPointActivate?: (point: Point) => void;
}

export function renderGoBoard(container: HTMLElement, options: RenderOptions): void {
  const { board, highlights = [], interactive = [], onPointActivate } = options;
  const size = board.size;
  const last = size - 1;
  const interactiveSet = new Set(interactive.map(pointKey));
  const highlightSet = new Set(highlights.map(pointKey));

  container.innerHTML = "";
  container.classList.add("go-board");

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `-0.5 -0.5 ${size} ${size}`);
  svg.setAttribute("aria-label", `${size} by ${size} Go board`);
  svg.classList.add("go-board-grid");

  for (let i = 0; i < size; i++) {
    svg.appendChild(gridLine(0, i, last, i));
    svg.appendChild(gridLine(i, 0, i, last));
  }

  for (const [x, y] of starPoints(size)) {
    svg.appendChild(dot(x, y, 0.09, "go-board-star"));
  }

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      svg.appendChild(dot(col, row, 0.05, "go-board-hint"));
    }
  }

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const point: Point = { row, col };
      if (highlightSet.has(pointKey(point))) {
        svg.appendChild(dot(col, row, 0.32, "go-board-highlight"));
      }
      svg.appendChild(pointCircle(point, board.cells[row][col], interactiveSet, onPointActivate));
    }
  }

  container.append(svg);
}

function pointCircle(
  point: Point,
  stone: Board["cells"][number][number],
  interactiveSet: Set<string>,
  onPointActivate?: (point: Point) => void,
): SVGCircleElement {
  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", String(point.col));
  circle.setAttribute("cy", String(point.row));
  circle.setAttribute("r", "0.42");
  circle.classList.add("go-board-point");
  if (stone) circle.classList.add(`go-board-point-${stone}`);
  describePoint(circle, point, stone);

  const canActivate = stone === null && interactiveSet.has(pointKey(point));
  if (canActivate && onPointActivate) {
    circle.classList.add("go-board-point-active");
    circle.setAttribute("role", "button");
    circle.setAttribute("tabindex", "0");
    const activate = (): void => onPointActivate(point);
    circle.addEventListener("click", activate);
    circle.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });
  }

  return circle;
}

function gridLine(x1: number, y1: number, x2: number, y2: number): SVGLineElement {
  const line = document.createElementNS(SVG_NS, "line");
  line.setAttribute("x1", String(x1));
  line.setAttribute("y1", String(y1));
  line.setAttribute("x2", String(x2));
  line.setAttribute("y2", String(y2));
  line.classList.add("go-board-line");
  return line;
}

function dot(x: number, y: number, radius: number, className: string): SVGCircleElement {
  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", String(x));
  circle.setAttribute("cy", String(y));
  circle.setAttribute("r", String(radius));
  circle.setAttribute("aria-hidden", "true");
  circle.classList.add(className);
  return circle;
}

function starPoints(size: number): Array<[number, number]> {
  if (size !== 9) return [];
  const edge = 2;
  const center = 4;
  const far = size - 1 - edge;
  return [
    [edge, edge],
    [edge, far],
    [far, edge],
    [far, far],
    [center, center],
  ];
}

function describePoint(
  point: SVGCircleElement,
  { row, col }: Point,
  stone: Board["cells"][number][number],
): void {
  const state = stone ? `${stone} stone` : "empty";
  point.setAttribute("aria-label", `Row ${row + 1}, column ${col + 1}: ${state}`);
}
