using System;
using UnityEngine;
using UnityEngine.EventSystems;

namespace HabitHero.App
{
    public static class HabitHeroWorldJoystickMath
    {
        public static Vector2 GetValue(Vector2 localPosition, float radius)
        {
            float safeRadius = Mathf.Max(0f, radius);
            if (safeRadius <= 0f || localPosition.sqrMagnitude <= 0.000001f)
            {
                return Vector2.zero;
            }

            return Vector2.ClampMagnitude(localPosition / safeRadius, 1f);
        }
    }

    public sealed class HabitHeroWorldJoystickInput : MonoBehaviour,
        IPointerDownHandler,
        IPointerMoveHandler,
        IPointerUpHandler,
        IPointerExitHandler
    {
        private const int NoPointer = int.MinValue;
        private const float MinimumRadius = 1f;
        private int activePointerId = NoPointer;
        private RectTransform surface;
        private RectTransform knob;
        private Vector2 value;

        public Action<Vector2> Changed;

        public Vector2 Value
        {
            get { return value; }
        }

        public void SetKnob(RectTransform target)
        {
            knob = target;
            UpdateKnobPosition();
        }

        public void OnPointerDown(PointerEventData eventData)
        {
            if (eventData == null
                || activePointerId != NoPointer
                || (eventData.pointerId < 0
                    && eventData.button != PointerEventData.InputButton.Left))
            {
                return;
            }

            activePointerId = eventData.pointerId;
            UpdateFromPointer(eventData);
        }

        public void OnPointerMove(PointerEventData eventData)
        {
            if (eventData == null || eventData.pointerId != activePointerId) return;
            UpdateFromPointer(eventData);
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            if (eventData == null || eventData.pointerId != activePointerId) return;
            ResetPointer();
        }

        public void OnPointerExit(PointerEventData eventData)
        {
            if (eventData == null || eventData.pointerId != activePointerId) return;
            ResetPointer();
        }

        private void Awake()
        {
            surface = GetComponent<RectTransform>();
        }

        private void OnDisable()
        {
            ResetPointer();
        }

        private void UpdateFromPointer(PointerEventData eventData)
        {
            if (surface == null) surface = GetComponent<RectTransform>();
            if (surface == null) return;

            Vector2 localPosition;
            if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(
                    surface,
                    eventData.position,
                    eventData.pressEventCamera,
                    out localPosition))
            {
                return;
            }

            float radius = Mathf.Max(
                MinimumRadius,
                Mathf.Min(surface.rect.width, surface.rect.height) * 0.5f);
            Vector2 next = HabitHeroWorldJoystickMath.GetValue(localPosition, radius);
            if (Vector2.Distance(value, next) <= 0.0001f) return;
            value = next;
            UpdateKnobPosition();
            if (Changed != null) Changed(value);
        }

        private void ResetPointer()
        {
            bool changed = value.sqrMagnitude > 0.000001f;
            activePointerId = NoPointer;
            value = Vector2.zero;
            UpdateKnobPosition();
            if (changed && Changed != null) Changed(value);
        }

        private void UpdateKnobPosition()
        {
            if (knob == null || surface == null) return;
            float radius = Mathf.Max(
                MinimumRadius,
                Mathf.Min(surface.rect.width, surface.rect.height) * 0.5f);
            knob.anchoredPosition = value * radius * 0.62f;
        }
    }
}
