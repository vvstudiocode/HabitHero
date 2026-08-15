import bpy, collections
path='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v6_connected.blend'
bpy.ops.wm.open_mainfile(filepath=path)
o=bpy.data.objects['HabitHero_Character']; me=o.data
names={g.index:g.name for g in o.vertex_groups}
bands=[(.45,.50),(.50,.55),(.55,.58),(.58,.60),(.60,.62),(.62,.65),(.65,.70),(.70,.78),(.78,.90),(.90,1.2)]
for lo,hi in bands:
    c=collections.Counter(); n=0
    for v in me.vertices:
        if lo<=v.co.z<hi and abs(v.co.x)<.32:
            n+=1
            top=sorted([(g.weight,names[g.group]) for g in v.groups],reverse=True)
            c[top[0][1] if top else 'none']+=1
    print('BAND',lo,hi,'N',n,'TOP',c.most_common(10),flush=True)

