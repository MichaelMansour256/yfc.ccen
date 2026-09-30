import { localized } from "@/lib/localized";

/**
 * Meeting information — WHO this website is for.
 * (Church identity, contact info, social links and assets live in `site.ts`.)
 *
 * All display strings are stored with their exact current values so the
 * rendered UI is unchanged, and each is an explicit `LocalizedText`
 * (`{ ar, en }`) so a page reads the language it was asked for instead of
 * reaching for a hard-coded `*Ar` field.
 */
export const meetingConfig = {
  /** Meeting name. */
  name: localized("إحنا شباب المسيح", "Youth For Christ Meeting"),
  /** Short display name (installed PWA title, admin pages) — brand, not translated. */
  shortName: "Youth For Christ",
  /** Age group / stage the meeting serves. */
  ageGroup: localized("شباب (Youth)", "Youth"),

  /** One-line tagline (used on the contact page). */
  tagline: localized("إحنا شباب المسيح", "Youth For Christ Meeting"),

  /** Home page hero texts. */
  hero: {
    welcome: localized(
      "أهلاً بيكم في اجتماع شباب المسيح",
      "Welcome to the Youth For Christ meeting"
    ),
    subtitle: localized(
      "إحنا شباب المسيح · كنيسة المسيح – عزبة النخل",
      "Youth For Christ Meeting · Christ Church – Ezbet El Nakhl"
    ),
  },

  /**
   * Weekly schedule.
   * `weekday` drives the countdown, the events date-strip highlight and the
   * invitation lookups (0 = Sunday … 6 = Saturday). `time` is HH:MM 24h and
   * feeds the countdown target and the admin event form default.
   * The `label` / `dayName` / `timeLabel` fields are the exact strings shown in
   * the UI and in push notifications.
   */
  schedule: {
  weekday: 5, // Friday
  time: "18:30",
  /** Weekly-meeting card line. */
    label: localized("كل جمعة · ٦:٣٠ م", "Every Friday · 6:30 PM"),
  /** Reminder/push text building blocks. */
    dayName: localized("الجمعة", "Friday"),
    timeLabel: localized("٦:٣٠ م", "6:30 PM"),
  },

  /** Meeting location (the church itself lives in `siteConfig.church`). */
  location: {
    name: localized("كنيسة المسيح – عزبة النخل", "Christ Church – Ezbet El Nakhl"),
  },

  /** "About" page content. */
  about: {
    title: localized("من نحن", "About Us"),
    paragraphs: {
      ar: [
        "إحنا اجتماع شباب المسيح في كنيسة المسيح – عزبة النخل، بنجتمع علشان نكبر مع بعض في علاقتنا بربنا، نفهم كلمته أكتر، ونعيش إيماننا بشكل حقيقي في حياتنا اليومية.",
        "بالنسبالنا الاجتماع مش مجرد وقت بنقضيه كل أسبوع، لكنه مكان بنقابل فيه ربنا، وبنكوّن صداقات حقيقية، ونتعلم، ونخوض تجارب جديدة مع بعض.",
      ],
      en: [
        "We are Youth For Christ, a meeting at Christ Church – Ezbet El Nakhl. We gather to grow together in our relationship with God, understand His word more deeply, and live out our faith in our everyday lives.",
        "For us, this meeting is not just time we spend every week — it's a place where we encounter God, build real friendships, learn, and experience new things together.",
      ],
    },
    pillars: [
      {
        icon: "✝️",
        title: localized("إيمان", "Faith"),
        desc: localized(
          "نقرب من ربنا، ونعرفه أكتر، ونفهم كلمته ونكتشف إزاي نعيشها.",
          "Drawing closer to God, knowing Him more, understanding His word and discovering how to live it out."
        ),
      },
      {
        icon: "🤝",
        title: localized("أصحاب", "Friends"),
        desc: localized(
          "نبني مجتمع حقيقي نقدر نكون فيه على طبيعتنا، ونفرح ونساعد بعض ونكبر سوا.",
          "Building a real community where we can be ourselves, share joy, support each other and grow together."
        ),
      },
      {
        icon: "🌱",
        title: localized("نمو", "Growth"),
        desc: localized(
          "كل واحد فينا في رحلة، وهدفنا إننا نتقدم خطوة كل يوم في علاقتنا بربنا وبالناس حوالينا.",
          "Each of us is on a journey — our goal is to take one step forward every day in our relationship with God and the people around us."
        ),
      },
    ],
  },
};
