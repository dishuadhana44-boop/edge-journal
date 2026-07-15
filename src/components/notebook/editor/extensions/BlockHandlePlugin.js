import { Plugin } from "@tiptap/pm/state";

const BlockHandlePlugin = new Plugin({
  props: {
    handleDOMEvents: {
      mousemove(view, event) {
        const target = event.target.closest("p,h1,h2,h3,li,blockquote");

        document.querySelectorAll(".block-handle").forEach((el) => {
          el.style.opacity = "0";
        });

        if (!target) return false;

        const handle = target.querySelector(".block-handle");

        if (handle) {
          handle.style.opacity = "1";
        }

        return false;
      },
    },
  },
});

export default BlockHandlePlugin;