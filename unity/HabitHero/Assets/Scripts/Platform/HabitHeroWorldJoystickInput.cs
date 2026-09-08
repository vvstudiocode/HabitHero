using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

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
        IBeginDragHandler,
        IDragHandler,
        IEndDragHandler
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

        public static HabitHeroWorldJoystickInput Create(
            Transform parent,
            Color surfaceColor,
            Color knobColor)
        {
            GameObject joystickObject = new GameObject(
                "WorldMovementJoystick",
                typeof(RectTransform),
                typeof(Image),
                typeof(HabitHeroWorldJoystickInput));
            joystickObject.transform.SetParent(parent, false);
            RectTransform joystickRect = joystickObject.GetComponent<RectTransform>();
            joystickRect.anchorMin = new Vector2(0.04f, 0.06f);
            joystickRect.anchorMax = new Vector2(0.96f, 0.94f);
            joystickRect.offsetMin = Vector2.zero;
            joystickRect.offsetMax = Vector2.zero;
            Image surface = joystickObject.GetComponent<Image>();
            surface.color = surfaceColor;

            GameObject knobObject = new GameObject(
                "Knob",
                typeof(RectTransform),
                typeof(Image));
            knobObject.transform.SetParent(joystickObject.transform, false);
            RectTransform knobRect = knobObject.GetComponent<RectTransform>();
            knobRect.anchorMin = new Vector2(0.5f, 0.5f);
            knobRect.anchorMax = new Vector2(0.5f, 0.5f);
            knobRect.sizeDelta = new Vector2(46f, 46f);
            knobRect.anchoredPosition = Vector2.zero;
            Image knob = knobObject.GetComponent<Image>();
            knob.color = knobColor;
            knob.raycastTarget = false;

            HabitHeroWorldJoystickInput input =
                joystickObject.GetComponent<HabitHeroWorldJoystickInput>();
            input.SetKnob(knobRect);
            return input;
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

        public void OnBeginDrag(PointerEventData eventData)
        {
            if (eventData == null) return;
            if (activePointerId == NoPointer)
            {
                activePointerId = eventData.pointerId;
            }

            if (eventData.pointerId == activePointerId)
            {
                UpdateFromPointer(eventData);
            }
        }

        public void OnDrag(PointerEventData eventData)
        {
            if (eventData == null || eventData.pointerId != activePointerId) return;
            UpdateFromPointer(eventData);
        }

        public void OnEndDrag(PointerEventData eventData)
        {
            if (eventData == null || eventData.pointerId != activePointerId) return;
            ResetPointer();
        }

        public void OnPointerUp(PointerEventData eventData)
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
