// Simplified Chinese-style area scoring, built on go-rules.ts's board
// primitives. This module assumes dead stones have already been removed
// from the board before scoring runs: it has no concept of life and death,
// and never decides that a stone is dead. It only flood-fills empty
// intersections and looks at which colour(s) of stone border each region.
//
// Black's score is its stones plus the empty points it alone surrounds;
// White's score is the same plus a fixed komi. A region bordered by both
// colours (or, degenerately, by neither) belongs to no one.

import { getStone, neighbors, pointKey, type Board, type Point, type Stone } from "./go-rules";

export type PointOwner = Stone | "neutral";

export interface EmptyRegion {
  points: Point[];
  owner: PointOwner;
}

export interface ScoreResult {
  komi: number;
  blackStones: number;
  whiteStones: number;
  regions: EmptyRegion[];
  blackTerritory: Point[];
  whiteTerritory: Point[];
  neutralPoints: Point[];
  /** Owner of every empty point, keyed by pointKey. Absent for occupied points. */
  pointOwners: Map<string, PointOwner>;
  /** Black's final score: stones + territory. */
  blackScore: number;
  /** White's stones + territory, before komi is added. */
  whiteBoardScore: number;
  /** White's final score: whiteBoardScore + komi. */
  whiteScore: number;
  winner: Stone | "tie";
  margin: number;
}

/** Every maximal connected region of empty points, each classified by which
 * stone colour(s) border it: a single colour owns it, both (or neither, on a
 * fully empty board) makes it neutral. */
function findEmptyRegions(board: Board): EmptyRegion[] {
  const visited = new Set<string>();
  const regions: EmptyRegion[] = [];

  for (let row = 0; row < board.size; row++) {
    for (let col = 0; col < board.size; col++) {
      const start: Point = { row, col };
      if (getStone(board, start) !== null) continue;
      const startKey = pointKey(start);
      if (visited.has(startKey)) continue;

      const points: Point[] = [];
      const borders = new Set<Stone>();
      const queue: Point[] = [start];
      visited.add(startKey);

      while (queue.length > 0) {
        const current = queue.shift() as Point;
        points.push(current);
        for (const neighbour of neighbors(board, current)) {
          const stone = getStone(board, neighbour);
          if (stone !== null) {
            borders.add(stone);
            continue;
          }
          const key = pointKey(neighbour);
          if (visited.has(key)) continue;
          visited.add(key);
          queue.push(neighbour);
        }
      }

      const owner: PointOwner = borders.size === 1 ? [...borders][0] : "neutral";
      regions.push({ points, owner });
    }
  }

  return regions;
}

/** Scores `board` under simplified Chinese-style area rules. `komi` is added
 * to White's score only. Assumes every stone on the board is alive — this
 * function does not attempt to detect or remove dead stones. */
export function scoreBoard(board: Board, komi: number): ScoreResult {
  let blackStones = 0;
  let whiteStones = 0;
  for (const row of board.cells) {
    for (const cell of row) {
      if (cell === "black") blackStones++;
      else if (cell === "white") whiteStones++;
    }
  }

  const regions = findEmptyRegions(board);
  const blackTerritory: Point[] = [];
  const whiteTerritory: Point[] = [];
  const neutralPoints: Point[] = [];
  const pointOwners = new Map<string, PointOwner>();

  for (const region of regions) {
    const bucket =
      region.owner === "black" ? blackTerritory : region.owner === "white" ? whiteTerritory : neutralPoints;
    for (const point of region.points) {
      bucket.push(point);
      pointOwners.set(pointKey(point), region.owner);
    }
  }

  const blackScore = blackStones + blackTerritory.length;
  const whiteBoardScore = whiteStones + whiteTerritory.length;
  const whiteScore = whiteBoardScore + komi;
  const winner: Stone | "tie" = blackScore > whiteScore ? "black" : whiteScore > blackScore ? "white" : "tie";
  const margin = Math.abs(blackScore - whiteScore);

  return {
    komi,
    blackStones,
    whiteStones,
    regions,
    blackTerritory,
    whiteTerritory,
    neutralPoints,
    pointOwners,
    blackScore,
    whiteBoardScore,
    whiteScore,
    winner,
    margin,
  };
}

/** The owner of `point` per `result`, or null if `point` currently holds a
 * stone (stones aren't territory — look at the board itself for those). */
export function territoryOwnerAt(result: ScoreResult, point: Point): PointOwner | null {
  return result.pointOwners.get(pointKey(point)) ?? null;
}
