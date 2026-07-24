import { createContext, useContext, useState, createElement, type ReactNode } from "react";

export type Role = "office" | "worker";

interface RoleCtx {
  role: Role;
  setRole: (r: Role) => void;
}

const Ctx = createContext<RoleCtx>({ role: "office", setRole: () => {} });

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("office");
  return createElement(Ctx.Provider, { value: { role, setRole } }, children);
}

export function useRole() {
  return useContext(Ctx);
}
