export default function NavigationItem({
    icon: Icon,
    title,
    active,
    onClick,
  }) {
    return (
      <button
        onClick={onClick}
        className={`
          w-full
          flex
          items-center
          gap-3
          px-3
          py-3
          rounded-xl
          text-sm
          font-medium
          transition-all
          duration-200
          ${
            active
              ? "bg-violet-600 text-white shadow-md"
              : "text-gray-700 hover:bg-violet-50 hover:text-violet-600"
          }
        `}
      >
        <Icon size={19} />
  
        <span>{title}</span>
      </button>
    );
  }