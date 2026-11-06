"use client";

import { useEffect, useState } from "react";

import type { UseCaseId } from "./usecases";

export type Role = "company" | "researcher";

export type Profile = {
  name: string;
  email: string;
  role: Role;
  /** What this workspace settles; drives the app's nouns and guidance. */
  useCase?: UseCaseId;
  createdAt: string;
};

const KEY = "clearaudit.profile.v1";
const EVENT = "clearaudit:profile";

export function readProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Profile;
    if (!p?.name || (p.role !== "company" && p.role !== "researcher")) return null;
    return p;
  } catch {
    return null;
  }
}

export function saveProfile(profile: Profile) {
  window.localStorage.setItem(KEY, JSON.stringify(profile));
  window.dispatchEvent(new Event(EVENT));
}

export function clearProfile() {
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Local workspace profile. There is no account server in this MVP: the wallet is
 * the identity and this record is the display layer. It is never sent to the API.
 */
export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => setProfile(readProfile());
    sync();
    setHydrated(true);
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return { profile, hydrated, save: saveProfile, clear: clearProfile };
}

export const ROLE_LABEL: Record<Role, string> = {
  company: "Company",
  researcher: "Researcher",
};
