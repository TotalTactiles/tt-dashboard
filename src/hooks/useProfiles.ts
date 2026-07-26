import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProfileLite {
  id: string;
  full_name: string;
  initials: string | null;
  colour: string | null;
  role: string | null;
  active?: boolean;
}

const db = supabase as any;

let cache: ProfileLite[] | null = null;
const subs = new Set<(p: ProfileLite[]) => void>();

async function loadOnce() {
  if (cache) return cache;
  const { data } = await db
    .from("profiles")
    .select("id, full_name, initials, colour, role")
    .order("full_name", { ascending: true });
  cache = (data as ProfileLite[]) ?? [];
  subs.forEach((fn) => fn(cache!));
  return cache;
}

export function useProfiles(enabled: boolean = true) {
  const [profiles, setProfiles] = useState<ProfileLite[]>(cache ?? []);
  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    subs.add(setProfiles);
    loadOnce().then((p) => {
      if (mounted) setProfiles(p);
    });
    return () => {
      mounted = false;
      subs.delete(setProfiles);
    };
  }, [enabled]);
  return enabled ? profiles : [];
}
