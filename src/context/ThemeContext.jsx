import React, {
    createContext,
    useContext,
    useEffect,
    useState,
  } from "react";
  
  const ThemeContext = createContext();
  
  export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
      const savedTheme = localStorage.getItem("edgeflo-theme");
  
      if (savedTheme) {
        return savedTheme;
      }
  
      return "light";
    });
  
    useEffect(() => {
      const root = document.documentElement;
  
      if (theme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
  
      localStorage.setItem("edgeflo-theme", theme);
    }, [theme]);
  
    const toggleTheme = () => {
      setTheme((currentTheme) =>
        currentTheme === "light" ? "dark" : "light"
      );
    };
  
    const value = {
      theme,
      setTheme,
      toggleTheme,
      isDark: theme === "dark",
    };
  
    return (
      <ThemeContext.Provider value={value}>
        {children}
      </ThemeContext.Provider>
    );
  }
  
  export function useTheme() {
    const context = useContext(ThemeContext);
  
    if (!context) {
      throw new Error(
        "useTheme must be used inside ThemeProvider"
      );
    }
  
    return context;
  }