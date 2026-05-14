import { Nav } from "@/components/Nav";
import { MagicLinkForm } from "@/components/MagicLinkForm";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sp = await searchParams;

  if (user) {
    redirect(sp.next ?? "/");
  }

  return (
    <>
      <Nav />
      <main className="max-w-md mx-auto px-6 py-16">
        <MagicLinkForm next={sp.next} />
      </main>
    </>
  );
}
