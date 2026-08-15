import bpy
path='/Users/studio.vv/Downloads/8e4b869b472bb38e73358b894523f700/HabitHero_walking_rig_repaired_v6_connected.blend'
bpy.ops.wm.open_mainfile(filepath=path)
a=bpy.data.objects['HabitHero_Rig']; s=bpy.context.scene
for f in [1,7,13,19]:
    s.frame_set(f); p=a.pose.bones
    print('FRAME',f)
    for n in ['pelvis','spine','chest','neck','head','shoulder.L','upper_arm.L','forearm.L','upper_leg.L','lower_leg.L']:
        pb=p[n]
        print(n,'rot',tuple(round(x,4) for x in pb.rotation_euler),'loc',tuple(round(x,4) for x in pb.location))

