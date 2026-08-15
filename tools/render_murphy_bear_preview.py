"""Render a local visual check of the exported Murphy Bear GLB."""

import os

import bpy
from mathutils import Vector


GLB = "/Users/studio.vv/Desktop/HabitHero/public/assets/pets/murphy-bear.glb"
OUTPUT = "/tmp/murphy-bear-preview.png"


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB)
    scene = bpy.context.scene

    meshes = [obj for obj in scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("No mesh imported from Murphy Bear GLB")
    for obj in scene.objects:
        if obj.type == "ARMATURE":
            obj.hide_render = True

    corners = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum = Vector((min(point.x for point in corners), min(point.y for point in corners), min(point.z for point in corners)))
    maximum = Vector((max(point.x for point in corners), max(point.y for point in corners), max(point.z for point in corners)))
    center = (minimum + maximum) / 2.0
    extent = max(maximum.x - minimum.x, maximum.y - minimum.y, maximum.z - minimum.z)

    bpy.ops.mesh.primitive_plane_add(size=extent * 5.0, location=(center.x, center.y, minimum.z - extent * 0.015))
    ground = bpy.context.object
    ground.data.materials.append(bpy.data.materials.new("MurphyPreviewGround"))
    ground.active_material.diffuse_color = (0.025, 0.045, 0.055, 1.0)

    camera_data = bpy.data.cameras.new("MurphyPreviewCamera")
    camera = bpy.data.objects.new("MurphyPreviewCamera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = center + Vector((extent * 0.75, -extent * 2.4, extent * 0.35))
    camera.data.lens = 58
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera

    for name, location, energy, size in (
        ("Key", center + Vector((extent * 1.5, -extent * 2.0, extent * 2.4)), 900, extent),
        ("Fill", center + Vector((-extent * 1.5, -extent, extent * 1.2)), 500, extent * 0.8),
    ):
        light_data = bpy.data.lights.new(name, "AREA")
        light_data.energy = energy
        light_data.shape = "DISK"
        light_data.size = size
        light = bpy.data.objects.new(name, light_data)
        scene.collection.objects.link(light)
        light.location = location
        light.rotation_euler = (center - light.location).to_track_quat("-Z", "Y").to_euler()

    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = OUTPUT
    scene.world = bpy.data.worlds.new("MurphyPreviewWorld")
    scene.world.color = (0.008, 0.012, 0.018)
    scene.render.film_transparent = False
    scene.frame_set(1)
    bpy.ops.render.render(write_still=True)
    print("MURPHY_BEAR_PREVIEW", OUTPUT)


if __name__ == "__main__":
    main()
