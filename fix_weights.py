import bpy, math
from mathutils import Vector

mesh = bpy.data.objects['Mesh1.0']
rig = bpy.data.objects['HH_GameRig']
arm = rig.data

# Replace unreliable automatic weights with distance-based weights.
for vg in list(mesh.vertex_groups):
    mesh.vertex_groups.remove(vg)
deform = [b for b in arm.bones if b.use_deform]
groups = {b.name: mesh.vertex_groups.new(name=b.name) for b in deform}
min_z = min(v.co.z for v in mesh.data.vertices)
max_x = max(v.co.x for v in mesh.data.vertices)
max_z_span = max(mesh.dimensions.z, .001)

def point_segment_distance(p, a, b):
    ab = b - a
    t = 0.0 if ab.length_squared == 0 else max(0.0, min(1.0, (p-a).dot(ab) / ab.length_squared))
    return (p - (a + ab*t)).length

for v in mesh.data.vertices:
    p = v.co
    scores = []
    for b in deform:
        d = point_segment_distance(p, b.head_local, b.tail_local)
        length = max((b.tail_local-b.head_local).length, .08)
        radius = max(length*.85, .12)
        score = math.exp(-((d/radius)**2))
        # Encourage feet to own the lowest vertices, and tail bones to own the far-right tail.
        z = (p.z - min_z) / max_z_span
        if 'foot' in b.name and z < .25: score *= 3.0
        if 'tail' in b.name and p.x > max_x-.35*mesh.dimensions.x: score *= 2.0
        scores.append((score, b.name))
    scores.sort(reverse=True)
    chosen = scores[:4]
    total = sum(s for s,_ in chosen) or 1.0
    for score, name in chosen:
        groups[name].add([v.index], score/total, 'REPLACE')

# Keep the existing armature modifier and ensure the mesh is driven by this rig.
mod = mesh.modifiers.get('HH_Armature') or next((m for m in mesh.modifiers if m.type == 'ARMATURE'), None)
if not mod: mod = mesh.modifiers.new('HH_Armature','ARMATURE')
mod.object = rig

# Make the walk cycle the default action while checking the new weights.
rig.animation_data_create(); rig.animation_data.action = bpy.data.actions['Walk']
bpy.context.scene.frame_start, bpy.context.scene.frame_end = 1, 32
bpy.context.scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath='/Users/studio.vv/Downloads/Meshy_AI_Starlight_Rainbow_Kit_0726024804_rigged.blend')
try:
    bpy.ops.export_scene.gltf(filepath='/Users/studio.vv/Downloads/Meshy_AI_Starlight_Rainbow_Kit_0726024804_character.glb', export_format='GLB', export_animations=True, export_skins=True)
except Exception as e:
    print('GLB_EXPORT_WARNING', e)
print('WEIGHTS_FIXED')
