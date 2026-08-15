import bpy
SRC='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v6_connected.blend'
bpy.ops.wm.open_mainfile(filepath=SRC)
o=bpy.data.objects['HabitHero_Character']; me=o.data
print('UV',[(u.name,len(u.data)) for u in me.uv_layers],flush=True)
for m in o.data.materials:
    print('MAT',m.name,'nodes',m.use_nodes,flush=True)
    for n in m.node_tree.nodes:
        print(' NODE',n.type,n.name,'label',n.label,flush=True)
        if n.type=='TEX_IMAGE': print('  IMAGE',n.image.name,n.image.filepath,n.image.size[:],flush=True)
for p in me.materials: print('ME_MAT',p.name,flush=True)
