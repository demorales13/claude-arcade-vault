import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChooseUsernameForm } from "@/components/choose-username-form";

export default async function ChooseUsernamePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <ChooseUsernameForm />;
}
