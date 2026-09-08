using System;
using UnityEngine;

namespace HabitHero.Platform
{
    public sealed class HabitHeroPetMotionState
    {
        public uint RandomState;
        public Vector2 Facing;
        public float Clock;
        public float NextTurnAt;
        public float NextPauseAt;
        public float PauseUntil;
    }

    public struct HabitHeroPetMotionStep
    {
        public Vector2 Position;
        public Vector2 Facing;
        public bool Moving;
        public bool Blocked;
    }

    public static class HabitHeroPetMotion
    {
        public const float FollowDistance = 0.12f;
        public const float FollowSpacing = 0.16f;
        public const float FollowClearance = 0.04f;
        public const float FollowStopDistance = 0.18f;
        public const float FollowSpeed = 0.75f;
        public const float WanderSpeed = 0.5f;

        private const float MinimumDirectionLength = 0.0001f;
        private const float WanderTurnIntervalMin = 1.4f;
        private const float WanderTurnIntervalMax = 3.2f;
        private const float WanderPauseIntervalMin = 4.2f;
        private const float WanderPauseIntervalMax = 8.5f;
        private const float WanderPauseDurationMin = 0.65f;
        private const float WanderPauseDurationMax = 1.75f;

        public static float GetFollowingDistance(int index)
        {
            return FollowDistance + Mathf.Max(0, index) * FollowSpacing;
        }

        public static float GetSafeFollowingDistance(
            float followDistance,
            float followerRadius,
            float leaderRadius)
        {
            return Mathf.Max(
                float.IsNaN(followDistance) || float.IsInfinity(followDistance)
                    ? FollowDistance
                    : followDistance,
                leaderRadius + Mathf.Max(followerRadius, 0.08f) + FollowClearance);
        }

        public static HabitHeroPetMotionState CreateState(string seedText)
        {
            uint seed = HashSeed(seedText);
            return new HabitHeroPetMotionState
            {
                RandomState = seed,
                Facing = Vector2.up,
                Clock = 0f,
                NextTurnAt = 0f,
                NextPauseAt = 5f,
                PauseUntil = 0f,
            };
        }

        public static HabitHeroPetMotionStep GetFollowingStep(
            Vector2 current,
            Vector2 leaderPosition,
            int followIndex,
            float followerRadius,
            float leaderRadius,
            float deltaSeconds,
            HabitHeroWorldCollisionProxy[] obstacles,
            float boundary,
            float speed = FollowSpeed)
        {
            float followDistance = GetSafeFollowingDistance(
                GetFollowingDistance(followIndex),
                followerRadius,
                leaderRadius);
            Vector2 fromLeader = current - leaderPosition;
            Vector2 side = Normalize(fromLeader, Vector2.down);
            Vector2 target = leaderPosition + side * followDistance;
            Vector2 toTarget = target - current;
            float distance = toTarget.magnitude;
            if (distance <= FollowStopDistance)
            {
                return new HabitHeroPetMotionStep
                {
                    Position = current,
                    Facing = side,
                    Moving = false,
                    Blocked = false,
                };
            }

            Vector2 direction = Normalize(toTarget, side);
            float safeDelta = Mathf.Max(0f, deltaSeconds);
            float stepDistance = Mathf.Min(
                distance,
                safeDelta * Mathf.Max(0f, speed));
            Vector2 desired = current + direction * stepDistance;
            HabitHeroWorldCollisionProxy[] collisionObstacles = AddLeaderObstacle(
                obstacles,
                leaderPosition,
                leaderRadius);
            Vector2 next = HabitHeroWorldCollision.MoveCharacter(
                current,
                desired,
                followerRadius,
                collisionObstacles,
                boundary);
            float movedDistance = Vector2.Distance(current, next);
            return new HabitHeroPetMotionStep
            {
                Position = next,
                Facing = direction,
                Moving = movedDistance > MinimumDirectionLength,
                Blocked = stepDistance > MinimumDirectionLength
                    && movedDistance <= MinimumDirectionLength,
            };
        }

        public static HabitHeroPetMotionStep GetWanderStep(
            Vector2 current,
            float deltaSeconds,
            float radius,
            float speed,
            HabitHeroWorldCollisionProxy[] obstacles,
            float boundary,
            HabitHeroPetMotionState state)
        {
            if (state == null) state = CreateState("default-pet");
            float safeDelta = Mathf.Max(0f, deltaSeconds);
            state.Clock += safeDelta;

            if (state.PauseUntil > state.Clock)
            {
                return Stationary(current, state.Facing);
            }

            if (state.PauseUntil > 0f)
            {
                state.PauseUntil = 0f;
                state.NextPauseAt = state.Clock + RandomBetween(
                    state,
                    WanderPauseIntervalMin,
                    WanderPauseIntervalMax);
            }

            if (state.Clock >= state.NextPauseAt)
            {
                state.PauseUntil = state.Clock + RandomBetween(
                    state,
                    WanderPauseDurationMin,
                    WanderPauseDurationMax);
                return Stationary(current, state.Facing);
            }

            if (state.Clock >= state.NextTurnAt)
            {
                state.Facing = RandomDirection(state);
                state.NextTurnAt = state.Clock + RandomBetween(
                    state,
                    WanderTurnIntervalMin,
                    WanderTurnIntervalMax);
            }

            float stepDistance = safeDelta * Mathf.Max(0f, speed);
            Vector2 desired = current + state.Facing * stepDistance;
            Vector2 next = HabitHeroWorldCollision.MoveCharacter(
                current,
                desired,
                radius,
                obstacles,
                boundary);
            float movedDistance = Vector2.Distance(current, next);
            bool blocked = stepDistance > MinimumDirectionLength
                && movedDistance <= MinimumDirectionLength;
            if (blocked)
            {
                state.Facing = new Vector2(-state.Facing.x, -state.Facing.y);
                state.NextTurnAt = state.Clock;
            }

            return new HabitHeroPetMotionStep
            {
                Position = next,
                Facing = state.Facing,
                Moving = movedDistance > MinimumDirectionLength,
                Blocked = blocked,
            };
        }

        public static uint HashSeed(string value)
        {
            string input = value ?? string.Empty;
            uint hash = 2166136261u;
            for (int index = 0; index < input.Length; index += 1)
            {
                hash ^= input[index];
                hash *= 16777619u;
            }

            return hash == 0u ? 1u : hash;
        }

        private static HabitHeroPetMotionStep Stationary(
            Vector2 position,
            Vector2 facing)
        {
            return new HabitHeroPetMotionStep
            {
                Position = position,
                Facing = Normalize(facing, Vector2.up),
                Moving = false,
                Blocked = false,
            };
        }

        private static HabitHeroWorldCollisionProxy[] AddLeaderObstacle(
            HabitHeroWorldCollisionProxy[] obstacles,
            Vector2 leaderPosition,
            float leaderRadius)
        {
            HabitHeroWorldCollisionProxy[] source = obstacles
                ?? new HabitHeroWorldCollisionProxy[0];
            HabitHeroWorldCollisionProxy[] result =
                new HabitHeroWorldCollisionProxy[source.Length + 1];
            Array.Copy(source, result, source.Length);
            result[source.Length] = new HabitHeroWorldCollisionProxy(
                leaderPosition.x,
                leaderPosition.y,
                leaderRadius);
            return result;
        }

        private static Vector2 Normalize(Vector2 value, Vector2 fallback)
        {
            return value.sqrMagnitude > MinimumDirectionLength * MinimumDirectionLength
                ? value.normalized
                : fallback.normalized;
        }

        private static Vector2 RandomDirection(HabitHeroPetMotionState state)
        {
            float angle = RandomBetween(state, -Mathf.PI, Mathf.PI);
            return new Vector2(Mathf.Sin(angle), Mathf.Cos(angle));
        }

        private static float RandomBetween(
            HabitHeroPetMotionState state,
            float minimum,
            float maximum)
        {
            uint value = state.RandomState;
            value ^= value << 13;
            value ^= value >> 17;
            value ^= value << 5;
            state.RandomState = value == 0u ? 1u : value;
            float ratio = state.RandomState / (float)uint.MaxValue;
            return minimum + (maximum - minimum) * ratio;
        }
    }
}
