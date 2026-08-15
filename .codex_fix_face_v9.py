import bpy, os, math
from mathutils import Vector

SRC='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v6_connected.blend'
OUT='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v9_face_weighted.blend'
DIR='/tmp/habithero_v9_face_frames'
os.makedirs(DIR, exist_ok=True)

bpy.ops.wm.open_mainfile(filepath=SRC)
obj=bpy.data.objects['HabitHero_Character']
arm=bpy.data.objects['HabitHero_Rig']
mesh=obj.data
groups={g.name:g for g in obj.vertex_groups}
head=groups['head']; chest=groups['chest']; neck=groups['neck']
all_groups=list(obj.vertex_groups)

def clear_weights(index):
    for g in all_groups:
        try:
            g.remove([index])
        except RuntimeError:
            pass

def set_weights(index, values):
    clear_weights(index)
    for name, weight in values:
        if weight > 0.0001 and name in groups:
            groups[name].add([index], float(weight), 'REPLACE')

def smoothstep(a,b,x):
    t=max(0.0,min(1.0,(x-a)/(b-a)))
    return t*t*(3.0-2.0*t)

# A measured ellipsoid around the complete head/hood. The arm sockets sit
# outside this volume, so the arm bones cannot receive face/head vertices.
center=Vector((0.0, 0.015, 0.835))
radii=Vector((0.335, 0.345, 0.315))
core_count=blend_count=0
for v in mesh.vertices:
    p=v.co
    d=math.sqrt(((p.x-center.x)/radii.x)**2 + ((p.y-center.y)/radii.y)**2 + ((p.z-center.z)/radii.z)**2)
    sprout=(p.z > 1.02 and abs(p.x) < 0.19)
    if sprout or d <= 0.95:
        set_weights(v.index, [('head',1.0)])
        core_count += 1
    elif d < 1.12 and p.z > 0.52:
        # Smooth head/chest transition only. Never leave shoulder/arm weights
        # in the transition band, which is what caused the walking face tear.
        w_head=1.0-smoothstep(0.95,1.12,d)
        set_weights(v.index, [('head',w_head),('chest',1.0-w_head)])
        blend_count += 1

# Explicitly remove limb weights from any clearly facial front vertices.
# This catches cheek/eye/mouth vertices just outside the ellipsoid.
for v in mesh.vertices:
    p=v.co
    front_face = p.z > 0.64 and p.y < -0.075 and abs(p.x) < 0.285
    if front_face:
        # keep rigid head for the facial surface
        set_weights(v.index, [('head',1.0)])
        core_count += 1

arm['skeleton_version']='v9_face_weighted_ellipsoid'
arm['face_weight_policy']='head core + smooth head/chest boundary; no limb weights on face'
arm['face_core_vertices']=core_count
arm['face_blend_vertices']=blend_count
arm['face_limb_weights_removed']=True
arm['face_fix_note']='Head/hood/face are weighted as one rigid region; transition is below/around scarf and smoothly blended.'

scene=bpy.context.scene
scene.frame_start=1
scene.frame_end=48
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
for f in [1,7,13,19,25,31,37,43]:
    scene.frame_set(f)
    scene.render.resolution_x=600
    scene.render.resolution_y=600
    scene.render.filepath=os.path.join(DIR,f'frame_{f:02d}.png')
    bpy.ops.render.render(write_still=True)
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('OUTPUT',OUT,'CORE',core_count,'BLEND',blend_count,flush=True)
