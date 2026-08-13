import bpy, os
from mathutils import Vector
SRC='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v6_connected.blend'
OUT='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v12_face_influence_fixed.blend'
DIR='/tmp/habithero_v12_face_frames'
os.makedirs(DIR,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=SRC)
o=bpy.data.objects['HabitHero_Character']; a=bpy.data.objects['HabitHero_Rig']; me=o.data
groups={g.name:g for g in o.vertex_groups}
allg=list(o.vertex_groups)
limb_names={'shoulder.L','upper_arm.L','forearm.L','hand.L','shoulder.R','upper_arm.R','forearm.R','hand.R','upper_leg.L','lower_leg.L','foot.L','toe.L','upper_leg.R','lower_leg.R','foot.R','toe.R'}
kept_names={'head','neck','chest','spine','pelvis'}
fixed=0; affected=0
for v in me.vertices:
    p=v.co
    # Head/hood and the narrow upper-scarf area. This excludes arm bones from
    # vertices that can appear in the face/hood silhouette.
    if p.z < 0.615 or abs(p.x) > 0.325:
        continue
    entries=[(allg[g.group],g.weight) for g in v.groups if g.group < len(allg)]
    limb_total=sum(w for g,w in entries if g.name in limb_names)
    if limb_total < 0.001:
        continue
    remaining=[(g.name,w) for g,w in entries if g.name not in limb_names]
    # Remove limb weights, then distribute the same total among existing torso/head
    # influences, preserving local deformation and avoiding a hard region cut.
    for g,w in entries:
        if g.name in limb_names:
            try: g.remove([v.index])
            except RuntimeError: pass
    torso=[(n,w) for n,w in remaining if n in kept_names and w>0.0001]
    total=sum(w for n,w in torso)
    if total>0:
        for n,w in torso:
            groups[n].add([v.index], limb_total*(w/total), 'ADD')
    else:
        target='head' if p.z>=0.70 else 'chest'
        groups[target].add([v.index], limb_total, 'ADD')
    fixed+=1
    if limb_total>0.05: affected+=1

# Store what was fixed.
a['skeleton_version']='v12_face_influence_fixed'
a['face_weight_policy']='remove limb influence above Z=0.615; redistribute to existing head/neck/chest/spine/pelvis weights'
a['face_vertices_fixed']=fixed
a['face_vertices_strongly_affected']=affected
a['face_fix_note']='Only erroneous limb weights were removed; original head/body deformation balance preserved.'

scene=bpy.context.scene
scene.frame_start=1; scene.frame_end=48
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
for f in [1,7,13,19,25,31,37,43]:
    scene.frame_set(f)
    scene.render.resolution_x=600; scene.render.resolution_y=600
    scene.render.filepath=os.path.join(DIR,f'frame_{f:02d}.png')
    bpy.ops.render.render(write_still=True)
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('OUTPUT',OUT,'FIXED',fixed,'STRONG',affected,flush=True)
