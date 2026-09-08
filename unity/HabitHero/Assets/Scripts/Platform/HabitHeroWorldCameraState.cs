using UnityEngine;

namespace HabitHero.Platform
{
    public sealed class HabitHeroWorldCameraState
    {
        public const float CameraDistanceDefault = 4.1f;
        public const float CameraDistanceMin = 1.45f;
        public const float CameraDistanceMax = 6.5f;
        public const float CameraPitchMin = 0.12f;
        public const float CameraPitchMax = Mathf.PI * (89f / 180f);
        public const float InitialCameraYaw = Mathf.PI / 2f;
        public const float InitialCameraPitch = 0.18f;

        public float Yaw { get; private set; }
        public float Pitch { get; private set; }
        public float Distance { get; private set; }

        public HabitHeroWorldCameraState()
        {
            Reset();
        }

        public void Reset()
        {
            Yaw = InitialCameraYaw;
            Pitch = InitialCameraPitch;
            Distance = CameraDistanceDefault;
        }

        public void ApplyDrag(Vector2 delta)
        {
            if (!IsFinite(delta.x) || !IsFinite(delta.y)) return;
            Yaw -= delta.x * 0.008f;
            Pitch = Mathf.Clamp(
                Pitch + delta.y * 0.006f,
                CameraPitchMin,
                CameraPitchMax);
        }

        public void ApplyZoomDelta(float zoomDelta)
        {
            if (!IsFinite(zoomDelta)) return;
            Distance = Mathf.Clamp(
                Distance - zoomDelta * 0.012f,
                CameraDistanceMin,
                CameraDistanceMax);
        }

        public float GetTargetHeight()
        {
            float zoomProgress = Mathf.Clamp01(
                (CameraDistanceDefault - Distance)
                / (CameraDistanceDefault - CameraDistanceMin));
            float normalHeight = Mathf.Lerp(0.38f, 0.5f, zoomProgress);
            float groundingStart = Mathf.PI / 3f;
            float groundingRange = Mathf.Max(
                CameraPitchMax - groundingStart,
                Mathf.Epsilon);
            float groundingProgress = Mathf.Clamp01(
                (Pitch - groundingStart) / groundingRange);
            return Mathf.Lerp(normalHeight, 0.04f, groundingProgress);
        }

        private static bool IsFinite(float value)
        {
            return !float.IsNaN(value) && !float.IsInfinity(value);
        }
    }
}
