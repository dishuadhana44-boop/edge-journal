import { Camera } from "lucide-react";
import { useRef, useState } from "react";
import { Pencil, X, Save } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";


export default function AccountPage() {

  const [isEditing, setIsEditing] = useState(false);

  const [profile, setProfile] = useState(() => {
    return (
      JSON.parse(
        localStorage.getItem("userProfile")
      ) || {
        fullName: "",
        username: "",
        email: "",
        phone: "",
        country: "",
        timezone: "",
        language: "English",
      }
    );
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

    const file = e.target.files[0];
  
    if (!file) return;
  
    const reader = new FileReader();
  
    reader.onload = () => {
  
      setProfileImage(reader.result);
  
      localStorage.setItem(
        "profileImage",
        reader.result
      );
  
    };
  
    reader.readAsDataURL(file);
  
  };

  return (

    <div className="w-full max-w-6xl mx-auto px-6">

      <div className="bg-white border border-gray-200 rounded-3xl p-8">

      <div className="flex items-center justify-between mb-8">

<div>

  <h2 className="text-2xl font-bold">
    Account
  </h2>

 

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

      onClick={() => setIsEditing(false)}

      className="
      px-5
      py-2.5
      rounded-xl
      border
      hover:bg-gray-100
      flex
      items-center
      gap-2
      "

    >

      <X size={18} />

      Cancel

    </button>

    <button
onClick={() => {

  localStorage.setItem(
    "userProfile",
    JSON.stringify(profile)
  );

  setIsEditing(false);

}}

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

        <div className="flex gap-10">

          {/* Left */}

          <div className="w-56 flex flex-col items-center">

          <div

className="relative"

onDragOver={(e) => e.preventDefault()}

onDrop={(e) => {

e.preventDefault();

const file = e.dataTransfer.files[0];

if (!file) return;

const reader = new FileReader();

reader.onload = () => {

setProfileImage(reader.result);

localStorage.setItem(

"profileImage",

reader.result

);

};

reader.readAsDataURL(file);

}}

>

            <img

src={
  profileImage ||
  "https://ui-avatars.com/api/?name=User&background=8b5cf6&color=fff&size=200"
}

alt="Profile"

className="

w-36
h-36
rounded-full
object-cover
border-4
border-violet-100

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

onClick={() => fileInputRef.current.click()}

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
"

>

<Camera size={18} />

</button>

            </div>

            <button
              className="
              mt-5
              text-violet-600
              text-sm
              font-medium
              hover:underline
              "
            >
              Change Photo
            </button>

            {profileImage && (
  <button
    onClick={() => {
      setProfileImage("");
      localStorage.removeItem("profileImage");
    }}
    className="
      mt-3
      px-4
      py-2
      rounded-xl
      border
      border-red-200
      bg-red-50
      text-red-600
      text-sm
      font-medium
      hover:bg-red-100
      hover:border-red-300
      transition-all
      duration-200
    "
  >
    Remove Photo
  </button>
)}

          </div>
          
                <AnimatePresence mode="wait">
          {/* Right */}

          {isEditing ? (

<motion.div
key="edit"
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -20 }}
transition={{ duration: .35 }}
className="flex-1 grid grid-cols-2 gap-6"
>

            <div>
              <label className="text-sm font-medium">
                Full Name
              </label>

              <input
                name="fullName"
                value={profile.fullName}
                onChange={handleChange}
                className="w-full mt-2 border rounded-xl px-4 py-3"
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                Username
              </label>

              <input
                name="username"
                value={profile.username}
                onChange={handleChange}
                className="w-full mt-2 border rounded-xl px-4 py-3"
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                Email
              </label>

              <input
                name="email"
                value={profile.email}
                onChange={handleChange}
                className="w-full mt-2 border rounded-xl px-4 py-3"
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                Phone
              </label>

              <input
                name="phone"
                value={profile.phone}
                onChange={handleChange}
                className="w-full mt-2 border rounded-xl px-4 py-3"
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                Country
              </label>

              <input
                name="country"
                value={profile.country}
                onChange={handleChange}
                className="w-full mt-2 border rounded-xl px-4 py-3"
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                Timezone
              </label>

              <input
                name="timezone"
                value={profile.timezone}
                onChange={handleChange}
                className="w-full mt-2 border rounded-xl px-4 py-3"
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                Language
              </label>

              <select
                name="language"
                value={profile.language}
                onChange={handleChange}
                className="w-full mt-2 border rounded-xl px-4 py-3"
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
transition={{ duration: .35 }}
className="flex-1"
>

<div className="space-y-6">

<div>

<p className="text-sm text-gray-500">

Full Name

</p>

<h3 className="text-lg font-semibold">

{profile.fullName || "Not Set"}

</h3>

</div>

<div>

<p className="text-sm text-gray-500">

Username

</p>

<h3 className="text-lg font-semibold">

{profile.username || "Not Set"}

</h3>

</div>

<div>

<p className="text-sm text-gray-500">

Email

</p>

<h3 className="text-lg font-semibold">

{profile.email || "Not Set"}

</h3>

</div>

<div>

<p className="text-sm text-gray-500">

Phone

</p>

<h3 className="text-lg font-semibold">

{profile.phone || "Not Set"}

</h3>

</div>

<div>

<p className="text-sm text-gray-500">

Country

</p>

<h3 className="text-lg font-semibold">

{profile.country || "Not Set"}

</h3>

</div>

<div>

<p className="text-sm text-gray-500">

Timezone

</p>

<h3 className="text-lg font-semibold">

{profile.timezone || "Not Set"}

</h3>

</div>

<div>

<p className="text-sm text-gray-500">

Language

</p>

<h3 className="text-lg font-semibold">

{profile.language}

</h3>

</div>

</div>

</motion.div>

)}
</AnimatePresence>
          </div>

        </div>

        

      </div>

    

  );

}