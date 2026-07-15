import { Extension } from "@tiptap/core";
import suggestion from "./suggestion";

const SlashExtension = Extension.create({
  name: "slash-command",

  addProseMirrorPlugins() {
    return [
      suggestion,
    ];
  },
});

export default SlashExtension;