"""Repair rigid weights for the mechanical Herbi rabbit asset.

This asset is a hard-surface, single-mesh character. The previous setup gave
every vertex exactly one weight, but the spatial regions were assigned to the
wrong bones. This script keeps the biped rig and replaces that mapping with
explicit front-view anatomical regions so shoulder and torso parts do not
blend into an arm during a pose.

Run from Blender's Python 3 console while herbi_pose_a_check.blend is open:
    exec(compile(open('/Users/studio.vv/Desktop/HabitHero/tools/fix_herbi_weights.py').read(), 'fix_herbi_weights.py', 'exec'))
"""

import bpy


OUTPUT_PATH = "/Users/studio.vv/Downloads/herbi_weight_fixed.blend"
RIG_NAME = "HabitHero_Walking_Rig"


def get_scene_objects():
    rig = bpy.data.objects.get(RIG_NAME)
    if rig is None or rig.type != "ARMATURE":
        raise RuntimeError(f"Missing armature: {RIG_NAME}")

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"Expected one mesh, found {len(meshes)}")
    return meshes[0], rig


def classify_vertex(x, z, bounds):
    min_x, max_x, min_z, max_z = bounds
    span_z = max(max_z - min_z, 1e-6)
    height = (z - min_z) / span_z
    side = "L" if x >= 0 else "R"
    ax = abs(x)

    # The upper 20% contains the head and the two long ears.
    if height >= 0.86:
        return f"ear.{side}" if ax >= 0.24 else "head"
    if height >= 0.72:
        return "head"

    # Centerline regions: keep the chest and pelvis on axial bones.
    if ax <= 0.22:
        if height >= 0.61:
            return "neck"
        if height >= 0.43:
            return "spine.002"
        if height >= 0.27:
            return "spine.001"
        return "pelvis"

    # Arms are outside the torso and above the pelvis. The shoulder shell is
    # kept on the clavicle so it does not pull the chest when the upper arm
    # rotates.
    if height >= 0.27:
        if height >= 0.58 and ax <= 0.37:
            return f"clavicle.{side}"
        if height >= 0.45:
            return f"upper_arm.{side}"
        if height >= 0.33:
            return f"forearm.{side}"
        return f"hand.{side}"

    # Legs are below the pelvis and separated by X. Keep each hard-surface
    # segment rigid; this prevents knee and foot plates from melting together.
    if height >= 0.16:
        return f"thigh.{side}"
    if height >= 0.055:
        return f"shin.{side}"
    return f"foot.{side}"


def rebuild_weights(mesh, rig):
    deform_bones = [bone.name for bone in rig.data.bones if bone.use_deform]
    missing = {
        "head",
        "neck",
        "spine.001",
        "spine.002",
        "pelvis",
        "clavicle.L",
        "clavicle.R",
        "upper_arm.L",
        "upper_arm.R",
        "forearm.L",
        "forearm.R",
        "hand.L",
        "hand.R",
        "thigh.L",
        "thigh.R",
        "shin.L",
        "shin.R",
        "foot.L",
        "foot.R",
        "ear.L",
        "ear.R",
    } - set(deform_bones)
    if missing:
        raise RuntimeError(f"Rig is missing deform bones: {sorted(missing)}")

    for group in list(mesh.vertex_groups):
        mesh.vertex_groups.remove(group)
    groups = {name: mesh.vertex_groups.new(name=name) for name in deform_bones}

    xs = [vertex.co.x for vertex in mesh.data.vertices]
    zs = [vertex.co.z for vertex in mesh.data.vertices]
    bounds = (min(xs), max(xs), min(zs), max(zs))
    buckets = {name: [] for name in deform_bones}
    for vertex in mesh.data.vertices:
        group_name = classify_vertex(vertex.co.x, vertex.co.z, bounds)
        if group_name not in buckets:
            raise RuntimeError(f"Classifier produced unknown group: {group_name}")
        buckets[group_name].append(vertex.index)

    for group_name, indices in buckets.items():
        if indices:
            groups[group_name].add(indices, 1.0, "REPLACE")

    mesh["weight_profile"] = "mechanical_rabbit_rigid_regions_v1"
    mesh["weight_influences_per_vertex"] = 1
    mesh["weight_bounds"] = tuple(round(value, 6) for value in bounds)
    return {name: len(indices) for name, indices in buckets.items()}


def main():
    mesh, rig = get_scene_objects()
    counts = rebuild_weights(mesh, rig)
    bpy.context.scene.frame_set(1)
    if rig.animation_data and bpy.data.actions.get("A_Pose_Check"):
        rig.animation_data.action = bpy.data.actions["A_Pose_Check"]
    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT_PATH)
    print("HERBI_WEIGHT_REPAIR_SAVED", OUTPUT_PATH)
    print("HERBI_WEIGHT_COUNTS", sorted((name, count) for name, count in counts.items() if count))


main()
