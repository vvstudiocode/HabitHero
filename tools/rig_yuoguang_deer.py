"""Rig 瑤光鹿.glb with a lightweight quadruped walking skeleton.

Run with Blender 5.x:
  blender --background --python tools/rig_yuoguang_deer.py

The source asset is a single Z-up mesh whose head points toward -Y.  The
deliverables are written beside the source GLB in Downloads:
  瑤光鹿_四足走路骨架.blend  - editable Blender rig, Octahedral display
  瑤光鹿_四足走路骨架.glb    - skinned GLB with Idle and Walk_InPlace actions
"""

import math
import os

import bpy
from mathutils import Vector


SOURCE = "/Users/studio.vv/Downloads/瑤光鹿.glb"
BLEND_OUTPUT = "/Users/studio.vv/Downloads/瑤光鹿_四足走路骨架.blend"
GLB_OUTPUT = "/Users/studio.vv/Downloads/瑤光鹿_四足走路骨架.glb"
FPS = 24
WALK_START = 1
WALK_END = 49
FORWARD_WALK_END = 97


def add_bone(armature, name, head, tail, parent=None, deform=True):
    bone = armature.edit_bones.new(name)
    bone.head = Vector(head)
    bone.tail = Vector(tail)
    bone.use_deform = deform
    if parent:
        bone.parent = armature.edit_bones[parent]
    return bone


def build_skeleton(mesh):
    """Create a readable, standard Octahedral quadruped armature."""
    bounds = [mesh.matrix_world @ Vector(corner) for corner in mesh.bound_box]
    mn = Vector((min(v.x for v in bounds), min(v.y for v in bounds), min(v.z for v in bounds)))
    mx = Vector((max(v.x for v in bounds), max(v.y for v in bounds), max(v.z for v in bounds)))

    armature_data = bpy.data.armatures.new("YaoguangDeer_Walking_Skeleton")
    rig = bpy.data.objects.new("YaoguangDeer_Walking_Skeleton", armature_data)
    bpy.context.collection.objects.link(rig)
    rig.matrix_world = mesh.matrix_world.copy()

    # The deer is Z-up and faces -Y.  These landmarks follow the visible
    # shoulder, hip, joint and hoof volumes of the supplied mesh.
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    mesh.select_set(False)
    bpy.ops.object.mode_set(mode="EDIT")

    x_side = 0.205
    add_bone(armature_data, "root", (0.0, 0.05, -0.90), (0.0, 0.05, -0.62), deform=False)
    add_bone(armature_data, "pelvis", (0.0, 0.37, 0.06), (0.0, 0.08, 0.18), "root")
    add_bone(armature_data, "spine_01", (0.0, 0.08, 0.18), (0.0, -0.16, 0.24), "pelvis")
    add_bone(armature_data, "spine_02", (0.0, -0.16, 0.24), (0.0, -0.34, 0.30), "spine_01")
    add_bone(armature_data, "neck", (0.0, -0.34, 0.30), (0.0, -0.52, 0.54), "spine_02")
    add_bone(armature_data, "head", (0.0, -0.52, 0.54), (0.0, -0.76, 0.46), "neck")

    # Ears follow the head.  They are deform bones so their small movement is
    # preserved when the GLB is posed in Blender or a runtime.
    for side, sign in (("L", 1.0), ("R", -1.0)):
        x = sign * x_side * 0.72
        add_bone(armature_data, f"ear.{side}", (x, -0.50, 0.62),
                 (x * 1.45, -0.52, 0.82), "head")

    # Four legs: upper, lower and hoof segments.  L is +X, R is -X.
    for side, sign in (("L", 1.0), ("R", -1.0)):
        x = sign * x_side

        add_bone(armature_data, f"front_upper.{side}", (x, -0.34, -0.10),
                 (x * 1.02, -0.39, -0.34), "spine_02")
        add_bone(armature_data, f"front_lower.{side}", (x * 1.02, -0.39, -0.34),
                 (x * 0.98, -0.42, -0.82), f"front_upper.{side}")
        add_bone(armature_data, f"front_hoof.{side}", (x * 0.98, -0.42, -0.82),
                 (x * 0.98, -0.51, -0.97), f"front_lower.{side}")

        add_bone(armature_data, f"hind_upper.{side}", (x, 0.34, -0.15),
                 (x * 1.02, 0.50, -0.35), "pelvis")
        add_bone(armature_data, f"hind_lower.{side}", (x * 1.02, 0.50, -0.30),
                 (x * 0.96, 0.66, -0.64), f"hind_upper.{side}")
        add_bone(armature_data, f"hind_hoof.{side}", (x * 0.96, 0.66, -0.64),
                 (x * 0.86, 0.57, -0.97), f"hind_lower.{side}")

    # A short tail chain gives the body a natural counter-swing while walking.
    add_bone(armature_data, "tail_01", (0.0, 0.37, 0.10), (0.0, 0.58, 0.08), "pelvis")
    add_bone(armature_data, "tail_02", (0.0, 0.58, 0.08), (0.0, 0.73, 0.02), "tail_01")
    add_bone(armature_data, "tail_03", (0.0, 0.73, 0.02), (0.0, 0.85, -0.03), "tail_02")

    bpy.ops.object.mode_set(mode="POSE")
    for pose_bone in rig.pose.bones:
        pose_bone.rotation_mode = "XYZ"
    bpy.ops.object.mode_set(mode="OBJECT")

    # Explicit artist-facing display choice: readable standard bones, slim
    # enough to see the mesh and joints clearly in the viewport.
    armature_data.display_type = "OCTAHEDRAL"
    rig.display_type = "WIRE"
    rig.show_in_front = True
    rig["skeleton_display"] = "OCTAHEDRAL"
    rig["rig_type"] = "quadruped_deer"
    rig["forward_axis"] = "-Y"
    rig["walk_cycle_frames"] = WALK_END - WALK_START
    rig["left_side"] = "+X"
    return rig


def point_segment_distance(point, head, tail):
    direction = tail - head
    denominator = max(direction.length_squared, 1e-10)
    factor = max(0.0, min(1.0, (point - head).dot(direction) / denominator))
    return (point - (head + factor * direction)).length


def bind_mesh(mesh, rig):
    """Bind with component-aware smooth nearest-segment influences.

    The source model is one GLB mesh made from many disconnected surface
    pieces.  A global nearest-bone pass lets a leg bone steal weights from the
    belly and causes visible seams during a walk.  Classifying each connected
    piece first keeps torso, head, tail and limb pieces on their anatomical
    chain while still blending at each joint.
    """
    deform_bones = [bone for bone in rig.data.bones if bone.use_deform]
    groups = {bone.name: mesh.vertex_groups.new(name=bone.name) for bone in deform_bones}
    segments = [(bone.name, bone.head_local.copy(), bone.tail_local.copy()) for bone in deform_bones]
    mesh_to_rig = rig.matrix_world.inverted() @ mesh.matrix_world

    # Find connected surface pieces from the imported mesh topology.  Keeping
    # the component lists also makes it possible to classify all vertices of a
    # strap, hoof or antler branch consistently.
    adjacency = [[] for _ in mesh.data.vertices]
    for edge in mesh.data.edges:
        a, b = edge.vertices
        adjacency[a].append(b)
        adjacency[b].append(a)

    unseen = set(range(len(mesh.data.vertices)))
    components = []
    while unseen:
        seed = unseen.pop()
        stack = [seed]
        component = [seed]
        while stack:
            index = stack.pop()
            for neighbor in adjacency[index]:
                if neighbor in unseen:
                    unseen.remove(neighbor)
                    stack.append(neighbor)
                    component.append(neighbor)
        components.append(component)

    def bounds_for(component):
        points = [mesh_to_rig @ mesh.data.vertices[index].co for index in component]
        xs = [point.x for point in points]
        ys = [point.y for point in points]
        zs = [point.z for point in points]
        return (
            min(xs), max(xs), min(ys), max(ys), min(zs), max(zs),
            sum(xs) / len(xs), sum(ys) / len(ys), sum(zs) / len(zs),
        )

    def classify(component, bounds):
        min_x, max_x, min_y, max_y, min_z, max_z, center_x, center_y, center_z = bounds
        span_y = max_y - min_y
        span_z = max_z - min_z
        size = len(component)

        # Large, long pieces are the two torso sides and belly.  Keep them on
        # the central chain even when their lower contour reaches the legs.
        if size >= 5000 or span_y >= 0.80:
            return "body"
        if max_z > 0.34 and min_y < -0.30:
            return "head"
        if center_y > 0.42 and max_z < 0.25 and span_z < 0.45:
            return "tail"
        if min_z < -0.50 and max_z < 0.08 and center_y < -0.18:
            return "front"
        if min_z < -0.50 and max_z < 0.08 and center_y > 0.18:
            return "hind"
        if min_z < -0.15 and max_z < 0.0 and center_y < -0.18 and size < 5000:
            return "front"
        if min_z < -0.15 and max_z < 0.0 and center_y > 0.18 and size < 5000:
            return "hind"
        return "body"

    allowed = {
        "body": ["pelvis", "spine_01", "spine_02", "neck", "head"],
        "head": ["neck", "head", "ear.L", "ear.R"],
        "tail": ["pelvis", "tail_01", "tail_02", "tail_03"],
    }
    classified = {"body": 0, "head": 0, "tail": 0, "front": 0, "hind": 0}

    for component in components:
        bounds = bounds_for(component)
        region = classify(component, bounds)
        classified[region] += 1
        center_x = bounds[6]
        if region in ("front", "hind") and abs(center_x) < 0.055:
            original_region = region
            region = "body"
            classified["body"] += 1
            classified[original_region] -= 1

        if region in ("front", "hind"):
            side = "L" if center_x >= 0.0 else "R"
            prefix = "front" if region == "front" else "hind"
            proximal = "spine_02" if region == "front" else "pelvis"
            candidate_names = [
                f"{prefix}_upper.{side}",
                f"{prefix}_lower.{side}",
                f"{prefix}_hoof.{side}",
                proximal,
                "spine_01",
                "spine_02",
                "neck",
            ]
        else:
            candidate_names = allowed[region]

        for index in component:
            point = mesh_to_rig @ mesh.data.vertices[index].co
            vertex_candidates = candidate_names
            candidate_segments = [
                (name, head, tail)
                for name, head, tail in segments
                if name in vertex_candidates
            ]
            ranked = sorted(
                (point_segment_distance(point, head, tail), name)
                for name, head, tail in candidate_segments
            )[:4]
            # The epsilon prevents a zero-distance vertex from starving the
            # neighbouring joint during normalization.
            weights = [1.0 / max(distance, 0.012) ** 2 for distance, _ in ranked]
            total = sum(weights) or 1.0
            for weight, (_, name) in zip(weights, ranked):
                groups[name].add([index], weight / total, "REPLACE")

    print("COMPONENT_REGIONS", classified)
    modifier = mesh.modifiers.new(name="YaoguangDeer_Armature", type="ARMATURE")
    modifier.object = rig
    mesh.parent = rig
    mesh.parent_type = "OBJECT"
    mesh.matrix_parent_inverse = rig.matrix_world.inverted()


def bind_mesh_auto(mesh, rig):
    """Use Blender's Bone Heat solver for an experimental weight pass."""
    bpy.ops.object.mode_set(mode="OBJECT") if bpy.context.object and bpy.context.object.mode != "OBJECT" else None
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")


def reset_pose(rig):
    for pose_bone in rig.pose.bones:
        pose_bone.rotation_mode = "XYZ"
        pose_bone.rotation_euler = (0.0, 0.0, 0.0)
        pose_bone.location = (0.0, 0.0, 0.0)
        pose_bone.scale = (1.0, 1.0, 1.0)


def key_pose(rig, frame):
    for pose_bone in rig.pose.bones:
        pose_bone.keyframe_insert(data_path="rotation_euler", frame=frame)
        pose_bone.keyframe_insert(data_path="location", frame=frame)


def smooth_action(action):
    curves = []
    if hasattr(action, "fcurves"):
        curves.extend(action.fcurves)
    else:
        for layer in action.layers:
            for strip in layer.strips:
                for channel_bag in strip.channelbags:
                    curves.extend(channel_bag.fcurves)
    for curve in curves:
        for point in curve.keyframe_points:
            point.interpolation = "BEZIER"
            point.handle_left_type = "AUTO_CLAMPED"
            point.handle_right_type = "AUTO_CLAMPED"


def new_action(rig, name, end):
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = action
    bpy.context.scene.frame_start = WALK_START
    bpy.context.scene.frame_end = end
    bpy.context.scene.render.fps = FPS
    reset_pose(rig)
    return action


def walk_pose(rig, frame, end=WALK_END, forward=False):
    # One gait cycle is 48 frames.  Walk_Forward contains two cycles so the
    # deer can visibly travel forward before the action ends; Walk_InPlace is
    # one loop for runtime playback.
    elapsed = (frame - WALK_START) / 48.0
    phase_t = elapsed % 1.0

    # Diagonal gait: front.L + hind.R, then front.R + hind.L.  The second pair
    # is deliberately the opposite diagonal (not the same-side hind leg), so
    # the four feet visibly alternate in a stable quadruped walk.
    phases = {
        "front.L": 0.00,
        "hind.R": 0.00,
        "front.R": 0.50,
        "hind.L": 0.50,
    }
    for side in ("L", "R"):
        for region in ("front", "hind"):
            phase = (phase_t + phases[f"{region}.{side}"]) % 1.0
            swing = math.sin(2.0 * math.pi * phase)
            lift = max(0.0, math.sin(2.0 * math.pi * phase)) ** 1.5
            upper = rig.pose.bones[f"{region}_upper.{side}"]
            lower = rig.pose.bones[f"{region}_lower.{side}"]
            hoof = rig.pose.bones[f"{region}_hoof.{side}"]

            # Deliberately readable stride: the previous 0.10/0.13 rad swing
            # was technically animated but looked like idle shifting.  These
            # values give the paired diagonal feet a clear lift and recovery.
            amplitude = 0.26 if region == "front" else 0.34
            upper.rotation_euler.x = amplitude * swing
            lower.rotation_euler.x = -0.42 * amplitude * swing + 0.22 * lift
            hoof.rotation_euler.x = -0.20 * amplitude * swing - 0.14 * lift

    root = rig.pose.bones["root"]
    pelvis = rig.pose.bones["pelvis"]
    spine_01 = rig.pose.bones["spine_01"]
    spine_02 = rig.pose.bones["spine_02"]
    neck = rig.pose.bones["neck"]
    head = rig.pose.bones["head"]

    # Important: this root bone is rotated 90 degrees relative to the object
    # axes.  Its local Y points upward in world space, while its local Z points
    # toward the deer's forward direction (-Y world).  Writing travel into
    # root.location.y makes the GLB fall downward; keep bob on local Y and put
    # horizontal travel on positive local Z.
    root.location.y = 0.004 * (0.5 - 0.5 * math.cos(4.0 * math.pi * phase_t))
    root.location.z = 0.72 * elapsed if forward else 0.0
    pelvis.rotation_euler.x = 0.0
    pelvis.rotation_euler.z = 0.0
    spine_01.rotation_euler.x = 0.0
    spine_02.rotation_euler.x = 0.0
    neck.rotation_euler.x = 0.0
    head.rotation_euler.x = 0.0

    for index in range(1, 4):
        tail = rig.pose.bones[f"tail_{index:02d}"]
        tail.rotation_euler.z = (0.09 - 0.016 * index) * math.sin(
            2.0 * math.pi * phase_t + index * 0.35
        )
        tail.rotation_euler.x = 0.018 * math.sin(2.0 * math.pi * phase_t + index * 0.20)

    for side, sign in (("L", 1.0), ("R", -1.0)):
        ear = rig.pose.bones[f"ear.{side}"]
        ear.rotation_euler.z = sign * 0.020 * math.sin(2.0 * math.pi * phase_t + math.pi)


def make_walk(rig, name="Walk_InPlace", end=WALK_END, forward=False):
    action = new_action(rig, name, end)
    for frame in range(WALK_START, end + 1, 4):
        reset_pose(rig)
        walk_pose(rig, frame, end=end, forward=forward)
        key_pose(rig, frame)
    reset_pose(rig)
    walk_pose(rig, end, end=end, forward=forward)
    key_pose(rig, end)
    smooth_action(action)
    return action


def make_idle(rig):
    action = new_action(rig, "Idle", 49)
    for frame in (1, 13, 25, 37, 49):
        reset_pose(rig)
        t = (frame - 1) / 48.0
        rig.pose.bones["spine_02"].rotation_euler.x = 0.012 * math.sin(2.0 * math.pi * t)
        rig.pose.bones["head"].rotation_euler.x = -0.010 * math.sin(2.0 * math.pi * t)
        rig.pose.bones["tail_02"].rotation_euler.z = 0.025 * math.sin(2.0 * math.pi * t + math.pi / 2)
        key_pose(rig, frame)
    smooth_action(action)
    return action


def export_deliverables(mesh, rig):
    os.makedirs(os.path.dirname(BLEND_OUTPUT), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig

    # Save the editable source of truth.  Octahedral display is a Blender
    # viewport property and is intentionally preserved in this file.
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
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SOURCE)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"Expected one mesh in source GLB, found {len(meshes)}")
    mesh = meshes[0]
    mesh.name = "YaoguangDeer_Mesh"

    rig = build_skeleton(mesh)
    if os.environ.get("YAOGUANG_AUTO_WEIGHTS") == "1":
        bind_mesh_auto(mesh, rig)
        print("WEIGHT_MODE", "BLENDER_AUTO")
    else:
        bind_mesh(mesh, rig)
        print("WEIGHT_MODE", "COMPONENT_AWARE")
    make_idle(rig)
    make_walk(rig, "Walk_InPlace", WALK_END, forward=False)
    make_walk(rig, "Walk_Forward", FORWARD_WALK_END, forward=True)

    # Open the editable Blender file on the travelling walk so the user sees
    # an actual forward-moving action immediately.  Both walk actions remain
    # available in the exported GLB.
    rig.animation_data.action = bpy.data.actions["Walk_Forward"]
    bpy.context.scene.frame_start = WALK_START
    bpy.context.scene.frame_end = FORWARD_WALK_END
    bpy.context.scene.frame_set(WALK_START)
    export_deliverables(mesh, rig)

    print("YAOGUANG_DEER_RIG_DONE")
    print("BLEND", BLEND_OUTPUT)
    print("GLB", GLB_OUTPUT)
    print("DISPLAY", rig.data.display_type)
    print("BONES", len(rig.data.bones))
    print("DEFORM_BONES", sum(1 for bone in rig.data.bones if bone.use_deform))
    print("VERTEX_GROUPS", len(mesh.vertex_groups))
    print("ACTIONS", sorted(action.name for action in bpy.data.actions))


if __name__ == "__main__":
    main()
