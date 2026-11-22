import { useEffect, useRef, useState } from "react";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

let scriptPromise = null;

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(
        `script[src="${GSI_SCRIPT_SRC}"]`
      );

      const script = existing || document.createElement("script");

      const handleLoad = () => resolve();

      const handleError = () => {
        scriptPromise = null;
        reject(
          new Error(
            "Could not load Google Sign-In. Check your connection and try again."
          )
        );
      };

      script.addEventListener("load", handleLoad);
      script.addEventListener("error", handleError);

      if (!existing) {
        script.src = GSI_SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    });
  }

  return scriptPromise;
}

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 48 48"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function GoogleLoginButton({ onSuccess, onError }) {
  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (GOOGLE_CLIENT_ID) {
      loadGoogleIdentityScript().catch(() => {});
    }
  }, []);

  const finish = () => {
    inFlightRef.current = false;
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    if (inFlightRef.current) {
      return;
    }

    onError("");

    if (!GOOGLE_CLIENT_ID) {
      onError(
        "Google sign-in is not configured. Add VITE_GOOGLE_CLIENT_ID to your .env.local file and restart the dev server."
      );
      return;
    }

    inFlightRef.current = true;
    setLoading(true);

    try {
      await loadGoogleIdentityScript();
    } catch (loadError) {
      finish();
      onError(loadError.message);
      return;
    }

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "openid email profile",
        callback: async (response) => {
          if (response?.error) {
            finish();

            onError(
              response.error === "access_denied"
                ? "Google sign-in was cancelled."
                : `Google sign-in failed: ${response.error}`
            );

            return;
          }

          try {
            const profileResponse = await fetch(
              "https://www.googleapis.com/oauth2/v3/userinfo",
              {
                headers: {
                  Authorization: `Bearer ${response.access_token}`,
                },
              }
            );

            if (!profileResponse.ok) {
              throw new Error("userinfo request failed");
            }

            const profile = await profileResponse.json();

            if (!profile?.email || !profile?.sub) {
              throw new Error("incomplete profile");
            }

            finish();
            onSuccess(profile);
          } catch {
            finish();
            onError(
              "Could not retrieve your Google account details. Please try again."
            );
          }
        },
        error_callback: (popupError) => {
          finish();

          if (
            popupError?.type === "popup_closed" ||
            popupError?.type === "popup_failed_to_open"
          ) {
            onError("Google sign-in window was closed before completing.");
          } else {
            onError("Google sign-in could not be started. Please try again.");
          }
        },
      });

      tokenClient.requestAccessToken({ prompt: "select_account" });
    } catch {
      finish();
      onError("Google sign-in could not be started. Please try again.");
    }
  };

  return (
    <button
      type="button"
      onClick={handleGoogleLogin}
      disabled={loading}
      className="w-full h-12 rounded-xl bg-white text-gray-900 border border-white/10 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-3 transition"
    >
      <GoogleIcon />
      {loading ? "Connecting..." : "Continue with Google"}
    </button>
  );
}

export default GoogleLoginButton;
