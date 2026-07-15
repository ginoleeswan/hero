// Plain-language Privacy Policy + Terms content for the /privacy and /terms
// routes. This is a sensible starting template covering what the app actually
// does (Supabase auth, favourites/votes/contributions, Vercel analytics,
// third-party encyclopedia data) — have it reviewed before launch; it is not
// legal advice. Update CONTACT_EMAIL and LAST_UPDATED as needed.
export const CONTACT_EMAIL = 'hello@mythique.app';
export const LAST_UPDATED = '20 June 2026';

export interface LegalSection {
  heading: string;
  body: string[];
}
export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

export const PRIVACY: LegalDoc = {
  title: 'Privacy Policy',
  updated: LAST_UPDATED,
  intro:
    'Mythique is an encyclopedia and game spanning fictional characters from every universe. This policy explains what we collect, why, and the choices you have. We keep data collection to the minimum needed to run the app.',
  sections: [
    {
      heading: 'Information we collect',
      body: [
        'Account details: if you sign up, we store your email address and an authentication identifier through our auth provider (Supabase). If you sign in with Google, we receive your basic profile (name, email, avatar) from Google — not your password.',
        'Your activity: characters you favourite, matchup votes you cast, and any corrections you submit to the encyclopedia. This is tied to your account so we can show it back to you.',
        'Device storage: the daily “Guess the Hero” game stores your progress, streak and stats locally on your device. We do not need an account for that.',
        'Usage analytics: we use privacy-friendly, aggregate analytics (Vercel Analytics) to understand page views and traffic. It does not use cookies to track you across other sites.',
      ],
    },
    {
      heading: 'How we use it',
      body: [
        'To provide core features — saving favourites, recording votes, reviewing community contributions, and personalising what you see.',
        'To keep the service secure and working, and to understand which features are used so we can improve them.',
        'We do not sell your personal information.',
      ],
    },
    {
      heading: 'Third parties',
      body: [
        'We rely on service providers to run the app: Supabase (database and authentication), Vercel (hosting and analytics), and Google (optional sign-in).',
        'Encyclopedia content is compiled from public sources including the SuperheroAPI, ComicVine, TMDB and Wikidata. Character names, images and trademarks belong to their respective owners; Mythique is an unofficial, fan-made reference.',
      ],
    },
    {
      heading: 'Your choices and rights',
      body: [
        'You can stop using the app and request deletion of your account and associated data at any time by contacting us.',
        'You can clear the daily game’s local data by clearing your browser/app storage.',
        'Depending on where you live, you may have rights to access, correct or delete your personal data — contact us to exercise them.',
      ],
    },
    {
      heading: 'Children',
      body: [
        'Mythique is not directed to children under 13, and we do not knowingly collect personal information from them.',
      ],
    },
    {
      heading: 'Changes & contact',
      body: [
        'We may update this policy as the app evolves; we will revise the “last updated” date above.',
        `Questions or requests: ${CONTACT_EMAIL}.`,
      ],
    },
  ],
};

export const TERMS: LegalDoc = {
  title: 'Terms of Service',
  updated: LAST_UPDATED,
  intro:
    'By using Mythique you agree to these terms. Mythique is a free, fan-made encyclopedia and game spanning fictional characters from every universe, provided “as is”.',
  sections: [
    {
      heading: 'Your account',
      body: [
        'You are responsible for activity under your account and for keeping your login secure. Don’t use the app to break the law or infringe others’ rights.',
      ],
    },
    {
      heading: 'Community contributions',
      body: [
        'You can suggest corrections to encyclopedia entries. By submitting, you confirm you have the right to share the information and grant us permission to use, edit and publish it within Mythique.',
        'Submissions are reviewed before they appear, and we may accept, edit or reject any contribution at our discretion.',
      ],
    },
    {
      heading: 'Content & intellectual property',
      body: [
        'Character names, likenesses, logos and trademarks belong to their respective owners (Marvel, DC and others). Mythique is unofficial and not endorsed by them. Content is provided for informational and entertainment purposes.',
        'The Mythique name, design and original software are ours; please don’t copy or redistribute them without permission.',
      ],
    },
    {
      heading: 'Acceptable use',
      body: [
        'Don’t attempt to disrupt, overload, scrape at scale, or abuse the service or its APIs, and don’t attempt to manipulate game results, votes or rankings.',
      ],
    },
    {
      heading: 'Disclaimer & liability',
      body: [
        'The service is provided “as is” without warranties. Encyclopedia data may be incomplete or inaccurate. To the extent permitted by law, we are not liable for any damages arising from your use of the app.',
      ],
    },
    {
      heading: 'Changes & contact',
      body: [
        'We may update these terms; continued use means you accept the changes.',
        `Questions: ${CONTACT_EMAIL}.`,
      ],
    },
  ],
};
