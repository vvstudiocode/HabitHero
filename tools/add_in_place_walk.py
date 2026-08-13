"""Add a clean looping in-place walk to the new GLB rig."""

import math
import bpy


BLEND = "/Users/studio.vv/Downloads/a458fe565e78e97bfecf15304b7d2e34_rigged.blend"
GLB = "/Users/studio.vv/Downloads/a458fe565e78e97bfecf15304b7d2e34_rigged.glb"
RIG_NAME = "Herbi_New_Rig"


def set_pose(rig, frame, values):
    bpy.context.scene.frame_set(frame)
    for bone_name, channels in values.items():
        bone = rig.pose.bones.get(bone_name)
        if bone is None:
            continue
        bone.rotation_mode = "XYZ"
        if "rot" in channels:
            rot = channels["rot"]
            # In this rig the bones' local Y axis follows the bone length.
            # The previous pass used local Y for every limb, which only
            # twisted the limbs. Redirect the stored swing value to the
            # correct anatomical axis for visible walking motion.
            if bone_name.startswith(("upper_arm.", "forearm.")):
                rot = (0.0, 0.0, rot[1])
            elif bone_name.startswith(("thigh.", "shin.", "foot.", "toe.")):
                rot = (rot[1], 0.0, 0.0)
            bone.rotation_euler = rot
        if "loc" in channels:
            bone.location = channels["loc"]
        bone.keyframe_insert(data_path="rotation_euler", frame=frame, group=bone_name)
        if "loc" in channels:
            bone.keyframe_insert(data_path="location", frame=frame, group=bone_name)


def main():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    rig = bpy.data.objects.get(RIG_NAME)
    mesh = bpy.data.objects.get("Herbi_NewGLB_Mesh")
    if rig is None or mesh is None:
        raise RuntimeError("Expected Herbi_New_Rig and Herbi_NewGLB_Mesh")

    old = bpy.data.actions.get("Walk_In_Place")
    if old:
        bpy.data.actions.remove(old)
    action = bpy.data.actions.new("Walk_In_Place")
    action.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = action

    # The source model faces -Y.  Y-axis rotations swing the limbs in the
    # front/back plane while the root remains fixed for an in-place cycle.
    def r(y=0.0, x=0.0, z=0.0):
        return (x, y, z)

    neutral = {
        "pelvis": {"rot": r(), "loc": (0.0, 0.0, 0.0)},
        "upper_arm.L": {"rot": r()}, "upper_arm.R": {"rot": r()},
        "forearm.L": {"rot": r()}, "forearm.R": {"rot": r()},
        "thigh.L": {"rot": r()}, "thigh.R": {"rot": r()},
        "shin.L": {"rot": r()}, "shin.R": {"rot": r()},
        "foot.L": {"rot": r()}, "foot.R": {"rot": r()},
        "head": {"rot": r()}, "tail.001": {"rot": r()},
        "tail.002": {"rot": r()}, "tail.003": {"rot": r()},
    }

    # Four poses over 24 frames; frame 25 repeats frame 1 for a seamless loop.
    poses = {
        1: {
            "pelvis": {"rot": r(z=0.015), "loc": (0.0, 0.0, 0.0)},
            "upper_arm.L": {"rot": r(y=-math.radians(20))},
            "upper_arm.R": {"rot": r(y=math.radians(20))},
            "forearm.L": {"rot": r(y=-math.radians(7))},
            "forearm.R": {"rot": r(y=math.radians(7))},
            "thigh.L": {"rot": r(y=math.radians(25))},
            "thigh.R": {"rot": r(y=-math.radians(25))},
            "shin.L": {"rot": r(y=-math.radians(8))},
            "shin.R": {"rot": r(y=math.radians(14))},
            "foot.L": {"rot": r(y=math.radians(5))},
            "foot.R": {"rot": r(y=-math.radians(8))},
            "head": {"rot": r(z=math.radians(-2))},
            "tail.001": {"rot": r(y=math.radians(-8))},
            "tail.002": {"rot": r(y=math.radians(-10))},
            "tail.003": {"rot": r(y=math.radians(-8))},
        },
        7: {
            "pelvis": {"rot": r(z=math.radians(-1.5)), "loc": (0.0, 0.0, 0.012)},
            "upper_arm.L": {"rot": r(y=math.radians(7))},
            "upper_arm.R": {"rot": r(y=-math.radians(7))},
            "forearm.L": {"rot": r(y=math.radians(3))},
            "forearm.R": {"rot": r(y=-math.radians(3))},
            "thigh.L": {"rot": r(y=-math.radians(8))},
            "thigh.R": {"rot": r(y=math.radians(8))},
            "shin.L": {"rot": r(y=math.radians(9))},
            "shin.R": {"rot": r(y=-math.radians(9))},
            "foot.L": {"rot": r(y=-math.radians(3))},
            "foot.R": {"rot": r(y=math.radians(3))},
            "head": {"rot": r(z=math.radians(1))},
            "tail.001": {"rot": r(y=math.radians(4))},
            "tail.002": {"rot": r(y=math.radians(5))},
            "tail.003": {"rot": r(y=math.radians(4))},
        },
        13: {
            "pelvis": {"rot": r(z=math.radians(1.5)), "loc": (0.0, 0.0, 0.0)},
            "upper_arm.L": {"rot": r(y=math.radians(20))},
            "upper_arm.R": {"rot": r(y=-math.radians(20))},
            "forearm.L": {"rot": r(y=math.radians(7))},
            "forearm.R": {"rot": r(y=-math.radians(7))},
            "thigh.L": {"rot": r(y=-math.radians(25))},
            "thigh.R": {"rot": r(y=math.radians(25))},
            "shin.L": {"rot": r(y=math.radians(14))},
            "shin.R": {"rot": r(y=-math.radians(8))},
            "foot.L": {"rot": r(y=-math.radians(8))},
            "foot.R": {"rot": r(y=math.radians(5))},
            "head": {"rot": r(z=math.radians(2))},
            "tail.001": {"rot": r(y=math.radians(8))},
            "tail.002": {"rot": r(y=math.radians(10))},
            "tail.003": {"rot": r(y=math.radians(8))},
        },
        19: {
            "pelvis": {"rot": r(z=math.radians(-1.5)), "loc": (0.0, 0.0, 0.012)},
            "upper_arm.L": {"rot": r(y=-math.radians(7))},
            "upper_arm.R": {"rot": r(y=math.radians(7))},
            "forearm.L": {"rot": r(y=-math.radians(3))},
            "forearm.R": {"rot": r(y=math.radians(3))},
            "thigh.L": {"rot": r(y=math.radians(8))},
            "thigh.R": {"rot": r(y=-math.radians(8))},
            "shin.L": {"rot": r(y=-math.radians(9))},
            "shin.R": {"rot": r(y=math.radians(9))},
            "foot.L": {"rot": r(y=math.radians(3))},
            "foot.R": {"rot": r(y=-math.radians(3))},
            "head": {"rot": r(z=math.radians(-1))},
            "tail.001": {"rot": r(y=math.radians(-4))},
            "tail.002": {"rot": r(y=math.radians(-5))},
            "tail.003": {"rot": r(y=math.radians(-4))},
        },
    }

    for frame, values in poses.items():
        set_pose(rig, frame, values)
    set_pose(rig, 25, poses[1])
    # Blender 5.2 stores action channels in layered channel-bags, so write a
    # second explicit cycle instead of relying on the legacy fcurves API.
    set_pose(rig, 31, poses[7])
    set_pose(rig, 37, poses[13])
    set_pose(rig, 43, poses[19])
    set_pose(rig, 49, poses[1])

    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 49
    bpy.context.scene.render.fps = 24
    bpy.context.scene.frame_set(1)
    rig.data.display_type = "OCTAHEDRAL"
    rig.show_in_front = True
    rig["active_animation"] = "Walk_In_Place"
    rig["animation_type"] = "in_place_loop"
    rig["cycle_frames"] = 24
    rig["walk_direction"] = "none / root locked"

    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=GLB,
        export_format="GLB",
        export_animations=True,
        export_skins=True,
        use_selection=True,
    )
    print("HERBI_WALK_IN_PLACE_SAVED", BLEND, GLB)
    print("HERBI_WALK_ACTION", action.name, "FRAMES", 1, 49, "CYCLE", 24)


main()
