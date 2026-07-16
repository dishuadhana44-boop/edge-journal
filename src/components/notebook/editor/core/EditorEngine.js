import BlockManager from "./BlockManager";
import CommandManager from "./CommandManager";
import HistoryManager from "./HistoryManager";
import SelectionManager from "./SelectionManager";

class EditorEngine {
  constructor(editor) {
    this.editor = editor;

    this.blockManager = new BlockManager();

    this.commandManager = new CommandManager(editor);

    this.historyManager = new HistoryManager();

    this.selectionManager = new SelectionManager(editor);
  }

  getEditor() {
    return this.editor;
  }

  getBlocks() {
    return this.blockManager.getAll();
  }

  createBlock(type) {
    return this.blockManager.create(type);
  }

  removeBlock(id) {
    this.blockManager.remove(id);
  }

  commands() {
    return this.commandManager;
  }

  history() {
    return this.historyManager;
  }

  selection() {
    return this.selectionManager;
  }
}

export default EditorEngine;