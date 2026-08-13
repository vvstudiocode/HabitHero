import bpy, sys, os, math
from mathutils import Vector
paths=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
for path in paths:
    bpy.ops.wm.open_mainfile(filepath=path)
    objs=[o for o in bpy.context.scene.objects if o.type=='MESH' and ('Character' in o.name or 'Body' in o.name or 'Head' in o.name)]
    print('FILE',os.path.basename(path),'OBJS',[o.name for o in objs],flush=True)
    for o in objs:
        me=o.data
        idx=set(v.index for v in me.vertices if v.co.z>0.635 and v.co.y<-0.075 and abs(v.co.x)<0.29)
        edges=[e for e in me.edges if e.vertices[0] in idx and e.vertices[1] in idx]
        if not edges:
            continue
        vals=[]
        for f in [1,7,13,19,25,31,37,43]:
            bpy.context.scene.frame_set(f)
            ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get())
            em=ev.to_mesh()
            ls=[(em.vertices[e.vertices[0]].co-em.vertices[e.vertices[1]].co).length for e in edges]
            ev.to_mesh_clear()
            vals.append((f,sum(ls)/len(ls),max(ls),min(ls)))
        base=vals[0][1]
        rel=[abs(x[1]-base)/max(base,1e-8) for x in vals]
        print(' OBJ',o.name,'V',len(idx),'E',len(edges),'MEAN_EDGE',[(f,round(avg,6),round(r,4)) for (f,avg,_,_),r in zip(vals,rel)],'MAX_REL',round(max(rel),4),flush=True)
    print('---',flush=True)

