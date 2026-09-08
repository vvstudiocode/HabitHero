using UnityEngine;

namespace HabitHero.Platform
{
    public static class HabitHeroWorldCameraMath
    {
        public static Vector3 GetOffset(
            float yaw,
            float pitch,
            float distance)
        {
            float horizontal = Mathf.Cos(pitch) * distance;
            return new Vector3(
                Mathf.Sin(yaw) * horizontal,
                Mathf.Sin(pitch) * distance + 0.16f,
                Mathf.Cos(yaw) * horizontal);
        }
    }
}
