import SlashMenu from "../SlashMenu";
import BlockMenu from "../menus/BlockMenu";

function MenuController({
  showSlashMenu,
  showBlockMenu,
  menuRef,
  blockMenuRef,
  editor,
  onCloseSlash,
  onCloseBlock,
}) {
  return (
    <>
      {showSlashMenu && (
        <div
          ref={menuRef}
          className="absolute left-0 top-10 z-50"
        >
          <SlashMenu
            editor={editor}
            onClose={onCloseSlash}
          />
        </div>
      )}

      {showBlockMenu && (
        <div
          ref={blockMenuRef}
          className="absolute left-10 top-10 z-50"
        >
          <BlockMenu
            onClose={onCloseBlock}
          />
        </div>
      )}
    </>
  );
}

export default MenuController;