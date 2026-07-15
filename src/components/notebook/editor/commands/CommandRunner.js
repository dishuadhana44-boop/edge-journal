export function runCommand(title, editor) {
    if (!editor) return;
  
    switch (title) {
      case "Text":
        editor.chain().focus().setParagraph().run();
        break;
  
      case "Heading 1":
        editor.chain().focus().toggleHeading({ level: 1 }).run();
        break;
  
      case "Heading 2":
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        break;
  
      case "Heading 3":
        editor.chain().focus().toggleHeading({ level: 3 }).run();
        break;
  
      default:
        console.log(title);
    }
  }