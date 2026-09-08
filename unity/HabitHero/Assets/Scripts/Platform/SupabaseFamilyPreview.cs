using System;
using System.Collections.Generic;

namespace HabitHero.Platform
{
    public static class SupabaseFamilyPreview
    {
        public static SupabaseChildProfileRecord SelectChild(
            SupabaseParentHomeSnapshot snapshot,
            string requestedChildId)
        {
            if (snapshot == null || snapshot.children == null)
            {
                return null;
            }

            foreach (SupabaseChildProfileRecord child in snapshot.children)
            {
                if (child != null && child.id == requestedChildId)
                {
                    return child;
                }
            }

            foreach (SupabaseChildProfileRecord child in snapshot.children)
            {
                if (child != null) return child;
            }

            return null;
        }

        public static SupabaseChildTaskRecord[] FilterTasks(
            SupabaseParentHomeSnapshot snapshot,
            string childProfileId)
        {
            return Filter(
                snapshot == null ? null : snapshot.tasks,
                childProfileId,
                task => task == null ? null : task.child_profile_id);
        }

        public static SupabaseChildRewardRecord[] FilterRewards(
            SupabaseParentHomeSnapshot snapshot,
            string childProfileId)
        {
            return Filter(
                snapshot == null ? null : snapshot.rewards,
                childProfileId,
                reward => reward == null ? null : reward.child_profile_id);
        }

        public static SupabaseChildWishlistRecord[] FilterWishlist(
            SupabaseParentHomeSnapshot snapshot,
            string childProfileId)
        {
            return Filter(
                snapshot == null ? null : snapshot.wishlist,
                childProfileId,
                wishlist => wishlist == null ? null : wishlist.child_profile_id);
        }

        public static SupabaseChildTicketRecord[] FilterTickets(
            SupabaseParentHomeSnapshot snapshot,
            string childProfileId)
        {
            return Filter(
                snapshot == null ? null : snapshot.tickets,
                childProfileId,
                ticket => ticket == null ? null : ticket.child_profile_id);
        }

        public static SupabaseChildLedgerRecord[] FilterLedger(
            SupabaseParentHomeSnapshot snapshot,
            string childProfileId)
        {
            return Filter(
                snapshot == null ? null : snapshot.ledger,
                childProfileId,
                entry => entry == null ? null : entry.child_profile_id);
        }

        private static T[] Filter<T>(
            T[] rows,
            string childProfileId,
            Func<T, string> getChildProfileId)
        {
            if (rows == null || string.IsNullOrWhiteSpace(childProfileId))
            {
                return new T[0];
            }

            List<T> filtered = new List<T>();
            foreach (T row in rows)
            {
                if (!ReferenceEquals(row, null) && getChildProfileId(row) == childProfileId)
                {
                    filtered.Add(row);
                }
            }

            return filtered.ToArray();
        }
    }
}
