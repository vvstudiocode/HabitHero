import bpy, bmesh, collections, os
from mathutils import Vector

SRC='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v6_connected.blend'
OUT='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v15_topology_head.blend'
DIR='/tmp/habithero_v15_frames'
os.makedirs(DIR,exist_ok=True)

bpy.ops.wm.open_mainfile(filepath=SRC)
body=bpy.data.objects['HabitHero_Character']
arm=bpy.data.objects['HabitHero_Rig']
mesh=body.data

# Build polygon adjacency from the original connected mesh.
adj=[[] for _ in mesh.polygons]
edge_faces=collections.defaultdict(list)
for p in mesh.polygons:
    for e in p.edge_keys:
        edge_faces[e].append(p.index)
for faces in edge_faces.values():
    if len(faces)==2:
        a,b=faces
        adj[a].append(b); adj[b].append(a)

start=max(range(len(mesh.polygons)), key=lambda i: mesh.polygons[i].center.z)
threshold=0.50
selected_faces=set([start])
queue=[start]
while queue:
    i=queue.pop()
    for j in adj[i]:
        if j in selected_faces: continue
        if mesh.polygons[j].center.z >= threshold:
            selected_faces.add(j)
            queue.append(j)

# Select exactly the topological head/hood island down to scarf height.
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='DESELECT')
bm=bmesh.from_edit_mesh(mesh)
for f in bm.faces:
    f.select = f.index in selected_faces
bmesh.update_edit_mesh(mesh)
bpy.ops.mesh.separate(type='SELECTED')
bpy.ops.object.mode_set(mode='OBJECT')

head_obj=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith('HabitHero_Character.') )
body.name='HabitHero_Body_Weighted'
head_obj.name='HabitHero_Head_Rigid'

# Ensure the detached head uses exactly one clean head group and one armature modifier.
for g in list(head_obj.vertex_groups):
    head_obj.vertex_groups.remove(g)
hg=head_obj.vertex_groups.new(name='head')
hg.add(list(range(len(head_obj.data.vertices))),1.0,'REPLACE')
for mod in list(head_obj.modifiers):
    head_obj.modifiers.remove(mod)
mod=head_obj.modifiers.new('Head_Armature','ARMATURE')
mod.object=arm
head_obj.parent=arm
head_obj.parent_type='OBJECT'

# Add seam metadata and preserve the animation.
arm['skeleton_version']='v15_topology_head_separated'
arm['face_fix_policy']='topology head/hood separated down to scarf line; head only'
arm['head_object']='HabitHero_Head_Rigid'
arm['body_object']='HabitHero_Body_Weighted'
arm['head_seam_height']=threshold
arm['face_fix_note']='Head boundary follows mesh topology and is hidden below the scarf; no cut across cheeks or eyes.'

# Render test frames.
scene=bpy.context.scene
scene.frame_start=1
scene.frame_end=48
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
for f in [1,7,13,19,25,31,37,43]:
    scene.frame_set(f)
    scene.render.resolution_x=600
    scene.render.resolution_y=600
    scene.render.filepath=os.path.join(DIR,f'frame_{f:02d}.png')
    bpy.ops.render.render(write_still=True)
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('OUTPUT',OUT,'SELECTED_FACES',len(selected_faces),'HEAD_VERTS',len(head_obj.data.vertices),'BODY_VERTS',len(body.data.vertices),flush=True)
