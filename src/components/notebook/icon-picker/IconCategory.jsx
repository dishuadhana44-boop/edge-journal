function IconCategory({
    title,
    children,
  }) {
    return (
      <div className="mb-6">
  
        <h3 className="mb-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
          {title}
        </h3>
  
        <div className="grid grid-cols-8 gap-2">
          {children}
        </div>
  
      </div>
    );
  }
  
  export default IconCategory;