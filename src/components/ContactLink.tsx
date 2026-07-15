"use client";

import { useContactModal } from "./ContactModalContext";

type Props = {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
};

export default function ContactLink({ children, className, onClick }: Props) {
  const { setOpen } = useContactModal();

  return (
    <button
      onClick={() => {
        setOpen(true);
        onClick?.();
      }}
      className={className}
    >
      {children}
    </button>
  );
}
