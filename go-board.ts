// A visual, interactive 9x9 Go board. It only knows how to place stones on
// empty intersections and clear them — no liberties, captures, suicide, or
// ko. Later lessons build those rules on top of (or beside) this component.

const SVG_NS = "http://www.w3.org/2000/svg";
const DEFAULT_SIZE = 9;

type Stone = "black" | "white" | null;

export interface GoBoardOptions {
  size?: number;
}

export function createGoBoard(container: HTMLElement, options: GoBoardOptions = {}): void {
  const size = options.size ?? DEFAULT_SIZE;
  const last = size - 1;
  const board: Stone[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, (): Stone => null),
  );
  let toPlay: Stone = "black";

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
    svg.appendChild(dot(x, y, "go-board-star"));
  }

  const points: SVGCircleElement[] = [];

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      svg.appendChild(dot(col, row, "go-board-hint"));

      const point = document.createElementNS(SVG_NS, "circle");
      point.setAttribute("cx", String(col));
      point.setAttribute("cy", String(row));
      point.setAttribute("r", "0.42");
      point.setAttribute("role", "button");
      point.setAttribute("tabindex", "0");
      point.classList.add("go-board-point");
      describePoint(point, row, col, null);

      const place = (): void => {
        if (board[row][col] !== null) return;
        board[row][col] = toPlay;
        point.classList.add(`go-board-point-${toPlay}`);
        describePoint(point, row, col, toPlay);
        toPlay = toPlay === "black" ? "white" : "black";
      };

      point.addEventListener("click", place);
      point.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          place();
        }
      });

      svg.appendChild(point);
      points.push(point);
    }
  }

  const reset = document.createElement("button");
  reset.type = "button";
  reset.textContent = "Clear board";
  reset.classList.add("go-board-reset");
  reset.addEventListener("click", () => {
    toPlay = "black";
    for (const row of board) row.fill(null);
    points.forEach((point, index) => {
      const row = Math.floor(index / size);
      const col = index % size;
      point.classList.remove("go-board-point-black", "go-board-point-white");
      describePoint(point, row, col, null);
    });
  });

  container.append(svg, reset);
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

function dot(x: number, y: number, className: string): SVGCircleElement {
  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", String(x));
  circle.setAttribute("cy", String(y));
  circle.setAttribute("r", className === "go-board-star" ? "0.09" : "0.05");
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

function describePoint(point: SVGCircleElement, row: number, col: number, stone: Stone): void {
  const state = stone ? `${stone} stone` : "empty";
  point.setAttribute("aria-label", `Row ${row + 1}, column ${col + 1}: ${state}`);
}
