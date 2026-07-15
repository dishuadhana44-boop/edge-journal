import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

const BlockHandleExtension = Extension.create({
  name: "blockHandle",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("blockHandle"),

        view(editorView) {
          let hoveredNode = null;

          const mouseMove = (event) => {
            const target = event.target.closest(
              "p,h1,h2,h3,blockquote,li"
            );

            if (hoveredNode) {
              hoveredNode.classList.remove("notion-hover");
            }

            hoveredNode = null;

            if (!target) return;

            target.classList.add("notion-hover");
            hoveredNode = target;
          };

          const mouseLeave = () => {
            if (hoveredNode) {
              hoveredNode.classList.remove("notion-hover");
              hoveredNode = null;
            }
          };

          editorView.dom.addEventListener("mousemove", mouseMove);
          editorView.dom.addEventListener("mouseleave", mouseLeave);

          return {
            destroy() {
              editorView.dom.removeEventListener(
                "mousemove",
                mouseMove
              );

              editorView.dom.removeEventListener(
                "mouseleave",
                mouseLeave
              );
            },
          };
        },
      }),
    ];
  },
});

export default BlockHandleExtension;