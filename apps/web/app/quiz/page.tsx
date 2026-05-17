import { Nav } from "@/components/Nav";
import { QuizFlow } from "@/components/QuizFlow";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string }>;
}) {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sp = await searchParams;

  if (!user) redirect("/sign-in?next=" + encodeURIComponent("/quiz"));

  const nextRoute = sp.after ?? "/";

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-16">
        <QuizFlow nextRoute={nextRoute} />
      </main>
    </>
  );
}
