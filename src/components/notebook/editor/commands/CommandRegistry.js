import { commandItems } from "./commandItems";

export function getCommand(title) {
  return commandItems.find(
    item => item.title === title
  );
}