import { redirect } from "next/navigation";

// Unified entry: everyone signs in at /login. After auth we route by account
// type, so an approved partner lands on /partners automatically.
export default function PartnerLoginRedirect() {
  redirect("/login");
}
