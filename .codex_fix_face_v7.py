import bpy, os
from mathutils import Vector
SRC='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v6_connected.blend'
OUT='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v7_face_locked.blend'
DIR='/tmp/habithero_v7_face_frames'
os.makedirs(DIR,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=SRC)
o=bpy.data.objects['HabitHero_Character']; a=bpy.data.objects['HabitHero_Rig']; me=o.data
groups={g.name:g for g in o.vertex_groups}
limb_names=['shoulder.L','upper_arm.L','forearm.L','hand.L','shoulder.R','upper_arm.R','forearm.R','hand.R','upper_leg.L','lower_leg.L','foot.L','toe.L','upper_leg.R','lower_leg.R','foot.R','toe.R']
limbs=[groups[n] for n in limb_names if n in groups]
head=groups.get('head'); neck=groups.get('neck'); chest=groups.get('chest'); spine=groups.get('spine'); pelvis=groups.get('pelvis')

# Protect the entire face/head shell. Facial features and forehead are one continuous surface
# and should follow head, not walking torso bones.
protected=0
for v in me.vertices:
    x,y,z=v.co
    # Broad head shell above the scarf line, including front and back sides.
    is_head_shell = z >= 0.635 and abs(x) <= 0.305
    # exclude the very top sprout; keep its existing torso/head transition untouched.
    if not is_head_shell: continue
    protected += 1
    for g in limbs:
        try: g.remove([v.index])
        except RuntimeError: pass
    if head:
        # rigid head preserves eyes, mouth and face silhouette during walk
        head.add([v.index],1.0,'REPLACE')
    for g in (neck,chest,spine,pelvis):
        if g:
            try: g.remove([v.index])
            except RuntimeError: pass

# Lock scarf/neck transition below head more gently: remove arm and leg influence only.
# This keeps the scarf/body deforming without pulling the face.
for v in me.vertices:
    x,y,z=v.co
    if 0.54 <= z < 0.635 and abs(x) <= 0.31:
        for g in limbs:
            try: g.remove([v.index])
            except RuntimeError: pass

# Keep the existing walk action unchanged. The face is protected by weights alone.
# This avoids touching Blender 5.2's layered Action API and preserves all keyed motion.
bpy.context.view_layer.objects.active=a
bpy.ops.object.mode_set(mode='POSE')
for n in ('head','neck'):
    pb=a.pose.bones.get(n)
    if pb:
        pb.rotation_mode='XYZ'
        pb.rotation_euler=(0,0,0)
        pb.location=(0,0,0)
bpy.ops.object.mode_set(mode='OBJECT')

a['skeleton_version']='v7_face_locked_walk'
a['face_weight_policy']='head_only_for_z>=0.635'
a['face_limb_influences_removed']=True
a['head_neck_walk_keys_removed']=False
a['face_fix_note']='Face shell follows head only; torso walk motion cannot distort facial features.'

scene=bpy.context.scene
scene.frame_start=1; scene.frame_end=48
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
for f in (1,7,13,19,25,31,37,43):
    scene.frame_set(f)
    scene.render.resolution_x=600; scene.render.resolution_y=600
    scene.render.filepath=os.path.join(DIR,f'frame_{f:02d}.png')
    bpy.ops.render.render(write_still=True)
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('OUTPUT',OUT,flush=True)
print('PROTECTED_HEAD_VERTS',protected,flush=True)
print('ACTION',a.animation_data.action.name if a.animation_data and a.animation_data.action else None,flush=True)
