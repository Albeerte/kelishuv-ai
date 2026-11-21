import Link from "next/link";
export default function NotFound() {
  return (
    <main className="not-found">
      <h1>Sahifa topilmadi</h1>
      <p>Manzilni tekshiring yoki shaxsiy kabinetingizga qayting.</p>
      <Link className="button button-primary" href="/">
        Bosh sahifaga qaytish
      </Link>
    </main>
  );
}
