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
      <main className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-6">
          <p className="badge-tuned mb-3 inline-flex">Admin · demo only</p>
          <h1 className="text-3xl font-bold tracking-tight text-paper">Real Food Win — Control Room</h1>
        </header>
        <nav className="flex gap-1 border-b border-white/10 mb-8 overflow-x-auto">
          <AdminTab href="/admin" label="Overview" />
          <AdminTab href="/admin/personas" label="Personas" />
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
      className="px-4 py-2.5 text-sm font-semibold text-paper/70 hover:text-paper hover:bg-white/10 rounded-t-soft transition-colors"
    >
      {label}
    </Link>
  );
}
