"""Make the imported Walking animation loop in place.

The cleaned scene is copied to a new file so the previous version and the
original FBX remain available for comparison.
"""

import bpy
import os


SOURCE = "/Users/studio.vv/Downloads/Walking_cleaned.blend"
OUTPUT = "/Users/studio.vv/Downloads/Walking_in_place.blend"
ROOT_BONE = 'mixamorig:Hips'


def set_root_forward_motion_constant(action):
    changed = 0
    first_value = None
    for layer in action.layers:
        for strip in layer.strips:
            for channelbag in strip.channelbags:
                for fcurve in channelbag.fcurves:
                    path = fcurve.data_path
                    if path == f'pose.bones["{ROOT_BONE}"].location' and fcurve.array_index == 2:
                        if not fcurve.keyframe_points:
                            continue
                        first_value = fcurve.keyframe_points[0].co[1]
                        for key in fcurve.keyframe_points:
                            key.co[1] = first_value
                            key.handle_left_type = 'AUTO_CLAMPED'
                            key.handle_right_type = 'AUTO_CLAMPED'
                        fcurve.update()
                        changed += 1
    return changed, first_value


def main():
    if not os.path.exists(SOURCE):
        raise FileNotFoundError(SOURCE)

    bpy.ops.wm.open_mainfile(filepath=SOURCE)
    armature = bpy.data.objects.get('Armature')
    mesh = bpy.data.objects.get('Meshy_AI__0813055453_texture')
    if armature is None or mesh is None:
        raise RuntimeError('Expected Armature and character mesh were not found.')

    action = armature.animation_data.action if armature.animation_data else None
    if action is None:
        raise RuntimeError('The armature has no walking action.')

    changed, root_value = set_root_forward_motion_constant(action)

    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = int(action.frame_range[1])
    scene.frame_set(scene.frame_start)

    # Keep the rig available for later editing but show only the character by
    # default, matching the requested presentation.
    armature.hide_viewport = True
    armature.hide_set(True)
    armature.hide_render = True
    mesh.hide_viewport = False
    mesh.hide_set(False)
    mesh.hide_render = False
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh

    scene["animation_mode"] = "in_place"
    scene["root_forward_motion_locked"] = True
    scene["root_forward_axis"] = 2
    scene["root_forward_value"] = float(root_value or 0.0)
    scene["source_scene"] = SOURCE

    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT)
    print(f'IN_PLACE_FILE={OUTPUT}')
    print(f'ROOT_CHANNELS_CHANGED={changed}')
    print(f'FRAME_RANGE={scene.frame_start}-{scene.frame_end}')


if __name__ == '__main__':
    main()
