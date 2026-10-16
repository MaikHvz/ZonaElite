import { redirect } from "next/navigation";

// Una cuenta por alumno: "Mis Cargas" se reemplazó por "Mi ficha".
// Se conserva la ruta para links y marcadores antiguos.
export default function CargasPage() {
  redirect("/dashboard/ficha");
}
