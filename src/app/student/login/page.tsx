import { redirect } from "next/navigation";

// Unified entry: everyone signs in at /login. After auth we route by account
// type, so a student lands on /student automatically.
export default function StudentLoginRedirect() {
  redirect("/login");
}
