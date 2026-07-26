import bpy, math
from mathutils import Vector

mesh = next((o for o in bpy.context.scene.objects if o.type == 'MESH'), None)
if not mesh:
    raise RuntimeError('No character mesh found')
for o in list(bpy.context.scene.objects):
    if o.type == 'ARMATURE' and o.name.startswith('HH_'):
        bpy.data.objects.remove(o, do_unlink=True)

bb = [Vector(v) for v in mesh.bound_box]
mn = Vector((min(v.x for v in bb), min(v.y for v in bb), min(v.z for v in bb)))
mx = Vector((max(v.x for v in bb), max(v.y for v in bb), max(v.z for v in bb)))
c = (mn + mx) / 2; w, d, h = mx.x-mn.x, mx.y-mn.y, mx.z-mn.z

data = bpy.data.armatures.new('HH_GameRig')
rig = bpy.data.objects.new('HH_GameRig', data)
bpy.context.collection.objects.link(rig); rig.matrix_world = mesh.matrix_world.copy()
bpy.context.view_layer.objects.active = rig; rig.select_set(True); mesh.select_set(False)
bpy.ops.object.mode_set(mode='EDIT')
bones = {}
def B(n, a, b, p=None):
    x = data.edit_bones.new(n); x.head, x.tail = a, b
    if p: x.parent = bones[p]
    bones[n] = x
B('root',(c.x,c.y,mn.z),(c.x,c.y,mn.z+.12*h))
B('pelvis',(c.x,c.y,mn.z+.2*h),(c.x,c.y,mn.z+.36*h),'root')
B('spine',(c.x,c.y,mn.z+.34*h),(c.x,c.y,mn.z+.57*h),'pelvis')
B('chest',(c.x,c.y,mn.z+.55*h),(c.x,c.y,mn.z+.7*h),'spine')
B('neck',(c.x,c.y,mn.z+.68*h),(c.x,c.y,mn.z+.78*h),'chest')
B('head',(c.x,c.y,mn.z+.76*h),(c.x,c.y,mx.z),'neck')
for s, sy in [('L',1),('R',-1)]:
    B('front_'+s,(c.x+.18*w,c.y+sy*.18*d,mn.z+.56*h),(c.x+.18*w,c.y+sy*.18*d,mn.z+.34*h),'chest')
    B('front_foot_'+s,(c.x+.18*w,c.y+sy*.18*d,mn.z+.34*h),(c.x+.18*w,c.y+sy*.18*d,mn.z+.08*h),'front_'+s)
    B('back_'+s,(c.x-.2*w,c.y+sy*.18*d,mn.z+.5*h),(c.x-.2*w,c.y+sy*.18*d,mn.z+.28*h),'pelvis')
    B('back_foot_'+s,(c.x-.2*w,c.y+sy*.18*d,mn.z+.28*h),(c.x-.2*w,c.y+sy*.18*d,mn.z+.08*h),'back_'+s)
    B('ear_'+s,(c.x,c.y+sy*.12*d,mn.z+.79*h),(c.x,c.y+sy*.18*d,mx.z+.12*h),'head')
for i in range(4):
    a = Vector((mx.x*.75+c.x*.25+i*.13*w,c.y,mn.z+.42*h-i*.025*h))
    B('tail_%02d'%i,a,a+Vector((.16*w,.04*(-1 if i%2 else 1),-.015*h)),'pelvis' if i==0 else 'tail_%02d'%(i-1))
bpy.ops.object.mode_set(mode='POSE')
for p in rig.pose.bones: p.rotation_mode='XYZ'
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT'); mesh.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active=rig
try: bpy.ops.object.parent_set(type='ARMATURE_AUTO')
except Exception:
    m=mesh.modifiers.get('HH_Armature') or mesh.modifiers.new('HH_Armature','ARMATURE'); m.object=rig

if not mesh.data.shape_keys: mesh.shape_key_add(name='Basis')
if 'Blink' not in mesh.data.shape_keys.key_blocks: mesh.shape_key_add(name='Blink')
def reset():
    bpy.context.view_layer.objects.active=rig; bpy.ops.object.mode_set(mode='POSE')
    for p in rig.pose.bones: p.rotation_euler=(0,0,0); p.location=(0,0,0)
    bpy.ops.object.mode_set(mode='OBJECT')
def key(n,f,r=(0,0,0),l=(0,0,0)):
    p=rig.pose.bones.get(n)
    if p: p.rotation_euler=r; p.location=l; p.keyframe_insert('rotation_euler',frame=f); p.keyframe_insert('location',frame=f)
def action(n,end):
    reset(); a=bpy.data.actions.get(n) or bpy.data.actions.new(n); a.frame_start=1; a.frame_end=end; a.use_fake_user=True
    if hasattr(a, 'fcurves'):
        while a.fcurves: a.fcurves.remove(a.fcurves[0])
    rig.animation_data_create(); rig.animation_data.action=a; return a

action('Idle',60)
for f,a in [(1,.06),(30,-.06),(60,.06)]: key('spine',f,(a,0,0)); key('chest',f,(a*.6,0,0)); key('tail_01',f,(0,a*4,0)); key('tail_02',f,(0,-a*6,0))
for name,end,amp in [('Walk',32,.72),('Run',24,1.05)]:
    action(name,end)
    frames=[1,9,17,25,32] if name=='Walk' else [1,7,13,19,24]
    for i,f in enumerate(frames):
        ph=1 if i%2==0 else -1; s=ph*amp
        key('front_L',f,(s*.8,s,0)); key('front_R',f,(-s*.8,-s,0)); key('back_L',f,(-s*.8,-s,0)); key('back_R',f,(s*.8,s,0)); key('root',f,l=(0,0,(.08*h if ph>0 else 0))); key('spine',f,(ph*.12,0,0)); key('tail_01',f,(0,ph*amp*.8,0)); key('tail_02',f,(0,-ph*amp*1.1,0))
action('Jump',36)
for f,z in [(1,0),(10,-.08*h),(18,.58*h),(26,.12*h),(36,0)]: key('root',f,l=(0,0,z))
for f,r in [(1,-.25),(10,-.55),(18,.25),(26,.45),(36,0)]:
    key('front_L',f,(0,r,0)); key('front_R',f,(0,r,0)); key('back_L',f,(0,-r,0)); key('back_R',f,(0,-r,0))
action('Wave',48)
for f,r in [(1,0),(12,-1.25),(24,-1.7),(36,-1.25),(48,0)]: key('front_L',f,(0,r,.35 if r else 0))
for f,r in [(1,0),(24,.32),(48,0)]: key('head',f,(0,r,0))
action('Celebrate',48)
for f,r in [(1,0),(12,-.4),(24,.4),(36,-.4),(48,0)]:
    key('root',f,l=(0,0,.2*h if f in (12,36) else 0)); key('tail_01',f,(0,r,0)); key('tail_02',f,(0,-r*1.8,0)); key('ear_L',f,(r*.8,0,0)); key('ear_R',f,(-r*.8,0,0))
action('LookAround',48)
for f,r in [(1,-.22),(24,.22),(48,0)]: key('head',f,(0,r,0))
reset(); a=bpy.data.actions.get('Blink') or bpy.data.actions.new('Blink'); a.frame_start=1; a.frame_end=20; a.use_fake_user=True; rig.animation_data.action=a
sk=mesh.data.shape_keys.key_blocks.get('Blink')
if sk:
    for f,v in [(1,0),(8,1),(11,1),(20,0)]: sk.value=v; sk.keyframe_insert('value',frame=f)
rig.show_in_front=True; data.display_type='BBONE'
bpy.context.view_layer.objects.active=rig; rig.select_set(True); mesh.select_set(False)
bpy.ops.wm.save_as_mainfile(filepath='/Users/studio.vv/Downloads/Meshy_AI_Starlight_Rainbow_Kit_0726024804_rigged.blend')
try: bpy.ops.export_scene.gltf(filepath='/Users/studio.vv/Downloads/Meshy_AI_Starlight_Rainbow_Kit_0726024804_character.glb',export_format='GLB',export_animations=True,export_skins=True)
except Exception as e: print('GLB_EXPORT_WARNING',e)
print('HABITHERO_DONE')
