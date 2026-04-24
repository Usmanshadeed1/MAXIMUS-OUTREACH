import { redirect } from "next/navigation";

export const metadata = {
  title: "Dashboard | Maximus Outreach",
};

export default function DashboardPage() {
  redirect("/analytics");
}
