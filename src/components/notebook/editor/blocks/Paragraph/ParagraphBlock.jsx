function ParagraphBlock({
    children,
  }) {
    return (
      <p
        className="
          min-h-[28px]
          outline-none
          text-[16px]
          leading-7
          text-gray-800
        "
      >
        {children}
      </p>
    );
  }
  
  export default ParagraphBlock;