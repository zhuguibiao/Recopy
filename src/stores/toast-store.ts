import { create } from "zustand";

interface ToastState {
  message: string;
  visible: boolean;
  show: (message: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: "",
  visible: false,
  show: (message: string) => {
    set({ message, visible: true });
    setTimeout(() => set({ visible: false }), 1500);
  },
}));
