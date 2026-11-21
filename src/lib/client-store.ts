"use client";
import { create } from "zustand";
type Toast = { id: number; message: string; kind: "success" | "error" };
export const useUI = create<{
  toasts: Toast[];
  toast: (message: string, kind?: Toast["kind"]) => void;
  removeToast: (id: number) => void;
  revision: number;
  refresh: () => void;
}>((set, get) => ({
  toasts: [],
  revision: 0,
  toast(message, kind = "success") {
    const id = Date.now() + Math.random();
    set((state) => ({
      toasts: [...state.toasts.slice(-2), { id, message, kind }],
    }));
    setTimeout(() => get().removeToast(id), 5500);
  },
  removeToast(id) {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },
  refresh() {
    set((state) => ({ revision: state.revision + 1 }));
  },
}));
