import BlockManager from "./BlockManager";
import CommandManager from "./CommandManager";
import { commandItems } from "../commands";
import SelectionManager from "./SelectionManager";

class EditorEngine {
  constructor(editor) {
    this.editor = editor;

    this.blockManager = new BlockManager();
    this.commandManager = new CommandManager(editor);
    this.selectionManager = new SelectionManager();
    
    this.registerCommands();
  }

  registerCommands() {
    commandItems.forEach((item) => {
      if (item.command) {
        this.commandManager.register(
          item.title,
          item.command
        );
      }
    });
  }

  execute(name, payload = {}) {
    return this.commandManager.execute(
      name,
      payload
    );
  }

  getBlocks() {
    return this.blockManager.getAll();
  }
}

export default EditorEngine;