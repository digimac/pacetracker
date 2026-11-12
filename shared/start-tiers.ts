/**
 * Day Quality explainer on /start. Ranges and tier names are fixed (they mirror
 * client/src/lib/day-quality.ts); everything else is editable in Admin → Pages
 * and stored as site page "start_tiers". Empty fields fall back to these defaults.
 *
 * Storage mapping: ctaLabel = tag, title = headline, subtitle = intro, body = closing note,
 * sections = JSON [{ tier, description, example }].
 */
export type StartTierKey = "off" | "solid" | "strong" | "sweet";

export const START_TIER_FIXED: { tier: StartTierKey; range: string; name: string }[] = [
  { tier: "off", range: "0 or less", name: "Off Day" },
  { tier: "solid", range: "+1 to +3", name: "Solid Day" },
  { tier: "strong", range: "+4 to +5", name: "Strong Day" },
  { tier: "sweet", range: "+6 or more", name: "Sweet Day" },
];

export const START_TIERS_DEFAULTS = {
  tag: "Day Quality",
  headline: "Solid. Strong. Sweet.",
  intro: "Every metric gets a Win, a Loss, or a Shift. Your daily score is your wins minus your losses, and that number sets the quality of your day.",
  note: "So the difference between a +3, a +5, and a +6 is the difference between Solid, Strong, and Sweet. Custom metrics count toward your score too, so they can help you reach Sweet even when one core metric is a Shift. Your History shows how many of each kind of day you've stacked up.",
  cards: {
    off: { description: "Losses matched or outweighed wins. It happens. You still scored it, and showing up keeps your streak alive.", example: "2 wins, 2 losses, 2 shifts = 0" },
    solid: { description: "You came out ahead. A +3 means more went right than wrong, with room left on the table.", example: "4 wins, 1 loss, 1 shift = +3" },
    strong: { description: "Nearly everything moved forward. A +5 is one metric away from a perfect core day.", example: "5 wins, 1 shift = +5" },
    sweet: { description: "The top of the scale. A +6 means a win on all six core metrics, the kind of day momentum is built on.", example: "6 wins across TIME, GOAL, TEAM, TASK, VIEW, and PACE = +6" },
  } as Record<StartTierKey, { description: string; example: string }>,
};

export const START_TIERS_PAGE_KEY = "start_tiers";
