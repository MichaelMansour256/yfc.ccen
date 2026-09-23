export default function PageHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-blue-mid/30 bg-blue-primary/30 px-4 py-4 backdrop-blur-sm">
      <span className="text-2xl">{icon}</span>
      <h1 className="text-xl font-bold text-white">{title}</h1>
    </div>
  );
}
