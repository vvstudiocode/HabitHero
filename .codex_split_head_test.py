import bpy, bmesh, os
from mathutils import Vector
SRC='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v6_connected.blend'
OUT='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v14_head_separated.blend'
DIR='/tmp/habithero_v14_split_frames'
os.makedirs(DIR,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=SRC)
body=bpy.data.objects['HabitHero_Character']; arm=bpy.data.objects['HabitHero_Rig']
# Select head/hood faces by an ellipsoid, excluding the body/arms and leaving the seam under the scarf.
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); bpy.context.view_layer.objects.active=body
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='DESELECT')
bm=bmesh.from_edit_mesh(body.data)
center=Vector((0.0,0.018,0.835)); radii=Vector((0.345,0.355,0.335))
selected=0
for f in bm.faces:
    pts=[v.co for v in f.verts]
    c=sum(pts,Vector())/len(pts)
    d=((c.x-center.x)/radii.x)**2+((c.y-center.y)/radii.y)**2+((c.z-center.z)/radii.z)**2
    # All faces in upper shell; ensure the face center is above scarf and sufficiently near head.
    take=(c.z>=0.565 and d<=1.30)
    f.select=take
    selected += int(take)
bmesh.update_edit_mesh(body.data)
before=set(bpy.context.scene.objects)
bpy.ops.mesh.separate(type='SELECTED')
bpy.ops.object.mode_set(mode='OBJECT')
after=set(bpy.context.scene.objects)
new=list(after-before)
print('SELECTED_FACES',selected,'NEW',[(x.name,x.type) for x in new],flush=True)
heads=[x for x in new if x.type=='MESH']
if len(heads)!=1:
    raise RuntimeError('Expected one separated head mesh')
head_obj=heads[0]; head_obj.name='HabitHero_Head_Rigid'; body.name='HabitHero_Body_Weighted'
# Force a single head group and a clean armature modifier on the head.
for g in list(head_obj.vertex_groups):
    head_obj.vertex_groups.remove(g)
hg=head_obj.vertex_groups.new(name='head')
hg.add(list(range(len(head_obj.data.vertices))),1.0,'REPLACE')
for mod in list(head_obj.modifiers):
    head_obj.modifiers.remove(mod)
mod=head_obj.modifiers.new('Head_Armature','ARMATURE'); mod.object=arm
head_obj.parent=arm; head_obj.parent_type='OBJECT'
# Keep the body object's existing weighted modifier, but remove now-empty head groups from body is unnecessary.
arm['skeleton_version']='v14_head_separated_rigid'
arm['face_fix_policy']='Head/hood/face separated into rigid mesh driven only by head bone; body retains walk deformation.'
arm['head_object']='HabitHero_Head_Rigid'
arm['body_object']='HabitHero_Body_Weighted'
arm['face_crack_fix']='separate_head_mesh'
scene=bpy.context.scene; scene.frame_start=1;scene.frame_end=48;scene.render.engine='BLENDER_EEVEE';scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
for f in [1,7,13,19,25,31,37,43]:
    scene.frame_set(f);scene.render.resolution_x=600;scene.render.resolution_y=600;scene.render.filepath=os.path.join(DIR,f'frame_{f:02d}.png');bpy.ops.render.render(write_still=True)
scene.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('OUTPUT',OUT,'HEAD_VERTS',len(head_obj.data.vertices),'BODY_VERTS',len(body.data.vertices),flush=True)
