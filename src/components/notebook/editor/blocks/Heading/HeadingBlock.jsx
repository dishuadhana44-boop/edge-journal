function HeadingBlock({
    level = 1,
    children,
  }) {
    const Tag = `h${level}`;
  
    return (
      <Tag
        className={`
          outline-none
          font-bold
          ${
            level === 1
              ? "text-4xl"
              : level === 2
              ? "text-3xl"
              : "text-2xl"
          }
        `}
      >
        {children}
      </Tag>
    );
  }
  
  export default HeadingBlock;