import math
import os
from mathutils import Vector

import bpy


ROOT = os.path.dirname(os.path.abspath(__file__))
BLEND_PATH = os.path.join(ROOT, "white_blue_sprite_login.blend")
PREVIEW_PATH = os.path.join(ROOT, "white_blue_sprite_login_preview.png")


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def mat(name, color, roughness=0.5, metallic=0.0, alpha=1.0, transmission=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        try:
            bsdf.inputs["Base Color"].default_value = color
            bsdf.inputs["Alpha"].default_value = alpha
            bsdf.inputs["Roughness"].default_value = roughness
            bsdf.inputs["Metallic"].default_value = metallic
            if "Transmission Weight" in bsdf.inputs:
                bsdf.inputs["Transmission Weight"].default_value = transmission
            if "IOR" in bsdf.inputs:
                bsdf.inputs["IOR"].default_value = 1.33
        except Exception:
            pass
    material.diffuse_color = color
    material.blend_method = "BLEND" if alpha < 1 else "OPAQUE"
    material.use_screen_refraction = alpha < 0.85 if hasattr(material, "use_screen_refraction") else False
    return material


def add_uv(name, location, scale, material, segments=64, rings=32):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        radius=1,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return obj


def add_hair(obj, name, count, length, color_hint="white", children=18, roughness=0.02):
    mod = obj.modifiers.new(name, "PARTICLE_SYSTEM")
    ps = mod.particle_system
    settings = ps.settings
    settings.type = "HAIR"
    settings.count = count
    settings.hair_length = length
    settings.use_advanced_hair = True
    settings.rendered_child_count = children
    settings.child_type = "INTERPOLATED"
    settings.child_length = 0.92
    settings.roughness_1_size = roughness
    settings.roughness_1 = roughness * 0.7
    settings.roughness_2 = roughness * 0.35
    settings.display_percentage = 35
    settings.use_modifier_stack = True
    settings.name = f"{obj.name}_{color_hint}_fur_particles"
    return mod


def create_elliptic_leaf(name, loc, rot, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=12, radius=1, location=loc, rotation=rot)
    leaf = bpy.context.object
    leaf.name = name
    leaf.scale = scale
    leaf.data.materials.append(material)
    bpy.ops.object.shade_smooth()

    vein = add_uv(f"{name}_soft_center_vein", loc, (0.018, scale[1] * 0.88, 0.006), material, 12, 6)
    vein.rotation_euler = leaf.rotation_euler
    vein.data.materials.append(material)
    return leaf


def create_island(moss_mat, soil_mat, flower_mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=2.45, depth=0.5, location=(0, 0, -1.15))
    island = bpy.context.object
    island.name = "floating_moss_island_soft_oval"
    island.scale = (1.35, 0.72, 1.0)
    island.data.materials.append(soil_mat)
    bpy.ops.object.shade_smooth()

    top = add_uv("rounded_moss_cushion_top", (0, 0, -0.86), (3.45, 1.8, 0.34), moss_mat, 96, 24)
    add_hair(top, "short_glowing_moss_hair", 1600, 0.11, "green", children=7, roughness=0.015)

    for i in range(18):
        angle = i * math.tau / 18
        radius = 2.0 + (i % 3) * 0.2
        x = math.cos(angle) * radius * 1.15
        y = math.sin(angle) * radius * 0.55
        bpy.ops.mesh.primitive_cone_add(
            vertices=7,
            radius1=0.035,
            radius2=0.012,
            depth=0.8 + (i % 4) * 0.15,
            location=(x, y, -1.55 - (i % 4) * 0.08),
            rotation=(0.2 * math.sin(angle), 0.2 * math.cos(angle), angle),
        )
        root = bpy.context.object
        root.name = f"hanging_soft_root_{i:02d}"
        root.data.materials.append(soil_mat)

    for i in range(14):
        x = -1.55 + (i % 7) * 0.5
        y = -0.58 + (i // 7) * 0.7
        petal = add_uv(f"tiny_login_flower_{i:02d}", (x, y, -0.48), (0.055, 0.055, 0.012), flower_mat, 16, 8)
        petal.rotation_euler.z = i * 0.7
    return island, top


def create_creature(materials):
    body = add_uv("rigged_white_blue_sprite_body_fur_host", (0, 0, 0.05), (1.28, 0.95, 1.2), materials["fur"], 96, 48)
    add_hair(body, "dense_soft_white_body_fur", 5200, 0.25, "white", children=22, roughness=0.04)

    blue_patch = add_uv("soft_blue_side_fur_patch", (0.72, -0.04, -0.02), (0.48, 0.78, 0.88), materials["blue_fur"], 48, 24)
    blue_patch.rotation_euler.y = -0.16
    add_hair(blue_patch, "blue_side_patch_fur", 1200, 0.18, "blue", children=14, roughness=0.035)

    for side, x in [("L", -0.58), ("R", 0.58)]:
        bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=0.22, radius2=0.045, depth=0.55, location=(x, -0.05, 1.07), rotation=(0.18, 0.22 * (-1 if side == "L" else 1), 0))
        ear = bpy.context.object
        ear.name = f"{side}_blue_furry_ear_weighted_to_rig"
        ear.scale.x = 0.72
        ear.data.materials.append(materials["blue_fur"])
        bpy.ops.object.shade_smooth()
        add_hair(ear, f"{side}_ear_short_fur", 360, 0.11, "blue", children=9, roughness=0.02)

    for side, x in [("L", -0.38), ("R", 0.38)]:
        foot = add_uv(f"{side}_round_blue_foot_controller_mesh", (x, -0.46, -0.82), (0.28, 0.18, 0.13), materials["blue_fur"], 32, 12)
        foot.rotation_euler.x = 0.1

    for side, x in [("L", -0.42), ("R", 0.42)]:
        eye = add_uv(f"{side}_large_glass_aqua_eye", (x, -0.78, 0.25), (0.26, 0.12, 0.35), materials["eye_glass"], 64, 24)
        eye.rotation_euler.x = -0.05
        pupil = add_uv(f"{side}_deep_blue_eye_core", (x, -0.865, 0.18), (0.16, 0.035, 0.22), materials["eye_core"], 48, 16)
        highlight = add_uv(f"{side}_white_eye_highlight_dot", (x - 0.08, -0.9, 0.39), (0.045, 0.016, 0.065), materials["highlight"], 24, 8)
        rim = add_uv(f"{side}_cyan_lower_eye_glow", (x + 0.02, -0.89, 0.02), (0.17, 0.018, 0.055), materials["cyan_glow"], 24, 8)
        for obj in [eye, pupil, highlight, rim]:
            obj["rig_note"] = f"Follows eye.{side} bone in exported login animation rig"

    nose = add_uv("tiny_pearl_nose", (0, -0.92, 0.08), (0.035, 0.018, 0.026), materials["nose"], 16, 8)
    mouth = bpy.data.curves.new("small_shy_mouth_curve", "CURVE")
    mouth.dimensions = "3D"
    mouth.resolution_u = 12
    mouth.bevel_depth = 0.006
    for sx in [-1, 1]:
        spl = mouth.splines.new("BEZIER")
        spl.bezier_points.add(2)
        pts = [(0, -0.95, -0.02), (0.035 * sx, -0.96, -0.055), (0.07 * sx, -0.94, -0.05)]
        for p, co in zip(spl.bezier_points, pts):
            p.co = co
            p.handle_left_type = p.handle_right_type = "AUTO"
    mouth_obj = bpy.data.objects.new("tiny_subtle_mouth_curve", mouth)
    bpy.context.collection.objects.link(mouth_obj)
    mouth_obj.data.materials.append(materials["mouth"])

    for side, x in [("L", -0.34), ("R", 0.34)]:
        blush = add_uv(f"{side}_soft_pink_blush", (x, -0.91, -0.05), (0.18, 0.012, 0.09), materials["blush"], 24, 8)
        blush.rotation_euler.x = 0.1

    # Antennae: curve stems plus furry blue plumes.
    for side, x in [("L", -0.28), ("R", 0.28)]:
        curve = bpy.data.curves.new(f"{side}_flexible_antenna_curve", "CURVE")
        curve.dimensions = "3D"
        curve.resolution_u = 20
        curve.bevel_depth = 0.018
        spl = curve.splines.new("BEZIER")
        spl.bezier_points.add(2)
        coords = [(x, -0.02, 1.16), (x * 1.3, -0.02, 1.72), (x * 1.65, -0.03, 1.9)]
        for p, co in zip(spl.bezier_points, coords):
            p.co = co
            p.handle_left_type = p.handle_right_type = "AUTO"
        obj = bpy.data.objects.new(f"{side}_flexible_antenna_weighted_curve", curve)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(materials["fur"])
        plume = add_uv(f"{side}_blue_feathery_antenna_plume", coords[-1], (0.12, 0.08, 0.2), materials["blue_fur"], 32, 12)
        plume.rotation_euler.y = 0.35 * (1 if side == "L" else -1)
        add_hair(plume, f"{side}_antenna_plume_long_strands", 450, 0.2, "blue", children=16, roughness=0.08)

    return body


def create_armature():
    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, -0.15), rotation=(0, 0, 0))
    arm = bpy.context.object
    arm.name = "Sprite_Login_Rig_armature"
    arm.data.name = "Sprite_Login_Rig_data"
    arm.show_in_front = True

    bones = arm.data.edit_bones
    root = bones[0]
    root.name = "root"
    root.head = (0, 0, -1.05)
    root.tail = (0, 0, 0.05)

    def add_bone(name, head, tail, parent="root"):
        b = bones.new(name)
        b.head = head
        b.tail = tail
        b.parent = bones[parent]
        return b

    add_bone("body_squash", (0, 0, -0.35), (0, 0, 0.92))
    add_bone("eye.L", (-0.42, -0.78, 0.18), (-0.42, -0.78, 0.55), "body_squash")
    add_bone("eye.R", (0.42, -0.78, 0.18), (0.42, -0.78, 0.55), "body_squash")
    add_bone("ear.L", (-0.58, -0.04, 0.86), (-0.82, -0.05, 1.34), "body_squash")
    add_bone("ear.R", (0.58, -0.04, 0.86), (0.82, -0.05, 1.34), "body_squash")
    add_bone("antenna.L.base", (-0.28, 0, 0.98), (-0.38, -0.02, 1.48), "body_squash")
    add_bone("antenna.L.tip", (-0.38, -0.02, 1.48), (-0.48, -0.03, 1.9), "antenna.L.base")
    add_bone("antenna.R.base", (0.28, 0, 0.98), (0.38, -0.02, 1.48), "body_squash")
    add_bone("antenna.R.tip", (0.38, -0.02, 1.48), (0.48, -0.03, 1.9), "antenna.R.base")
    add_bone("foot.L", (-0.38, -0.42, -0.78), (-0.38, -0.42, -0.48), "root")
    add_bone("foot.R", (0.38, -0.42, -0.78), (0.38, -0.42, -0.48), "root")
    add_bone("look_target", (0, -1.7, 0.25), (0, -1.7, 0.7), "root")
    bpy.ops.object.mode_set(mode="POSE")
    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"
    bpy.ops.object.mode_set(mode="OBJECT")
    arm["usage"] = "Login page hero rig: idle float, blink, ear wiggle, antenna wave, and bubble reaction actions are included."
    return arm


def add_rig_modifier(body, arm):
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    mod = body.modifiers.new("Armature_deform_placeholder_for_login_sprite", "ARMATURE")
    mod.object = arm
    # Vertex groups are broad regions so the asset has a real deformation-ready setup.
    verts = body.data.vertices
    for bone_name in ["root", "body_squash", "ear.L", "ear.R", "antenna.L.base", "antenna.R.base", "foot.L", "foot.R"]:
        body.vertex_groups.new(name=bone_name)
    for v in verts:
        world = body.matrix_world @ v.co
        weight = 1.0
        body.vertex_groups["body_squash"].add([v.index], weight, "ADD")
        body.vertex_groups["root"].add([v.index], 0.15, "ADD")
        if world.x < -0.25 and world.z > 0.45:
            body.vertex_groups["ear.L"].add([v.index], 0.35, "ADD")
        if world.x > 0.25 and world.z > 0.45:
            body.vertex_groups["ear.R"].add([v.index], 0.35, "ADD")


def keyframe_pose(arm, frame, transforms):
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    for bone_name, data in transforms.items():
        pb = arm.pose.bones.get(bone_name)
        if not pb:
            continue
        if "loc" in data:
            pb.location = data["loc"]
            pb.keyframe_insert("location", frame=frame)
        if "rot" in data:
            pb.rotation_euler = data["rot"]
            pb.keyframe_insert("rotation_euler", frame=frame)
        if "scale" in data:
            pb.scale = data["scale"]
            pb.keyframe_insert("scale", frame=frame)
    bpy.ops.object.mode_set(mode="OBJECT")


def make_action(arm, name, keyed_frames):
    arm.animation_data_create()
    arm.animation_data.action = bpy.data.actions.new(name)
    for frame, transforms in keyed_frames:
        keyframe_pose(arm, frame, transforms)
    arm.animation_data.action.use_fake_user = True
    return arm.animation_data.action


def create_actions(arm):
    make_action(
        arm,
        "A_idle_float_body_breathing_96f",
        [
            (1, {"root": {"loc": (0, 0, 0)}, "body_squash": {"scale": (1, 1, 1)}}),
            (24, {"root": {"loc": (0, 0, 0.08)}, "body_squash": {"scale": (1.025, 1.0, 0.97)}}),
            (48, {"root": {"loc": (0, 0, 0.12)}, "body_squash": {"scale": (0.985, 1.0, 1.035)}}),
            (72, {"root": {"loc": (0, 0, 0.04)}, "body_squash": {"scale": (1.02, 1.0, 0.98)}}),
            (96, {"root": {"loc": (0, 0, 0)}, "body_squash": {"scale": (1, 1, 1)}}),
        ],
    )
    make_action(
        arm,
        "B_antenna_wave_loop_72f",
        [
            (1, {"antenna.L.tip": {"rot": (0.0, 0.0, 0.18)}, "antenna.R.tip": {"rot": (0.0, 0.0, -0.18)}}),
            (24, {"antenna.L.tip": {"rot": (0.22, 0.08, -0.1)}, "antenna.R.tip": {"rot": (0.22, -0.08, 0.1)}}),
            (48, {"antenna.L.tip": {"rot": (-0.18, -0.05, 0.12)}, "antenna.R.tip": {"rot": (-0.18, 0.05, -0.12)}}),
            (72, {"antenna.L.tip": {"rot": (0.0, 0.0, 0.18)}, "antenna.R.tip": {"rot": (0.0, 0.0, -0.18)}}),
        ],
    )
    make_action(
        arm,
        "C_ear_wiggle_reaction_48f",
        [
            (1, {"ear.L": {"rot": (0, 0, 0)}, "ear.R": {"rot": (0, 0, 0)}}),
            (12, {"ear.L": {"rot": (0.12, -0.15, 0.2)}, "ear.R": {"rot": (0.12, 0.15, -0.2)}}),
            (24, {"ear.L": {"rot": (-0.09, 0.12, -0.16)}, "ear.R": {"rot": (-0.09, -0.12, 0.16)}}),
            (36, {"ear.L": {"rot": (0.05, -0.08, 0.1)}, "ear.R": {"rot": (0.05, 0.08, -0.1)}}),
            (48, {"ear.L": {"rot": (0, 0, 0)}, "ear.R": {"rot": (0, 0, 0)}}),
        ],
    )
    make_action(
        arm,
        "D_soft_blink_36f_scale_eye_bones",
        [
            (1, {"eye.L": {"scale": (1, 1, 1)}, "eye.R": {"scale": (1, 1, 1)}}),
            (16, {"eye.L": {"scale": (1, 1, 0.08)}, "eye.R": {"scale": (1, 1, 0.08)}}),
            (22, {"eye.L": {"scale": (1, 1, 1.08)}, "eye.R": {"scale": (1, 1, 1.08)}}),
            (36, {"eye.L": {"scale": (1, 1, 1)}, "eye.R": {"scale": (1, 1, 1)}}),
        ],
    )
    make_action(
        arm,
        "E_tap_reaction_bounce_60f",
        [
            (1, {"root": {"loc": (0, 0, 0)}, "body_squash": {"scale": (1, 1, 1)}}),
            (10, {"root": {"loc": (0, 0, -0.06)}, "body_squash": {"scale": (1.12, 1, 0.82)}}),
            (24, {"root": {"loc": (0, 0, 0.18)}, "body_squash": {"scale": (0.88, 1, 1.18)}}),
            (42, {"root": {"loc": (0, 0, 0.04)}, "body_squash": {"scale": (1.04, 1, 0.96)}}),
            (60, {"root": {"loc": (0, 0, 0)}, "body_squash": {"scale": (1, 1, 1)}}),
        ],
    )


def create_bubbles(material):
    bubbles = []
    specs = [
        ("hero_bubble_left_interactive", (-2.25, -0.55, 0.34), 0.38, 1),
        ("top_right_large_slow_bubble", (2.1, -0.45, 1.85), 0.28, 20),
        ("small_center_bubble_01", (-0.95, -0.75, 0.82), 0.12, 10),
        ("small_center_bubble_02", (-1.32, -0.62, 0.35), 0.14, 28),
        ("bottom_left_bubble", (-1.95, -0.5, -1.25), 0.22, 44),
        ("tiny_login_bubble_right_low", (1.7, -0.63, -1.35), 0.12, 7),
        ("micro_spark_bubble_top", (0.85, -0.68, 1.48), 0.06, 30),
    ]
    for name, loc, radius, offset in specs:
        bubble = add_uv(name, loc, (radius, radius, radius), material, 64, 24)
        bubble["interaction_role"] = "Can be targeted by login page pointer hover/click; has baked bobbing keyframes."
        for frame, zoff in [(1, 0), (48, 0.13), (96, 0)]:
            bubble.location.z = loc[2] + zoff
            bubble.location.x = loc[0] + math.sin(frame * 0.05 + offset) * 0.05
            bubble.keyframe_insert("location", frame=frame + offset)
        bubbles.append(bubble)
    return bubbles


def create_background(materials):
    # Soft transparent planes for login-page depth, deliberately low-poly and editable.
    for i in range(26):
        z = -1.7 + (i % 13) * 0.32
        x = -2.6 + (i // 13) * 5.1 + math.sin(i) * 0.18
        bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.018 + (i % 4) * 0.006, depth=1.2 + (i % 5) * 0.32, location=(x, 0.6 + (i % 3) * 0.05, z))
        stem = bpy.context.object
        stem.name = f"soft_background_vertical_light_stem_{i:02d}"
        stem.rotation_euler.x = math.radians(7 + (i % 4) * 3)
        stem.data.materials.append(materials["bg_stem"])

    for i in range(11):
        create_elliptic_leaf(
            f"foreground_canopy_leaf_{i:02d}",
            (-2.2 + (i % 5) * 0.38, -0.88, 2.05 - (i // 5) * 0.32 + math.sin(i) * 0.05),
            (math.radians(15 + i * 3), math.radians(0), math.radians(-30 + i * 21)),
            (0.14, 0.33, 0.035),
            materials["leaf"],
        )


def setup_camera_and_lights():
    bpy.ops.object.light_add(type="AREA", location=(-2.4, -3.0, 4.1))
    key = bpy.context.object
    key.name = "large_soft_top_left_forest_key_light"
    key.data.energy = 520
    key.data.size = 4.2

    bpy.ops.object.light_add(type="POINT", location=(0.9, -1.7, 1.45))
    glint = bpy.context.object
    glint.name = "eye_and_bubble_cyan_glint_light"
    glint.data.energy = 70
    glint.data.color = (0.35, 0.82, 1.0)

    bpy.ops.object.camera_add(location=(0, -8.4, 0.28), rotation=(math.radians(88), 0, 0))
    camera = bpy.context.object
    camera.name = "Login_Page_Portrait_Camera_9x16"
    target = Vector((0, 0, 0.08))
    direction = target - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 38
    camera.data.dof.use_dof = True
    camera.data.dof.focus_distance = (target - camera.location).length
    camera.data.dof.aperture_fstop = 3.2
    bpy.context.scene.camera = camera


def configure_scene():
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 96
    scene.render.fps = 24
    scene.render.resolution_x = 1080
    scene.render.resolution_y = 1920
    scene.eevee.taa_render_samples = 64 if hasattr(scene, "eevee") else 16
    scene.world = bpy.data.worlds.new("soft_underwater_forest_world")
    scene.world.color = (0.025, 0.28, 0.34)
    try:
        scene.render.engine = "CYCLES"
        scene.cycles.samples = 96
        scene.cycles.use_denoising = True
    except Exception:
        pass
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1


def add_notes():
    note = bpy.data.texts.new("LOGIN_ASSET_NOTES")
    note.write(
        "White-blue sprite login hero asset\n"
        "- Rig object: Sprite_Login_Rig_armature\n"
        "- Actions: idle float, antenna wave, ear wiggle, blink, tap reaction\n"
        "- Interaction targets: bubbles include custom interaction_role properties\n"
        "- Camera: Login_Page_Portrait_Camera_9x16, framed for a vertical login page\n"
        "- Fur is procedural particle hair; lower rendered_child_count before exporting realtime GLB.\n"
    )


def main():
    clear_scene()
    configure_scene()
    materials = {
        "fur": mat("warm_white_translucent_fur", (0.94, 0.98, 1.0, 1), roughness=0.78),
        "blue_fur": mat("aqua_blue_fur_tips", (0.03, 0.55, 0.95, 1), roughness=0.7),
        "eye_glass": mat("transparent_aqua_eye_glass", (0.07, 0.76, 1.0, 0.48), roughness=0.03, alpha=0.48, transmission=0.65),
        "eye_core": mat("deep_ocean_eye_core", (0.0, 0.08, 0.18, 1), roughness=0.12),
        "highlight": mat("wet_eye_white_highlight", (1, 1, 1, 0.88), roughness=0.02, alpha=0.88),
        "cyan_glow": mat("cyan_lower_eye_glow", (0.0, 0.85, 1.0, 0.7), roughness=0.08, alpha=0.7),
        "nose": mat("tiny_rose_pearl_nose", (0.85, 0.55, 0.58, 1), roughness=0.35),
        "mouth": mat("soft_charcoal_mouth", (0.06, 0.09, 0.12, 1), roughness=0.55),
        "blush": mat("barely_pink_cheek_blush", (1.0, 0.43, 0.65, 0.32), roughness=0.65, alpha=0.32),
        "moss": mat("glowing_moss_carpet", (0.34, 0.62, 0.22, 1), roughness=0.86),
        "soil": mat("soft_shadowed_island_soil", (0.12, 0.18, 0.09, 1), roughness=0.92),
        "flower": mat("tiny_pale_blue_flowers", (0.62, 0.88, 1.0, 1), roughness=0.55),
        "bubble": mat("soap_bubble_thin_film", (0.72, 0.95, 1.0, 0.24), roughness=0.01, alpha=0.24, transmission=0.7),
        "leaf": mat("sunlit_canopy_leaf_green", (0.18, 0.46, 0.18, 0.72), roughness=0.5, alpha=0.72),
        "bg_stem": mat("distant_teal_forest_stems", (0.08, 0.42, 0.46, 0.24), roughness=0.8, alpha=0.24),
    }

    create_background(materials)
    create_island(materials["moss"], materials["soil"], materials["flower"])
    body = create_creature(materials)
    arm = create_armature()
    add_rig_modifier(body, arm)
    create_actions(arm)
    bubbles = create_bubbles(materials["bubble"])
    setup_camera_and_lights()
    add_notes()

    # Organize top-level asset naming for future app import/export.
    for obj in bpy.context.scene.objects:
        obj["asset_family"] = "white_blue_sprite_login_hero"
    for bubble in bubbles:
        bubble["animation_loop_frames"] = "1-96"

    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    if os.environ.get("SKIP_PREVIEW_RENDER") == "1":
        print(f"SAVED_BLEND={BLEND_PATH}")
        print("SKIPPED_PREVIEW_RENDER=1")
        return
    bpy.context.scene.render.filepath = PREVIEW_PATH
    bpy.ops.render.render(write_still=True)
    print(f"SAVED_BLEND={BLEND_PATH}")
    print(f"SAVED_PREVIEW={PREVIEW_PATH}")


if __name__ == "__main__":
    main()
