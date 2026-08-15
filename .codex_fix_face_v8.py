import bpy, os
from mathutils import Vector
SRC='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v6_connected.blend'
OUT='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v8_face_seam_fixed.blend'
DIR='/tmp/habithero_v8_face_frames'
os.makedirs(DIR,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=SRC)
o=bpy.data.objects['HabitHero_Character']; a=bpy.data.objects['HabitHero_Rig']; me=o.data
vg={g.name:g for g in o.vertex_groups}
limb_names=['shoulder.L','upper_arm.L','forearm.L','hand.L','shoulder.R','upper_arm.R','forearm.R','hand.R','upper_leg.L','lower_leg.L','foot.L','toe.L','upper_leg.R','lower_leg.R','foot.R','toe.R']
limbs=[vg[n] for n in limb_names if n in vg]
head=vg.get('head'); neck=vg.get('neck'); chest=vg.get('chest'); spine=vg.get('spine'); pelvis=vg.get('pelvis')

# Weight the upper character as one rigid head/hood piece. The lower edge is left
# to chest/neck so the scarf hides the transition; no visible face-to-hood seam is cut.
upper=0
for v in me.vertices:
    x,y,z=v.co
    in_upper_character = z >= 0.56 and abs(x) <= 0.315
    if not in_upper_character: continue
    upper += 1
    for g in limbs:
        try: g.remove([v.index])
        except RuntimeError: pass
    if z >= 0.59 and head:
        head.add([v.index],1.0,'REPLACE')
        for g in (neck,chest,spine,pelvis):
            if g:
                try:g.remove([v.index])
                except RuntimeError:pass
    elif z >= 0.56 and chest:
        # scarf/neck border: chest drives the whole border consistently
        chest.add([v.index],0.70,'REPLACE')
        if neck: neck.add([v.index],0.30,'REPLACE')
        if head:
            try: head.remove([v.index])
            except RuntimeError: pass

# Keep head and neck animation intact; only the weight boundary was changed.
a['skeleton_version']='v8_face_hood_seam_fixed'
a['face_hood_policy']='upper character shell head-only above Z=0.59; scarf border chest/neck'
a['face_hood_limb_influences_removed']=True

s=bpy.context.scene; s.frame_start=1; s.frame_end=48; s.render.engine='BLENDER_EEVEE'; s.render.resolution_percentage=100; s.render.image_settings.file_format='PNG'
for f in [1,7,13,19,25,31,37,43]:
    s.frame_set(f); s.render.resolution_x=600; s.render.resolution_y=600; s.render.filepath=os.path.join(DIR,f'frame_{f:02d}.png'); bpy.ops.render.render(write_still=True)
s.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('OUTPUT',OUT,'UPPER',upper,flush=True)
