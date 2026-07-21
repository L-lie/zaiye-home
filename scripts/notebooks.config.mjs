export const sharedKeyFile = "blender-notes.key";
export const libraryOutputFile = "notes-library.enc.json";
export const publicOutputFile = "notes-public.json";

export const notebooks = [
  {
    id: "blender",
    sourceFile: "blender-notes.json",
    outputFile: "blender-notes.enc.json",
    href: "blender-notes.html",
  },
  {
    id: "mingri-park-heat-world",
    sourceFile: "mingri-park-heat-world.json",
    outputFile: "mingri-park-heat-world.enc.json",
    href: "mingri-park-notes.html",
  },
];

export function getNotebookConfig(id) {
  return notebooks.find((notebook) => notebook.id === id);
}
