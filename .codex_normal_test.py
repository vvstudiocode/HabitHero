import bpy, os
SRC='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v13_face_limb_clean.blend'
DIR='/tmp/habithero_normal_test'
os.makedirs(DIR,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=SRC)
o=bpy.data.objects['HabitHero_Character']; mat=o.active_material
normal=next((n for n in mat.node_tree.nodes if n.type=='NORMAL_MAP'),None)
if normal: normal.inputs['Strength'].default_value=0.0
s=bpy.context.scene;s.render.engine='BLENDER_EEVEE';s.render.resolution_x=600;s.render.resolution_y=600;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG'
for f in [1,13,31,43]:
 s.frame_set(f);s.render.filepath=os.path.join(DIR,f'frame_{f:02d}.png');bpy.ops.render.render(write_still=True)
print('DONE',flush=True)
