import bpy, os
from mathutils import Vector

SRC='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v6_connected.blend'
OUT='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v11_face_stable.blend'
DIR='/tmp/habithero_v11_face_frames'
os.makedirs(DIR,exist_ok=True)

bpy.ops.wm.open_mainfile(filepath=SRC)
o=bpy.data.objects['HabitHero_Character']; a=bpy.data.objects['HabitHero_Rig']; me=o.data
groups={g.name:g for g in o.vertex_groups}; allg=list(o.vertex_groups)
head=groups['head']; chest=groups['chest']; neck=groups['neck']

# Remove any limb influence from the head/hood shell, then make the shell a single
# stable head region. The boundary is placed under the scarf, which hides it.
head_vertices=0
for v in me.vertices:
    p=v.co
    in_head_shell = (p.z >= 0.57 and abs(p.x) <= 0.325)
    if p.z > 1.015 and abs(p.x) < 0.22:
        in_head_shell=True
    if not in_head_shell:
        continue
    for g in allg:
        try:
            g.remove([v.index])
        except RuntimeError:
            pass
    head.add([v.index],1.0,'REPLACE')
    head_vertices += 1

# Make the scarf/neck border torso-owned consistently and remove any arm influence.
transition_vertices=0
for v in me.vertices:
    p=v.co
    in_transition=(0.535 <= p.z < 0.57 and abs(p.x) <= 0.325)
    if not in_transition:
        continue
    for g in allg:
        if g.name.startswith(('shoulder.','upper_arm.','forearm.','hand.')):
            try:
                g.remove([v.index])
            except RuntimeError:
                pass
    # Keep existing chest/neck balance, but eliminate any accidental limb weights.
    transition_vertices += 1

# Blender 5.2 stores animation curves inside Action channelbags.
# Freeze upper-torso/head twist so the head shell and scarf border cannot shear.
action=a.animation_data.action if a.animation_data else None
frozen={'spine','chest','neck','head'}
removed_curves=0
if action:
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in list(bag.fcurves):
                    if any(('pose.bones["'+name+'"]') in fc.data_path for name in frozen):
                        bag.fcurves.remove(fc)
                        removed_curves += 1

bpy.context.view_layer.objects.active=a
bpy.ops.object.mode_set(mode='POSE')
for name in frozen:
    pb=a.pose.bones.get(name)
    if pb:
        pb.rotation_mode='XYZ'
        pb.rotation_euler=(0.0,0.0,0.0)
        pb.location=(0.0,0.0,0.0)
bpy.ops.object.mode_set(mode='OBJECT')

a['skeleton_version']='v11_face_stable_walk'
a['face_weight_policy']='head shell rigid; scarf border torso-owned'
a['face_head_vertices']=head_vertices
a['face_transition_vertices']=transition_vertices
a['frozen_upper_torso_bones']='spine,chest,neck,head'
a['face_fix_note']='Upper head and face stable during walk; arms and legs retain animation.'

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
print('OUTPUT',OUT,'HEAD',head_vertices,'TRANSITION',transition_vertices,'REMOVED_CURVES',removed_curves,flush=True)
