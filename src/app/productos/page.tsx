"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PageCTA from "@/components/PageCTA";

interface Product {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  price: number;
  stock: number;
  product_images: { url: string; position: number }[];
}

const CATEGORIES = ["Todos", "Indumentaria", "Accesorios", "Suplementos", "Otros"];

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState("Todos");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("products")
      .select("id, name, category, description, price, stock, product_images(url, position)")
      .eq("active", true)
      .order("name")
      .then(({ data }) => {
        setProducts((data as Product[]) || []);
        setLoading(false);
      });
  }, []);

  const filtered = filter === "Todos" ? products : products.filter((p) => p.category === filter);

  return (
    <div className="min-h-screen bg-background pt-28 pb-16 px-5">
      <div className="max-w-[1280px] mx-auto">
        <div className="text-center mb-12">
          <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] md:text-[48px] text-on-surface uppercase tracking-tighter mb-2">
            Tienda <span className="text-primary">ZonaElite</span>
          </h1>
          <p className="font-[family-name:var(--font-body-lg)] text-[18px] leading-[28px] text-on-surface-variant max-w-xl mx-auto">
            Equipamiento y accesorios para tu entrenamiento
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`font-[family-name:var(--font-label-sm)] text-[12px] uppercase tracking-wider px-5 py-2 rounded-full border transition-colors cursor-pointer ${
                filter === cat
                  ? "btn-primary-gradient text-white border-transparent"
                  : "border-on-surface/20 text-on-surface-variant hover:border-primary/50 hover:text-on-surface"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-on-surface/20 text-7xl mb-4 block">
              inventory_2
            </span>
            <p className="font-[family-name:var(--font-body-lg)] text-on-surface-variant">
              No hay productos disponibles{filter !== "Todos" ? ` en "${filter}"` : ""}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((product) => {
              const img = product.product_images?.sort((a, b) => a.position - b.position)[0];
              return (
                <article
                  key={product.id}
                  className="rounded-2xl border border-on-surface/5 bg-surface-container-lowest overflow-hidden hover:border-primary/30 transition-colors group"
                >
                  <div className="h-[200px] bg-surface-container flex items-center justify-center overflow-hidden">
                    {img ? (
                      <img
                        src={img.url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-on-surface/20 text-7xl">
                        package_2
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    {product.category && (
                      <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-primary mb-1 block">
                        {product.category}
                      </span>
                    )}
                    <h3 className="font-[family-name:var(--font-headline-md)] text-[18px] text-on-surface uppercase mb-2">
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="font-[family-name:var(--font-body-md)] text-[13px] leading-[20px] text-on-surface-variant mb-3">
                        {product.description.length > 80
                          ? product.description.slice(0, 80) + "..."
                          : product.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="font-[family-name:var(--font-headline-lg)] text-[24px] text-primary">
                        ${product.price.toLocaleString("es-CL")}
                      </span>
                      {product.stock > 0 ? (
                        <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-green-400">
                          Disponible
                        </span>
                      ) : (
                        <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-red-400">
                          Agotado
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <PageCTA />
    </div>
  );
}
