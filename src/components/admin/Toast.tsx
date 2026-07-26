"use client";

import { useEffect } from "react";

interface Props {
  message: string;
  type?: "error" | "success";
  onClose: () => void;
}

export default function Toast({ message, type = "error", onClose }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div
        className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-[14px] font-[family-name:var(--font-body-md)] ${
          type === "error"
            ? "bg-red-600 text-white"
            : "bg-green-600 text-white"
        }`}
      >
        <span className="material-symbols-outlined text-[18px]">
          {type === "error" ? "error" : "check_circle"}
        </span>
        {message}
        <button onClick={onClose} className="ml-2 cursor-pointer opacity-70 hover:opacity-100">
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </div>
  );
}
