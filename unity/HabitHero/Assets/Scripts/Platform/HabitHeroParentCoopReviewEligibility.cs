using HabitHero.Platform;

namespace HabitHero.App
{
    public static class HabitHeroParentCoopReviewEligibility
    {
        public static bool NeedsReview(SupabaseCoopAdventureCompletion completion)
        {
            return completion != null
                && (completion.status == "pending"
                    || completion.status == "revision_requested");
        }
    }
}
