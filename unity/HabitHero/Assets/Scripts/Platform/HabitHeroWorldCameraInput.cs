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
        private readonly Dictionary<int, Vector2> pointers =
            new Dictionary<int, Vector2>();

        public Action<Vector2> Dragged;
        public Action<float> Zoomed;

        public void OnPointerDown(PointerEventData eventData)
        {
            if (eventData == null) return;
            if (eventData.pointerId < 0
                && eventData.button != PointerEventData.InputButton.Left) return;
            pointers[eventData.pointerId] = eventData.position;
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
            pointers.Remove(eventData.pointerId);
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
        }
    }
}
