import bpy, collections
from mathutils import Vector
path='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v6_connected.blend'
bpy.ops.wm.open_mainfile(filepath=path)
o=bpy.data.objects['HabitHero_Character']; me=o.data
names={g.index:g.name for g in o.vertex_groups}
limb={'shoulder.L','upper_arm.L','forearm.L','hand.L','shoulder.R','upper_arm.R','forearm.R','hand.R'}
rows=[]
for v in me.vertices:
    infl=sorted([(names[g.group],g.weight) for g in v.groups if names[g.group] in limb and g.weight>0.01],key=lambda x:-x[1])
    x,y,z=v.co
    if infl and z>0.55:
        rows.append((v.index,round(x,3),round(y,3),round(z,3),[(n,round(w,3)) for n,w in infl]))
print('COUNT',len(rows),flush=True)
for row in rows[::max(1,len(rows)//150)]:
    print(row,flush=True)

