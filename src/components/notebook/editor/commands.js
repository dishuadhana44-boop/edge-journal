export const commandItems = [
    {
      title: "Text",
      description: "Just start writing with plain text.",
      icon: "📝",
      command: ({ editor }) => {
        const result = editor
          .chain()
          .focus()
          .setHeading({ level: 1 })
          .run();
      
        console.log("HTML:", editor.getHTML());
        console.log(
          "Current Node:",
          editor.state.selection.$from.parent.type.name
        );
      
        return result;
      },
    },
    {
      title: "Heading 1",
      description: "Large section heading",
      icon: "H1",
    
      command: ({ editor }) => {
    
        const result = editor
          .chain()
          .focus()
          .setHeading({ level: 1 })
          .insertContent("TEST")
          .run();
    
        console.log("HTML:", editor.getHTML());
        console.log(
          "Node:",
          editor.state.selection.$from.parent.type.name
        );
    
        return result;
      },
    },
  
    {
      title: "Heading 2",
      description: "Medium section heading",
      icon: "H2",
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleHeading({ level: 2 })
          .run();
      },
    },
  
    {
      title: "Heading 3",
      description: "Small section heading",
      icon: "H3",
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleHeading({ level: 3 })
          .run();
      },
    },
  
    {
      title: "Bullet List",
      description: "Create a bullet list",
      icon: "•",
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleBulletList()
          .run();
      },
    },
  
    {
      title: "Numbered List",
      description: "Create a numbered list",
      icon: "1.",
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleOrderedList()
          .run();
      },
    },
    {
      title: "To-do",
      description: "Track your tasks",
      icon: "☑️",
    
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleTaskList()
          .run();
      },
    },
  
    {
      title: "Quote",
      description: "Capture a quote",
      icon: "❝",
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleBlockquote()
          .run();
      },
    },
    {
      title: "Divider",
      description: "Insert divider",
      icon: "➖",
    
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setHorizontalRule()
          .run();
      },
    },

    {
      title: "Code Block",
      description: "Insert code",
      icon: "</>",
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleCodeBlock()
          .run();
      },
    },
    {
      title: "Image",
      description: "Insert image",
      icon: "🖼️",
    
      command: ({ editor }) => {
        const url = window.prompt("Image URL");
    
        if (url) {
          editor
            .chain()
            .focus()
            .setImage({ src: url })
            .run();
        }
      },
    },
    {
      title: "Table",
      description: "Insert a table",
      icon: "📊",
    
      command: ({ editor }) => {
        console.log("Table command running");
      
        const result = editor
          .chain()
          .focus()
          .insertTable({
            rows: 3,
            cols: 3,
            withHeaderRow: true,
          })
          .run();
      
        console.log("Result:", result);
      }
    },
  ];