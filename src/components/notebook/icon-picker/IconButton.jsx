function IconButton({
  Icon,
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      className="
        w-9
        h-9
        rounded-lg
        flex
        items-center
        justify-center
        transition-all
        duration-150
        hover:bg-neutral-100
        active:scale-95
      "
    >
      <Icon
        size={19}
        strokeWidth={2}
        className="text-neutral-900"
      />
    </button>
  );
}

export default IconButton;