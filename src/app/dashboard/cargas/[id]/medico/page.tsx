import { redirect } from "next/navigation";

// Una cuenta por alumno: la ficha médica de cada alumno está en "Mi ficha"
// de su propia cuenta. Se conserva la ruta para links antiguos.
export default function MedicoPage() {
  redirect("/dashboard/ficha");
}
