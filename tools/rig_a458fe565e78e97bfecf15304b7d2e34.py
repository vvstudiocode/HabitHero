"""Create a clean humanoid rig and skin for the supplied GLB character.

The source asset is imported from scratch, its GLTF rotation/scale are baked,
and a symmetric armature is created in the resulting character coordinates.
Blender's bone-heat automatic weights are used first; a nearest-bone rigid
fallback is kept for assets where bone heat cannot solve a disconnected shell.
"""

import bpy
import math
import os
from mathutils import Vector


SOURCE = "/Users/studio.vv/Downloads/a458fe565e78e97bfecf15304b7d2e34.glb"
OUTPUT_BLEND = "/Users/studio.vv/Downloads/a458fe565e78e97bfecf15304b7d2e34_rigged.blend"
OUTPUT_GLB = "/Users/studio.vv/Downloads/a458fe565e78e97bfecf15304b7d2e34_rigged.glb"
RIG_NAME = "Herbi_New_Rig"


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SOURCE)


def get_single_mesh():
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("The GLB contains no mesh")
    if len(meshes) > 1:
        bpy.ops.object.select_all(action="DESELECT")
        for obj in meshes:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.join()
    mesh = meshes[0]
    mesh.name = "Herbi_NewGLB_Mesh"
    bpy.context.view_layer.objects.active = mesh
    mesh.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return mesh


def bounds(mesh):
    xs = [v.co.x for v in mesh.data.vertices]
    ys = [v.co.y for v in mesh.data.vertices]
    zs = [v.co.z for v in mesh.data.vertices]
    return min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)


def make_bone(edit_bones, name, head, tail, parent=None, connect=False):
    bone = edit_bones.new(name)
    bone.head = head
    bone.tail = tail
    bone.parent = parent
    bone.use_connect = bool(connect and parent is not None)
    return bone


def build_rig(mesh):
    min_x, max_x, min_y, max_y, min_z, max_z = bounds(mesh)
    cx = (min_x + max_x) * 0.5
    cy = (min_y + max_y) * 0.5
    height = max_z - min_z

    arm_data = bpy.data.armatures.new(RIG_NAME)
    rig = bpy.data.objects.new(RIG_NAME, arm_data)
    bpy.context.scene.collection.objects.link(rig)
    rig.show_in_front = True
    arm_data.display_type = "BBONE"
    arm_data.axes_position = 0

    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones

    def p(x, y, z):
        return Vector((cx + x, cy + y, min_z + z * height))

    root = make_bone(eb, "root", p(0, 0, 0.02), p(0, 0, 0.14))
    pelvis = make_bone(eb, "pelvis", p(0, 0, 0.28), p(0, 0, 0.42), root)
    spine1 = make_bone(eb, "spine.001", p(0, 0, 0.42), p(0, 0, 0.56), pelvis)
    spine2 = make_bone(eb, "spine.002", p(0, 0, 0.56), p(0, 0, 0.68), spine1)
    neck = make_bone(eb, "neck", p(0, 0, 0.68), p(0, 0, 0.78), spine2)
    head = make_bone(eb, "head", p(0, 0, 0.77), p(0, 0, 0.93), neck)

    for side, sign in (("L", 1), ("R", -1)):
        clavicle = make_bone(eb, f"clavicle.{side}", p(sign * 0.045, 0, 0.68), p(sign * 0.145, 0, 0.69), spine2)
        upper = make_bone(eb, f"upper_arm.{side}", p(sign * 0.145, 0, 0.69), p(sign * 0.255, 0, 0.69), clavicle)
        fore = make_bone(eb, f"forearm.{side}", p(sign * 0.255, 0, 0.69), p(sign * 0.345, 0, 0.69), upper)
        make_bone(eb, f"hand.{side}", p(sign * 0.345, 0, 0.69), p(sign * 0.405, 0, 0.69), fore)

        thigh = make_bone(eb, f"thigh.{side}", p(sign * 0.105, 0.005, 0.39), p(sign * 0.115, 0.005, 0.23), pelvis)
        shin = make_bone(eb, f"shin.{side}", p(sign * 0.115, 0.005, 0.23), p(sign * 0.115, 0.005, 0.09), thigh)
        foot = make_bone(eb, f"foot.{side}", p(sign * 0.115, 0.005, 0.09), p(sign * 0.115, -0.12, 0.045), shin)
        make_bone(eb, f"toe.{side}", p(sign * 0.115, -0.12, 0.045), p(sign * 0.115, -0.19, 0.045), foot)

        make_bone(eb, f"ear.{side}", p(sign * 0.075, 0, 0.91), p(sign * 0.14, 0, 1.055), head)

    tail1 = make_bone(eb, "tail.001", p(0.17, 0.10, 0.39), p(0.26, 0.13, 0.32), pelvis)
    tail2 = make_bone(eb, "tail.002", p(0.26, 0.13, 0.32), p(0.34, 0.10, 0.23), tail1)
    make_bone(eb, "tail.003", p(0.34, 0.10, 0.23), p(0.37, 0.03, 0.15), tail2)

    bpy.ops.object.mode_set(mode="POSE")
    for bone in rig.pose.bones:
        bone.rotation_mode = "XYZ"
    bpy.ops.object.mode_set(mode="OBJECT")
    rig["rig_profile"] = "herbi_new_glb_humanoid_v1"
    rig["source_asset"] = os.path.basename(SOURCE)
    rig["rest_pose"] = "T_pose_from_source"
    rig["binding_method"] = "ARMATURE_AUTO with rigid fallback"
    rig["bone_count"] = len(arm_data.bones)
    return rig, (min_x, max_x, min_y, max_y, min_z, max_z)


def rigid_fallback(mesh, rig):
    """Assign each vertex to the closest rest-pose bone segment."""
    for group in list(mesh.vertex_groups):
        mesh.vertex_groups.remove(group)
    groups = {bone.name: mesh.vertex_groups.new(name=bone.name) for bone in rig.data.bones}
    segments = []
    for bone in rig.data.bones:
        a = bone.head_local.copy()
        b = bone.tail_local.copy()
        ab = b - a
        denom = max(ab.length_squared, 1e-12)
        segments.append((bone.name, a, ab, denom))
    buckets = {name: [] for name in groups}
    for vertex in mesh.data.vertices:
        point = vertex.co
        best_name = None
        best_dist = float("inf")
        for name, a, ab, denom in segments:
            t = max(0.0, min(1.0, (point - a).dot(ab) / denom))
            delta = point - (a + t * ab)
            dist = delta.length_squared
            if dist < best_dist:
                best_dist = dist
                best_name = name
        buckets[best_name].append(vertex.index)
    for name, indices in buckets.items():
        if indices:
            groups[name].add(indices, 1.0, "REPLACE")
    mod = mesh.modifiers.get("Herbi_New_Rig_Armature") or mesh.modifiers.new("Herbi_New_Rig_Armature", "ARMATURE")
    mod.object = rig
    mesh.parent = rig
    mesh.parent_type = "ARMATURE"
    return "RIGID_NEAREST_BONE"


def envelope_fallback(mesh, rig):
    """Use Blender's envelope solver when bone heat has no usable groups."""
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    for group in list(mesh.vertex_groups):
        mesh.vertex_groups.remove(group)
    for modifier in list(mesh.modifiers):
        if modifier.type == "ARMATURE":
            mesh.modifiers.remove(modifier)
    mesh.parent = None
    bpy.ops.object.parent_set(type="ARMATURE_ENVELOPE")
    if mesh.parent != rig or not any(vertex.groups for vertex in mesh.data.vertices):
        return rigid_fallback(mesh, rig)
    return "ARMATURE_ENVELOPE"


def bind_mesh(mesh, rig):
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    try:
        bpy.ops.object.parent_set(type="ARMATURE_AUTO")
        method = "ARMATURE_AUTO"
    except Exception as exc:
        print("HERBI_AUTO_WEIGHT_FAILED", repr(exc))
        method = envelope_fallback(mesh, rig)
    if not mesh.parent or mesh.parent != rig or not any(vertex.groups for vertex in mesh.data.vertices):
        print("HERBI_AUTO_WEIGHT_EMPTY_FALLBACK")
        method = envelope_fallback(mesh, rig)
    mesh["binding_method"] = method
    mesh["weight_influences_expected"] = "automatic bone heat; inspect shoulders, hips, knees"
    return method


def make_test_action(rig):
    action = bpy.data.actions.new("Herbi_Rig_Test")
    action.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = action
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 24
    bpy.context.scene.frame_set(1)
    for bone in rig.pose.bones:
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (0.0, 0.0, 0.0)
        bone.keyframe_insert(data_path="rotation_euler", frame=1, group=bone.name)

    # A small, reversible walk-test pose; frame 1 remains the neutral source T-pose.
    for frame, arm_angle, leg_angle in ((12, math.radians(18), math.radians(10)), (24, 0.0, 0.0)):
        bpy.context.scene.frame_set(frame)
        rig.pose.bones["upper_arm.L"].rotation_euler[1] = -arm_angle
        rig.pose.bones["upper_arm.R"].rotation_euler[1] = arm_angle
        rig.pose.bones["thigh.L"].rotation_euler[1] = leg_angle
        rig.pose.bones["thigh.R"].rotation_euler[1] = -leg_angle
        for name in ("upper_arm.L", "upper_arm.R", "thigh.L", "thigh.R"):
            rig.pose.bones[name].keyframe_insert(data_path="rotation_euler", frame=frame, group=name)
    bpy.context.scene.frame_set(1)


def save_outputs(mesh, rig):
    # Keep the editable Blender asset first.
    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT_BLEND)
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_GLB,
        export_format="GLB",
        export_animations=True,
        export_skins=True,
        use_selection=True,
    )
    print("HERBI_RIGGED_BLEND", OUTPUT_BLEND)
    print("HERBI_RIGGED_GLB", OUTPUT_GLB)


def main():
    clear_scene()
    mesh = get_single_mesh()
    rig, mesh_bounds = build_rig(mesh)
    method = bind_mesh(mesh, rig)
    make_test_action(rig)
    bpy.context.scene.frame_set(1)
    save_outputs(mesh, rig)
    print("HERBI_RIG_DONE", method, "VERTICES", len(mesh.data.vertices), "BONES", len(rig.data.bones), "BOUNDS", tuple(round(v, 5) for v in mesh_bounds))


main()
