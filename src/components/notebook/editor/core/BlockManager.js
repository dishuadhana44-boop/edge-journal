import { createBlock } from "../engine/BlockFactory";
import { BLOCK_TYPES } from "../engine/BlockTypes";

class BlockManager {
  constructor() {
    this.blocks = [];
  }

  create(type = BLOCK_TYPES.PARAGRAPH) {
    const block = createBlock(type);

    this.blocks.push(block);

    return block;
  }

  getAll() {
    return this.blocks;
  }

  remove(id) {
    this.blocks = this.blocks.filter(
      block => block.id !== id
    );
  }
}

export default BlockManager;