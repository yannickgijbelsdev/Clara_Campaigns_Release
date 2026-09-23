import { useEffect, useState } from "react";

// Newsletter best-practice tips, narrated by the koodh bear while things load.
export const NEWSLETTER_TIPS = [
  "Keep subject lines under 50 characters — they earn the highest open rates.",
  "Personalize with the recipient's first name to boost engagement.",
  "One clear call-to-action beats five competing links.",
  "Tuesday and Thursday mornings tend to get the best open rates.",
  "Preview on mobile first — most people read newsletters on their phone.",
  "A strong preheader can lift opens as much as the subject line itself.",
  "Segment your audience so every message feels personally relevant.",
  "Use images sparingly — too many can trip spam filters.",
  "Always include an unsubscribe link to stay trusted and compliant.",
  "Send a test to yourself before you send to everyone.",
  "Short paragraphs and plenty of white space make emails easy to read.",
  "A/B test your subject lines to learn what your audience loves.",
];

// Rotates through the tips while `active` is true.
export function useRotatingTip(active, intervalMs = 3200) {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * NEWSLETTER_TIPS.length));

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % NEWSLETTER_TIPS.length);
    }, intervalMs);
    return () => clearInterval(t);
  }, [active, intervalMs]);

  return NEWSLETTER_TIPS[idx];
}
