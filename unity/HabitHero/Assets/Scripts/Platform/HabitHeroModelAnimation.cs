using System;
using System.Collections.Generic;
using UnityEngine;

namespace HabitHero.Platform
{
    public enum HabitHeroModelAnimationAction
    {
        Idle,
        Walk,
        Sit,
        Wave,
        Dance,
    }

    public enum HabitHeroModelAnimationPlayback
    {
        Hold,
        Loop,
    }

    public static class HabitHeroModelAnimationContract
    {
        private static readonly HabitHeroModelAnimationAction[] Actions =
        {
            HabitHeroModelAnimationAction.Idle,
            HabitHeroModelAnimationAction.Walk,
            HabitHeroModelAnimationAction.Sit,
            HabitHeroModelAnimationAction.Wave,
            HabitHeroModelAnimationAction.Dance,
        };

        public static string FindClipName(
            IReadOnlyList<string> clipNames,
            HabitHeroModelAnimationAction action)
        {
            if (clipNames == null) return null;

            string canonicalName = GetCanonicalName(action);
            for (int index = 0; index < clipNames.Count; index += 1)
            {
                if (string.Equals(
                        clipNames[index],
                        canonicalName,
                        StringComparison.OrdinalIgnoreCase))
                {
                    return clipNames[index];
                }
            }

            for (int index = 0; index < clipNames.Count; index += 1)
            {
                string clipName = clipNames[index];
                if (string.IsNullOrWhiteSpace(clipName)) continue;
                if (MatchesAlias(clipName, action)) return clipName;
            }

            return null;
        }

        public static HabitHeroModelAnimationPlayback GetPlayback(
            HabitHeroModelAnimationAction action)
        {
            return action == HabitHeroModelAnimationAction.Sit
                ? HabitHeroModelAnimationPlayback.Hold
                : HabitHeroModelAnimationPlayback.Loop;
        }

        public static bool IsCoreAction(HabitHeroModelAnimationAction action)
        {
            return action == HabitHeroModelAnimationAction.Idle
                || action == HabitHeroModelAnimationAction.Walk;
        }

        public static IReadOnlyList<HabitHeroModelAnimationAction> GetActions()
        {
            return Actions;
        }

        private static string GetCanonicalName(HabitHeroModelAnimationAction action)
        {
            switch (action)
            {
                case HabitHeroModelAnimationAction.Idle:
                    return "Idle";
                case HabitHeroModelAnimationAction.Walk:
                    return "Walk_InPlace";
                case HabitHeroModelAnimationAction.Sit:
                    return "Sit";
                case HabitHeroModelAnimationAction.Wave:
                    return "Wave";
                case HabitHeroModelAnimationAction.Dance:
                    return "Dance";
                default:
                    return string.Empty;
            }
        }

        private static bool MatchesAlias(
            string clipName,
            HabitHeroModelAnimationAction action)
        {
            StringComparison comparison = StringComparison.OrdinalIgnoreCase;
            switch (action)
            {
                case HabitHeroModelAnimationAction.Idle:
                    return clipName.IndexOf("idle", comparison) >= 0
                        || clipName.IndexOf("iddle", comparison) >= 0
                        || clipName.IndexOf("stand", comparison) >= 0
                        || clipName.IndexOf("rest", comparison) >= 0;
                case HabitHeroModelAnimationAction.Walk:
                    return clipName.IndexOf("walk", comparison) >= 0
                        || clipName.IndexOf("run", comparison) >= 0;
                case HabitHeroModelAnimationAction.Sit:
                    return clipName.IndexOf("sit", comparison) >= 0;
                case HabitHeroModelAnimationAction.Wave:
                    return clipName.IndexOf("wave", comparison) >= 0
                        || clipName.IndexOf("greet", comparison) >= 0
                        || clipName.IndexOf("salute", comparison) >= 0;
                case HabitHeroModelAnimationAction.Dance:
                    return clipName.IndexOf("dance", comparison) >= 0;
                default:
                    return false;
            }
        }
    }

    [DisallowMultipleComponent]
    public sealed class HabitHeroWorldModelAnimation : MonoBehaviour
    {
        private const float CrossFadeSeconds = 0.12f;
        private const float WalkIdlePoseRatio = 0.04f;

        private readonly Dictionary<HabitHeroModelAnimationAction, string> clipNames =
            new Dictionary<HabitHeroModelAnimationAction, string>();
        private readonly Dictionary<HabitHeroModelAnimationAction, Animation> clipSources =
            new Dictionary<HabitHeroModelAnimationAction, Animation>();
        private readonly List<Animation> animationSources = new List<Animation>();
        private HabitHeroModelAnimationAction activeAction;
        private Animation activeSource;
        private string activeClipName;
        private bool isMoving;

        public HabitHeroModelAnimationAction ActiveAction
        {
            get { return activeAction; }
        }

        public string ActiveClipName
        {
            get { return activeClipName; }
        }

        public bool HasAnimation
        {
            get { return clipNames.Count > 0; }
        }

        public static HabitHeroWorldModelAnimation Attach(
            GameObject modelRoot,
            GameObject modelContent)
        {
            if (modelRoot == null) return null;
            HabitHeroWorldModelAnimation animation =
                modelRoot.GetComponent<HabitHeroWorldModelAnimation>();
            if (animation == null)
            {
                animation = modelRoot.AddComponent<HabitHeroWorldModelAnimation>();
            }

            animation.Configure(
                modelContent == null
                    ? new Animation[0]
                    : modelContent.GetComponentsInChildren<Animation>(true));
            return animation;
        }

        public void Configure(IReadOnlyList<Animation> sources)
        {
            StopAllSources();
            clipNames.Clear();
            clipSources.Clear();
            animationSources.Clear();

            if (sources != null)
            {
                for (int sourceIndex = 0; sourceIndex < sources.Count; sourceIndex += 1)
                {
                    Animation source = sources[sourceIndex];
                    if (source == null) continue;
                    animationSources.Add(source);
                }
            }

            List<string> availableClipNames = new List<string>();
            Dictionary<string, Animation> sourceByClipName =
                new Dictionary<string, Animation>(StringComparer.OrdinalIgnoreCase);
            foreach (Animation source in animationSources)
            {
                foreach (AnimationState state in source)
                {
                    if (state == null || string.IsNullOrWhiteSpace(state.name)) continue;
                    if (!sourceByClipName.ContainsKey(state.name))
                    {
                        sourceByClipName.Add(state.name, source);
                        availableClipNames.Add(state.name);
                    }
                }
            }

            foreach (HabitHeroModelAnimationAction action in
                HabitHeroModelAnimationContract.GetActions())
            {
                string clipName = HabitHeroModelAnimationContract.FindClipName(
                    availableClipNames,
                    action);
                if (string.IsNullOrWhiteSpace(clipName)) continue;
                clipNames[action] = clipName;
                clipSources[action] = sourceByClipName[clipName];
                AnimationState state = clipSources[action][clipName];
                if (state != null)
                {
                    state.wrapMode = HabitHeroModelAnimationContract.GetPlayback(action)
                        == HabitHeroModelAnimationPlayback.Hold
                        ? WrapMode.ClampForever
                        : WrapMode.Loop;
                }
            }

            activeSource = null;
            activeClipName = null;
            PlayMotion();
        }

        public bool PlayAction(HabitHeroModelAnimationAction action)
        {
            if (!clipNames.ContainsKey(action)) return false;
            Animation source = clipSources[action];
            string nextClipName = clipNames[action];
            AnimationState nextState = source == null ? null : source[nextClipName];
            if (nextState == null) return false;
            if (action == HabitHeroModelAnimationAction.Walk && isMoving)
            {
                nextState.speed = 1f;
            }

            bool sameAction = activeSource == source && activeClipName == nextClipName;
            if (sameAction && source.IsPlaying(nextClipName))
            {
                return true;
            }

            StopOtherSources(source);
            if (sameAction)
            {
                source.Play(nextClipName);
            }
            else if (!string.IsNullOrWhiteSpace(activeClipName)
                && activeSource == source)
            {
                source.CrossFade(nextClipName, CrossFadeSeconds);
            }
            else
            {
                source.Play(nextClipName);
            }

            activeAction = action;
            activeSource = source;
            activeClipName = nextClipName;
            return true;
        }

        public void SetMoving(bool moving)
        {
            isMoving = moving;
            PlayMotion();
        }

        public void FaceDirection(Vector2 direction)
        {
            if (direction.sqrMagnitude < 0.0001f) return;
            transform.rotation = Quaternion.Euler(
                0f,
                Mathf.Atan2(direction.x, direction.y) * Mathf.Rad2Deg,
                0f);
        }

        public void StopAction()
        {
            PlayMotion();
        }

        private void PlayMotion()
        {
            HabitHeroModelAnimationAction preferred = isMoving
                ? HabitHeroModelAnimationAction.Walk
                : HabitHeroModelAnimationAction.Idle;
            if (!PlayAction(preferred))
            {
                HabitHeroModelAnimationAction fallback = isMoving
                    ? HabitHeroModelAnimationAction.Idle
                    : HabitHeroModelAnimationAction.Walk;
                if (!PlayAction(fallback)) return;
                if (!isMoving) PauseAtWalkIdlePose();
            }
        }

        private void PauseAtWalkIdlePose()
        {
            if (activeSource == null || string.IsNullOrWhiteSpace(activeClipName)) return;
            AnimationState state = activeSource[activeClipName];
            if (state == null) return;
            float duration = Mathf.Max(0f, state.length);
            if (duration <= 0f) return;
            float lastSafeTime = Mathf.Max(0f, duration - 0.0001f);
            state.time = Mathf.Min(
                Mathf.Max(duration * WalkIdlePoseRatio, 0.033f),
                lastSafeTime);
            state.speed = 0f;
        }

        private void StopAllSources()
        {
            foreach (Animation source in animationSources)
            {
                if (source != null) source.Stop();
            }
        }

        private void StopOtherSources(Animation active)
        {
            foreach (Animation source in animationSources)
            {
                if (source != null && source != active) source.Stop();
            }
        }
    }
}
