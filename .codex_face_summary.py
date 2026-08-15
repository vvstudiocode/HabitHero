import bpy, collections
bpy.ops.wm.open_mainfile(filepath='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v6_connected.blend')
o=bpy.data.objects['HabitHero_Character']; me=o.data; names={g.index:g.name for g in o.vertex_groups}
c=collections.Counter(); n=0; sums=collections.defaultdict(float)
for v in me.vertices:
    if v.co.z>0.635 and v.co.y<-0.075 and abs(v.co.x)<0.29:
        n+=1
        top=sorted([(g.weight,names[g.group]) for g in v.groups],reverse=True)[:3]
        key=top[0][1] if top else 'none'
        c[key]+=1
        sums[key]+=top[0][0] if top else 0
print('N',n,'top',c,'avg',{k:round(sums[k]/c[k],3) for k in c},flush=True)

