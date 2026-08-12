// Pure Go board rules: no DOM, no rendering. This is the single source of
// truth for what a legal position looks like, so lessons, the sandbox, and
// later features can all build on it without re-deriving the rules.
//
// Deliberately not implemented yet: ko and territory scoring.

export type Stone = "black" | "white";
export type Cell = Stone | null;

export interface Point {
  row: number;
  col: number;
}

export interface Board {
  size: number;
  cells: Cell[][];
}

export function createBoard(size = 9): Board {
  return {
    size,
    cells: Array.from({ length: size }, () => Array.from({ length: size }, (): Cell => null)),
  };
}

export function cloneBoard(board: Board): Board {
  return { size: board.size, cells: board.cells.map((row) => [...row]) };
}

export function pointKey(point: Point): string {
  return `${point.row},${point.col}`;
}

export function isOnBoard(board: Board, point: Point): boolean {
  return point.row >= 0 && point.row < board.size && point.col >= 0 && point.col < board.size;
}

export function getStone(board: Board, point: Point): Cell {
  return isOnBoard(board, point) ? board.cells[point.row][point.col] : null;
}

/** The on-board points orthogonally adjacent to `point`. */
export function neighbors(board: Board, point: Point): Point[] {
  const candidates: Point[] = [
    { row: point.row - 1, col: point.col },
    { row: point.row + 1, col: point.col },
    { row: point.row, col: point.col - 1 },
    { row: point.row, col: point.col + 1 },
  ];
  return candidates.filter((candidate) => isOnBoard(board, candidate));
}

/** The connected group of same-colour stones containing `point`, or [] if `point` is empty. */
export function getGroup(board: Board, point: Point): Point[] {
  const colour = getStone(board, point);
  if (colour === null) return [];

  const visited = new Set<string>([pointKey(point)]);
  const group: Point[] = [point];
  const queue: Point[] = [point];

  while (queue.length > 0) {
    const current = queue.shift() as Point;
    for (const neighbour of neighbors(board, current)) {
      const key = pointKey(neighbour);
      if (visited.has(key)) continue;
      if (getStone(board, neighbour) !== colour) continue;
      visited.add(key);
      group.push(neighbour);
      queue.push(neighbour);
    }
  }

  return group;
}

/** The empty points adjacent to any stone in `group`, deduplicated. */
export function getLiberties(board: Board, group: Point[]): Point[] {
  const seen = new Set<string>();
  const liberties: Point[] = [];

  for (const stone of group) {
    for (const neighbour of neighbors(board, stone)) {
      if (getStone(board, neighbour) !== null) continue;
      const key = pointKey(neighbour);
      if (seen.has(key)) continue;
      seen.add(key);
      liberties.push(neighbour);
    }
  }

  return liberties;
}

export type PlaceResult =
  | { ok: true; board: Board; captured: Point[] }
  | { ok: false; reason: "occupied" | "off-board" | "suicide" };

/**
 * Places `colour` at `point`, removes any opponent group left with zero
 * liberties, then rejects the move as suicide if the placed stone's own
 * group is still left with zero liberties — unless capturing opponent
 * stones gave it one. A point emptied by an earlier capture is never
 * permanently blocked: legality here is recomputed fresh from the board
 * passed in, not from history.
 */
export function placeStone(board: Board, point: Point, colour: Stone): PlaceResult {
  if (!isOnBoard(board, point)) return { ok: false, reason: "off-board" };
  if (getStone(board, point) !== null) return { ok: false, reason: "occupied" };

  const next = cloneBoard(board);
  next.cells[point.row][point.col] = colour;

  const opponent: Stone = colour === "black" ? "white" : "black";
  const captured: Point[] = [];
  const processed = new Set<string>();

  for (const neighbour of neighbors(next, point)) {
    if (getStone(next, neighbour) !== opponent) continue;
    const key = pointKey(neighbour);
    if (processed.has(key)) continue;

    const group = getGroup(next, neighbour);
    for (const stone of group) processed.add(pointKey(stone));

    if (getLiberties(next, group).length === 0) {
      for (const stone of group) {
        next.cells[stone.row][stone.col] = null;
        captured.push(stone);
      }
    }
  }

  const ownGroup = getGroup(next, point);
  if (getLiberties(next, ownGroup).length === 0) {
    return { ok: false, reason: "suicide" };
  }

  return { ok: true, board: next, captured };
}
