import bpy, os, json, math
from mathutils import Vector
path='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v6_connected.blend'
bpy.ops.wm.open_mainfile(filepath=path)
o=bpy.data.objects['HabitHero_Character']; a=bpy.data.objects['HabitHero_Rig']; me=o.data
print('OBJ',o.name,'ARM',o.find_armature().name if o.find_armature() else None,'groups',len(o.vertex_groups),'action',a.animation_data.action.name if a.animation_data and a.animation_data.action else None)
names={g.index:g.name for g in o.vertex_groups}
limb=set(['shoulder.L','upper_arm.L','forearm.L','hand.L','shoulder.R','upper_arm.R','forearm.R','hand.R','upper_leg.L','lower_leg.L','foot.L','toe.L','upper_leg.R','lower_leg.R','foot.R','toe.R'])
face=[]
for v in me.vertices:
    x,y,z=v.co
    # include all head/face volume, not only front face
    if z>0.59 and abs(x)<0.30:
        infl=[(names[g.group],g.weight) for g in v.groups if g.group in names and g.weight>0.01]
        limb=[(n,w) for n,w in infl if n in limb]
        face.append((v.index,x,y,z,limb,infl))
print('FACE_VERTS',len(face),'FACE_WITH_LIMB',sum(bool(x[4]) for x in face))
cnt={}
examples=[]
for row in face:
    for n,w in row[4]:
        cnt[n]=cnt.get(n,0)+1
        if len(examples)<20: examples.append(row)
print('LIMB_COUNTS',cnt)
print('EXAMPLES')
for row in examples: print(row[:5])
# Evaluate face bbox in world/deformed mesh over action frames
mod=next(m for m in o.modifiers if m.type=='ARMATURE')
for f in [1,7,13,19,25,31,37,43,48]:
    bpy.context.scene.frame_set(f)
    deps=bpy.context.evaluated_depsgraph_get()
    ev=o.evaluated_get(deps)
    em=ev.to_mesh()
    pts=[]
    for v in face:
        idx=v[0]
        p=em.vertices[idx].co
        pts.append(p)
    mn=Vector((min(p.x for p in pts),min(p.y for p in pts),min(p.z for p in pts)))
    mx=Vector((max(p.x for p in pts),max(p.y for p in pts),max(p.z for p in pts)))
    print('FRAME',f,'FACE_BBOX',tuple(round(x,4) for x in mn),tuple(round(x,4) for x in mx))
    ev.to_mesh_clear()

