import BlockManager from "./BlockManager";

class EditorEngine {
  constructor() {
    this.blockManager = new BlockManager();
  }

  createBlock(type) {
    return this.blockManager.create(type);
  }

  getBlocks() {
    return this.blockManager.getAll();
  }

  removeBlock(id) {
    this.blockManager.remove(id);
  }
}

export default EditorEngine;