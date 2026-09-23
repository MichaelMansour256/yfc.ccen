import PageHeader from "@/components/PageHeader";
import SocialLinks from "@/components/SocialLinks";
import Link from "next/link";
import { meetingConfig, siteConfig } from "@/config";

export default function ContactPage() {
  return (
    <div className="min-h-dvh page-gradient">
      <PageHeader title="Contact" icon="📬" />

      <div className="flex flex-col items-center gap-6 px-6 pt-8 text-center">
        {/* Church info */}
        <div className="w-full max-w-sm rounded-2xl border border-blue-mid/40 bg-blue-primary/30 p-6 backdrop-blur-sm">
          <p className="text-base font-semibold text-white">{siteConfig.church.name}</p>
          <p className="mt-1 text-sm text-blue-light/70">{meetingConfig.tagline.ar}</p>
        </div>

        {/* Social links */}
        <div className="w-full max-w-sm rounded-2xl border border-blue-mid/40 bg-blue-primary/30 p-6 backdrop-blur-sm">
          <p className="mb-4 text-sm font-semibold text-white">Follow Us</p>
          <SocialLinks />
        </div>

        {/* All links list */}
        <div className="w-full max-w-sm flex flex-col gap-2">
          {siteConfig.social.map(({ name, url }) => (
            <Link key={name} href={url} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between rounded-2xl border border-blue-mid/40 bg-blue-primary/40 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-mid/50 active:scale-95">
              {name}
              <span className="text-blue-light/50">↗</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
