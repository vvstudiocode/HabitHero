using UnityEngine;

namespace HabitHero.Platform
{
    public enum HabitHeroWorldPlacementControl
    {
        RotateLeft,
        RotateRight,
        ScaleDown,
        ScaleUp,
    }

    public struct HabitHeroWorldPlacementDraft
    {
        public float X;
        public float Z;
        public float RotationY;
        public float Scale;
    }

    public static class HabitHeroWorldPlacement
    {
        private const float RotationStepRadians = 0.3926991f;
        private const float ScaleStep = 0.1f;
        private const float MinimumScale = 0.1f;
        private const float MaximumScale = 3f;

        public static HabitHeroWorldPlacementDraft CreateDraft(
            Vector2 characterPosition,
            float cameraYaw,
            float distance,
            float defaultScale,
            float minScale,
            float maxScale,
            float boundary)
        {
            float safeYaw = IsFinite(cameraYaw) ? cameraYaw : 0f;
            float safeDistance = IsFinite(distance) ? Mathf.Max(0.5f, distance) : 1.8f;
            HabitHeroWorldPlacementDraft draft = new HabitHeroWorldPlacementDraft
            {
                X = characterPosition.x - Mathf.Sin(safeYaw) * safeDistance,
                Z = characterPosition.y - Mathf.Cos(safeYaw) * safeDistance,
                RotationY = 0f,
                Scale = ClampScale(defaultScale, minScale, maxScale),
            };
            return ClampToWorld(draft, 0f, boundary);
        }

        public static bool TryGetGroundPosition(
            Ray ray,
            float groundY,
            out Vector2 position)
        {
            position = Vector2.zero;
            if (!IsFinite(ray.origin.x)
                || !IsFinite(ray.origin.y)
                || !IsFinite(ray.origin.z)
                || !IsFinite(ray.direction.x)
                || !IsFinite(ray.direction.y)
                || !IsFinite(ray.direction.z)
                || !IsFinite(groundY)
                || Mathf.Abs(ray.direction.y) <= 0.0001f)
            {
                return false;
            }

            float distance = (groundY - ray.origin.y) / ray.direction.y;
            if (!IsFinite(distance) || distance < 0f) return false;

            Vector3 hit = ray.GetPoint(distance);
            if (!IsFinite(hit.x) || !IsFinite(hit.z)) return false;
            position = new Vector2(hit.x, hit.z);
            return true;
        }

        public static HabitHeroWorldPlacementDraft ApplyControl(
            HabitHeroWorldPlacementDraft draft,
            HabitHeroWorldPlacementControl control,
            float minScale,
            float maxScale)
        {
            switch (control)
            {
                case HabitHeroWorldPlacementControl.RotateLeft:
                    draft.RotationY = NormalizeRotationY(
                        draft.RotationY - RotationStepRadians);
                    break;
                case HabitHeroWorldPlacementControl.RotateRight:
                    draft.RotationY = NormalizeRotationY(
                        draft.RotationY + RotationStepRadians);
                    break;
                case HabitHeroWorldPlacementControl.ScaleDown:
                    draft.Scale = ClampScale(
                        draft.Scale - ScaleStep,
                        minScale,
                        maxScale);
                    break;
                case HabitHeroWorldPlacementControl.ScaleUp:
                    draft.Scale = ClampScale(
                        draft.Scale + ScaleStep,
                        minScale,
                        maxScale);
                    break;
            }

            return draft;
        }

        public static float NormalizeRotationY(float rotationY)
        {
            if (!IsFinite(rotationY)) return 0f;
            if (rotationY >= -Mathf.PI && rotationY <= Mathf.PI) return rotationY;

            float fullTurn = Mathf.PI * 2f;
            float wrapped = rotationY - fullTurn * Mathf.Floor(
                (rotationY + Mathf.PI) / fullTurn);
            return wrapped > Mathf.PI ? wrapped - fullTurn : wrapped;
        }

        public static HabitHeroWorldPlacementDraft ClampToWorld(
            HabitHeroWorldPlacementDraft draft,
            float collisionRadius,
            float boundary)
        {
            float safeScale = Mathf.Clamp(
                IsFinite(draft.Scale) ? draft.Scale : 1f,
                MinimumScale,
                MaximumScale);
            float safeRadius = IsFinite(collisionRadius)
                ? Mathf.Max(0f, collisionRadius)
                : 0f;
            float footprint = Mathf.Max(0.05f, safeRadius * safeScale);
            float safeBoundary = Mathf.Max(
                footprint,
                IsFinite(boundary) ? Mathf.Abs(boundary) : footprint);

            draft.X = Mathf.Clamp(
                IsFinite(draft.X) ? draft.X : 0f,
                -safeBoundary + footprint,
                safeBoundary - footprint);
            draft.Z = Mathf.Clamp(
                IsFinite(draft.Z) ? draft.Z : 0f,
                -safeBoundary + footprint,
                safeBoundary - footprint);
            draft.RotationY = NormalizeRotationY(draft.RotationY);
            draft.Scale = safeScale;
            return draft;
        }

        public static SupabaseFriendWorldTransform ToTransform(
            HabitHeroWorldPlacementDraft draft)
        {
            return new SupabaseFriendWorldTransform
            {
                x = draft.X,
                y = 0f,
                z = draft.Z,
                rotationX = 0f,
                rotationY = NormalizeRotationY(draft.RotationY),
                rotationZ = 0f,
                scale = Mathf.Clamp(
                    IsFinite(draft.Scale) ? draft.Scale : 1f,
                    MinimumScale,
                    MaximumScale),
            };
        }

        private static float ClampScale(float value, float minScale, float maxScale)
        {
            float minimum = Mathf.Clamp(
                IsFinite(minScale) ? minScale : MinimumScale,
                MinimumScale,
                MaximumScale);
            float maximum = Mathf.Clamp(
                IsFinite(maxScale) ? maxScale : MaximumScale,
                minimum,
                MaximumScale);
            float safeValue = IsFinite(value) ? value : 1f;
            return Mathf.Clamp(
                Mathf.Round(safeValue * 100f) / 100f,
                minimum,
                maximum);
        }

        private static bool IsFinite(float value)
        {
            return !float.IsNaN(value) && !float.IsInfinity(value);
        }
    }
}
