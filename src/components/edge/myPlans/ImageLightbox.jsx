import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ImageLightbox({

  image,

  open,

  onClose,

}) {

  if (!open) return null;

  return (

    <AnimatePresence>

      <motion.div

        initial={{ opacity: 0 }}

        animate={{ opacity: 1 }}

        exit={{ opacity: 0 }}

        onClick={onClose}

        className="

          fixed

          inset-0

          bg-black/80

          backdrop-blur-md

          z-[999]

          flex

          items-center

          justify-center

          p-10

        "

      >

        <button

          onClick={onClose}

          className="

            absolute

            top-6

            right-6

            w-12

            h-12

            rounded-full

            bg-white/10

            hover:bg-white/20

            text-white

            flex

            items-center

            justify-center

          "

        >

          <X size={24} />

        </button>

        <motion.img

          initial={{ scale: .9 }}

          animate={{ scale: 1 }}

          exit={{ scale: .9 }}

          transition={{ duration: .25 }}

          onClick={(e)=>e.stopPropagation()}

          src={image}

          className="

            max-h-[90vh]

            max-w-[90vw]

            rounded-3xl

            shadow-2xl

          "

        />

      </motion.div>

    </AnimatePresence>

  );

}