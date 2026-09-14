import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Camera,
  Pencil,
  X,
  Save,
  LogIn,
  LogOut,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";

export default function AccountPage() {
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Login state
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const savedLoginState = localStorage.getItem("isLoggedIn");

    // Default account is logged in for the current app
    if (savedLoginState === null) {
      localStorage.setItem("isLoggedIn", "true");
      return true;
    }

    return savedLoginState === "true";
  });

  const [profile, setProfile] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("userProfile")) || {
          fullName: "",
          username: "",
          email: "",
          phone: "",
          country: "",
          timezone: "",
          language: "English",
        }
      );
    } catch {
      return {
        fullName: "",
        username: "",
        email: "",
        phone: "",
        country: "",
        timezone: "",
        language: "English",
      };
    }
  });

  const fileInputRef = useRef(null);

  const [profileImage, setProfileImage] = useState(() => {
    return localStorage.getItem("profileImage") || "";
  });

  const handleChange = (e) => {
    setProfile({
      ...profile,
      [e.target.name]: e.target.value,
    });
  };

  const handleProfileImage = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const image = reader.result;

      setProfileImage(image);
      localStorage.setItem("profileImage", image);
    };

    reader.readAsDataURL(file);
  };

  const handleDropImage = (e) => {
    e.preventDefault();

    const file = e.dataTransfer.files?.[0];

    if (!file || !file.type.startsWith("image/")) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const image = reader.result;

      setProfileImage(image);
      localStorage.setItem("profileImage", image);
    };

    reader.readAsDataURL(file);
  };

  const handleSaveProfile = () => {
    localStorage.setItem("userProfile", JSON.stringify(profile));
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    try {
      const savedProfile = JSON.parse(
        localStorage.getItem("userProfile")
      );

      if (savedProfile) {
        setProfile(savedProfile);
      }
    } catch {
      // Keep current state if stored profile is invalid
    }

    setIsEditing(false);
  };

  const handleRemovePhoto = () => {
    setProfileImage("");
    localStorage.removeItem("profileImage");
  };

  // Logout and return to Landing Page
  const handleLogout = () => {
    localStorage.setItem("isLoggedIn", "false");

    setIsLoggedIn(false);
    setShowLogoutModal(false);
    setIsEditing(false);

    // Navigate to Landing Page
    navigate("/");
  };

  const handleLogin = () => {
    localStorage.setItem("isLoggedIn", "true");
    setIsLoggedIn(true);
  };

  const avatarUrl =
    profileImage ||
    "https://ui-avatars.com/api/?name=User&background=8b5cf6&color=fff&size=200";

  return (
    <>
      <div className="w-full max-w-6xl mx-auto px-6 pb-10">
        {/* Main Account Card */}
        <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-gray-800 rounded-3xl p-8 transition-colors">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Account
              </h2>

              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Manage your personal information and account settings.
              </p>
            </div>

            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="
                  flex
                  items-center
                  gap-2
                  px-5
                  py-2.5
                  rounded-xl
                  bg-violet-600
                  hover:bg-violet-700
                  text-white
                  transition-all
                  duration-200
                  hover:scale-105
                "
              >
                <Pencil size={18} />
                Edit Profile
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={handleCancelEdit}
                  className="
                    px-5
                    py-2.5
                    rounded-xl
                    border
                    border-gray-200
                    dark:border-gray-700
                    hover:bg-gray-100
                    dark:hover:bg-gray-800
                    text-gray-700
                    dark:text-gray-200
                    flex
                    items-center
                    gap-2
                    transition-colors
                  "
                >
                  <X size={18} />
                  Cancel
                </button>

                <button
                  onClick={handleSaveProfile}
                  className="
                    px-5
                    py-2.5
                    rounded-xl
                    bg-violet-600
                    hover:bg-violet-700
                    text-white
                    flex
                    items-center
                    gap-2
                    transition-all
                    duration-200
                    hover:scale-105
                  "
                >
                  <Save size={18} />
                  Save
                </button>
              </div>
            )}
          </div>

          {/* Profile Area */}
          <div className="flex gap-10">
            {/* Left - Profile Photo */}
            <div className="w-56 shrink-0 flex flex-col items-center">
              <div
                className="relative"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDropImage}
              >
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="
                    w-36
                    h-36
                    rounded-full
                    object-cover
                    border-4
                    border-violet-100
                    dark:border-violet-900/50
                  "
                />

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfileImage}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="
                    absolute
                    bottom-2
                    right-2
                    w-10
                    h-10
                    rounded-full
                    bg-violet-600
                    text-white
                    flex
                    items-center
                    justify-center
                    hover:scale-110
                    transition
                    duration-200
                    shadow-lg
                  "
                  title="Change photo"
                >
                  <Camera size={18} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="
                  mt-5
                  text-violet-600
                  dark:text-violet-400
                  text-sm
                  font-medium
                  hover:underline
                "
              >
                Change Photo
              </button>

              {profileImage && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="
                    mt-3
                    px-4
                    py-2
                    rounded-xl
                    border
                    border-red-200
                    dark:border-red-900
                    bg-red-50
                    dark:bg-red-950/30
                    text-red-600
                    dark:text-red-400
                    text-sm
                    font-medium
                    hover:bg-red-100
                    dark:hover:bg-red-950/50
                    transition-all
                    duration-200
                  "
                >
                  Remove Photo
                </button>
              )}
            </div>

            {/* Right - Profile Information */}
            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">
                {isEditing ? (
                  <motion.div
                    key="edit"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.35 }}
                    className="grid grid-cols-2 gap-6"
                  >
                    {/* Full Name */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Full Name
                      </label>

                      <input
                        name="fullName"
                        value={profile.fullName}
                        onChange={handleChange}
                        className="
                          w-full
                          mt-2
                          border
                          border-gray-200
                          dark:border-gray-700
                          rounded-xl
                          px-4
                          py-3
                          bg-white
                          dark:bg-[#151515]
                          text-gray-900
                          dark:text-white
                          outline-none
                          focus:ring-2
                          focus:ring-violet-500/30
                          focus:border-violet-500
                        "
                      />
                    </div>

                    {/* Username */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Username
                      </label>

                      <input
                        name="username"
                        value={profile.username}
                        onChange={handleChange}
                        className="
                          w-full
                          mt-2
                          border
                          border-gray-200
                          dark:border-gray-700
                          rounded-xl
                          px-4
                          py-3
                          bg-white
                          dark:bg-[#151515]
                          text-gray-900
                          dark:text-white
                          outline-none
                          focus:ring-2
                          focus:ring-violet-500/30
                          focus:border-violet-500
                        "
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Email
                      </label>

                      <input
                        name="email"
                        type="email"
                        value={profile.email}
                        onChange={handleChange}
                        className="
                          w-full
                          mt-2
                          border
                          border-gray-200
                          dark:border-gray-700
                          rounded-xl
                          px-4
                          py-3
                          bg-white
                          dark:bg-[#151515]
                          text-gray-900
                          dark:text-white
                          outline-none
                          focus:ring-2
                          focus:ring-violet-500/30
                          focus:border-violet-500
                        "
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Phone
                      </label>

                      <input
                        name="phone"
                        value={profile.phone}
                        onChange={handleChange}
                        className="
                          w-full
                          mt-2
                          border
                          border-gray-200
                          dark:border-gray-700
                          rounded-xl
                          px-4
                          py-3
                          bg-white
                          dark:bg-[#151515]
                          text-gray-900
                          dark:text-white
                          outline-none
                          focus:ring-2
                          focus:ring-violet-500/30
                          focus:border-violet-500
                        "
                      />
                    </div>

                    {/* Country */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Country
                      </label>

                      <input
                        name="country"
                        value={profile.country}
                        onChange={handleChange}
                        className="
                          w-full
                          mt-2
                          border
                          border-gray-200
                          dark:border-gray-700
                          rounded-xl
                          px-4
                          py-3
                          bg-white
                          dark:bg-[#151515]
                          text-gray-900
                          dark:text-white
                          outline-none
                          focus:ring-2
                          focus:ring-violet-500/30
                          focus:border-violet-500
                        "
                      />
                    </div>

                    {/* Timezone */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Timezone
                      </label>

                      <input
                        name="timezone"
                        value={profile.timezone}
                        onChange={handleChange}
                        className="
                          w-full
                          mt-2
                          border
                          border-gray-200
                          dark:border-gray-700
                          rounded-xl
                          px-4
                          py-3
                          bg-white
                          dark:bg-[#151515]
                          text-gray-900
                          dark:text-white
                          outline-none
                          focus:ring-2
                          focus:ring-violet-500/30
                          focus:border-violet-500
                        "
                      />
                    </div>

                    {/* Language */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Language
                      </label>

                      <select
                        name="language"
                        value={profile.language}
                        onChange={handleChange}
                        className="
                          w-full
                          mt-2
                          border
                          border-gray-200
                          dark:border-gray-700
                          rounded-xl
                          px-4
                          py-3
                          bg-white
                          dark:bg-[#151515]
                          text-gray-900
                          dark:text-white
                          outline-none
                          focus:ring-2
                          focus:ring-violet-500/30
                          focus:border-violet-500
                        "
                      >
                        <option>English</option>
                        <option>Hindi</option>
                      </select>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="view"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.35 }}
                    className="grid grid-cols-2 gap-x-8 gap-y-7"
                  >
                    <ProfileField
                      label="Full Name"
                      value={profile.fullName}
                    />

                    <ProfileField
                      label="Username"
                      value={profile.username}
                    />

                    <ProfileField
                      label="Email"
                      value={profile.email}
                    />

                    <ProfileField
                      label="Phone"
                      value={profile.phone}
                    />

                    <ProfileField
                      label="Country"
                      value={profile.country}
                    />

                    <ProfileField
                      label="Timezone"
                      value={profile.timezone}
                    />

                    <ProfileField
                      label="Language"
                      value={profile.language}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Login / Security Section */}
        <div className="mt-6 bg-white dark:bg-[#111111] border border-gray-200 dark:border-gray-800 rounded-3xl p-8 transition-colors">
          <div className="flex items-start justify-between gap-6">
            <div className="flex gap-4">
              <div
                className="
                  w-12
                  h-12
                  rounded-2xl
                  bg-violet-100
                  dark:bg-violet-950/50
                  text-violet-600
                  dark:text-violet-400
                  flex
                  items-center
                  justify-center
                  shrink-0
                "
              >
                <ShieldCheck size={24} />
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Account Security
                </h3>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Manage your current login session.
                </p>
              </div>
            </div>

            {isLoggedIn ? (
              <div
                className="
                  flex
                  items-center
                  gap-2
                  px-3
                  py-2
                  rounded-full
                  bg-green-50
                  dark:bg-green-950/30
                  text-green-600
                  dark:text-green-400
                  text-sm
                  font-medium
                "
              >
                <CheckCircle2 size={16} />
                Logged In
              </div>
            ) : (
              <div
                className="
                  flex
                  items-center
                  gap-2
                  px-3
                  py-2
                  rounded-full
                  bg-gray-100
                  dark:bg-gray-800
                  text-gray-600
                  dark:text-gray-300
                  text-sm
                  font-medium
                "
              >
                <AlertTriangle size={16} />
                Logged Out
              </div>
            )}
          </div>

          <div className="mt-7 border-t border-gray-100 dark:border-gray-800 pt-6">
            {isLoggedIn ? (
              <div className="flex items-center justify-between gap-5">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Current session
                  </p>

                  <p className="mt-1 font-medium text-gray-900 dark:text-white">
                    You are currently logged in to your EdgeFlo account.
                  </p>

                  {profile.email && (
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {profile.email}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowLogoutModal(true)}
                  className="
                    flex
                    items-center
                    gap-2
                    px-5
                    py-2.5
                    rounded-xl
                    border
                    border-red-200
                    dark:border-red-900
                    text-red-600
                    dark:text-red-400
                    bg-red-50
                    dark:bg-red-950/20
                    hover:bg-red-100
                    dark:hover:bg-red-950/40
                    transition-all
                    duration-200
                  "
                >
                  <LogOut size={18} />
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-5">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Current session
                  </p>

                  <p className="mt-1 font-medium text-gray-900 dark:text-white">
                    You are currently logged out.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleLogin}
                  className="
                    flex
                    items-center
                    gap-2
                    px-5
                    py-2.5
                    rounded-xl
                    bg-violet-600
                    hover:bg-violet-700
                    text-white
                    transition-all
                    duration-200
                    hover:scale-105
                  "
                >
                  <LogIn size={18} />
                  Login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutModal && (
          <motion.div
            className="
              fixed
              inset-0
              z-50
              flex
              items-center
              justify-center
              px-4
              bg-black/50
              backdrop-blur-sm
            "
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="
                w-full
                max-w-md
                bg-white
                dark:bg-[#111111]
                border
                border-gray-200
                dark:border-gray-800
                rounded-3xl
                p-7
                shadow-2xl
              "
            >
              <div
                className="
                  w-12
                  h-12
                  rounded-2xl
                  bg-red-100
                  dark:bg-red-950/40
                  text-red-600
                  dark:text-red-400
                  flex
                  items-center
                  justify-center
                  mb-5
                "
              >
                <LogOut size={24} />
              </div>

              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Logout from EdgeFlo?
              </h3>

              <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                Are you sure you want to logout from your current session?
              </p>

              <div className="flex justify-end gap-3 mt-7">
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(false)}
                  className="
                    px-5
                    py-2.5
                    rounded-xl
                    border
                    border-gray-200
                    dark:border-gray-700
                    text-gray-700
                    dark:text-gray-200
                    hover:bg-gray-100
                    dark:hover:bg-gray-800
                    transition-colors
                  "
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="
                    px-5
                    py-2.5
                    rounded-xl
                    bg-red-600
                    hover:bg-red-700
                    text-white
                    transition-colors
                  "
                >
                  Logout
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* Profile Field Component */

function ProfileField({ label, value }) {
  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {label}
      </p>

      <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white break-words">
        {value || "Not Set"}
      </h3>
    </div>
  );
}