import bpy, collections
from mathutils import Vector
path='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v6_connected.blend'
bpy.ops.wm.open_mainfile(filepath=path)
o=bpy.data.objects['HabitHero_Character']; me=o.data
adj=[[] for _ in me.polygons]; ef=collections.defaultdict(list)
for p in me.polygons:
    for e in p.edge_keys: ef[e].append(p.index)
for fs in ef.values():
    if len(fs)==2:
        a,b=fs; adj[a].append(b); adj[b].append(a)
start=max(range(len(me.polygons)),key=lambda i:me.polygons[i].center.z)
for threshold in [0.50,0.52,0.54,0.56,0.58,0.60]:
    seen={start}; q=[start]
    while q:
        i=q.pop()
        for j in adj[i]:
            if j in seen: continue
            p=me.polygons[j]
            if p.center.z>=threshold:
                seen.add(j); q.append(j)
    verts=set()
    for i in seen: verts.update(me.polygons[i].vertices)
    ps=[me.vertices[v].co for v in verts]
    mn=Vector((min(p.x for p in ps),min(p.y for p in ps),min(p.z for p in ps))); mx=Vector((max(p.x for p in ps),max(p.y for p in ps),max(p.z for p in ps)))
    print('THRESH',threshold,'FACES',len(seen),'VERTS',len(verts),'BOUNDS',tuple(round(x,3) for x in mn),tuple(round(x,3) for x in mx),flush=True)

