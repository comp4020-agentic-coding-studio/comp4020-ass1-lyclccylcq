// Guards against the exact regression this file is named for: one lesson's
// definition silently overwriting another's. Each lesson's identity and
// initial state come from lesson.ts, kept separate from DOM wiring, so this
// runs with no browser.

import { describe, expect, it } from "vitest";
import { getGroup, getLiberties, getStone, placeStone } from "./go-rules";
import { placingStonesLesson } from "./lesson-placing-stones";
import { libertiesAndCaptureLesson, TARGET } from "./lesson-liberties-capture";
import {
  EXAMPLE_1_GROUP,
  EXAMPLE_2_GROUP,
  EXAMPLE_3_GROUP,
  connectedGroupsLesson,
  createExample1Board,
  createExample2Board,
  createExample3Board,
  isGroupCaptured,
} from "./lesson-connected-groups";
import {
  CAPTURE_BLACK,
  CAPTURE_TARGET,
  CAPTURE_WHITE,
  SUICIDE_TARGET,
  SUICIDE_WHITE,
  createCaptureExampleBoard,
  createSuicideExampleBoard,
  illegalMovesLesson,
} from "./lesson-illegal-moves";
import { CAPTURE_POINT, KO_POINT, koLesson } from "./lesson-ko";
import { createScoringBoard, scoringLesson } from "./lesson-scoring";

const lessons = [
  placingStonesLesson,
  libertiesAndCaptureLesson,
  connectedGroupsLesson,
  illegalMovesLesson,
  koLesson,
  scoringLesson,
];
const examples = [
  { group: EXAMPLE_1_GROUP, createBoard: createExample1Board },
  { group: EXAMPLE_2_GROUP, createBoard: createExample2Board },
  { group: EXAMPLE_3_GROUP, createBoard: createExample3Board },
];

describe("lesson definitions", () => {
  it("Lesson 1 (placing stones) exists", () => {
    expect(placingStonesLesson.id).toBe("placing-stones");
    expect(placingStonesLesson.title).toBeTruthy();
  });

  it("Lesson 2 (liberties and capture) exists", () => {
    expect(libertiesAndCaptureLesson.id).toBe("liberties-and-capture");
    expect(libertiesAndCaptureLesson.title).toBeTruthy();
  });

  it("Lesson 3 (connected groups) exists", () => {
    expect(connectedGroupsLesson.id).toBe("connected-groups");
    expect(connectedGroupsLesson.title).toBeTruthy();
  });

  it("Lesson 4 (illegal moves) exists", () => {
    expect(illegalMovesLesson.id).toBe("illegal-moves");
    expect(illegalMovesLesson.title).toBeTruthy();
  });

  it("every lesson has a distinct id and title", () => {
    const ids = lessons.map((lesson) => lesson.id);
    const titles = lessons.map((lesson) => lesson.title);
    expect(new Set(ids).size).toBe(lessons.length);
    expect(new Set(titles).size).toBe(lessons.length);
  });

  it("Lesson 1 loads its own initial state: an empty board", () => {
    const board = placingStonesLesson.createInitialBoard();
    for (const row of board.cells) {
      for (const cell of row) expect(cell).toBeNull();
    }
  });

  it("Lesson 2 loads its own initial state: a black stone already placed", () => {
    const board = libertiesAndCaptureLesson.createInitialBoard();
    expect(getStone(board, TARGET)).toBe("black");
  });

  it("Lesson 3 loads its own initial state: a small connected black group", () => {
    const board = connectedGroupsLesson.createInitialBoard();
    for (const point of EXAMPLE_1_GROUP) {
      expect(getStone(board, point)).toBe("black");
    }
    expect(getGroup(board, EXAMPLE_1_GROUP[0])).toHaveLength(EXAMPLE_1_GROUP.length);
  });

  it("Lesson 4 loads its own initial state: a point fully surrounded by White, still empty", () => {
    const board = illegalMovesLesson.createInitialBoard();
    for (const point of SUICIDE_WHITE) {
      expect(getStone(board, point)).toBe("white");
    }
    expect(getStone(board, SUICIDE_TARGET)).toBeNull();
  });

  it("Lesson 5 (ko) exists", () => {
    expect(koLesson.id).toBe("ko");
    expect(koLesson.title).toBeTruthy();
  });

  it("Lesson 5 loads its own initial state: a lone White stone with one liberty", () => {
    const board = koLesson.createInitialBoard();
    expect(getStone(board, KO_POINT)).toBe("white");
    expect(getStone(board, CAPTURE_POINT)).toBeNull();
  });

  it("Lesson 6 (scoring) exists", () => {
    expect(scoringLesson.id).toBe("scoring");
    expect(scoringLesson.title).toBeTruthy();
  });

  it("Lesson 6 loads its own initial state: a finished 9x9 position dividing the board in two", () => {
    const board = scoringLesson.createInitialBoard();
    expect(board.size).toBe(9);
    expect(getStone(board, { row: 0, col: 3 })).toBe("black");
    expect(getStone(board, { row: 0, col: 4 })).toBe("white");
    expect(getStone(board, { row: 8, col: 5 })).toBe("black");
    expect(getStone(board, { row: 8, col: 6 })).toBe("white");

    const sameBoard = createScoringBoard();
    expect(sameBoard).toEqual(board);
  });

  it("loading one lesson's initial state leaves the other lessons' definitions untouched", () => {
    placingStonesLesson.createInitialBoard();
    connectedGroupsLesson.createInitialBoard();
    const lesson2Board = libertiesAndCaptureLesson.createInitialBoard();
    expect(getStone(lesson2Board, TARGET)).toBe("black");

    libertiesAndCaptureLesson.createInitialBoard();
    connectedGroupsLesson.createInitialBoard();
    const lesson1Board = placingStonesLesson.createInitialBoard();
    expect(getStone(lesson1Board, TARGET)).toBeNull();

    placingStonesLesson.createInitialBoard();
    libertiesAndCaptureLesson.createInitialBoard();
    const lesson3Board = connectedGroupsLesson.createInitialBoard();
    for (const point of EXAMPLE_1_GROUP) {
      expect(getStone(lesson3Board, point)).toBe("black");
    }
  });
});

describe("Lesson 3's three capture examples", () => {
  it("each starts from a distinct board holding only its own group", () => {
    const boards = examples.map((example) => example.createBoard());

    for (const [index, example] of examples.entries()) {
      const board = boards[index];
      for (const point of example.group) {
        expect(getStone(board, point)).toBe("black");
      }
      // No other example's group is present on this board.
      for (const [otherIndex, otherExample] of examples.entries()) {
        if (otherIndex === index) continue;
        for (const point of otherExample.group) {
          expect(getStone(board, point)).toBeNull();
        }
      }
    }

    // The three initial boards are genuinely different positions.
    const stoneCounts = boards.map((board) => board.cells.flat().filter((cell) => cell === "black").length);
    expect(new Set(stoneCounts).size).toBeGreaterThan(1);
  });

  it("clicking any stone in a group selects the whole connected group", () => {
    const board = createExample2Board();
    for (const anchor of EXAMPLE_2_GROUP) {
      const group = getGroup(board, anchor);
      expect(group).toHaveLength(EXAMPLE_2_GROUP.length);
      expect(group).toEqual(expect.arrayContaining(EXAMPLE_2_GROUP));
    }
  });

  it("exposes each example's actual shared liberties, not a hidden answer", () => {
    expect(getLiberties(createExample1Board(), EXAMPLE_1_GROUP)).toHaveLength(6);
    expect(getLiberties(createExample2Board(), EXAMPLE_2_GROUP)).toHaveLength(8);
    expect(getLiberties(createExample3Board(), EXAMPLE_3_GROUP)).toHaveLength(5);
  });

  it("does not reveal a predetermined answer in example 3's initial state", () => {
    const board = createExample3Board();
    const liberties = getLiberties(board, EXAMPLE_3_GROUP);
    // Every liberty is a plain empty point — none is marked, filled, or
    // otherwise distinguished as "the" move to play.
    for (const liberty of liberties) {
      expect(getStone(board, liberty)).toBeNull();
    }
    expect(isGroupCaptured(board, EXAMPLE_3_GROUP)).toBe(false);
  });

  it("playing a white stone reduces the group's liberties one at a time, allowing consecutive white moves", () => {
    let board = createExample1Board();
    let liberties = getLiberties(board, EXAMPLE_1_GROUP);
    expect(liberties).toHaveLength(6);

    while (liberties.length > 0) {
      const before = liberties.length;
      const result = placeStone(board, liberties[0], "white");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      board = result.board;
      liberties = isGroupCaptured(board, EXAMPLE_1_GROUP) ? [] : getLiberties(board, EXAMPLE_1_GROUP);
      expect(liberties.length).toBeLessThan(before);
    }

    expect(isGroupCaptured(board, EXAMPLE_1_GROUP)).toBe(true);
  });

  it("filling the final liberty captures every stone in the group together", () => {
    let board = createExample2Board();
    for (const liberty of getLiberties(board, EXAMPLE_2_GROUP)) {
      const result = placeStone(board, liberty, "white");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      board = result.board;
    }

    expect(isGroupCaptured(board, EXAMPLE_2_GROUP)).toBe(true);
    for (const point of EXAMPLE_2_GROUP) {
      expect(getStone(board, point)).toBeNull();
    }
  });

  it("an illegal move (playing on an occupied point) leaves the board unchanged", () => {
    const board = createExample1Board();
    const before = JSON.parse(JSON.stringify(board));

    const result = placeStone(board, EXAMPLE_1_GROUP[0], "white");
    expect(result).toEqual({ ok: false, reason: "occupied" });
    expect(board).toEqual(before);
  });
});

describe("Lesson 4's two illegal-move examples", () => {
  it("example 1 starts unsolved: the surrounded point is empty and untouched", () => {
    const board = createSuicideExampleBoard();
    expect(getStone(board, SUICIDE_TARGET)).toBeNull();
    for (const point of SUICIDE_WHITE) expect(getStone(board, point)).toBe("white");
  });

  it("does not reveal the illegal point in advance: every White stone there still has its own other liberty", () => {
    const board = createSuicideExampleBoard();
    // If any of these White stones were already at zero liberties elsewhere,
    // the position would be pre-decided rather than something the learner
    // has to actually try.
    for (const point of SUICIDE_WHITE) {
      expect(getLiberties(board, getGroup(board, point)).length).toBeGreaterThan(0);
    }
  });

  it("attempting the suicide move is rejected by the shared rules engine and leaves the board unchanged", () => {
    const board = createSuicideExampleBoard();
    const before = JSON.parse(JSON.stringify(board));

    const attempt = placeStone(board, SUICIDE_TARGET, "black");
    expect(attempt).toEqual({ ok: false, reason: "suicide" });
    expect(board).toEqual(before);
    expect(getStone(board, SUICIDE_TARGET)).toBeNull();
  });

  it("example 2 starts unsolved: the corner point is empty, White and Black are in place", () => {
    const board = createCaptureExampleBoard();
    expect(getStone(board, CAPTURE_TARGET)).toBeNull();
    for (const point of CAPTURE_WHITE) expect(getStone(board, point)).toBe("white");
    for (const point of CAPTURE_BLACK) expect(getStone(board, point)).toBe("black");
  });

  it("the legal capturing move completes example 2: White is removed, Black remains with liberties", () => {
    const board = createCaptureExampleBoard();
    const attempt = placeStone(board, CAPTURE_TARGET, "black");

    expect(attempt.ok).toBe(true);
    if (!attempt.ok) return;
    expect(attempt.captured).toEqual(expect.arrayContaining(CAPTURE_WHITE));
    for (const point of CAPTURE_WHITE) {
      expect(getStone(attempt.board, point)).toBeNull();
    }
    expect(getStone(attempt.board, CAPTURE_TARGET)).toBe("black");
    expect(getLiberties(attempt.board, getGroup(attempt.board, CAPTURE_TARGET)).length).toBeGreaterThan(0);
    expect(illegalMovesLesson.isComplete?.(attempt.board)).toBe(true);
  });

  it("occupied intersections are still rejected separately from suicide", () => {
    const board = createSuicideExampleBoard();
    const result = placeStone(board, SUICIDE_WHITE[0], "black");
    expect(result).toEqual({ ok: false, reason: "occupied" });
  });
});
