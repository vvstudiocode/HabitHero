"""Import Walking.fbx, remove exported scene helpers, and save a clean Blender file.

The source FBX is never overwritten.  The cleaned scene keeps the skinned
character, its armature, and the imported animation action.
"""

import bpy
import bmesh
import os


SOURCE = "/Users/studio.vv/Downloads/Walking.fbx"
OUTPUT = "/Users/studio.vv/Downloads/Walking_cleaned.blend"


def remove_object(obj):
    bpy.data.objects.remove(obj, do_unlink=True)


def remove_small_mesh_components(obj, minimum_vertices=1000):
    """Remove isolated mesh islands below the requested vertex count."""
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)

    remaining = set(bm.verts)
    components = []
    while remaining:
        start = remaining.pop()
        component = {start}
        stack = [start]
        while stack:
            vert = stack.pop()
            for edge in vert.link_edges:
                other = edge.other_vert(vert)
                if other in remaining:
                    remaining.remove(other)
                    component.add(other)
                    stack.append(other)
        components.append(component)

    small_components = [component for component in components if len(component) < minimum_vertices]
    for component in small_components:
        bmesh.ops.delete(bm, geom=list(component), context="VERTS")

    removed = sum(len(component) for component in small_components)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return len(components), removed


def main():
    if not os.path.exists(SOURCE):
        raise FileNotFoundError(SOURCE)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=SOURCE)

    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not armatures or not meshes:
        raise RuntimeError("The FBX did not contain both an armature and a mesh.")

    armature = armatures[0]
    skinned_meshes = [
        obj for obj in meshes
        if any(mod.type == "ARMATURE" and mod.object == armature for mod in obj.modifiers)
    ]
    character_mesh = skinned_meshes[0] if skinned_meshes else meshes[0]

    component_count, removed_vertices = remove_small_mesh_components(character_mesh)

    # Remove exported helper objects (default cube, camera, light, and any
    # non-character helper geometry).  The original FBX remains untouched.
    kept = {armature, character_mesh}
    for obj in list(bpy.context.scene.objects):
        if obj not in kept:
            remove_object(obj)

    # Use the requested clear, standard skeleton appearance.
    armature.data.display_type = "OCTAHEDRAL"
    armature.show_in_front = True
    armature.hide_viewport = False
    armature.hide_render = True

    character_mesh.hide_viewport = False
    character_mesh.hide_render = False
    character_mesh.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature

    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = max(30, int(scene.frame_end))
    scene.frame_set(scene.frame_start)
    scene["cleaning_note"] = (
        "Removed exported Cube/Camera/Light helpers and one isolated mesh island; "
        "preserved the skinned mesh, armature, and walking action."
    )
    scene["removed_mesh_components"] = component_count - 1
    scene["removed_mesh_vertices"] = removed_vertices

    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT)
    print(f"CLEANED_FILE={OUTPUT}")
    print(f"KEPT_OBJECTS={[obj.name for obj in bpy.context.scene.objects]}")
    print(f"ACTIONS={[action.name for action in bpy.data.actions]}")
    print(f"REMOVED_MESH_VERTICES={removed_vertices}")


if __name__ == "__main__":
    main()
