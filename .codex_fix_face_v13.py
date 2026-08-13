import bpy, os
from mathutils import Vector
SRC='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v6_connected.blend'
OUT='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v13_face_limb_clean.blend'
DIR='/tmp/habithero_v13_face_frames'
os.makedirs(DIR,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=SRC)
o=bpy.data.objects['HabitHero_Character']; a=bpy.data.objects['HabitHero_Rig']; me=o.data
allg=list(o.vertex_groups)
limb_names={'shoulder.L','upper_arm.L','forearm.L','hand.L','shoulder.R','upper_arm.R','forearm.R','hand.R'}
kept_names={'head','neck','chest','spine','pelvis'}
fixed=0
for v in me.vertices:
    p=v.co
    # Only the visible face/hood region. Leave scarf/body untouched.
    if not (p.z >= 0.615 and abs(p.x) <= 0.32):
        continue
    entries=[(allg[e.group],e.weight) for e in v.groups if e.group < len(allg)]
    limb_total=sum(w for g,w in entries if g.name in limb_names)
    if limb_total <= 0.001:
        continue
    remaining=[(g.name,w) for g,w in entries if g.name not in limb_names and g.name in kept_names]
    remaining_total=sum(w for n,w in remaining)
    # Remove only arm/hand influence, preserve the original torso/head balance.
    for g,w in entries:
        if g.name in limb_names:
            try:g.remove([v.index])
            except RuntimeError:pass
    if remaining_total>0:
        for n,w in remaining:
            allg[v.group if False else 0] if False else None
            groups_by_name={x.name:x for x in allg}
            groups_by_name[n].add([v.index],limb_total*w/remaining_total,'ADD')
    else:
        groups_by_name={x.name:x for x in allg}
        groups_by_name['head' if p.z>0.70 else 'chest'].add([v.index],limb_total,'ADD')
    fixed+=1
a['skeleton_version']='v13_face_limb_clean'
a['face_weight_policy']='only remove shoulder/arm/hand weights from face/hood; preserve head/neck/chest balance'
a['face_vertices_fixed']=fixed
a['face_fix_note']='No head animation keys changed; no rigid face cut; only erroneous limb influence removed.'
s=bpy.context.scene;s.frame_start=1;s.frame_end=48;s.render.engine='BLENDER_EEVEE';s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG'
for f in [1,7,13,19,25,31,37,43]:
 s.frame_set(f);s.render.resolution_x=600;s.render.resolution_y=600;s.render.filepath=os.path.join(DIR,f'frame_{f:02d}.png');bpy.ops.render.render(write_still=True)
s.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('OUTPUT',OUT,'FIXED',fixed,flush=True)
