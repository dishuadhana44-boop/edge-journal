class SelectionManager {
    constructor() {
      this.selectedBlockId = null;
    }
  
    select(blockId) {
      this.selectedBlockId = blockId;
    }
  
    clear() {
      this.selectedBlockId = null;
    }
  
    getSelected() {
      return this.selectedBlockId;
    }
  
    isSelected(blockId) {
      return this.selectedBlockId === blockId;
    }
  }
  
  export default SelectionManager;