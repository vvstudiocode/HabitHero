"""Render a lightweight Blender preview of the in-place walk cycle."""

import os

import bpy
from mathutils import Vector


ROOT = "/Users/studio.vv/Desktop/HabitHero"
BLEND = os.path.join(ROOT, "habit_hero_quadruped_walking_rig.blend")
OUTPUT_DIR = os.path.join(ROOT, "habit_hero_walk_preview_frames")


def main():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    scene = bpy.context.scene
    mesh = next(o for o in scene.objects if o.type == "MESH")
    rig = next(o for o in scene.objects if o.type == "ARMATURE")
    rig.animation_data_create()
    rig.animation_data.action = bpy.data.actions["Walk_InPlace"]
    rig.hide_render = True

    bounds = [mesh.matrix_world @ Vector(v) for v in mesh.bound_box]
    mn = Vector((min(v.x for v in bounds), min(v.y for v in bounds), min(v.z for v in bounds)))
    mx = Vector((max(v.x for v in bounds), max(v.y for v in bounds), max(v.z for v in bounds)))
    center = (mn + mx) / 2.0

    # A temporary ground plane makes foot contact and body bob easier to read.
    bpy.ops.mesh.primitive_plane_add(size=8.0, location=(center.x, center.y, mn.z - 0.015))
    ground = bpy.context.object
    ground.name = "Preview_Ground"
    material = bpy.data.materials.new("Preview_Ground_Material")
    material.diffuse_color = (0.08, 0.12, 0.10, 1.0)
    ground.data.materials.append(material)

    cam_data = bpy.data.cameras.new("WalkPreviewCamera")
    cam = bpy.data.objects.new("WalkPreviewCamera", cam_data)
    scene.collection.objects.link(cam)
    cam.location = center + Vector((2.7, -4.3, 1.55))
    cam.data.lens = 58
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam

    scene.frame_start = 1
    scene.frame_end = 49
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = 480
    scene.render.resolution_y = 360
    scene.render.resolution_percentage = 100
    # Blender 5.2 exposes movie output through the separate ffmpeg settings;
    # image_settings only accepts still-image formats.
    scene.render.image_settings.file_format = "PNG"
    scene.render.fps = 24
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    scene.render.filepath = os.path.join(OUTPUT_DIR, "walk_")
    scene.render.film_transparent = False
    scene.world.color = (0.025, 0.035, 0.05)
    scene.display.shading.light = "STUDIO"
    scene.display.shading.studio_light = "paint.sl"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = "WORLD"
    bpy.ops.render.render(animation=True)
    print("WALK_PREVIEW_FRAMES_DONE", OUTPUT_DIR)


if __name__ == "__main__":
    main()
