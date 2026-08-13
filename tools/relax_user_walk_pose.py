"""Refine the user's edited rig: forward feet and relaxed arms for walking."""

import math
import bpy
from mathutils import Vector


INPUT_BLEND = "/Users/studio.vv/Downloads/a458fe565e78e97bfecf15304b7d2e34_rigged_user_edit_before_pose.blend"
OUTPUT_BLEND = "/Users/studio.vv/Downloads/a458fe565e78e97bfecf15304b7d2e34_rigged.blend"
OUTPUT_GLB = "/Users/studio.vv/Downloads/a458fe565e78e97bfecf15304b7d2e34_rigged.glb"
RIG_NAME = "Herbi_New_Rig"
MESH_NAME = "Herbi_NewGLB_Mesh"


def object_mode(rig):
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    if rig.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")


def point_feet_forward(rig):
    """Keep the user's ankle positions, but point foot/toe bones along -Y."""
    object_mode(rig)
    bpy.ops.object.mode_set(mode="EDIT")
    eb = rig.data.edit_bones
    for side in ("L", "R"):
        foot = eb.get(f"foot.{side}")
        toe = eb.get(f"toe.{side}")
        if foot is None or toe is None:
            continue
        foot_head = foot.head.copy()
        foot_len = max(foot.length, 0.075)
        toe_len = max(toe.length, 0.06)
        foot.tail = foot_head + Vector((0.0, -foot_len, 0.0))
        toe.head = foot.tail.copy()
        toe.tail = toe.head + Vector((0.0, -toe_len, 0.0))
        toe.parent = foot
        toe.use_connect = True
    bpy.ops.object.mode_set(mode="OBJECT")


def relax_arms_in_walk(rig):
    """Add a neutral downward shoulder offset while retaining swing in Z."""
    action = bpy.data.actions.get("Walk_In_Place")
    if action is None:
        raise RuntimeError("Walk_In_Place action is missing")
    rig.animation_data_create()
    rig.animation_data.action = action
    frames = (1, 7, 13, 19, 25, 31, 37, 43, 49)
    arm_drop = math.radians(70.0)
    for frame in frames:
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        for side, sign in (("L", 1.0), ("R", -1.0)):
            for part in ("upper_arm", "forearm"):
                bone = rig.pose.bones.get(f"{part}.{side}")
                if bone is None:
                    continue
                bone.rotation_mode = "XYZ"
                # The edited rig's upper/forearm bones run along local X.
                # Local X rotation puts the arms below the shoulders; local Z
                # remains the forward/back swing plane used by Walk_In_Place.
                bone.rotation_euler[0] = -arm_drop
                bone.keyframe_insert(data_path="rotation_euler", frame=frame, group=bone.name)


def main():
    bpy.ops.wm.open_mainfile(filepath=INPUT_BLEND)
    rig = bpy.data.objects.get(RIG_NAME)
    mesh = bpy.data.objects.get(MESH_NAME)
    if rig is None or mesh is None:
        raise RuntimeError("Expected edited Herbi rig and mesh")
    object_mode(rig)
    point_feet_forward(rig)
    relax_arms_in_walk(rig)
    rig.data.display_type = "OCTAHEDRAL"
    rig.show_in_front = True
    rig["neutral_pose"] = "feet_forward_arms_down"
    rig["walk_cycle"] = "in_place_24f"
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 49
    bpy.context.scene.frame_set(1)

    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT_BLEND)
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_GLB,
        export_format="GLB",
        export_animations=True,
        export_skins=True,
        use_selection=True,
    )
    print("HERBI_RELAXED_WALK_SAVED", OUTPUT_BLEND, OUTPUT_GLB)
    print("HERBI_RELAXED_WALK_DONE", "feet_forward", "arms_down", "root_locked")


main()
