// A visual, interactive 9x9 Go board. This module only renders: given a
// board state (from go-rules.ts) it draws stones and, optionally, highlighted
// points and a set of points that respond to activation. It has no opinion
// about whose turn it is, what a legal move is, or what happens next — the
// caller (a lesson, or later a free-play sandbox) owns that.

import { pointKey, type Board, type Point } from "./go-rules";

const SVG_NS = "http://www.w3.org/2000/svg";

/** A marker's shape carries its meaning — never rely on colour alone to
 * distinguish what a marker means (e.g. Black territory vs White territory). */
export type MarkerShape = "square" | "ring" | "cross";

export interface PointMarker {
  point: Point;
  shape: MarkerShape;
  /** CSS class controlling this marker's colour/opacity. */
  className: string;
  /** Appended to the point's aria-label, so the meaning is never visual-only. */
  label: string;
}

export interface RenderOptions {
  board: Board;
  /** Points to visually mark, e.g. a group's current liberties. */
  highlights?: Point[];
  /** Points that respond to click/keyboard activation. Omitted = none. */
  interactive?: Point[];
  /** Small shape overlays for at most one caller-defined meaning per point
   * (e.g. territory ownership) — distinct from `highlights`, which is a
   * single undifferentiated set. */
  markers?: PointMarker[];
  onPointActivate?: (point: Point) => void;
}

export function renderGoBoard(container: HTMLElement, options: RenderOptions): void {
  const { board, highlights = [], interactive = [], markers = [], onPointActivate } = options;
  const size = board.size;
  const last = size - 1;
  const interactiveSet = new Set(interactive.map(pointKey));
  const highlightSet = new Set(highlights.map(pointKey));
  const markerMap = new Map(markers.map((marker) => [pointKey(marker.point), marker]));

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
      const stone = board.cells[row][col];
      const marker = markerMap.get(pointKey(point));
      svg.appendChild(pointCircle(point, stone, interactiveSet, marker, onPointActivate));
      if (marker) svg.appendChild(markerShape(col, row, marker));
      if (highlightSet.has(pointKey(point))) {
        // A highlighted stone gets a halo just outside it (an occupied point's
        // fill would otherwise paint straight over a same-sized ring); a
        // highlighted empty point keeps the smaller dot marker.
        svg.appendChild(dot(col, row, stone ? 0.46 : 0.32, "go-board-highlight"));
      }
    }
  }

  container.append(svg);
}

function pointCircle(
  point: Point,
  stone: Board["cells"][number][number],
  interactiveSet: Set<string>,
  marker: PointMarker | undefined,
  onPointActivate?: (point: Point) => void,
): SVGCircleElement {
  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", String(point.col));
  circle.setAttribute("cy", String(point.row));
  circle.setAttribute("r", "0.42");
  circle.classList.add("go-board-point");
  if (stone) circle.classList.add(`go-board-point-${stone}`);
  describePoint(circle, point, stone, marker);

  const canActivate = interactiveSet.has(pointKey(point));
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

/** A small, restrained shape overlay: a filled square, an unfilled ring, or
 * a cross — deliberately not just a coloured dot, so the marker's meaning
 * survives colour-blindness or a grayscale display. */
function markerShape(x: number, y: number, marker: PointMarker): SVGElement {
  const { shape, className } = marker;

  if (shape === "square") {
    const size = 0.26;
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", String(x - size / 2));
    rect.setAttribute("y", String(y - size / 2));
    rect.setAttribute("width", String(size));
    rect.setAttribute("height", String(size));
    rect.setAttribute("aria-hidden", "true");
    rect.classList.add("go-board-marker", className);
    return rect;
  }

  if (shape === "ring") {
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("cx", String(x));
    circle.setAttribute("cy", String(y));
    circle.setAttribute("r", "0.16");
    circle.setAttribute("aria-hidden", "true");
    circle.classList.add("go-board-marker", className);
    return circle;
  }

  const half = 0.15;
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("aria-hidden", "true");
  group.classList.add("go-board-marker", className);
  const diagonal1 = document.createElementNS(SVG_NS, "line");
  diagonal1.setAttribute("x1", String(x - half));
  diagonal1.setAttribute("y1", String(y - half));
  diagonal1.setAttribute("x2", String(x + half));
  diagonal1.setAttribute("y2", String(y + half));
  const diagonal2 = document.createElementNS(SVG_NS, "line");
  diagonal2.setAttribute("x1", String(x - half));
  diagonal2.setAttribute("y1", String(y + half));
  diagonal2.setAttribute("x2", String(x + half));
  diagonal2.setAttribute("y2", String(y - half));
  group.append(diagonal1, diagonal2);
  return group;
}

// Star points are a convention, not a formula: a 9x9 board marks its four
// 3-3 corners and the centre, while a 19x19 marks a full 3x3 grid on the
// fourth lines. Written out per size for that reason — a shared expression
// would only make two different traditions look like one.
export function starPoints(size: number): Array<[number, number]> {
  if (size === 9) return [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]];
  if (size === 19) {
    const lines = [3, 9, 15];
    return lines.flatMap((x) => lines.map((y): [number, number] => [x, y]));
  }
  return [];
}

function describePoint(
  point: SVGCircleElement,
  { row, col }: Point,
  stone: Board["cells"][number][number],
  marker?: PointMarker,
): void {
  const state = stone ? `${stone} stone` : "empty";
  const suffix = marker ? ` — ${marker.label}` : "";
  point.setAttribute("aria-label", `Row ${row + 1}, column ${col + 1}: ${state}${suffix}`);
}
