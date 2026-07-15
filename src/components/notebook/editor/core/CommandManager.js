class CommandManager {
    constructor() {
      this.commands = new Map();
    }
  
    register(name, callback) {
      this.commands.set(name, callback);
    }
  
    execute(name, ...args) {
      const command = this.commands.get(name);
  
      if (!command) {
        console.warn(`Command "${name}" not found.`);
        return;
      }
  
      return command(...args);
    }
  
    has(name) {
      return this.commands.has(name);
    }
  
    unregister(name) {
      this.commands.delete(name);
    }
  
    clear() {
      this.commands.clear();
    }
  }
  
  export default CommandManager;