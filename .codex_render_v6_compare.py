import bpy, os
SRC='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v6_connected.blend'
DIR='/tmp/habithero_v6_compare'
os.makedirs(DIR,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=SRC)
s=bpy.context.scene; s.render.engine='BLENDER_EEVEE'; s.render.resolution_x=600; s.render.resolution_y=600; s.render.resolution_percentage=100; s.render.image_settings.file_format='PNG'
for f in [1,7,13,19]:
 s.frame_set(f); s.render.filepath=os.path.join(DIR,f'frame_{f:02d}.png'); bpy.ops.render.render(write_still=True)
print('DONE')
