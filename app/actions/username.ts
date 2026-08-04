"use server";

import { createClient } from "@/lib/supabase/server";
import { normalizeUsername, isValidUsername } from "@/lib/username";

export type ClaimUsernameResult =
  { ok: true } | { ok: false; error: "invalid" | "taken" | "unauthenticated" };

export async function claimUsername(raw: string): Promise<ClaimUsernameResult> {
  const username = normalizeUsername(raw);

  if (!isValidUsername(username)) {
    return { ok: false, error: "invalid" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "unauthenticated" };
  }

  const { error: insertError } = await supabase
    .from("profiles")
    .insert({ id: user.id, username });

  if (insertError) {
    if (insertError.code === "23505") {
      return { ok: false, error: "taken" };
    }
    throw insertError;
  }

  const { error: updateError } = await supabase.auth.updateUser({
    data: { display_name: username },
  });

  if (updateError) throw updateError;

  return { ok: true };
}
