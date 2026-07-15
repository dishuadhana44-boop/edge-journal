import suggestion from "@tiptap/suggestion";
import { commandItems } from "./commands";

export default suggestion({
  char: "/",

  items: ({ query }) => {
    return commandItems.filter((item) =>
      item.title.toLowerCase().includes(query.toLowerCase())
    );
  },

  render: () => {
    let popup;

    return {
      onStart: (props) => {
        popup = document.createElement("div");

        popup.className =
          "fixed z-[9999] w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden";

        popup.innerHTML = props.items
          .map(
            (item) => `
              <div class="px-4 py-3 hover:bg-gray-100 cursor-pointer flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                  ${item.icon}
                </div>

                <div>
                  <div class="font-medium text-sm">${item.title}</div>
                  <div class="text-xs text-gray-500">${item.description}</div>
                </div>
              </div>
            `
          )
          .join("");

        document.body.appendChild(popup);

        const rect = props.clientRect();

        popup.style.left = rect.left + "px";
        popup.style.top = rect.bottom + 8 + "px";
      },

      onUpdate: (props) => {
        const rect = props.clientRect();

        popup.style.left = rect.left + "px";
        popup.style.top = rect.bottom + 8 + "px";
      },

      onExit: () => {
        popup.remove();
      },
    };
  },
});