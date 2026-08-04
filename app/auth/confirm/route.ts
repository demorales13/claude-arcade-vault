import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (token_hash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    });

    if (!error) {
      if (type === "recovery") {
        return NextResponse.redirect(new URL("/update-password", origin));
      }

      const displayName = data.user?.user_metadata?.display_name;
      const destination =
        typeof displayName === "string" && displayName
          ? "/"
          : "/choose-username";
      return NextResponse.redirect(new URL(destination, origin));
    }
  }

  return NextResponse.redirect(new URL("/login", origin));
}
