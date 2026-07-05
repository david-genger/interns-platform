import { getCompanyUserCounts, listCompanies } from "@/lib/admin";
import { AddCompanyForm } from "@/components/admin/AddCompanyForm";
import { CompaniesTable } from "@/components/admin/CompaniesTable";

export const dynamic = "force-dynamic";

export default async function AdminCompaniesPage() {
  const [companies, counts] = await Promise.all([
    listCompanies(),
    getCompanyUserCounts(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Companies</h1>
        <p className="mt-1 text-sm text-slate-500">
          {companies.length} {companies.length === 1 ? "company" : "companies"}
        </p>
      </div>

      <AddCompanyForm />

      <CompaniesTable companies={companies} userCounts={counts} />
    </div>
  );
}
