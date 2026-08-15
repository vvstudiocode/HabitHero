"""Build a clean quadruped walking rig for the HabitHero character.

Run with Blender, using the already rigged character blend as the input file:
  blender -b Meshy_AI_Starlight_Rainbow_Kit_0726024804_rigged.blend \
    --python tools/create_walking_rig.py

The rig is intentionally in-place by default so it can be driven by a game
runtime. A second Walk_Forward action is included for quick Blender previews.
"""

import math
import os

import bpy
from mathutils import Vector


ROOT = "/Users/studio.vv/Desktop/HabitHero"
BLEND_OUTPUT = os.path.join(ROOT, "habit_hero_quadruped_walking_rig.blend")
GLB_OUTPUT = os.path.join(ROOT, "public/models/habit-hero-quadruped-walking-rig.glb")
FPS = 24
WALK_END = 49


def remove_old_rig(mesh):
    for modifier in list(mesh.modifiers):
        if modifier.type == "ARMATURE":
            mesh.modifiers.remove(modifier)

    for obj in list(bpy.data.objects):
        if obj.type == "ARMATURE":
            bpy.data.objects.remove(obj, do_unlink=True)

    for group in list(mesh.vertex_groups):
        mesh.vertex_groups.remove(group)

    mesh.parent = None
    mesh.parent_type = "OBJECT"

    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)

    # The source glTF contains a scene empty; keep the deliverable focused on
    # the character and its armature.
    for obj in list(bpy.data.objects):
        if obj != mesh:
            bpy.data.objects.remove(obj, do_unlink=True)


def bone(armature, name, head, tail, parent=None, deform=True):
    b = armature.edit_bones.new(name)
    b.head = head
    b.tail = tail
    b.use_deform = deform
    if parent:
        b.parent = armature.edit_bones[parent]
    return b


def build_skeleton(mesh):
    bounds = [Vector(v) for v in mesh.bound_box]
    mn = Vector((min(v.x for v in bounds), min(v.y for v in bounds), min(v.z for v in bounds)))
    mx = Vector((max(v.x for v in bounds), max(v.y for v in bounds), max(v.z for v in bounds)))
    center = (mn + mx) / 2.0
    width, depth, height = mx.x - mn.x, mx.y - mn.y, mx.z - mn.z

    data = bpy.data.armatures.new("HabitHero_Walking_Rig")
    rig = bpy.data.objects.new("HabitHero_Walking_Rig", data)
    bpy.context.collection.objects.link(rig)
    rig.matrix_world = mesh.matrix_world.copy()

    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    mesh.select_set(False)
    bpy.ops.object.mode_set(mode="EDIT")

    # The model faces -X (the tail extends toward +X). The landmarks follow
    # the visible shoulder/hip and paw volumes of the supplied cat character.
    z_floor = mn.z + height * 0.01
    z_paw = mn.z + height * 0.08
    z_hock = mn.z + height * 0.25
    z_knee = mn.z + height * 0.38
    z_hip = mn.z + height * 0.52
    z_chest = mn.z + height * 0.60
    z_neck = mn.z + height * 0.70
    z_head = mn.z + height * 0.74
    z_top = mx.z - height * 0.04
    side = depth * 0.23

    # Core: low and slightly arched, matching a natural quadruped silhouette.
    bone(data, "root", (center.x + width * 0.08, center.y, z_floor),
         (center.x + width * 0.08, center.y, z_floor + height * 0.10), deform=False)
    bone(data, "pelvis", (center.x + width * 0.20, center.y, z_hip - height * 0.07),
         (center.x + width * 0.08, center.y, z_chest - height * 0.06), "root")
    bone(data, "spine_01", (center.x + width * 0.08, center.y, z_chest - height * 0.08),
         (center.x - width * 0.08, center.y, z_chest), "pelvis")
    bone(data, "spine_02", (center.x - width * 0.08, center.y, z_chest),
         (center.x - width * 0.20, center.y, z_neck - height * 0.06), "spine_01")
    bone(data, "neck", (center.x - width * 0.20, center.y, z_neck - height * 0.06),
         (center.x - width * 0.31, center.y, z_neck + height * 0.03), "spine_02")
    bone(data, "head", (center.x - width * 0.31, center.y, z_head - height * 0.05),
         (center.x - width * 0.43, center.y, z_top), "neck")

    # Ears stay attached to the head and make the Octahedral skeleton easy to
    # read in the viewport.
    for label, y in (("L", center.y + depth * 0.12), ("R", center.y - depth * 0.12)):
        bone(data, f"ear.{label}", (center.x - width * 0.43, y, z_head + height * 0.02),
             (center.x - width * 0.47, y + (depth * 0.07 if label == "L" else -depth * 0.07), z_top + height * 0.06), "head")

    # Forelegs are under the head/shoulder, hind legs under the pelvis. Small
    # forward/back offsets create believable bent silhouettes at rest.
    for label, y in (("L", center.y + side), ("R", center.y - side)):
        bone(data, f"fore_upper.{label}", (center.x - width * 0.20, y, z_chest - height * 0.08),
             (center.x - width * 0.27, y, z_knee - height * 0.03), "spine_02")
        bone(data, f"fore_lower.{label}", (center.x - width * 0.27, y, z_knee - height * 0.03),
             (center.x - width * 0.22, y, z_hock), f"fore_upper.{label}")
        bone(data, f"fore_paw.{label}", (center.x - width * 0.22, y, z_hock),
             (center.x - width * 0.30, y, z_paw), f"fore_lower.{label}")

        bone(data, f"hind_upper.{label}", (center.x + width * 0.20, y, z_hip - height * 0.06),
             (center.x + width * 0.29, y, z_knee), "pelvis")
        bone(data, f"hind_lower.{label}", (center.x + width * 0.29, y, z_knee),
             (center.x + width * 0.18, y, z_hock), f"hind_upper.{label}")
        bone(data, f"hind_paw.{label}", (center.x + width * 0.18, y, z_hock),
             (center.x + width * 0.10, y, z_paw), f"hind_lower.{label}")

    # Tail starts at the rear (+X) and tapers into four easy-to-animate links.
    tail_start = center.x + width * 0.26
    for i in range(4):
        x0 = tail_start + width * (0.13 * i)
        x1 = tail_start + width * (0.13 * (i + 1))
        y0 = center.y + depth * (0.015 * (i % 2))
        y1 = center.y + depth * (0.035 * (-1 if i % 2 else 1))
        z0 = z_hip - height * (0.04 + i * 0.018)
        z1 = z0 - height * 0.018
        bone(data, f"tail_{i + 1:02d}", (x0, y0, z0), (x1, y1, z1),
             "pelvis" if i == 0 else f"tail_{i:02d}")

    bpy.ops.object.mode_set(mode="POSE")
    for pb in rig.pose.bones:
        pb.rotation_mode = "XYZ"
    bpy.ops.object.mode_set(mode="OBJECT")

    # Explicitly requested by the artist: readable, standard, slim bones.
    data.display_type = "OCTAHEDRAL"
    rig.show_in_front = True
    rig.display_type = "WIRE"
    rig["skeleton_display"] = "OCTAHEDRAL"
    rig["rig_type"] = "quadruped_walking"
    rig["walk_cycle_frames"] = WALK_END - 1
    rig["forward_axis"] = "-X"
    return rig


def distance_to_segment(point, head, tail):
    direction = tail - head
    denom = max(direction.length_squared, 1e-8)
    t = max(0.0, min(1.0, (point - head).dot(direction) / denom))
    closest = head + direction * t
    return (point - closest).length


def bind_mesh(mesh, rig):
    deform_bones = [b for b in rig.data.bones if b.use_deform]
    groups = {b.name: mesh.vertex_groups.new(name=b.name) for b in deform_bones}
    segments = []
    for b in deform_bones:
        segments.append((b.name, b.head_local.copy(), b.tail_local.copy()))

    for vertex in mesh.data.vertices:
        distances = sorted(
            (distance_to_segment(vertex.co, head, tail), name)
            for name, head, tail in segments
        )
        chosen = distances[:4]
        weights = [1.0 / max(distance, 0.018) ** 2 for distance, _ in chosen]
        total = sum(weights) or 1.0
        for weight, (_, name) in zip(weights, chosen):
            groups[name].add([vertex.index], weight / total, "REPLACE")

    modifier = mesh.modifiers.new(name="HabitHero_Armature", type="ARMATURE")
    modifier.object = rig
    mesh.parent = rig
    mesh.parent_type = "OBJECT"
    mesh.matrix_parent_inverse = rig.matrix_world.inverted()


def reset_pose(rig):
    for pb in rig.pose.bones:
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = (0.0, 0.0, 0.0)
        pb.location = (0.0, 0.0, 0.0)
        pb.scale = (1.0, 1.0, 1.0)


def key_all(rig, frame):
    for pb in rig.pose.bones:
        pb.keyframe_insert(data_path="rotation_euler", frame=frame)
        pb.keyframe_insert(data_path="location", frame=frame)


def prepare_action(rig, name, end):
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = action
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = end
    bpy.context.scene.render.fps = FPS
    reset_pose(rig)
    return action


def smooth_action(action):
    # Blender 5.2 stores F-curves inside layered Action channel bags. Keep a
    # legacy branch so this helper also works with older Blender LTS builds.
    curves = []
    if hasattr(action, "fcurves"):
        curves.extend(action.fcurves)
    else:
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    curves.extend(bag.fcurves)
    for curve in curves:
        for point in curve.keyframe_points:
            point.interpolation = "BEZIER"
            point.handle_left_type = "AUTO_CLAMPED"
            point.handle_right_type = "AUTO_CLAMPED"


def pose_walk(rig, frame, forward=False):
    t = (frame - 1) / float(WALK_END - 1)
    root = rig.pose.bones["root"]
    pelvis = rig.pose.bones["pelvis"]
    spine_01 = rig.pose.bones["spine_01"]
    spine_02 = rig.pose.bones["spine_02"]
    neck = rig.pose.bones["neck"]
    head = rig.pose.bones["head"]

    # Four-beat walk: rear-left, front-left, rear-right, front-right. This is
    # slower and more stable than a running diagonal gait for a small pet.
    phases = {
        "fore.L": 0.00,
        "hind.R": 0.25,
        "fore.R": 0.50,
        "hind.L": 0.75,
    }
    for side in ("L", "R"):
        for region in ("fore", "hind"):
            phase = (t + phases[f"{region}.{side}"]) % 1.0
            swing = math.sin(2.0 * math.pi * phase)
            lift = max(0.0, math.sin(2.0 * math.pi * phase)) ** 1.35
            upper = rig.pose.bones[f"{region}_upper.{side}"]
            lower = rig.pose.bones[f"{region}_lower.{side}"]
            paw = rig.pose.bones[f"{region}_paw.{side}"]
            amplitude = 0.34 if region == "fore" else 0.42
            upper.rotation_euler.y = amplitude * swing
            lower.rotation_euler.y = -amplitude * 0.72 * swing + 0.52 * lift
            paw.rotation_euler.y = -amplitude * 0.32 * swing - 0.24 * lift

    # Subtle body roll and vertical suspension, timed between foot contacts.
    root.location.z = 0.028 * (0.5 - 0.5 * math.cos(4.0 * math.pi * t))
    if forward:
        root.location.x = -0.62 * t
    pelvis.rotation_euler.y = 0.045 * math.sin(2.0 * math.pi * t + math.pi)
    pelvis.rotation_euler.z = 0.040 * math.sin(2.0 * math.pi * t)
    spine_01.rotation_euler.y = -0.035 * math.sin(2.0 * math.pi * t)
    spine_02.rotation_euler.y = 0.030 * math.sin(2.0 * math.pi * t + math.pi)
    neck.rotation_euler.y = 0.025 * math.sin(2.0 * math.pi * t)
    head.rotation_euler.y = -0.035 * math.sin(2.0 * math.pi * t + math.pi)
    head.rotation_euler.z = 0.022 * math.sin(2.0 * math.pi * t + math.pi / 2.0)

    # Tail counterbalances the hips and adds a soft follow-through.
    for i in range(1, 5):
        tail = rig.pose.bones[f"tail_{i:02d}"]
        tail.rotation_euler.z = (0.14 - i * 0.018) * math.sin(2.0 * math.pi * t + i * 0.32)
        tail.rotation_euler.y = 0.035 * math.sin(2.0 * math.pi * t + i * 0.22)

    for side, sign in (("L", 1.0), ("R", -1.0)):
        ear = rig.pose.bones[f"ear.{side}"]
        ear.rotation_euler.z = sign * 0.035 * math.sin(2.0 * math.pi * t + math.pi)


def make_walk(rig, name, forward=False):
    action = prepare_action(rig, name, WALK_END)
    for frame in range(1, WALK_END + 1, 4):
        pose_walk(rig, frame, forward=forward)
        key_all(rig, frame)
    # Always close the loop with the exact starting pose.
    pose_walk(rig, WALK_END, forward=forward)
    key_all(rig, WALK_END)
    smooth_action(action)
    return action


def make_idle(rig):
    action = prepare_action(rig, "Idle", 49)
    for frame in (1, 13, 25, 37, 49):
        t = (frame - 1) / 48.0
        chest = rig.pose.bones["spine_02"]
        head = rig.pose.bones["head"]
        tail = rig.pose.bones["tail_02"]
        chest.rotation_euler.y = 0.018 * math.sin(2.0 * math.pi * t)
        chest.rotation_euler.z = 0.012 * math.sin(2.0 * math.pi * t + math.pi / 2)
        head.rotation_euler.y = -0.018 * math.sin(2.0 * math.pi * t)
        tail.rotation_euler.z = 0.04 * math.sin(2.0 * math.pi * t + math.pi / 2)
        key_all(rig, frame)
    smooth_action(action)
    return action


def export_assets(mesh, rig):
    os.makedirs(os.path.dirname(GLB_OUTPUT), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUTPUT)
    bpy.ops.export_scene.gltf(
        filepath=GLB_OUTPUT,
        export_format="GLB",
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_skins=True,
        export_apply=False,
        export_yup=True,
        use_selection=True,
    )


def main():
    mesh = next((o for o in bpy.context.scene.objects if o.type == "MESH"), None)
    if mesh is None:
        raise RuntimeError("No mesh character found in the input blend")

    remove_old_rig(mesh)
    rig = build_skeleton(mesh)
    bind_mesh(mesh, rig)
    make_idle(rig)
    make_walk(rig, "Walk_InPlace", forward=False)
    make_walk(rig, "Walk_Forward", forward=True)

    rig.animation_data.action = bpy.data.actions["Walk_InPlace"]
    reset_pose(rig)
    pose_walk(rig, 1, forward=False)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = WALK_END
    bpy.context.scene.frame_set(1)
    export_assets(mesh, rig)
    print("HABITHERO_WALKING_RIG_DONE")
    print("BLEND", BLEND_OUTPUT)
    print("GLB", GLB_OUTPUT)
    print("DISPLAY", rig.data.display_type)
    print("BONES", len(rig.data.bones))
    print("ACTIONS", sorted(a.name for a in bpy.data.actions))


if __name__ == "__main__":
    main()
