import { redirect } from "next/navigation";
import { getMyIntern } from "@/lib/interns";
import { InternProfile } from "@/components/InternProfile";
import { ResumeUpload } from "@/components/student/ResumeUpload";

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const intern = await getMyIntern();
  // Middleware already gates this, but resolve defensively in case of a race.
  if (!intern) redirect("/student/pending");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Your profile
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          This is exactly what hiring companies see. Keep your resume current to
          make the best impression.
        </p>
      </div>

      <ResumeUpload hasResume={!!intern.resume_path} />

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Preview
        </h2>
        <InternProfile intern={intern} resumeSrc="/student/resume" />
      </section>
    </div>
  );
}
