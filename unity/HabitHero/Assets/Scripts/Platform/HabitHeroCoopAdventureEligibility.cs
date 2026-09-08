using HabitHero.Platform;

namespace HabitHero.App
{
    public static class HabitHeroCoopAdventureEligibility
    {
        public static bool CanCreate(SupabaseChildTaskRecord task)
        {
            return task != null
                && task.adventure_type == "general"
                && !task.is_daily
                && (task.status == "todo"
                    || task.status == "revision_requested"
                    || task.status == "proposed"
                    || task.status == "proposal_revision_requested");
        }
    }
}
