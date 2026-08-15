import bpy, collections
SRC='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v6_connected.blend'
bpy.ops.wm.open_mainfile(filepath=SRC)
o=bpy.data.objects['HabitHero_Character']; me=o.data; groups=list(o.vertex_groups)
adj=[[] for _ in me.vertices]
for e in me.edges:
    a,b=e.vertices; adj[a].append(b); adj[b].append(a)
seen=set(); comps=[]
for v in me.vertices:
    if v.index in seen: continue
    q=[v.index]; seen.add(v.index); ids=[]
    while q:
        i=q.pop(); ids.append(i)
        for j in adj[i]:
            if j not in seen: seen.add(j); q.append(j)
    comps.append(ids)
comps.sort(key=len, reverse=True)
for k,ids in enumerate(comps[:40]):
    s=set(ids); z=[me.vertices[i].co.z for i in ids]; x=[me.vertices[i].co.x for i in ids]; y=[me.vertices[i].co.y for i in ids]
    names=collections.Counter()
    for i in ids:
        for vg in me.vertices[i].groups:
            if vg.group < len(groups): names[groups[vg.group].name]+=round(vg.weight,2)
    # face count
    fc=sum(1 for p in me.polygons if any(i in s for i in p.vertices))
    print(k,'verts',len(ids),'faces',fc,'bounds',tuple(round(a,3) for a in (min(x),max(x),min(y),max(y),min(z),max(z))),'groups',names.most_common(8),flush=True)
print('TOTAL_COMPONENTS',len(comps),flush=True)
