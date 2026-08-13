"""Export the supplied Murphy Bear blend as a mobile-friendly animated GLB.

Run with Blender 5.x:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/export_murphy_bear.py

The source blend keeps the editable high-resolution asset. The shipped GLB uses
a conservative decimation pass, Draco geometry compression, and WebP textures.
"""

import os

import bpy


SOURCE = "/Users/studio.vv/Downloads/墨菲熊_骨架.blend"
OUTPUT = "/Users/studio.vv/Desktop/HabitHero/public/assets/pets/murphy-bear.glb"
DECIMATE_RATIO = 0.30


def export() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.open_mainfile(filepath=SOURCE)

    meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    if len(meshes) != 1 or len(armatures) != 1:
        raise RuntimeError(f"Expected one mesh and one armature, got {len(meshes)} and {len(armatures)}")

    mesh = meshes[0]
    decimate = mesh.modifiers.new(name="MurphyBear_MobileDecimate", type="DECIMATE")
    decimate.decimate_type = "COLLAPSE"
    decimate.ratio = DECIMATE_RATIO
    decimate.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = mesh
    mesh.select_set(True)
    for obj in bpy.context.selected_objects:
        if obj != mesh:
            obj.select_set(False)
    bpy.ops.object.modifier_apply(modifier=decimate.name)

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath="/tmp/murphy-bear-mobile-export.blend")
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT,
        export_format="GLB",
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_optimize_animation_size=True,
        export_skins=True,
        export_apply=False,
        export_yup=True,
        export_image_format="WEBP",
        export_image_quality=84,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_draco_color_quantization=8,
        export_draco_generic_quantization=12,
    )
    print("MURPHY_BEAR_EXPORT", OUTPUT)
    print("MURPHY_BEAR_TRIANGLES", len(mesh.data.loop_triangles))
    print("MURPHY_BEAR_ACTIONS", [action.name for action in bpy.data.actions])


if __name__ == "__main__":
    export()
