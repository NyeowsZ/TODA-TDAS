import { getCurrentUser } from "@/lib/actions/auth-actions";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/ui/dashboard-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-canvas">
      <DashboardNav user={user} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
