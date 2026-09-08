using HabitHero.Platform;
using NUnit.Framework;
using UnityEngine;

namespace HabitHero.Tests
{
    public sealed class HabitHeroWorldPlacementTests
    {
        [Test]
        public void CreateDraftStartsInFrontOfCharacterInsideTheWorld()
        {
            HabitHeroWorldPlacementDraft draft = HabitHeroWorldPlacement.CreateDraft(
                new Vector2(0f, 0f),
                0f,
                1.8f,
                1.8f,
                0.75f,
                1.25f,
                5f);

            Assert.That(draft.X, Is.EqualTo(0f).Within(0.0001f));
            Assert.That(draft.Z, Is.EqualTo(-1.8f).Within(0.0001f));
            Assert.That(draft.Scale, Is.EqualTo(1.25f).Within(0.0001f));
        }

        [Test]
        public void ControlsRotateAndClampScaleToCatalogBounds()
        {
            HabitHeroWorldPlacementDraft draft = new HabitHeroWorldPlacementDraft
            {
                X = 1f,
                Z = -1f,
                RotationY = 0f,
                Scale = 1f,
            };

            draft = HabitHeroWorldPlacement.ApplyControl(
                draft,
                HabitHeroWorldPlacementControl.RotateRight,
                0.75f,
                1.25f);
            draft = HabitHeroWorldPlacement.ApplyControl(
                draft,
                HabitHeroWorldPlacementControl.ScaleUp,
                0.75f,
                1.25f);
            draft = HabitHeroWorldPlacement.ApplyControl(
                draft,
                HabitHeroWorldPlacementControl.ScaleUp,
                0.75f,
                1.25f);

            Assert.That(draft.RotationY, Is.EqualTo(Mathf.PI / 8f).Within(0.0001f));
            Assert.That(draft.Scale, Is.EqualTo(1.25f).Within(0.0001f));
        }

        [Test]
        public void RotationWrapsToCanonicalRadians()
        {
            float normalized = HabitHeroWorldPlacement.NormalizeRotationY(
                Mathf.PI * 3.25f);

            Assert.That(normalized, Is.EqualTo(-Mathf.PI * 0.75f).Within(0.0001f));
        }

        [Test]
        public void ClampDraftKeepsScaledDecorationFootprintInsideBoundary()
        {
            HabitHeroWorldPlacementDraft draft = new HabitHeroWorldPlacementDraft
            {
                X = 4.9f,
                Z = -4.9f,
                RotationY = 0f,
                Scale = 1.5f,
            };

            HabitHeroWorldPlacementDraft clamped = HabitHeroWorldPlacement.ClampToWorld(
                draft,
                0.8f,
                5f);

            Assert.That(clamped.X, Is.EqualTo(3.8f).Within(0.0001f));
            Assert.That(clamped.Z, Is.EqualTo(-3.8f).Within(0.0001f));
        }

        [Test]
        public void TransformIsGroundedAndPreservesPlacementRotation()
        {
            HabitHeroWorldPlacementDraft draft = new HabitHeroWorldPlacementDraft
            {
                X = 1.2f,
                Z = -2.4f,
                RotationY = Mathf.PI / 4f,
                Scale = 1.1f,
            };

            SupabaseFriendWorldTransform transform =
                HabitHeroWorldPlacement.ToTransform(draft);

            Assert.That(transform.x, Is.EqualTo(1.2f).Within(0.0001f));
            Assert.That(transform.y, Is.EqualTo(0f).Within(0.0001f));
            Assert.That(transform.z, Is.EqualTo(-2.4f).Within(0.0001f));
            Assert.That(transform.rotationX, Is.EqualTo(0f).Within(0.0001f));
            Assert.That(transform.rotationY, Is.EqualTo(Mathf.PI / 4f).Within(0.0001f));
            Assert.That(transform.rotationZ, Is.EqualTo(0f).Within(0.0001f));
            Assert.That(transform.scale, Is.EqualTo(1.1f).Within(0.0001f));
        }
    }
}
