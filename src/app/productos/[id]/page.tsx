"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/context/CartContext";

interface ProductImage {
  id: string;
  url: string;
  position: number;
}

interface Product {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  price: number;
  stock: number;
  active: boolean;
  created_at: string;
  product_images: ProductImage[];
}

export default function ProductoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const { addItem } = useCart();
  const router = useRouter();

  const addToCart = () => {
    if (!product) return;
    const img = product.product_images[0];
    addItem({
      productId: product.id,
      name: product.name,
      price: Number(product.price),
      quantity: 1,
      image: img?.url || null,
    });
  };

  const buyNow = () => {
    addToCart();
    router.push("/carrito");
  };

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("products")
      .select("*, product_images(id, url, position)")
      .eq("id", id)
      .eq("active", true)
      .single()
      .then(({ data, error }) => {
        if (data) {
          const sorted = [...(data.product_images || [])].sort((a, b) => a.position - b.position);
          setProduct({ ...data, product_images: sorted });
        }
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-28 pb-16 px-5">
        <div className="max-w-[1100px] mx-auto flex justify-center py-20">
          <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background pt-28 pb-16 px-5">
        <div className="max-w-[1100px] mx-auto text-center py-20">
          <span className="material-symbols-outlined text-on-surface/20 text-7xl mb-4 block">search_off</span>
          <p className="font-[family-name:var(--font-body-lg)] text-on-surface-variant mb-6">
            Producto no encontrado o no disponible
          </p>
          <Link
            href="/productos"
            className="inline-flex items-center gap-2 font-[family-name:var(--font-headline-md)] text-[14px] text-primary uppercase tracking-wider hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Volver a la tienda
          </Link>
        </div>
      </div>
    );
  }

  const images = product.product_images;
  const hasImages = images.length > 0;

  return (
    <div className="min-h-screen bg-background pt-28 pb-16 px-5">
      <div className="max-w-[1100px] mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-8">
          <Link href="/productos" className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface-variant hover:text-primary transition-colors">
            Tienda
          </Link>
          <span className="material-symbols-outlined text-on-surface-variant/30 text-[16px]">chevron_right</span>
          <span className="font-[family-name:var(--font-body-md)] text-[13px] text-on-surface">{product.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Galería de imágenes */}
          <div className="space-y-4">
            {/* Imagen principal */}
            <div className="aspect-square bg-surface-container rounded-2xl overflow-hidden border border-on-surface/5 flex items-center justify-center">
              {hasImages ? (
                <img
                  src={images[selectedImage]?.url || images[0].url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="material-symbols-outlined text-on-surface/10 text-[120px]">package_2</span>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-3">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(i)}
                    className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-colors cursor-pointer ${
                      selectedImage === i ? "border-primary" : "border-on-surface/10 hover:border-primary/30"
                    }`}
                  >
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info del producto */}
          <div className="flex flex-col">
            {product.category && (
              <span className="font-[family-name:var(--font-label-sm)] text-[11px] uppercase tracking-wider text-primary mb-3 block">
                {product.category}
              </span>
            )}

            <h1 className="font-[family-name:var(--font-headline-lg)] text-[32px] md:text-[40px] text-on-surface uppercase tracking-tighter mb-4 leading-tight">
              {product.name}
            </h1>

            <div className="mb-6">
              <span className="font-[family-name:var(--font-headline-lg)] text-[36px] text-primary">
                ${product.price.toLocaleString("es-CL")}
              </span>
            </div>

            {/* Estado del stock */}
            <div className="mb-6">
              {product.stock > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="font-[family-name:var(--font-body-md)] text-[14px] text-green-400">
                    Disponible ({product.stock} en stock)
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="font-[family-name:var(--font-body-md)] text-[14px] text-red-400">
                    Agotado
                  </span>
                </div>
              )}
            </div>

            {/* Descripción */}
            {product.description && (
              <div className="border-t border-on-surface/5 pt-6 mb-6">
                <h3 className="font-[family-name:var(--font-headline-md)] text-[16px] text-on-surface uppercase mb-3">
                  Descripción
                </h3>
                <div className="space-y-2">
                  {product.description.split("\n").map((paragraph, i) => (
                    <p key={i} className="font-[family-name:var(--font-body-md)] text-[15px] leading-[26px] text-on-surface-variant">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Separator */}
            <div className="border-t border-on-surface/5 pt-6 mt-auto" />

            {/* Acciones */}
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <Link
                href="/productos"
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-on-surface/10 text-on-surface-variant hover:bg-on-surface/5 transition-colors text-[14px] font-[family-name:var(--font-headline-md)] uppercase tracking-wider"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Volver a la tienda
              </Link>
              {product.stock > 0 && (
                <>
                  <button
                    onClick={addToCart}
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-on-surface/15 text-on-surface text-[14px] font-[family-name:var(--font-headline-md)] uppercase tracking-wider hover:bg-on-surface/5 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                    Agregar al carrito
                  </button>
                  <button
                    onClick={buyNow}
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg btn-primary-gradient text-white text-[14px] font-[family-name:var(--font-headline-md)] uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
                    Comprar ahora
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
