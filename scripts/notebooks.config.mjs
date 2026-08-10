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
    assetDir: "mingri-park-heat-world-assets",
    outputFile: "mingri-park-heat-world.enc.json",
    href: "mingri-park-notes.html",
  },
  {
    id: "website-development",
    sourceFile: "website-development-notes.json",
    outputFile: "website-development-notes.enc.json",
    href: "website-development-notes.html",
  },
];

export function getNotebookConfig(id) {
  return notebooks.find((notebook) => notebook.id === id);
}
