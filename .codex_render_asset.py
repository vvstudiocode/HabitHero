import bpy
from mathutils import Vector

scene = bpy.context.scene
mesh = bpy.data.objects.get('Mesh1.0') or next(o for o in scene.objects if o.type == 'MESH')
for o in list(scene.objects):
    if o.type == 'CAMERA':
        bpy.data.objects.remove(o, do_unlink=True)

bb = [mesh.matrix_world @ Vector(v) for v in mesh.bound_box]
mn = Vector((min(v.x for v in bb), min(v.y for v in bb), min(v.z for v in bb)))
mx = Vector((max(v.x for v in bb), max(v.y for v in bb), max(v.z for v in bb)))
center = (mn + mx) / 2

cam_data = bpy.data.cameras.new('InspectCamera')
cam = bpy.data.objects.new('InspectCamera', cam_data)
scene.collection.objects.link(cam)
cam.location = center + Vector((2.8, -4.5, 1.9))
cam.data.lens = 65
cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = cam

scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = 640
scene.render.resolution_y = 640
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = '/Users/studio.vv/Desktop/HabitHero/.codex_asset_inspect.png'
scene.display.shading.light = 'STUDIO'
scene.display.shading.studio_light = 'paint.sl'
scene.display.shading.color_type = 'MATERIAL'
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.display.shading.cavity_type = 'WORLD'
scene.world.color = (0.035, 0.035, 0.05)
scene.render.film_transparent = False
bpy.ops.render.render(write_still=True)
