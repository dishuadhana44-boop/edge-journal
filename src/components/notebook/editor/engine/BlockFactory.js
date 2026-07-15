import { BLOCK_TYPES } from "./BlockTypes";

export function createBlock(type) {
  return {
    id: crypto.randomUUID(),

    type,

    content: "",

    children: [],
  };
}