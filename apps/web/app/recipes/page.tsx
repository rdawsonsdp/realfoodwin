import { redirect } from "next/navigation";

// Folded into /kitchen as the "Real Food Kitchen" tab — keep the URL alive
// for any inbound links by redirecting.
export default function LegacyRecipesPage() {
  redirect("/kitchen?tab=real-food");
}
