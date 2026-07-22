class SelectionManager {
  constructor() {
    this.selection = null;
  }

  save(editor) {
    if (!editor) return;

    this.selection = {
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    };
  }

  restore(editor) {
    if (!editor || !this.selection) return;

    editor
      .chain()
      .focus()
      .setTextSelection(this.selection)
      .run();
  }

  clear() {
    this.selection = null;
  }

  get() {
    return this.selection;
  }
}

export default SelectionManager;