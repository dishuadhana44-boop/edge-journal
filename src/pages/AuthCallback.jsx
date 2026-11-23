import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function AuthCallback() {
  const { isAuthenticated, loading } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      const timer = setTimeout(() => setError("Authentication timed out."), 5000);
      return () => clearTimeout(timer);
    }
  }, [loading, isAuthenticated]);

  if (error) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          <p className="mt-4 text-gray-400">Completing sign-in...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
        <p className="mt-4 text-gray-400">Finishing authentication...</p>
      </div>
    </div>
  );
}

export default AuthCallback;
