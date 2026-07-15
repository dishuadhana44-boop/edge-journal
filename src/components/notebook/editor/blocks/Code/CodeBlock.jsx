function CodeBlock({ children }) {
    return (
      <pre
        className="
          bg-gray-900
          text-gray-100
          rounded-lg
          p-4
          overflow-x-auto
          my-3
        "
      >
        <code>{children}</code>
      </pre>
    );
  }
  
  export default CodeBlock;