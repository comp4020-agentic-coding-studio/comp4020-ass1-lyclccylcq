import { createBoard } from "./go-rules";
import type { LessonDefinition } from "./lesson";

export const placingStonesLesson: LessonDefinition = {
  id: "placing-stones",
  title: "Placing a Stone",
  createInitialBoard: () => createBoard(9),
};
