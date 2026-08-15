"""Render a local visual reference of the supplied Magellan Rabbit blend."""

import bpy
from mathutils import Vector


BLEND = "/Users/studio.vv/Downloads/麥哲倫旅行兔_腿部調整_只動腳.blend"
OUTPUT = "/tmp/magellan-rabbit-source-preview.png"


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    scene = bpy.context.scene
    meshes = [obj for obj in scene.objects if obj.type == "MESH"]
    mesh = meshes[0]
    for obj in scene.objects:
        if obj.type == "ARMATURE":
            obj.hide_render = True
    corners = [mesh.matrix_world @ Vector(corner) for corner in mesh.bound_box]
    minimum = Vector((min(point.x for point in corners), min(point.y for point in corners), min(point.z for point in corners)))
    maximum = Vector((max(point.x for point in corners), max(point.y for point in corners), max(point.z for point in corners)))
    center = (minimum + maximum) / 2.0
    extent = max(maximum.x - minimum.x, maximum.y - minimum.y, maximum.z - minimum.z)
    bpy.ops.mesh.primitive_plane_add(size=extent * 5.0, location=(center.x, center.y, minimum.z - extent * 0.015))
    ground = bpy.context.object
    ground.data.materials.append(bpy.data.materials.new("SourcePreviewGround"))
    ground.active_material.diffuse_color = (0.025, 0.045, 0.055, 1.0)
    camera_data = bpy.data.cameras.new("SourcePreviewCamera")
    camera = bpy.data.objects.new("SourcePreviewCamera", camera_data)
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
    scene.world = bpy.data.worlds.new("SourcePreviewWorld")
    scene.world.color = (0.008, 0.012, 0.018)
    scene.render.film_transparent = False
    scene.frame_set(20)
    bpy.ops.render.render(write_still=True)
    print("MAGELLAN_SOURCE_PREVIEW", OUTPUT)


if __name__ == "__main__":
    main()
