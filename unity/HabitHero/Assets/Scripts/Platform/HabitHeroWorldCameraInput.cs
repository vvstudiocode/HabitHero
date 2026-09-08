using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;

namespace HabitHero.App
{
    public sealed class HabitHeroWorldCameraInput : MonoBehaviour,
        IPointerDownHandler,
        IPointerMoveHandler,
        IPointerUpHandler,
        IScrollHandler
    {
        private const float ScrollZoomScale = 32f;
        private const float TapDistance = 18f;
        private const float TapDuration = 0.35f;
        private readonly Dictionary<int, Vector2> pointers =
            new Dictionary<int, Vector2>();
        private readonly Dictionary<int, Vector2> pointerDownPositions =
            new Dictionary<int, Vector2>();
        private readonly Dictionary<int, float> pointerDownTimes =
            new Dictionary<int, float>();

        public Action<Vector2> Dragged;
        public Action<float> Zoomed;
        public Action<Vector2> Tapped;

        public void OnPointerDown(PointerEventData eventData)
        {
            if (eventData == null) return;
            if (eventData.pointerId < 0
                && eventData.button != PointerEventData.InputButton.Left) return;
            pointers[eventData.pointerId] = eventData.position;
            pointerDownPositions[eventData.pointerId] = eventData.position;
            pointerDownTimes[eventData.pointerId] = Time.unscaledTime;
        }

        public void OnPointerMove(PointerEventData eventData)
        {
            if (eventData == null
                || !pointers.ContainsKey(eventData.pointerId)) return;

            Vector2 previousPoint = pointers[eventData.pointerId];
            float previousDistance = GetPointerDistance();
            pointers[eventData.pointerId] = eventData.position;

            if (pointers.Count == 1)
            {
                Dragged?.Invoke(eventData.position - previousPoint);
                return;
            }

            if (pointers.Count >= 2)
            {
                float currentDistance = GetPointerDistance();
                Zoomed?.Invoke(currentDistance - previousDistance);
            }
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            if (eventData == null) return;
            bool isTap = false;
            Vector2 downPosition;
            float downTime;
            if (pointers.Count == 1
                && pointerDownPositions.TryGetValue(eventData.pointerId, out downPosition)
                && pointerDownTimes.TryGetValue(eventData.pointerId, out downTime))
            {
                isTap = Vector2.Distance(downPosition, eventData.position) <= TapDistance
                    && Time.unscaledTime - downTime <= TapDuration;
            }

            pointers.Remove(eventData.pointerId);
            pointerDownPositions.Remove(eventData.pointerId);
            pointerDownTimes.Remove(eventData.pointerId);
            if (isTap) Tapped?.Invoke(eventData.position);
        }

        public void OnScroll(PointerEventData eventData)
        {
            if (eventData == null) return;
            Zoomed?.Invoke(eventData.scrollDelta.y * ScrollZoomScale);
        }

        private float GetPointerDistance()
        {
            if (pointers.Count < 2) return 0f;
            using (Dictionary<int, Vector2>.Enumerator enumerator = pointers.GetEnumerator())
            {
                enumerator.MoveNext();
                Vector2 first = enumerator.Current.Value;
                enumerator.MoveNext();
                Vector2 second = enumerator.Current.Value;
                return Vector2.Distance(first, second);
            }
        }

        private void OnDisable()
        {
            pointers.Clear();
            pointerDownPositions.Clear();
            pointerDownTimes.Clear();
        }
    }
}
