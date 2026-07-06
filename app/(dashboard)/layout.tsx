import { Shell } from "@/components/Shell";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <Shell>{children}</Shell>;
}
