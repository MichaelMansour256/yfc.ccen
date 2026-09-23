import PageHeader from "@/components/PageHeader";

export default function ComingSoon({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="min-h-dvh page-gradient">
      <PageHeader title={title} icon={icon} />
      <div className="flex flex-col items-center justify-center gap-3 pt-24 text-center text-blue-light/50">
        <span className="text-6xl">{icon}</span>
        <p className="text-sm">Coming soon…</p>
      </div>
    </div>
  );
}
