import { describe, expect, it } from "vitest";
import { createBoard, getGroup, getLiberties, getStone, placeStone, type Point } from "./go-rules";

describe("placeStone", () => {
  it("places a stone on an empty point", () => {
    const board = createBoard(9);
    const result = placeStone(board, { row: 4, col: 4 }, "black");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(getStone(result.board, { row: 4, col: 4 })).toBe("black");
    }
  });

  it("rejects placing on an occupied point", () => {
    const board = createBoard(9);
    const first = placeStone(board, { row: 4, col: 4 }, "black");
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = placeStone(first.board, { row: 4, col: 4 }, "white");
    expect(second).toEqual({ ok: false, reason: "occupied" });
  });
});

describe("getLiberties", () => {
  it("gives a centre stone four liberties", () => {
    const board = createBoard(9);
    const result = placeStone(board, { row: 4, col: 4 }, "black");
    if (!result.ok) throw new Error("expected placement to succeed");

    const group = getGroup(result.board, { row: 4, col: 4 });
    expect(getLiberties(result.board, group)).toHaveLength(4);
  });

  it("gives an edge stone three liberties", () => {
    const board = createBoard(9);
    const result = placeStone(board, { row: 0, col: 4 }, "black");
    if (!result.ok) throw new Error("expected placement to succeed");

    const group = getGroup(result.board, { row: 0, col: 4 });
    expect(getLiberties(result.board, group)).toHaveLength(3);
  });

  it("gives a corner stone two liberties", () => {
    const board = createBoard(9);
    const result = placeStone(board, { row: 0, col: 0 }, "black");
    if (!result.ok) throw new Error("expected placement to succeed");

    const group = getGroup(result.board, { row: 0, col: 0 });
    expect(getLiberties(result.board, group)).toHaveLength(2);
  });
});

describe("getGroup", () => {
  it("detects connected stones as one group", () => {
    let board = createBoard(9);
    for (const point of [
      { row: 4, col: 4 },
      { row: 4, col: 5 },
    ]) {
      const result = placeStone(board, point, "black");
      if (!result.ok) throw new Error("expected placement to succeed");
      board = result.board;
    }

    const group = getGroup(board, { row: 4, col: 4 });
    expect(group).toHaveLength(2);
    expect(group).toEqual(
      expect.arrayContaining([
        { row: 4, col: 4 },
        { row: 4, col: 5 },
      ]),
    );
  });

  it("gives connected stones their shared liberties", () => {
    let board = createBoard(9);
    for (const point of [
      { row: 4, col: 4 },
      { row: 4, col: 5 },
    ]) {
      const result = placeStone(board, point, "black");
      if (!result.ok) throw new Error("expected placement to succeed");
      board = result.board;
    }

    const group = getGroup(board, { row: 4, col: 4 });
    // Two centre stones side by side share a border, so the pair has six
    // liberties, not eight: four each minus the two points they touch twice.
    expect(getLiberties(board, group)).toHaveLength(6);
  });
});

describe("captures", () => {
  it("captures a single stone once its last liberty is filled", () => {
    let board = createBoard(9);
    const target: Point = { row: 4, col: 4 };
    const surrounding: Point[] = [
      { row: 3, col: 4 },
      { row: 5, col: 4 },
      { row: 4, col: 3 },
      { row: 4, col: 5 },
    ];

    const placedTarget = placeStone(board, target, "black");
    if (!placedTarget.ok) throw new Error("expected placement to succeed");
    board = placedTarget.board;

    for (const [index, point] of surrounding.entries()) {
      const result = placeStone(board, point, "white");
      if (!result.ok) throw new Error("expected placement to succeed");
      board = result.board;

      const isLastMove = index === surrounding.length - 1;
      expect(result.captured).toEqual(isLastMove ? [target] : []);
      expect(getStone(board, target)).toBe(isLastMove ? null : "black");
    }
  });

  it("captures a whole surrounded group, not just one stone", () => {
    let board = createBoard(9);
    const group: Point[] = [
      { row: 4, col: 4 },
      { row: 4, col: 5 },
    ];
    const surrounding: Point[] = [
      { row: 3, col: 4 },
      { row: 3, col: 5 },
      { row: 5, col: 4 },
      { row: 5, col: 5 },
      { row: 4, col: 3 },
      { row: 4, col: 6 },
    ];

    for (const point of group) {
      const result = placeStone(board, point, "black");
      if (!result.ok) throw new Error("expected placement to succeed");
      board = result.board;
    }

    for (const point of surrounding) {
      const result = placeStone(board, point, "white");
      if (!result.ok) throw new Error("expected placement to succeed");
      board = result.board;
    }

    for (const point of group) {
      expect(getStone(board, point)).toBeNull();
    }
  });

  it("does not remove unrelated stones when a nearby group is captured", () => {
    let board = createBoard(9);
    const target: Point = { row: 4, col: 4 };
    const bystander: Point = { row: 0, col: 0 };
    const surrounding: Point[] = [
      { row: 3, col: 4 },
      { row: 5, col: 4 },
      { row: 4, col: 3 },
      { row: 4, col: 5 },
    ];

    const placedTarget = placeStone(board, target, "black");
    if (!placedTarget.ok) throw new Error("expected placement to succeed");
    board = placedTarget.board;

    const placedBystander = placeStone(board, bystander, "black");
    if (!placedBystander.ok) throw new Error("expected placement to succeed");
    board = placedBystander.board;

    for (const point of surrounding) {
      const result = placeStone(board, point, "white");
      if (!result.ok) throw new Error("expected placement to succeed");
      board = result.board;
    }

    expect(getStone(board, target)).toBeNull();
    expect(getStone(board, bystander)).toBe("black");
  });
});

describe("the liberties lesson's move sequence", () => {
  // Mirrors exactly what lessons/placing-stones.html walks the learner
  // through: a lone black stone at board centre, captured by placing white
  // on each of its four liberties in turn.
  it("captures the centre stone once all four liberties are filled", () => {
    let board = createBoard(9);
    const target: Point = { row: 4, col: 4 };

    const placedTarget = placeStone(board, target, "black");
    if (!placedTarget.ok) throw new Error("expected placement to succeed");
    board = placedTarget.board;

    let lastLiberties = getLiberties(board, getGroup(board, target));
    expect(lastLiberties).toHaveLength(4);

    while (lastLiberties.length > 0) {
      const [next] = lastLiberties;
      const result = placeStone(board, next, "white");
      if (!result.ok) throw new Error("expected placement to succeed");
      board = result.board;
      lastLiberties = getLiberties(board, getGroup(board, target));
    }

    expect(getStone(board, target)).toBeNull();
  });
});
