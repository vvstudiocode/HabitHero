import bpy, math

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def mat(name, color, emission=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    if bs is None:
        bs = m.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Roughness'].default_value = 0.9
    if emission:
        bs.inputs['Emission Color'].default_value = (*color, 1)
        bs.inputs['Emission Strength'].default_value = emission
    return m

skin = mat('Skin', (1.0, 0.72, 0.64)); hair = mat('Mint Hair', (0.78, 0.87, 0.83))
hair2 = mat('Hair Shadow', (0.55, 0.66, 0.63)); hoodie = mat('Hoodie', (0.82, 0.84, 0.81))
hoodline = mat('Hoodie Shadow', (0.60, 0.64, 0.62)); pants = mat('Pants', (0.08, 0.09, 0.11))
shoe = mat('Shoes', (0.90, 0.88, 0.82)); dark = mat('Ink', (0.04, 0.05, 0.05))
eye = mat('Eye Green', (0.16, 0.45, 0.34)); white = mat('Eye Highlight', (1, 1, 1))
pink = mat('Blush', (1.0, 0.44, 0.45)); star = mat('Sparkle', (1.0, 0.82, 0.28), 0.3)

root = bpy.data.objects.new('CHARACTER_ROOT', None); bpy.context.collection.objects.link(root)
parts = []

def poly(name, pts, z, material, parent=root):
    me = bpy.data.meshes.new(name + 'Mesh')
    me.from_pydata([(x, y, z) for x, y in pts], [], [list(range(len(pts)))])
    me.update()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    ob.data.materials.append(material); ob.parent = parent; parts.append(ob); return ob

def ellipse(name, cx, cy, rx, ry, z, material, n=32, parent=root):
    pts = [(cx + rx * math.cos(2 * math.pi * i / n), cy + ry * math.sin(2 * math.pi * i / n)) for i in range(n)]
    return poly(name, pts, z, material, parent)

def line(name, pts, z, material, bevel=0.025, parent=root):
    cu = bpy.data.curves.new(name + 'Curve', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = bevel; cu.bevel_resolution = 2
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for p, (x, y) in zip(sp.points, pts): p.co = (x, y, z, 1)
    ob = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(ob)
    ob.data.materials.append(material); ob.parent = parent; parts.append(ob); return ob

legL = poly('Leg_L', [(-1.0,-1.0),(-0.18,-1.0),(-0.05,-3.15),(-1.05,-3.15)], 0.18, pants)
legR = poly('Leg_R', [(0.18,-1.0),(1.0,-1.0),(1.05,-3.15),(0.05,-3.15)], 0.18, pants)
shoeL = ellipse('Shoe_L', -0.58, -3.35, 0.78, 0.32, 0.25, shoe); shoeR = ellipse('Shoe_R', 0.58, -3.35, 0.78, 0.32, 0.25, shoe)
line('ShoeLineL', [(-1.1,-3.35),(-0.1,-3.35)], 0.3, dark, 0.035); line('ShoeLineR', [(0.1,-3.35),(1.1,-3.35)], 0.3, dark, 0.035)
body = poly('HoodieBody', [(-1.45,1.0),(1.45,1.0),(1.3,-1.25),(0.8,-1.6),(-0.8,-1.6),(-1.3,-1.25)], 0.35, hoodie)
ellipse('Hood', 0, 1.15, 1.0, 0.55, 0.42, hoodline)
armL = poly('Arm_L', [(-1.35,0.85),(-1.7,0.55),(-2.05,-0.55),(-1.7,-0.8),(-1.2,0.2)], 0.3, hoodie)
armR = poly('Arm_R', [(1.35,0.85),(1.7,0.55),(2.05,-0.55),(1.7,-0.8),(1.2,0.2)], 0.3, hoodie)
ellipse('Hand_L', -1.82, -0.78, 0.27, 0.36, 0.5, skin); ellipse('Hand_R', 1.82, -0.78, 0.27, 0.36, 0.5, skin)
ellipse('Neck', 0, 1.55, 0.4, 0.35, 0.55, skin); ellipse('Head', 0, 2.85, 1.55, 1.45, 0.65, skin)
poly('HairCap', [(-1.55,3.0),(-1.35,4.0),(-0.7,4.45),(0,4.55),(0.8,4.35),(1.5,3.75),(1.6,3.0),(1.1,3.35),(0.7,3.75),(0.25,3.3),(-0.2,3.8),(-0.75,3.25)], 0.8, hair)
poly('HairLeft', [(-1.45,3.25),(-1.8,2.45),(-1.55,2.0),(-1.1,2.55)], 0.78, hair2)
poly('HairRight', [(1.45,3.25),(1.8,2.45),(1.55,2.0),(1.1,2.55)], 0.78, hair2)
ellipse('Eye_L', -0.58, 2.88, 0.25, 0.38, 0.95, eye); ellipse('Eye_R', 0.58, 2.88, 0.25, 0.38, 0.95, eye)
ellipse('GlintL', -0.51, 3.03, 0.07, 0.10, 1.0, white); ellipse('GlintR', 0.65, 3.03, 0.07, 0.10, 1.0, white)
ellipse('BlushL', -0.92, 2.48, 0.25, 0.10, 0.96, pink); ellipse('BlushR', 0.92, 2.48, 0.25, 0.10, 0.96, pink)
line('Mouth', [(-0.18,2.38),(0,2.32),(0.18,2.38)], 1.0, dark, 0.025)
line('StringL', [(-0.42,1.55),(-0.5,0.72)], 0.9, dark, 0.025); line('StringR', [(0.42,1.55),(0.5,0.72)], 0.9, dark, 0.025)
poly('Emblem', [(-0.65,0.55),(-0.35,0.55),(-0.35,0.25),(-0.1,0.25),(-0.1,0.55),(0.55,0.55),(0.55,0.25),(0.8,0.25),(0.8,0.75),(-0.65,0.75)], 0.92, dark)
line('Earring', [(1.48,2.25),(1.75,1.72)], 1.0, dark, 0.035); ellipse('EarringRing', 1.75, 1.55, 0.22, 0.3, 1.0, star)
for i, (x, y) in enumerate([(-2.35,3.2),(2.35,3.0),(2.15,1.9)]):
    line('Sparkle'+str(i), [(x,y-0.25),(x,y+0.25)], 0.7, star, 0.035); line('SparkleX'+str(i), [(x-0.18,y),(x+0.18,y)], 0.7, star, 0.035)

bpy.ops.object.camera_add(location=(0, 0, 20)); cam = bpy.context.object; cam.name = '2D_Camera'; cam.data.type = 'ORTHO'; cam.data.ortho_scale = 10.2; bpy.context.scene.camera = cam
sc = bpy.context.scene; sc.frame_start = 1; sc.frame_end = 120; sc.render.engine = 'BLENDER_WORKBENCH'; sc.render.resolution_x = 600; sc.render.resolution_y = 800; sc.render.resolution_percentage = 75
sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'; sc.display.shading.show_shadows = False

for f, s in [(1,1.0),(20,1.018),(40,1.0)]: root.scale = (s,s,s); root.keyframe_insert('scale', frame=f)
# Blender 5.2 stores actions in layered slots; the keyed breathing pose remains
# available across the preview range without requiring legacy fcurve access.
root.location = (-2.6,0,0); root.keyframe_insert('location', frame=1); root.location = (2.6,0,0); root.keyframe_insert('location', frame=120)
for ob, ang in [(armL,0.16),(armR,-0.16),(legL,-0.12),(legR,0.12)]:
    ob.rotation_mode = 'XYZ'; ob.rotation_euler[2] = ang; ob.keyframe_insert('rotation_euler', index=2, frame=1); ob.rotation_euler[2] = -ang; ob.keyframe_insert('rotation_euler', index=2, frame=20); ob.rotation_euler[2] = ang; ob.keyframe_insert('rotation_euler', index=2, frame=40)
# Limb swing is keyed for the first idle/walk cycle.

# Repeat the subtle breathing and limb rhythm through the full preview range.
for f, s in [(1,1.0),(20,1.018),(40,1.0),(60,1.018),(80,1.0),(100,1.018),(120,1.0)]:
    root.scale = (s, s, s); root.keyframe_insert('scale', frame=f)
for ob, ang in [(armL,0.16),(armR,-0.16),(legL,-0.12),(legR,0.12)]:
    for f, value in [(60,-ang),(80,ang),(100,-ang),(120,ang)]:
        ob.rotation_euler[2] = value; ob.keyframe_insert('rotation_euler', index=2, frame=f)

sc.frame_set(20)
bpy.ops.wm.save_as_mainfile(filepath='/Users/studio.vv/Desktop/HabitHero/habithero_2d_character.blend')
