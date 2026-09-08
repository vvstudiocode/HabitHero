using HabitHero.Platform;

namespace HabitHero.App
{
    public static class HabitHeroParentGoalReviewEligibility
    {
        public static bool NeedsReview(SupabaseChildTaskRecord task)
        {
            return task != null
                && (task.status == "proposed"
                    || task.status == "proposal_revision_requested");
        }
    }
}
