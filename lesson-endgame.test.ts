// The Lesson 6 fixture, checked against the rules and scoring engines rather
// than against itself. Everything the lesson says about this position — that
// nothing is in danger, that the left side isn't territory until the wall
// closes, that exactly three points are worth playing — is a claim these
// tests can falsify.

import { describe, expect, it } from "vitest";
import { getGroup, getLiberties, getStone, placeStone, type Board, type Point } from "./go-rules";
import { scoreBoard } from "./go-scoring";
import {
  FINAL_POINT,
  IDLE_POINTS,
  REDUCE_POINT,
  SEAL_POINT,
  SUICIDE_POINT,
  createEndgameBoard,
  endgameLesson,
} from "./lesson-endgame";
import { KOMI } from "./lesson-scoring";

function play(board: Board, point: Point): Board {
  const result = placeStone(board, point, "black");
  expect(result.ok, `expected ${JSON.stringify(point)} to be legal`).toBe(true);
  if (!result.ok) throw new Error("unreachable");
  return result.board;
}

function everyGroupsLiberties(board: Board): number[] {
  const counts: number[] = [];
  for (let row = 0; row < board.size; row++) {
    for (let col = 0; col < board.size; col++) {
      if (!board.cells[row][col]) continue;
      counts.push(getLiberties(board, getGroup(board, { row, col })).length);
    }
  }
  return counts;
}

describe("Lesson 6's position is genuinely finished apart from the boundary", () => {
  it("is registered as its own lesson", () => {
    expect(endgameLesson.id).toBe("endgame");
    expect(endgameLesson.title).toBeTruthy();
    expect(endgameLesson.createInitialBoard()).toEqual(createEndgameBoard());
  });

  it("has no group in atari, so nothing on the board is up for capture", () => {
    expect(Math.min(...everyGroupsLiberties(createEndgameBoard()))).toBeGreaterThan(1);
  });

  it("starts with all three answer points empty, nothing played in advance", () => {
    const board = createEndgameBoard();
    for (const point of [SEAL_POINT, REDUCE_POINT, FINAL_POINT]) {
      expect(getStone(board, point)).toBeNull();
    }
  });

  it("gives Black no territory at all while the wall still has its gap", () => {
    const start = scoreBoard(createEndgameBoard(), KOMI);
    // The open boundary means Black's whole left side borders White too, so
    // by the area rules it belongs to nobody yet — which is the entire point
    // of the first move.
    expect(start.blackTerritory).toHaveLength(0);
    expect(start.neutralPoints.length).toBeGreaterThan(30);
    expect(start.whiteTerritory).toHaveLength(23);
  });
});

describe("the three endgame moves, scored by the real engine", () => {
  it("sealing the wall converts the whole left side into Black's territory", () => {
    const before = scoreBoard(createEndgameBoard(), KOMI);
    const after = scoreBoard(play(createEndgameBoard(), SEAL_POINT), KOMI);

    expect(before.blackTerritory).toHaveLength(0);
    expect(after.blackTerritory).toHaveLength(36);
    expect(after.blackScore).toBe(45);
    expect(after.whiteScore).toBe(before.whiteScore);
  });

  it("each contested point moves one point out of dispute and into Black's score", () => {
    const sealed = play(createEndgameBoard(), SEAL_POINT);
    const reduced = play(sealed, REDUCE_POINT);

    expect(scoreBoard(sealed, KOMI).neutralPoints).toHaveLength(2);
    expect(scoreBoard(reduced, KOMI).neutralPoints).toHaveLength(1);
    expect(scoreBoard(reduced, KOMI).blackScore).toBe(scoreBoard(sealed, KOMI).blackScore + 1);
    // White gains nothing from Black's move, but loses a point it could have had.
    expect(scoreBoard(reduced, KOMI).whiteScore).toBe(scoreBoard(sealed, KOMI).whiteScore);
  });

  it("the two contested points are interchangeable, so either order finishes the same board", () => {
    const sealed = play(createEndgameBoard(), SEAL_POINT);
    const oneWay = play(play(sealed, REDUCE_POINT), FINAL_POINT);
    const otherWay = play(play(sealed, FINAL_POINT), REDUCE_POINT);
    expect(oneWay).toEqual(otherWay);
  });

  it("leaves nothing in dispute once all three are played, which is what makes passing correct", () => {
    const finished = play(play(play(createEndgameBoard(), SEAL_POINT), REDUCE_POINT), FINAL_POINT);
    const result = scoreBoard(finished, KOMI);

    expect(result.neutralPoints).toHaveLength(0);
    expect(result.blackScore).toBe(47);
    expect(result.whiteScore).toBe(41.5);
    expect(result.winner).toBe("black");
    expect(result.margin).toBe(5.5);
  });
});

describe("the moves that aren't worth playing", () => {
  it("a point inside Black's own side is legal, and gains Black nothing", () => {
    const sealed = play(createEndgameBoard(), SEAL_POINT);
    const before = scoreBoard(sealed, KOMI);

    for (const idle of IDLE_POINTS) {
      const after = scoreBoard(play(sealed, idle), KOMI);
      // One more stone, one less point of territory under it: no gain at all.
      expect(after.blackScore).toBe(before.blackScore);
    }
  });

  it("White's corner eye is rejected by the rules engine itself, not by the lesson", () => {
    const board = createEndgameBoard();
    expect(placeStone(board, SUICIDE_POINT, "black")).toEqual({ ok: false, reason: "suicide" });
    expect(board).toEqual(createEndgameBoard());
  });
});
