import bpy, collections, math
SRC='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v6_connected.blend'
bpy.ops.wm.open_mainfile(filepath=SRC)
o=bpy.data.objects['HabitHero_Character']; me=o.data; names=[g.name for g in o.vertex_groups]
print('CAM',[(round(x,3)) for x in bpy.context.scene.camera.location],flush=True)
for name in ['head','neck','chest','shoulder.L','shoulder.R','upper_arm.L','upper_arm.R']:
    gi=names.index(name); arr=[]
    for v in me.vertices:
        w=next((e.weight for e in v.groups if e.group==gi),0)
        if w>.2: arr.append((v.co.x,v.co.y,v.co.z,w))
    if arr:
        print(name,'n',len(arr),'bounds',tuple(round(t,3) for t in [min(a[0] for a in arr),max(a[0] for a in arr),min(a[1] for a in arr),max(a[1] for a in arr),min(a[2] for a in arr),max(a[2] for a in arr)]),'mean',tuple(round(sum(a[j] for a in arr)/len(arr),3) for j in range(3)),flush=True)
for z0 in [.35,.45,.5,.55,.6,.65,.7,.75,.8,.85,.9,1.0]:
    vs=[v for v in me.vertices if z0<=v.co.z<z0+.02]
    print('Z',z0,'N',len(vs),'Y',tuple(round(x,3) for x in (min((v.co.y for v in vs),default=0),max((v.co.y for v in vs),default=0))), 'X',tuple(round(x,3) for x in (min((v.co.x for v in vs),default=0),max((v.co.x for v in vs),default=0))),flush=True)
