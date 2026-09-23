import Image from "next/image";
import PageHeader from "@/components/PageHeader";
import { SERVANTS_DIR, servants, servantsTitleAr } from "@/config";

export default function ServantsPage() {
  return (
    <div className="min-h-dvh page-gradient">
      <PageHeader title={servantsTitleAr} icon="🙏" />

      <div className="grid grid-cols-2 gap-4 p-4">
        {servants.map(({ file, nameAr }) => (
          <div key={file}
            className="flex flex-col items-center gap-3 rounded-2xl border border-blue-mid/40 bg-blue-primary/30 p-4 backdrop-blur-sm">
            <div className="relative h-24 w-24 overflow-hidden rounded-full ring-2 ring-blue-accent/40 shadow-lg shadow-blue-accent/20">
              <Image
                src={`${SERVANTS_DIR}/${file}`}
                alt={nameAr}
                fill
                className="object-cover"
                sizes="96px"
              />
            </div>
            <p className="text-sm font-semibold text-white text-center">{nameAr}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
