import { createContext, useContext, useState } from "react";

const UIContext = createContext();

export function UIProvider({ children }) {

  const [orderOpen, setOrderOpen] = useState(false);

  const [quickOrderOpen, setQuickOrderOpen] = useState(false);

  return (
    <UIContext.Provider
      value={{
        orderOpen,
        setOrderOpen,

        quickOrderOpen,
        setQuickOrderOpen,
      }}
    >
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  return useContext(UIContext);
}