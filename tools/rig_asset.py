import bpy
from mathutils import Vector
import os

SOURCE = "/Users/studio.vv/Downloads/asset_BXr5E3FR9oT1HuzzhzsUb8qT.glb"
OUTPUT = "/Users/studio.vv/Desktop/HabitHero/public/models/asset-rigged-wanderer.glb"
FPS = 24


def key(obj, data_path, frame, index=None):
    if index is None:
        obj.keyframe_insert(data_path=data_path, frame=frame)
    else:
        obj.keyframe_insert(data_path=data_path, index=index, frame=frame)


def make_bone(arm, name, head, tail, parent=None, deform=True):
    bone = arm.data.edit_bones.new(name)
    bone.head = head
    bone.tail = tail
    bone.use_deform = deform
    if parent:
        bone.parent = arm.data.edit_bones[parent]
    return bone


def build_skeleton(mesh):
    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    arm = bpy.context.object
    arm.name = "Wanderer_Rig"
    arm.data.name = "Wanderer_Rig"
    for bone in list(arm.data.edit_bones):
        arm.data.edit_bones.remove(bone)

    # The source is a one-meter, Z-up character. These landmarks are intentionally
    # conservative so automatic weights have broad, stable influence regions.
    z = {
        "floor": 0.0,
        "ankle": 0.09,
        "knee": 0.34,
        "hip": 0.53,
        "chest": 0.70,
        "shoulder": 0.75,
        "neck": 0.84,
        "head": 0.93,
        "top": 1.00,
    }
    make_bone(arm, "root", (0, 0, z["floor"]), (0, 0, z["hip"]), deform=False)
    make_bone(arm, "pelvis", (0, 0, z["hip"]), (0, 0, 0.60), "root")
    make_bone(arm, "spine", (0, 0, 0.60), (0, 0, z["chest"]), "pelvis")
    make_bone(arm, "chest", (0, 0, z["chest"]), (0, 0, z["shoulder"]), "spine")
    make_bone(arm, "neck", (0, 0, z["shoulder"]), (0, 0, z["neck"]), "chest")
    make_bone(arm, "head", (0, 0, z["neck"]), (0, 0, z["top"]), "neck")

    for side, x in (("L", -1), ("R", 1)):
        sx = 0.075 * x
        ex = 0.16 * x
        hx = 0.225 * x
        make_bone(arm, f"upper_arm.{side}", (sx, 0, z["shoulder"]), (ex, 0, 0.73), "chest")
        make_bone(arm, f"forearm.{side}", (ex, 0, 0.73), (hx, 0, 0.71), f"upper_arm.{side}")
        make_bone(arm, f"hand.{side}", (hx, 0, 0.71), (0.25 * x, 0, 0.70), f"forearm.{side}")
        make_bone(arm, f"thigh.{side}", (0.045 * x, 0, z["hip"]), (0.055 * x, 0, z["knee"]), "pelvis")
        make_bone(arm, f"shin.{side}", (0.055 * x, 0, z["knee"]), (0.05 * x, 0, z["ankle"]), f"thigh.{side}")
        make_bone(arm, f"foot.{side}", (0.05 * x, 0, z["ankle"]), (0.05 * x, -0.065, 0.035), f"shin.{side}")

    bpy.ops.object.mode_set(mode="POSE")
    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def bind_mesh(mesh, arm):
    """Assign smooth nearest-bone weights without depending on Bone Heat's solver."""
    deform_bones = [b for b in arm.data.bones if b.use_deform]
    for bone in deform_bones:
        mesh.vertex_groups.new(name=bone.name)
    segments = []
    for bone in deform_bones:
        head = arm.matrix_world @ bone.head_local
        tail = arm.matrix_world @ bone.tail_local
        segments.append((bone.name, head, tail))

    for vertex in mesh.data.vertices:
        point = mesh.matrix_world @ vertex.co
        distances = []
        for name, head, tail in segments:
            direction = tail - head
            length_sq = max(direction.length_squared, 1e-8)
            t = max(0.0, min(1.0, (point - head).dot(direction) / length_sq))
            closest = head + direction * t
            distances.append(((point - closest).length, name))
        distances.sort(key=lambda item: item[0])
        nearest = distances[:4]
        weights = [1.0 / max(distance, 0.006) ** 2 for distance, _ in nearest]
        total = sum(weights)
        for weight, (_, name) in zip(weights, nearest):
            mesh.vertex_groups[name].add([vertex.index], weight / total, "REPLACE")
    modifier = mesh.modifiers.new(name="Wanderer_Armature", type="ARMATURE")
    modifier.object = arm
    mesh.parent = arm
    mesh.parent_type = "OBJECT"


def make_idle(arm):
    action = bpy.data.actions.new("idle_breathing")
    arm.animation_data_create()
    arm.animation_data.action = action
    scene = bpy.context.scene
    scene.frame_start, scene.frame_end, scene.render.fps = 1, 72, FPS

    chest = arm.pose.bones["chest"]
    spine = arm.pose.bones["spine"]
    head = arm.pose.bones["head"]
    for frame, scale, sway in ((1, 1.0, 0.0), (36, 1.025, 0.008), (72, 1.0, 0.0)):
        chest.rotation_euler[1] = sway
        spine.scale = (1.0, 1.0, scale)
        chest.scale = (1.0, 1.0, scale)
        head.rotation_euler[1] = -sway * 0.6
        key(chest, "rotation_euler", frame)
        key(spine, "scale", frame)
        key(chest, "scale", frame)
        key(head, "rotation_euler", frame)
    action.use_fake_user = True
    return action


def set_pose(arm, frame, phase):
    # In-place walk cycle: the browser can translate the root while this loops.
    for side, sign in (("L", 1), ("R", -1)):
        thigh = arm.pose.bones[f"thigh.{side}"]
        shin = arm.pose.bones[f"shin.{side}"]
        foot = arm.pose.bones[f"foot.{side}"]
        upper = arm.pose.bones[f"upper_arm.{side}"]
        fore = arm.pose.bones[f"forearm.{side}"]
        thigh.rotation_euler[1] = 0.42 * sign * phase
        shin.rotation_euler[1] = -0.26 * max(0.0, -sign * phase)
        foot.rotation_euler[1] = -0.15 * sign * phase
        upper.rotation_euler[1] = -0.22 * sign * phase
        fore.rotation_euler[1] = 0.12 * max(0.0, sign * phase)
        for bone in (thigh, shin, foot, upper, fore):
            key(bone, "rotation_euler", frame)
    pelvis = arm.pose.bones["pelvis"]
    chest = arm.pose.bones["chest"]
    pelvis.location.z = 0.008 * abs(phase)
    chest.rotation_euler[1] = 0.035 * phase
    key(pelvis, "location", frame)
    key(chest, "rotation_euler", frame)


def make_walk(arm):
    action = bpy.data.actions.new("wander_walk")
    arm.animation_data.action = action
    scene = bpy.context.scene
    scene.frame_start, scene.frame_end, scene.render.fps = 1, 48, FPS
    for frame, phase in ((1, 1.0), (13, 0.0), (25, -1.0), (37, 0.0), (48, 1.0)):
        set_pose(arm, frame, phase)
    action.use_fake_user = True
    return action


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SOURCE)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"Expected one mesh, found {len(meshes)}")
    mesh = meshes[0]
    arm = build_skeleton(mesh)

    bind_mesh(mesh, arm)

    idle = make_idle(arm)
    walk = make_walk(arm)
    arm.animation_data.action = idle
    bpy.context.scene.frame_set(1)

    # Keep the deliverable self-describing for the web runtime.
    arm["default_animation"] = "idle_breathing"
    arm["walk_animation"] = "wander_walk"
    arm["walk_speed_mps"] = 0.12
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT,
        export_format="GLB",
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_skins=True,
        export_apply=False,
        export_yup=True,
    )
    print(f"WROTE {OUTPUT}")
    print("ACTIONS", [a.name for a in bpy.data.actions])


if __name__ == "__main__":
    main()
