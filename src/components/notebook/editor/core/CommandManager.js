class CommandManager {
  constructor(editor) {
    this.editor = editor;
    this.commands = new Map();
  }

  register(name, command) {
    this.commands.set(name, command);
  }

  execute(name, payload = {}) {
    const command = this.commands.get(name);

    if (!command) {
      console.warn(`Command "${name}" not found.`);
      return false;
    }

    return command({
      editor: this.editor,
      ...payload,
    });
  }

  has(name) {
    return this.commands.has(name);
  }

  getAll() {
    return [...this.commands.keys()];
  }
}

export default CommandManager;