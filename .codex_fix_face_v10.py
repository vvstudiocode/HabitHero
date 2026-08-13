import bpy, os, math
from mathutils import Vector
SRC='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v6_connected.blend'
OUT='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v10_face_locked_clean.blend'
DIR='/tmp/habithero_v10_face_frames'
os.makedirs(DIR,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=SRC)
o=bpy.data.objects['HabitHero_Character']; a=bpy.data.objects['HabitHero_Rig']; me=o.data
groups={g.name:g for g in o.vertex_groups}; allg=list(o.vertex_groups)
limbs=[groups[n] for n in ['shoulder.L','upper_arm.L','forearm.L','hand.L','shoulder.R','upper_arm.R','forearm.R','hand.R'] if n in groups]
head=groups['head']; neck=groups['neck']; chest=groups['chest']; spine=groups['spine']; pelvis=groups['pelvis']
center=Vector((0.0,0.018,0.835)); radii=Vector((0.345,0.355,0.335))
head_count=0
for v in me.vertices:
    p=v.co
    d=math.sqrt(((p.x-center.x)/radii.x)**2+((p.y-center.y)/radii.y)**2+((p.z-center.z)/radii.z)**2)
    front_face=p.z>=0.63 and p.y<-0.07 and abs(p.x)<0.30
    sprout=p.z>1.02 and abs(p.x)<0.20
    # Head shell includes the full side perimeter and lower edge; scarf hides the only boundary.
    if d<=1.18 or front_face or sprout:
        for g in allg:
            try:g.remove([v.index])
            except RuntimeError:pass
        head.add([v.index],1.0,'REPLACE')
        head_count+=1
# Explicitly keep the scarf/body below the head edge on torso bones, and remove arm influence
# from the narrow transition ring immediately under the face.
for v in me.vertices:
    p=v.co
    if 0.54<=p.z<0.63 and abs(p.x)<0.32:
        for g in limbs:
            try:g.remove([v.index])
            except RuntimeError:pass
# Metadata
a['skeleton_version']='v10_face_locked_clean'
a['face_weight_policy']='entire head/hood shell rigid to head; seam below scarf'
a['face_vertices_head_locked']=head_count
a['face_limb_weights_removed']=True
a['face_fix_note']='Head, hood and face follow one head bone; lower boundary is hidden by scarf.'
s=bpy.context.scene; s.frame_start=1; s.frame_end=48; s.render.engine='BLENDER_EEVEE'; s.render.resolution_percentage=100; s.render.image_settings.file_format='PNG'
for f in [1,7,13,19,25,31,37,43]:
    s.frame_set(f); s.render.resolution_x=600; s.render.resolution_y=600; s.render.filepath=os.path.join(DIR,f'frame_{f:02d}.png'); bpy.ops.render.render(write_still=True)
s.frame_set(1); bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('OUTPUT',OUT,'HEAD_LOCKED',head_count,flush=True)
