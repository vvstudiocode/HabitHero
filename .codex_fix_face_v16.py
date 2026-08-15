import bpy, os
SRC='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v6_connected.blend'
OUT='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v16_face_smooth_weights.blend'
DIR='/tmp/habithero_v16_face_frames'
os.makedirs(DIR,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=SRC)
o=bpy.data.objects['HabitHero_Character']; a=bpy.data.objects['HabitHero_Rig']; me=o.data
groups={g.name:g for g in o.vertex_groups}
all_names={'shoulder.L','shoulder.R','upper_arm.L','upper_arm.R','forearm.L','forearm.R','hand.L','hand.R'}
kept_names={'head','neck','chest','spine','pelvis'}
fixed=0; changed_weight=0
def smoothstep(t):
    t=max(0.0,min(1.0,t)); return t*t*(3.0-2.0*t)
for v in me.vertices:
    p=v.co
    if abs(p.x)>0.325 or p.z<0.52: continue
    # Fade out erroneous arm influence through the scarf/face transition.
    f=smoothstep((p.z-0.52)/(0.70-0.52))
    if f<=0.0001: continue
    entries=[(groups[o.vertex_groups[e.group].name],o.vertex_groups[e.group].name,e.weight) for e in v.groups if e.group<len(o.vertex_groups)]
    limb_total=sum(w for g,n,w in entries if n in all_names)
    if limb_total<0.0001: continue
    moved=limb_total*f
    remaining=[(g,n,w) for g,n,w in entries if n not in all_names and n in kept_names]
    rem_total=sum(w for g,n,w in remaining)
    if rem_total<=0: continue
    for g,n,w in entries:
        if n in all_names:
            g.remove([v.index])
            if w*(1.0-f)>0.00001: g.add([v.index],w*(1.0-f),'REPLACE')
    for g,n,w in remaining:
        g.add([v.index],moved*(w/rem_total),'ADD')
    fixed+=1
    if moved>0.05: changed_weight+=1
a['skeleton_version']='v16_face_smooth_weights'
a['face_weight_policy']='smoothly fade arm influence from Z=0.52 to Z=0.70; no hard face cut and no geometry split'
a['face_vertices_fixed']=fixed
a['face_vertices_strongly_affected']=changed_weight
a['face_fix_note']='Shoulder/arm weights are reduced gradually through the scarf-to-face transition to prevent a visible deformation seam.'
s=bpy.context.scene; s.frame_start=1; s.frame_end=48; s.render.engine='BLENDER_EEVEE'; s.render.resolution_percentage=100; s.render.image_settings.file_format='PNG'
for f in [1,7,13,19,25,31,37,43]:
    s.frame_set(f); s.render.resolution_x=600; s.render.resolution_y=600; s.render.filepath=os.path.join(DIR,f'frame_{f:02d}.png'); bpy.ops.render.render(write_still=True)
s.frame_set(1); bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('OUTPUT',OUT,'FIXED',fixed,'STRONG',changed_weight,flush=True)
