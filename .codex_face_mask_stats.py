import bpy, collections
SRC='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v6_connected.blend'
bpy.ops.wm.open_mainfile(filepath=SRC)
o=bpy.data.objects['HabitHero_Character']; me=o.data; names=[g.name for g in o.vertex_groups]
limbs={'shoulder.L','shoulder.R','upper_arm.L','upper_arm.R','forearm.L','forearm.R','hand.L','hand.R'}
for y0 in [-.22,-.20,-.18,-.16,-.14,-.12,-.10]:
    vs=[v for v in me.vertices if v.co.y<y0 and v.co.z>.55 and abs(v.co.x)<.30]
    tops=collections.Counter(); arm=[]
    for v in vs:
        ee=sorted([(e.weight,names[e.group]) for e in v.groups if e.group<len(names)],reverse=True)
        if ee: tops[ee[0][1]]+=1
        arm.append(sum(w for w,n in ee if n in limbs))
    print('Y',y0,'N',len(vs),'arm_any',sum(a>.01 for a in arm),'arm_gt_.1',sum(a>.1 for a in arm),'armmean',round(sum(arm)/len(arm),3) if arm else 0,'tops',tops.most_common(8),flush=True)
for z0 in [.55,.6,.65,.7,.75,.8,.85,.9]:
    vs=[v for v in me.vertices if v.co.z>=z0 and v.co.z<z0+.05 and v.co.y<-.14 and abs(v.co.x)<.30]
    tops=collections.Counter(); arm=[]
    for v in vs:
        ee=sorted([(e.weight,names[e.group]) for e in v.groups if e.group<len(names)],reverse=True)
        if ee: tops[ee[0][1]]+=1
        arm.append(sum(w for w,n in ee if n in limbs))
    print('Z',z0,'N',len(vs),'arm_gt_.1',sum(a>.1 for a in arm),'armmean',round(sum(arm)/len(arm),3) if arm else 0,'tops',tops.most_common(7),flush=True)
print('sample front',flush=True)
for v in sorted([v for v in me.vertices if v.co.y<-.18 and v.co.z>.55 and abs(v.co.x)<.28],key=lambda v:(round(v.co.z,2),v.co.x))[:120:10]:
    ee=sorted([(round(e.weight,3),names[e.group]) for e in v.groups if e.group<len(names)],reverse=True)
    print(round(v.co.x,3),round(v.co.y,3),round(v.co.z,3),ee[:5],flush=True)
