"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import type { AdminBrand, AdminBrandProduct } from "@/app/admin/brands/page";

interface Props {
  initial: AdminBrand[];
}

const EMPTY_BRAND: Omit<AdminBrand, "id" | "brand_products"> & { id?: string } = {
  name: "",
  category: "",
  description: "",
  website_url: "",
  logo_url: "",
  certifications: [],
};

export function BrandsAdmin({ initial }: Props) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setCreating(true)} className="btn-primary">
          + Add brand
        </button>
      </div>

      {creating && (
        <BrandFormCard
          brand={null}
          onDone={() => {
            setCreating(false);
            router.refresh();
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      <ul className="space-y-3">
        {initial.map((b) => (
          <li key={b.id}>
            <BrandRow
              brand={b}
              expanded={openId === b.id}
              onToggle={() => setOpenId((id) => (id === b.id ? null : b.id))}
            />
          </li>
        ))}
        {initial.length === 0 && !creating && (
          <li className="card p-6 text-center text-ink-soft">
            No brands yet. Click "+ Add brand" to create the first one.
          </li>
        )}
      </ul>
    </div>
  );
}

function BrandRow({
  brand,
  expanded,
  onToggle,
}: {
  brand: AdminBrand;
  expanded: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  async function remove() {
    if (!window.confirm(`Delete "${brand.name}" and its ${brand.brand_products.length} curated products?`)) return;
    try {
      await apiPost("/api/admin/brands", {
        kind: "brand_delete",
        payload: { id: brand.id },
      });
      router.refresh();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }

  return (
    <div className="card">
      <div className="p-4 flex items-center gap-4">
        <button onClick={onToggle} className="flex-1 flex items-center gap-4 text-left">
          {brand.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logo_url}
              alt={`${brand.name} logo`}
              className="w-12 h-12 object-contain rounded-soft bg-paper p-1 ring-1 ring-ink/10"
              loading="lazy"
            />
          ) : (
            <div className="w-12 h-12 rounded-soft bg-cream grid place-items-center text-lg ring-1 ring-ink/10">
              🥗
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-ink truncate">{brand.name}</h3>
            <p className="text-xs text-ink-muted truncate">
              {brand.brand_products.length} product{brand.brand_products.length === 1 ? "" : "s"}
              {brand.website_url && ` · ${stripScheme(brand.website_url)}`}
            </p>
          </div>
          <span aria-hidden className="text-ink-muted">{expanded ? "▴" : "▾"}</span>
        </button>
        <div className="flex items-center gap-1">
          <button onClick={() => setEditing(true)} className="btn-ghost text-xs">
            Edit
          </button>
          <button onClick={remove} className="btn-ghost text-xs text-coral">
            Delete
          </button>
        </div>
      </div>

      {editing && (
        <div className="px-4 pb-4">
          <BrandFormCard
            brand={brand}
            onDone={() => {
              setEditing(false);
              router.refresh();
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}

      {expanded && !editing && (
        <div className="border-t border-ink/5 p-4 space-y-3">
          <ProductsAdmin
            brandId={brand.id}
            brandName={brand.name}
            products={brand.brand_products}
          />
        </div>
      )}
    </div>
  );
}

function BrandFormCard({
  brand,
  onDone,
  onCancel,
}: {
  brand: AdminBrand | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<typeof EMPTY_BRAND>({
    id: brand?.id,
    name: brand?.name ?? "",
    category: brand?.category ?? "",
    description: brand?.description ?? "",
    website_url: brand?.website_url ?? "",
    logo_url: brand?.logo_url ?? "",
    certifications: brand?.certifications ?? [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiPost("/api/admin/brands", {
        kind: "brand_upsert",
        payload: {
          ...form,
          name: form.name.trim(),
          category: form.category?.trim() || null,
          description: form.description?.trim() || null,
          website_url: form.website_url?.trim() || null,
          logo_url: form.logo_url?.trim() || null,
          certifications: form.certifications?.filter((c) => c.trim()) ?? null,
        },
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-4 space-y-3 ring-2 ring-coral/40 bg-paper">
      <h4 className="font-bold text-ink">{brand ? `Edit ${brand.name}` : "Add a brand"}</h4>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Name (required)">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="input"
          />
        </Field>
        <Field label="Category">
          <input
            value={form.category ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className="input"
            placeholder="e.g. snacks, dairy"
          />
        </Field>
        <Field label="Website URL">
          <input
            type="url"
            value={form.website_url ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))}
            className="input"
            placeholder="https://…"
          />
        </Field>
        <Field label="Logo URL">
          <input
            type="url"
            value={form.logo_url ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
            className="input"
            placeholder="https://…"
          />
        </Field>
      </div>
      <Field label="Description">
        <textarea
          value={form.description ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={3}
          className="input resize-none"
        />
      </Field>
      <Field label="Certifications (comma-separated)">
        <input
          value={(form.certifications ?? []).join(", ")}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              certifications: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            }))
          }
          className="input"
          placeholder="e.g. USDA Organic, Non-GMO"
        />
      </Field>
      {error && <p className="text-sm text-coral">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} disabled={saving} className="btn-ghost">
          Cancel
        </button>
        <button onClick={save} disabled={saving || !form.name.trim()} className="btn-primary">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function ProductsAdmin({
  brandId,
  brandName,
  products,
}: {
  brandId: string;
  brandName: string;
  products: AdminBrandProduct[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function remove(id: string, name: string) {
    if (!window.confirm(`Remove "${name}" from ${brandName}?`)) return;
    try {
      await apiPost("/api/admin/brands", {
        kind: "product_delete",
        payload: { id },
      });
      router.refresh();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-ink">Products we like</h4>
        <button onClick={() => setAdding(true)} className="btn-secondary py-1.5 text-xs">
          + Add product
        </button>
      </div>
      {adding && (
        <ProductForm
          brandId={brandId}
          product={null}
          onDone={() => {
            setAdding(false);
            router.refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      )}
      {products.length === 0 && !adding ? (
        <p className="text-sm text-ink-muted italic">No products yet.</p>
      ) : (
        <ul className="space-y-2">
          {products
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((p) =>
              editingId === p.id ? (
                <li key={p.id}>
                  <ProductForm
                    brandId={brandId}
                    product={p}
                    onDone={() => {
                      setEditingId(null);
                      router.refresh();
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              ) : (
                <li
                  key={p.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-soft bg-paper ring-1 ring-ink/5"
                >
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="w-10 h-10 object-contain rounded-soft bg-cream"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-soft bg-cream grid place-items-center text-sm">
                      🥗
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{p.name}</p>
                    {p.product_url && (
                      <p className="text-xs text-ink-muted truncate">{stripScheme(p.product_url)}</p>
                    )}
                  </div>
                  <button onClick={() => setEditingId(p.id)} className="btn-ghost text-xs">
                    Edit
                  </button>
                  <button onClick={() => remove(p.id, p.name)} className="btn-ghost text-xs text-coral">
                    ✕
                  </button>
                </li>
              ),
            )}
        </ul>
      )}
    </div>
  );
}

function ProductForm({
  brandId,
  product,
  onDone,
  onCancel,
}: {
  brandId: string;
  product: AdminBrandProduct | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    id: product?.id,
    brand_id: brandId,
    name: product?.name ?? "",
    description: product?.description ?? "",
    product_url: product?.product_url ?? "",
    image_url: product?.image_url ?? "",
    tags: product?.tags ?? [],
    sort_order: product?.sort_order ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiPost("/api/admin/brands", {
        kind: "product_upsert",
        payload: {
          ...form,
          name: form.name.trim(),
          description: form.description?.trim() || null,
          product_url: form.product_url?.trim() || null,
          image_url: form.image_url?.trim() || null,
          tags: form.tags?.filter((t) => t.trim()) ?? null,
        },
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-3 space-y-2 ring-2 ring-coral/40 bg-paper">
      <Field label="Product name (required)">
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="input"
        />
      </Field>
      <div className="grid sm:grid-cols-2 gap-2">
        <Field label="Product URL">
          <input
            type="url"
            value={form.product_url ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, product_url: e.target.value }))}
            className="input"
            placeholder="https://…"
          />
        </Field>
        <Field label="Image URL">
          <input
            type="url"
            value={form.image_url ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
            className="input"
            placeholder="https://…"
          />
        </Field>
      </div>
      <Field label="Description">
        <textarea
          value={form.description ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={2}
          className="input resize-none"
        />
      </Field>
      <Field label="Sort order">
        <input
          type="number"
          value={form.sort_order}
          onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
          className="input"
        />
      </Field>
      {error && <p className="text-sm text-coral">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} disabled={saving} className="btn-ghost text-sm">
          Cancel
        </button>
        <button onClick={save} disabled={saving || !form.name.trim()} className="btn-primary">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
