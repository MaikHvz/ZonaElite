"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PageCTA from "@/components/PageCTA";
import { useCart } from "@/context/CartContext";

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
  const { addItem } = useCart();
  const router = useRouter();

  const addToCart = (product: Product) => {
    const img = product.product_images?.sort((a, b) => a.position - b.position)[0];
    addItem({
      productId: product.id,
      name: product.name,
      price: Number(product.price),
      quantity: 1,
      image: img?.url || null,
    });
  };

  const buyNow = (product: Product) => {
    addToCart(product);
    router.push("/carrito");
  };

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
                <div
                  key={product.id}
                  className="flex flex-col rounded-2xl border border-on-surface/5 bg-surface-container-lowest overflow-hidden hover:border-primary/30 transition-colors group"
                >
                  <Link
                    href={`/productos/${product.id}`}
                    className="block h-[200px] bg-surface-container flex items-center justify-center overflow-hidden"
                  >
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
                  </Link>
                  <div className="p-5 flex flex-col flex-1">
                    <Link href={`/productos/${product.id}`}>
                      {product.category && (
                        <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-primary mb-1 block">
                          {product.category}
                        </span>
                      )}
                      <h3 className="font-[family-name:var(--font-headline-md)] text-[18px] text-on-surface uppercase mb-2">
                        {product.name}
                      </h3>
                    </Link>
                    {product.description && (
                      <p className="font-[family-name:var(--font-body-md)] text-[13px] leading-[20px] text-on-surface-variant mb-3">
                        {product.description.length > 80
                          ? product.description.slice(0, 80) + "..."
                          : product.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-[family-name:var(--font-headline-lg)] text-[24px] text-primary">
                        ${Number(product.price).toLocaleString("es-CL")}
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
                    {product.stock > 0 ? (
                      <div className="grid grid-cols-2 gap-2 mt-auto">
                        <button
                          onClick={() => addToCart(product)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-on-surface/15 text-on-surface text-[12px] font-[family-name:var(--font-headline-md)] uppercase tracking-wider hover:bg-on-surface/5 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">add_shopping_cart</span>
                          Agregar
                        </button>
                        <button
                          onClick={() => buyNow(product)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg btn-primary-gradient text-white text-[12px] font-[family-name:var(--font-headline-md)] uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">shopping_cart</span>
                          Comprar
                        </button>
                      </div>
                    ) : (
                      <p className="text-center font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-on-surface-variant/50 mt-auto pt-1">
                        Sin stock
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <PageCTA />
    </div>
  );
}
