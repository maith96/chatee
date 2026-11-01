// Reading personas. Row Level Security decides what each user can see:
// public + unlisted personas, built-ins, and their own.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonaDefinition, Visibility } from "./persona-schema";

export type Persona = {
  id: string;
  slug: string | null;
  owner_id: string | null;
  name: string;
  tagline: string | null;
  avatar_emoji: string | null;
  avatar_url: string | null;
  visibility: Visibility;
  is_romantic: boolean;
  definition: PersonaDefinition;
  created_at: string;
  updated_at: string;
};

const FIELDS =
  "id, slug, owner_id, name, tagline, avatar_emoji, avatar_url, visibility, is_romantic, definition, created_at, updated_at";

/** Public summary (no full character sheet), for lists and pickers. */
export function summarize(p: Persona, userId: string) {
  return {
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    avatar_emoji: p.avatar_emoji,
    avatar_url: p.avatar_url,
    visibility: p.visibility,
    is_romantic: p.is_romantic,
    is_builtin: p.owner_id === null,
    is_mine: p.owner_id === userId,
    bio: p.definition?.identity?.bio ?? null,
    role: p.definition?.relationship?.role ?? null,
  };
}

/** Built-in and public personas, plus the user's own (private/unlisted included). Unlisted ones from others are hidden. */
export async function listPersonas(db: SupabaseClient, userId: string) {
  const { data, error } = await db
    .from("personas")
    .select(FIELDS)
    .or(`visibility.eq.public,owner_id.eq.${userId}`)
    .order("owner_id", { ascending: true, nullsFirst: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data as Persona[];
}

export async function getPersona(db: SupabaseClient, id: string) {
  const { data, error } = await db.from("personas").select(FIELDS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Persona | null;
}
