"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type ContactModalContextType = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const ContactModalContext = createContext<ContactModalContextType>({
  open: false,
  setOpen: () => {},
});

export function useContactModal() {
  return useContext(ContactModalContext);
}

export function ContactModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <ContactModalContext.Provider value={{ open, setOpen }}>
      {children}
    </ContactModalContext.Provider>
  );
}
