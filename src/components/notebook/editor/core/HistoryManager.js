class HistoryManager {
    constructor() {
      this.undoStack = [];
      this.redoStack = [];
    }
  
    save(state) {
      this.undoStack.push(
        JSON.parse(JSON.stringify(state))
      );
  
      this.redoStack = [];
    }
  
    undo(currentState) {
      if (this.undoStack.length === 0) {
        return currentState;
      }
  
      this.redoStack.push(
        JSON.parse(JSON.stringify(currentState))
      );
  
      return this.undoStack.pop();
    }
  
    redo(currentState) {
      if (this.redoStack.length === 0) {
        return currentState;
      }
  
      this.undoStack.push(
        JSON.parse(JSON.stringify(currentState))
      );
  
      return this.redoStack.pop();
    }
  
    clear() {
      this.undoStack = [];
      this.redoStack = [];
    }
  }
  
  export default HistoryManager;