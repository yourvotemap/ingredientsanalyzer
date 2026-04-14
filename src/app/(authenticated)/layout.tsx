import { auth } from "@/lib/auth";
import Navigation from "@/components/Navigation";
import { redirect } from "next/navigation";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen" style={{ background: "#f5f7fb" }}>
      <Navigation userName={session.user?.name || session.user?.email || ""} />
      <div className="flex">
        <main className="flex-1 max-w-[1360px] mx-auto px-6 py-4">
          {children}
        </main>
      </div>
    </div>
  );
}
