import React, { useState } from "react";

import {
  User,
  Mail,
  MapPin,
  Globe,
  Calendar,
  Pencil,
  Save,
  X,
  TrendingUp,
  Target,
  BarChart3,
  Award,
  ShieldCheck,
  Clock,
  BriefcaseBusiness,
  Camera,
  CheckCircle2,
} from "lucide-react";

import PageHeader from "../components/common/PageHeader";

function Profile() {
  const [isEditing, setIsEditing] = useState(false);

  const [profile, setProfile] = useState({
    fullName: "Trader",
    username: "@trader",
    email: "trader@example.com",
    country: "India",
    timezone: "Asia/Kolkata",
    experience: "Intermediate",
    tradingStyle: "Day Trading",
    primaryMarket: "Forex",
    joinedDate: "September 2026",
  });

  const [draftProfile, setDraftProfile] = useState(profile);

  const handleChange = (field, value) => {
    setDraftProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEdit = () => {
    setDraftProfile(profile);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraftProfile(profile);
    setIsEditing(false);
  };

  const handleSave = () => {
    setProfile(draftProfile);
    setIsEditing(false);
  };

  const initials = profile.fullName
    .split(" ")
    .map((name) => name[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const stats = [
    {
      label: "Total Trades",
      value: "0",
      icon: BarChart3,
      iconColor: "text-violet-600",
      bgColor: "bg-violet-50",
    },
    {
      label: "Win Rate",
      value: "0%",
      icon: Target,
      iconColor: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "Total P&L",
      value: "$0.00",
      icon: TrendingUp,
      iconColor: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      label: "Trading Days",
      value: "0",
      icon: Calendar,
      iconColor: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  return (
    <div className="w-full pb-10">
      {/* PAGE HEADER */}

      <PageHeader
        title="Profile"
        subtitle="Manage your profile and account information."
        icon="profile"
      />

      <div className="mt-6 space-y-6">

        {/* =====================================================
            PROFILE HEADER
        ===================================================== */}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="p-6">

            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

              {/* LEFT PROFILE SECTION */}

              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">

                {/* AVATAR */}

                <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-3xl font-bold text-white shadow-lg">

                  {initials}

                  <button
                    type="button"
                    className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-xl border-2 border-white bg-violet-600 text-white shadow-md transition hover:bg-violet-700"
                  >
                    <Camera size={16} />
                  </button>

                </div>

                {/* PROFILE DETAILS */}

                <div className="flex flex-col">

                  <div className="flex flex-wrap items-center gap-3">

                    <h2 className="text-2xl font-bold text-slate-900">
                      {profile.fullName}
                    </h2>

                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">

                      <CheckCircle2 size={14} />

                      Active

                    </span>

                  </div>

                  <p className="mt-1 text-sm font-medium text-violet-600">
                    {profile.username}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-slate-500">

                    <span className="flex items-center gap-2">

                      <MapPin size={16} className="text-slate-400" />

                      {profile.country}

                    </span>

                    <span className="flex items-center gap-2">

                      <Calendar size={16} className="text-slate-400" />

                      Joined {profile.joinedDate}

                    </span>

                    <span className="flex items-center gap-2">

                      <TrendingUp size={16} className="text-slate-400" />

                      {profile.primaryMarket} Trader

                    </span>

                  </div>

                </div>

              </div>

              {/* ACTION BUTTONS */}

              <div className="flex shrink-0 items-center gap-3">

                {!isEditing ? (

                  <button
                    onClick={handleEdit}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98]"
                  >

                    <Pencil size={17} />

                    Edit Profile

                  </button>

                ) : (

                  <>

                    <button
                      onClick={handleCancel}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >

                      <X size={17} />

                      Cancel

                    </button>

                    <button
                      onClick={handleSave}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
                    >

                      <Save size={17} />

                      Save Changes

                    </button>

                  </>

                )}

              </div>

            </div>

          </div>

        </div>


        {/* =====================================================
            STATISTICS
        ===================================================== */}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          {stats.map((stat) => {

            const Icon = stat.icon;

            return (

              <div
                key={stat.label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >

                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bgColor} ${stat.iconColor}`}
                >

                  <Icon size={20} />

                </div>

                <p className="mt-5 text-2xl font-bold text-slate-900">
                  {stat.value}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {stat.label}
                </p>

              </div>

            );

          })}

        </div>


        {/* =====================================================
            MAIN CONTENT
        ===================================================== */}

        <div className="grid gap-6 xl:grid-cols-2">


          {/* PERSONAL INFORMATION */}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">

                <User size={21} />

              </div>

              <div>

                <h3 className="text-base font-semibold text-slate-900">
                  Personal Information
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Your basic profile details and preferences.
                </p>

              </div>

            </div>


            <div className="mt-7 space-y-6">

              <ProfileField
                label="Full Name"
                icon={User}
                value={
                  isEditing
                    ? draftProfile.fullName
                    : profile.fullName
                }
                editable={isEditing}
                onChange={(value) =>
                  handleChange("fullName", value)
                }
              />


              <ProfileField
                label="Username"
                icon={User}
                value={
                  isEditing
                    ? draftProfile.username
                    : profile.username
                }
                editable={isEditing}
                onChange={(value) =>
                  handleChange("username", value)
                }
              />


              <ProfileField
                label="Email Address"
                icon={Mail}
                value={
                  isEditing
                    ? draftProfile.email
                    : profile.email
                }
                editable={isEditing}
                onChange={(value) =>
                  handleChange("email", value)
                }
              />


              <ProfileField
                label="Country"
                icon={MapPin}
                value={
                  isEditing
                    ? draftProfile.country
                    : profile.country
                }
                editable={isEditing}
                onChange={(value) =>
                  handleChange("country", value)
                }
              />


              <ProfileField
                label="Timezone"
                icon={Globe}
                value={
                  isEditing
                    ? draftProfile.timezone
                    : profile.timezone
                }
                editable={isEditing}
                onChange={(value) =>
                  handleChange("timezone", value)
                }
              />

            </div>

          </div>


          {/* TRADING PROFILE */}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">

                <TrendingUp size={21} />

              </div>

              <div>

                <h3 className="text-base font-semibold text-slate-900">
                  Trading Profile
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Customize your trading preferences.
                </p>

              </div>

            </div>


            <div className="mt-7 space-y-6">

              <ProfileField
                label="Trading Experience"
                icon={Award}
                value={
                  isEditing
                    ? draftProfile.experience
                    : profile.experience
                }
                editable={isEditing}
                onChange={(value) =>
                  handleChange("experience", value)
                }
              />


              <ProfileField
                label="Trading Style"
                icon={Clock}
                value={
                  isEditing
                    ? draftProfile.tradingStyle
                    : profile.tradingStyle
                }
                editable={isEditing}
                onChange={(value) =>
                  handleChange("tradingStyle", value)
                }
              />


              <ProfileField
                label="Primary Market"
                icon={BriefcaseBusiness}
                value={
                  isEditing
                    ? draftProfile.primaryMarket
                    : profile.primaryMarket
                }
                editable={isEditing}
                onChange={(value) =>
                  handleChange("primaryMarket", value)
                }
              />

            </div>


            {/* ACCOUNT STATUS */}

            <div className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">

              <div className="flex items-start gap-4">

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">

                  <ShieldCheck size={21} />

                </div>

                <div>

                  <h4 className="text-sm font-semibold text-emerald-900">
                    EdgeFlo Account Active
                  </h4>

                  <p className="mt-1.5 text-sm leading-6 text-emerald-700">
                    Your account is ready to track trades, analyze
                    performance, and build your trading edge.
                  </p>

                </div>

              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}


/* ==========================================================
   PROFILE FIELD
========================================================== */

function ProfileField({
  label,
  icon: Icon,
  value,
  editable,
  onChange,
}) {

  return (

    <div>

      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>


      <div className="flex items-center gap-3">

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500">

          <Icon size={19} />

        </div>


        {editable ? (

          <input
            value={value}
            onChange={(event) =>
              onChange(event.target.value)
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
          />

        ) : (

          <p className="text-sm font-medium text-slate-700">
            {value}
          </p>

        )}

      </div>

    </div>

  );
}

export default Profile;