import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function Nav() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-paper/80 border-b border-ink/5">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-soft bg-sunrise grid place-items-center text-white font-bold shadow-warm transition-transform group-hover:scale-105">
            ◯
          </div>
          <span className="font-bold text-lg tracking-tight">Real Food Win</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link href="/recipes" className="btn-ghost">Recipes</Link>
          <Link href="/brands" className="btn-ghost">Brands</Link>
          {user ? (
            <>
              <Link href="/kitchen" className="btn-ghost">My Kitchen</Link>
              <Link href="/settings" className="btn-ghost">Account</Link>
            </>
          ) : (
            <Link href="/sign-in" className="btn-secondary ml-2 py-2">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
