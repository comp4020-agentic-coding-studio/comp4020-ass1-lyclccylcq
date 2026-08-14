// A small local opponent for free play. It runs entirely in the page: no
// network, no model, no engine beyond go-rules.ts. It is not strong and
// isn't meant to be — it exists so a learner has something to push against
// after finishing the chapters.
//
// Every move it considers is played through the shared placeStone(), so
// captures, suicide, and ko are enforced by exactly the same code that
// governs the lessons. The bot has no legality logic of its own; anything
// placeStone refuses is simply dropped from its candidates.
//
// Its judgement is a strict ordering of intentions, checked in turn:
//   capture something > save a group in atari > put a group in atari >
//   give a short-of-liberties group more room > ordinary shape >
//   (last resort) a move that puts its own stone in atari.
// Ties inside a tier are broken at random, so repeat games diverge.

import {
  getGroup,
  getLiberties,
  getStone,
  neighbors,
  placeStone,
  pointKey,
  type Board,
  type Point,
  type Stone,
} from "./go-rules";

export interface BotMoveOptions {
  board: Board;
  colour: Stone;
  /** The position the ko rule is measured against, exactly as placeStone takes it. */
  koBoard?: Board | null;
  /** True if the human has just passed, which lets the bot agree to stop. */
  opponentPassed?: boolean;
  /** Injectable for tests; any function returning [0, 1). */
  rng?: () => number;
}

const TIER = {
  selfAtari: 0,
  shape: 1,
  moreLiberties: 2,
  giveAtari: 3,
  saveGroup: 4,
  capture: 5,
} as const;

/** Enough breadth to notice anything urgent, few enough to stay instant. */
const MAX_CANDIDATES = 40;
const SCATTER_COUNT = 12;

interface RatedMove {
  point: Point;
  tier: number;
  score: number;
}

/**
 * Picks the bot's move, or "pass" when it has nothing legal left — or when
 * the human has passed and the bot has nothing urgent, in which case it
 * agrees to stop. That makes it an agreeable opponent rather than a good
 * judge of when a game is over: telling those apart needs life-and-death
 * reading this bot doesn't do, and a practice partner that won't let you
 * stop is worse than one that stops early. Never returns a point placeStone
 * would reject.
 */
export function chooseBotMove(options: BotMoveOptions): Point | "pass" {
  const { board, colour, koBoard, opponentPassed = false, rng = Math.random } = options;

  let rated = rateAll(board, candidatePoints(board, colour, rng), colour, koBoard);
  if (rated.length === 0) {
    // The shortlist can miss a board whose only openings are far from any
    // stone, and passing then would be wrong rather than polite — so before
    // passing for want of a move, look at every point.
    rated = rateAll(board, allEmptyPoints(board), colour, koBoard);
  }
  if (rated.length === 0) return "pass";

  const bestTier = Math.max(...rated.map((move) => move.tier));
  if (opponentPassed && bestTier <= TIER.shape) return "pass";

  const inTier = rated.filter((move) => move.tier === bestTier);
  const bestScore = Math.max(...inTier.map((move) => move.score));
  const best = inTier.filter((move) => move.score === bestScore);
  return best[Math.min(best.length - 1, Math.floor(rng() * best.length))].point;
}

function rateAll(board: Board, points: Point[], colour: Stone, koBoard: Board | null | undefined): RatedMove[] {
  return points
    .map((point) => rate(board, point, colour, koBoard ?? undefined))
    .filter((move): move is RatedMove => move !== null);
}

function allEmptyPoints(board: Board): Point[] {
  const points: Point[] = [];
  for (let row = 0; row < board.size; row++) {
    for (let col = 0; col < board.size; col++) {
      if (board.cells[row][col] === null) points.push({ row, col });
    }
  }
  return points;
}

/** Legal-move rating, or null if the shared engine refuses the move. */
function rate(board: Board, point: Point, colour: Stone, koBoard: Board | undefined): RatedMove | null {
  const result = placeStone(board, point, colour, koBoard);
  if (!result.ok) return null;

  const next = result.board;
  const own = getGroup(next, point);
  const ownLiberties = getLiberties(next, own).length;

  if (result.captured.length > 0) {
    return { point, tier: TIER.capture, score: result.captured.length };
  }

  const rescued = groupsRescued(board, next, colour);
  if (rescued > 0) return { point, tier: TIER.saveGroup, score: rescued * 10 + ownLiberties };

  const threatened = groupsPutInAtari(board, next, point, colour);
  if (threatened > 0) return { point, tier: TIER.giveAtari, score: threatened * 10 + ownLiberties };

  if (ownLiberties === 1) return { point, tier: TIER.selfAtari, score: 0 };

  if (relievesOwnShortage(board, next, point, colour, ownLiberties)) {
    return { point, tier: TIER.moreLiberties, score: ownLiberties };
  }

  return { point, tier: TIER.shape, score: shapeScore(board, point, colour) };
}

/** How many of the bot's groups were in atari before the move and aren't now. */
function groupsRescued(before: Board, after: Board, colour: Stone): number {
  let rescued = 0;
  for (const group of groupsOf(before, colour)) {
    if (getLiberties(before, group).length !== 1) continue;
    const anchor = group[0];
    if (getStone(after, anchor) !== colour) continue;
    if (getLiberties(after, getGroup(after, anchor)).length > 1) rescued++;
  }
  return rescued;
}

/** How many opponent groups next to the new stone this move newly ataris. */
function groupsPutInAtari(before: Board, after: Board, point: Point, colour: Stone): number {
  const opponent: Stone = colour === "black" ? "white" : "black";
  const counted = new Set<string>();
  let threatened = 0;

  for (const neighbour of neighbors(after, point)) {
    if (getStone(after, neighbour) !== opponent) continue;
    const group = getGroup(after, neighbour);
    const key = pointKey(group[0]);
    if (counted.has(key)) continue;
    counted.add(key);
    if (getLiberties(after, group).length !== 1) continue;
    if (getLiberties(before, getGroup(before, group[0])).length <= 1) continue;
    threatened++;
  }
  return threatened;
}

/** True if the move gives a group that was down to two liberties more room. */
function relievesOwnShortage(
  before: Board,
  after: Board,
  point: Point,
  colour: Stone,
  ownLiberties: number,
): boolean {
  for (const neighbour of neighbors(before, point)) {
    if (getStone(before, neighbour) !== colour) continue;
    if (getLiberties(before, getGroup(before, neighbour)).length !== 2) continue;
    if (ownLiberties > 2) return true;
  }
  return false;
}

/** A crude preference for playing near stones and off the very edge. */
function shapeScore(board: Board, point: Point, colour: Stone): number {
  const opponent: Stone = colour === "black" ? "white" : "black";
  let score = 0;
  for (const neighbour of neighbors(board, point)) {
    const stone = getStone(board, neighbour);
    if (stone === colour) score += 1;
    else if (stone === opponent) score += 2;
  }
  const edge = point.row === 0 || point.col === 0 || point.row === board.size - 1 || point.col === board.size - 1;
  return edge ? score - 2 : score;
}

function groupsOf(board: Board, colour: Stone): Point[][] {
  const seen = new Set<string>();
  const groups: Point[][] = [];
  for (let row = 0; row < board.size; row++) {
    for (let col = 0; col < board.size; col++) {
      if (board.cells[row][col] !== colour) continue;
      const key = pointKey({ row, col });
      if (seen.has(key)) continue;
      const group = getGroup(board, { row, col });
      for (const stone of group) seen.add(pointKey(stone));
      groups.push(group);
    }
  }
  return groups;
}

/**
 * Everything the bot will look at this turn: every liberty of a group that's
 * short of them (either colour, since those are the moves that decide
 * things), every empty point touching a stone, and a scatter of open points
 * so it will still develop on a quiet board.
 */
function candidatePoints(board: Board, colour: Stone, rng: () => number): Point[] {
  const urgent: Point[] = [];
  const contact: Point[] = [];
  const seen = new Set<string>();

  const add = (into: Point[], point: Point): void => {
    const key = pointKey(point);
    if (seen.has(key)) return;
    seen.add(key);
    into.push(point);
  };

  let stones = 0;
  for (const stone of [colour, colour === "black" ? "white" : "black"] as Stone[]) {
    for (const group of groupsOf(board, stone)) {
      stones += group.length;
      const liberties = getLiberties(board, group);
      if (liberties.length <= 2) for (const liberty of liberties) add(urgent, liberty);
    }
  }

  if (stones === 0) return openingPoints(board, rng);

  for (let row = 0; row < board.size; row++) {
    for (let col = 0; col < board.size; col++) {
      if (board.cells[row][col] !== null) continue;
      const point = { row, col };
      if (neighbors(board, point).some((n) => getStone(board, n) !== null)) add(contact, point);
    }
  }

  const scatter: Point[] = [];
  for (let attempt = 0; attempt < SCATTER_COUNT * 3 && scatter.length < SCATTER_COUNT; attempt++) {
    const row = Math.floor(rng() * board.size);
    const col = Math.floor(rng() * board.size);
    if (board.cells[row][col] === null) add(scatter, { row, col });
  }

  return [...urgent, ...shuffle(contact, rng), ...scatter].slice(
    0,
    Math.max(MAX_CANDIDATES, urgent.length),
  );
}

/** On an empty board, open where a person would: on a star point. */
function openingPoints(board: Board, rng: () => number): Point[] {
  const lines = board.size >= 13 ? [3, board.size - 4] : [2, board.size - 3];
  const corners = lines.flatMap((row) => lines.map((col) => ({ row, col })));
  const middle = Math.floor(board.size / 2);
  return shuffle([...corners, { row: middle, col: middle }], rng);
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
