import bpy, os, math
from mathutils import Vector
path='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v6_connected.blend'
bpy.ops.wm.open_mainfile(filepath=path)
o=bpy.data.objects['HabitHero_Character']; a=bpy.data.objects['HabitHero_Rig']; me=o.data
names={g.index:g.name for g in o.vertex_groups}
def info(v):
    w=sorted([(names[g.group],g.weight) for g in v.groups],key=lambda x:-x[1])
    return tuple(round(float(x),3) for x in v.co),w[:5]
# face/front profile buckets
buckets={}
for v in me.vertices:
    x,y,z=v.co
    if z>0.56 and abs(x)<0.32:
        key=(round(z,2),round(y,2))
        buckets.setdefault(key,[]).append(v)
for key,vs in sorted(buckets.items(),key=lambda x:(-x[0][0],x[0][1]))[:120]:
    if len(vs)>=5:
        c={}
        for v in vs:
            for g,w in [(names[x.group],x.weight) for x in v.groups]:
                c[g]=c.get(g,0)+w
        top=sorted([(k,round(v/len(vs),2)) for k,v in c.items()],key=lambda x:-x[1])[:4]
        print('BUCKET',key,'N',len(vs),'X',round(min(v.co.x for v in vs),2),round(max(v.co.x for v in vs),2),'WEIGHTS',top,flush=True)
# Deformed trajectory for candidate face classes at frames
classes={
'front_face':[v.index for v in me.vertices if v.co.z>0.635 and v.co.y<-0.075 and abs(v.co.x)<0.29],
'head_shell':[v.index for v in me.vertices if v.co.z>0.635 and abs(v.co.x)<0.305],
'upper_face':[v.index for v in me.vertices if v.co.z>0.78 and v.co.y<-0.075 and abs(v.co.x)<0.29],
'face_sides':[v.index for v in me.vertices if v.co.z>0.635 and abs(v.co.x)>0.22 and abs(v.co.x)<0.32],
}
for cname,idxs in classes.items():
    print('CLASS',cname,len(idxs),flush=True)
    rest=[me.vertices[i].co.copy() for i in idxs]
    for f in [1,7,13,19]:
        bpy.context.scene.frame_set(f); ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get()); em=ev.to_mesh()
        ds=[(em.vertices[i].co-rest[j]).length for j,i in enumerate(idxs)]
        print(' frame',f,'disp_avg',round(sum(ds)/len(ds),4),'disp_max',round(max(ds),4),flush=True)
        ev.to_mesh_clear()

