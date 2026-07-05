import { listCompanies, listCompanyUsers } from "@/lib/admin";
import { AddUserForm } from "@/components/admin/AddUserForm";
import { UsersTable } from "@/components/admin/UsersTable";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const [users, companies] = await Promise.all([
    listCompanyUsers(),
    listCompanies(),
  ]);

  const pending = users.filter((u) => !u.approved).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-500">
            {users.length} {users.length === 1 ? "user" : "users"} on the
            allowlist
            {pending > 0 && (
              <>
                {" · "}
                <span className="font-medium text-amber-600">
                  {pending} pending approval
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      <AddUserForm companies={companies} />

      <UsersTable users={users} companies={companies} />
    </div>
  );
}
