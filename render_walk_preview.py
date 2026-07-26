import bpy, os
from mathutils import Vector

scene = bpy.context.scene
rig = bpy.data.objects.get('HH_GameRig')
mesh = bpy.data.objects.get('Mesh1.0')
if not rig or not mesh:
    raise RuntimeError('Character rig or mesh not found')

rig.animation_data_create()
rig.animation_data.action = bpy.data.actions.get('Walk')
scene.frame_start, scene.frame_end = 1, 32

for o in scene.objects:
    if o.type == 'ARMATURE':
        o.hide_render = True

bb = [mesh.matrix_world @ Vector(v) for v in mesh.bound_box]
mn = Vector((min(v.x for v in bb), min(v.y for v in bb), min(v.z for v in bb)))
mx = Vector((max(v.x for v in bb), max(v.y for v in bb), max(v.z for v in bb)))
center = (mn + mx) / 2
w, d, h = mx.x-mn.x, mx.y-mn.y, mx.z-mn.z

cam_data = bpy.data.cameras.new('HH_PreviewCamera')
cam = bpy.data.objects.new('HH_PreviewCamera', cam_data)
scene.collection.objects.link(cam)
cam.location = center + Vector((2.4*w, -3.2*d, .75*h))
cam.data.lens = 58
cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = cam

scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.display.shading.light = 'STUDIO'
scene.display.shading.studio_light = 'paint.sl'
scene.display.shading.color_type = 'MATERIAL'
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.display.shading.cavity_type = 'WORLD'
scene.world.color = (0.035, 0.035, 0.05)

out_dir = '/Users/studio.vv/Desktop/HabitHero/walk_preview_frames'
os.makedirs(out_dir, exist_ok=True)
scene.render.filepath = os.path.join(out_dir, 'walk_')
bpy.ops.render.render(animation=True)
scene.render.image_settings.file_format = 'FFMPEG'
scene.render.ffmpeg.format = 'MPEG4'
scene.render.ffmpeg.codec = 'H264'
scene.render.fps = 12
scene.render.filepath = '/Users/studio.vv/Desktop/HabitHero/walk_preview.mp4'
bpy.ops.render.render(animation=True)
print('WALK_PREVIEW_DONE', out_dir)
