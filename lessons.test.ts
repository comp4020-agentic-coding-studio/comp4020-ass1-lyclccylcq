// Guards against the exact regression this file is named for: one lesson's
// definition silently overwriting another's. Each lesson's identity and
// initial state come from lesson.ts, kept separate from DOM wiring, so this
// runs with no browser.

import { describe, expect, it } from "vitest";
import { getStone } from "./go-rules";
import { placingStonesLesson } from "./lesson-placing-stones";
import { libertiesAndCaptureLesson, TARGET } from "./lesson-liberties-capture";

const lessons = [placingStonesLesson, libertiesAndCaptureLesson];

describe("lesson definitions", () => {
  it("Lesson 1 (placing stones) exists", () => {
    expect(placingStonesLesson.id).toBe("placing-stones");
    expect(placingStonesLesson.title).toBeTruthy();
  });

  it("Lesson 2 (liberties and capture) exists", () => {
    expect(libertiesAndCaptureLesson.id).toBe("liberties-and-capture");
    expect(libertiesAndCaptureLesson.title).toBeTruthy();
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

  it("loading one lesson's initial state leaves the other lesson's definition untouched", () => {
    placingStonesLesson.createInitialBoard();
    const lesson2Board = libertiesAndCaptureLesson.createInitialBoard();
    expect(getStone(lesson2Board, TARGET)).toBe("black");

    libertiesAndCaptureLesson.createInitialBoard();
    const lesson1Board = placingStonesLesson.createInitialBoard();
    expect(getStone(lesson1Board, TARGET)).toBeNull();
  });
});
