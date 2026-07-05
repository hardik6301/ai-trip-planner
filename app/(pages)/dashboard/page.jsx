import { redirect } from "next/navigation";

/** Legacy nav link — dashboard is now profile */
export default function DashboardRedirect() {
  redirect("/profile");
}
