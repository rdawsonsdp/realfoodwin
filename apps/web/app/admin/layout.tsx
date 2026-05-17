import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?next=" + encodeURIComponent("/admin"));
  if (!isAdminRequest(user.email)) {
    redirect("/?error=admin_only");
  }

  return (
    <>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <header className="mb-6">
          <p className="badge-tuned mb-3 inline-flex">Admin · demo only</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-paper">Real Food Win — Control Room</h1>
        </header>
        {/* -mx negative margin lets the tab strip bleed to the edge on phones
            so the underline border feels intentional rather than truncated. */}
        <nav className="flex gap-1 border-b border-white/10 mb-6 md:mb-8 overflow-x-auto scroll-row -mx-4 md:mx-0 px-4 md:px-0">
          <AdminTab href="/admin" label="Overview" />
          <AdminTab href="/admin/personas" label="Personas" />
          <AdminTab href="/admin/brands" label="Brands" />
          <AdminTab href="/admin/intelligence" label="AI reasoning" />
          <AdminTab href="/admin/satisfaction" label="Satisfaction" />
          <AdminTab href="/admin/activity" label="Activity" />
          <AdminTab href="/admin/llm" label="LLM spend" />
          <AdminTab href="/admin/models" label="Models" />
        </nav>
        {children}
      </main>
    </>
  );
}

function AdminTab({ href, label }: { href: string; label: string }) {
  // We can't easily detect "current" without `usePathname` in a client component.
  // For the prototype, just style all links the same way.
  return (
    <Link
      href={href}
      className="flex-shrink-0 px-4 py-3 min-h-[44px] text-sm font-semibold text-paper/70 hover:text-paper hover:bg-white/10 rounded-t-soft transition-colors whitespace-nowrap"
    >
      {label}
    </Link>
  );
}
