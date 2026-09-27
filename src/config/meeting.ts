/**
 * Meeting information — WHO this website is for.
 * (Church identity, contact info, social links and assets live in `site.ts`.)
 *
 * All display strings are stored with their exact current values so the
 * rendered UI is unchanged.
 */
export const meetingConfig = {
  /** Meeting name (Arabic). */
  name: "إحنا شباب المسيح",
  /** Meeting name (English). */
  nameEn: "Youth For Christ Meeting",
  /** Short display name (installed PWA title, admin pages). */
  shortName: "Youth For Christ",
  /** Age group / stage the meeting serves. */
  ageGroup: "شباب (Youth)",

  /** One-line tagline (used on the contact page). */
  tagline: {
    ar: "إحنا شباب المسيح",
    en: "Youth For Christ Meeting",
  },

  /** Home page hero texts. */
  hero: {
    welcome: {
      ar: "أهلاً بيكم في اجتماع شباب المسيح",
      en: "Youth For Christ Meeting",
    },
    subtitle: {
      ar: "إحنا شباب المسيح · كنيسة المسيح – عزبة النخل",
      en: "Youth For Christ Meeting · Christ Church – Ezbet El Nakhl",
    },
  },

  /**
   * Weekly schedule.
   * `weekday` drives the countdown, the events date-strip highlight and the
   * invitation lookups (0 = Sunday … 6 = Saturday). `time` is HH:MM 24h and
   * feeds the countdown target and the admin event form default.
   * The `label*` fields are the exact strings shown in the UI / notifications.
   */
  schedule: {
  weekday: 5, // Friday
  time: "18:30",
  /** Weekly-meeting card line. */
  labelAr: "كل جمعة · ٦:٣٠ م",
  labelEn: "Every Friday · 6:30 PM",
  /** Reminder/push text building blocks. */
  dayNameAr: "الجمعة",
  dayNameEn: "Friday",
  timeLabelAr: "٦:٣٠",
  timeLabelEn: "6:30 PM",
},

  /** Meeting location (the church itself lives in `siteConfig.church`). */
  location: {
    name: "كنيسة المسيح – عزبة النخل",
    nameEn: "Christ Church – Ezbet El Nakhl",
  },

  /** "About" page content. */
  about: {
    title: { ar: "من نحن", en: "About Us" },
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
        title: { ar: "إيمان", en: "Faith" },
        desc: {
          ar: "نقرب من ربنا، ونعرفه أكتر، ونفهم كلمته ونكتشف إزاي نعيشها.",
          en: "Drawing closer to God, knowing Him more, understanding His word and discovering how to live it out.",
        },
      },
      {
        icon: "🤝",
        title: { ar: "أصحاب", en: "Friends" },
        desc: {
          ar: "نبني مجتمع حقيقي نقدر نكون فيه على طبيعتنا، ونفرح ونساعد بعض ونكبر سوا.",
          en: "Building a real community where we can be ourselves, share joy, support each other and grow together.",
        },
      },
      {
        icon: "🌱",
        title: { ar: "نمو", en: "Growth" },
        desc: {
          ar: "كل واحد فينا في رحلة، وهدفنا إننا نتقدم خطوة كل يوم في علاقتنا بربنا وبالناس حوالينا.",
          en: "Each of us is on a journey — our goal is to take one step forward every day in our relationship with God and the people around us.",
        },
      },
    ],
  },
};
