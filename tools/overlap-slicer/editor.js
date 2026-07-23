const meta = document.querySelector("#meta");
const colsInput = document.querySelector("#cols");
const rowsInput = document.querySelector("#rows");
const overlapInput = document.querySelector("#overlap");
const cropAspectInput = document.querySelector("#cropAspect");
const fileInput = document.querySelector("#fileInput");
const preview = document.querySelector("#preview");
const previewContext = preview.getContext("2d");
const tilesNode = document.querySelector("#tiles");
const copyNextButton = document.querySelector("#copyNext");
const downloadAllButton = document.querySelector("#downloadAll");
const downloadPlanButton = document.querySelector("#downloadPlan");
const applyCropButton = document.querySelector("#applyCrop");
const resetCropButton = document.querySelector("#resetCrop");
const dropZone = document.querySelector("#dropZone");
const stitchFilesInput = document.querySelector("#stitchFiles");
const stitchTilesButton = document.querySelector("#stitchTiles");
const autoAlignButton = document.querySelector("#autoAlignTiles");
const fullscreenStitchButton = document.querySelector("#fullscreenStitch");
const closeFullscreenStitchButton = document.querySelector("#closeFullscreenStitch");
const deleteSelectedTileButton = document.querySelector("#deleteSelectedTile");
const clearStitchTilesButton = document.querySelector("#clearStitchTiles");
const downloadMergedButton = document.querySelector("#downloadMerged");
const stitchStatus = document.querySelector("#stitchStatus");
const stitchResult = document.querySelector("#stitchResult");
const stitchPreview = document.querySelector("#stitchPreview");
const stitchPreviewContext = stitchPreview.getContext("2d");

let originalImage = null;
let capturedImage = null;
let tileSourceImage = null;
let baseName = "ai-image";
let tiles = [];
let nextCopyIndex = 0;
let cropRect = null;
let cropInteraction = null;
let previewMetrics = null;
let stitchFiles = [];
let stitchPlacedItems = [];
let stitchDrag = null;
let selectedStitchItem = null;
let stitchPlacementMode = "";

const SUPPORTED_ASPECTS = [
  { label: "21:9", ratio: 21 / 9 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "3:2", ratio: 3 / 2 },
  { label: "4:3", ratio: 4 / 3 },
  { label: "5:4", ratio: 5 / 4 },
  { label: "1:1", ratio: 1 },
  { label: "4:5", ratio: 4 / 5 },
  { label: "3:4", ratio: 3 / 4 },
  { label: "2:3", ratio: 2 / 3 },
  { label: "9:16", ratio: 9 / 16 },
  { label: "9:21", ratio: 9 / 21 },
];

const hasChromeStorage = typeof chrome !== "undefined" && chrome.storage?.local;
const hasSourceStore = typeof OverlapImageStore !== "undefined";

init();

async function init() {
  wireImageImport();

  const params = new URLSearchParams(location.search);
  const sourceId = params.get("sourceId");
  if (sourceId && hasSourceStore) {
    const source = await OverlapImageStore.getSource(sourceId);
    if (source) {
      await loadSourceRecord(source);
      await OverlapImageStore.removeSource(sourceId);
      return;
    }
  }

  const shouldLoadCapture = params.get("capture") === "1";
  if (!shouldLoadCapture) {
    const shouldLoadSource = params.get("source") === "1";
    if (shouldLoadSource && hasChromeStorage) {
      const stored = await chrome.storage.local.get("overlapSlicerSource");
      if (stored.overlapSlicerSource?.dataUrl) {
        await loadSourceData(stored.overlapSlicerSource);
        await chrome.storage.local.remove("overlapSlicerSource");
        return;
      }
    }
    if (hasChromeStorage) await chrome.storage.local.remove("overlapSlicerCapture");
    clearPreview();
    return;
  }

  if (!hasChromeStorage) {
    clearPreview();
    return;
  }

  const stored = await chrome.storage.local.get("overlapSlicerCapture");
  const capture = stored.overlapSlicerCapture;
  if (!capture?.dataUrl) {
    clearPreview();
    return;
  }

  baseName = capture.pageTitle || "ai-image";
  await setSourceCanvas(await cropCapture(capture), `${baseName}-screenshot`);
}

document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    const [cols, rows] = button.dataset.preset.split("x").map(Number);
    colsInput.value = cols;
    rowsInput.value = rows;
    makeTiles();
  });
});

[colsInput, rowsInput, overlapInput, cropAspectInput].forEach((input) => {
  input.addEventListener("input", makeTiles);
});

preview.addEventListener("pointerdown", (event) => {
  if (!capturedImage || !previewMetrics) return;
  const point = canvasPointToImage(event);
  if (!point) return;
  if (cropRect && pointInRect(point, cropRect)) {
    cropInteraction = {
      type: "move",
      start: point,
      origin: { ...cropRect },
    };
  } else {
    cropInteraction = {
      type: "draw",
      start: point,
    };
    cropRect = { x: point.x, y: point.y, width: 1, height: 1 };
  }
  preview.setPointerCapture(event.pointerId);
  renderPreview();
});

preview.addEventListener("pointermove", (event) => {
  if (!cropInteraction || !capturedImage) return;
  const point = canvasPointToImage(event);
  if (!point) return;
  if (cropInteraction.type === "move") {
    const dx = point.x - cropInteraction.start.x;
    const dy = point.y - cropInteraction.start.y;
    cropRect = moveRect(cropInteraction.origin, dx, dy, capturedImage.width, capturedImage.height);
  } else {
    cropRect = makeCropRect(cropInteraction.start, point, capturedImage.width, capturedImage.height);
  }
  applyCropButton.disabled = cropRect.width < 8 || cropRect.height < 8;
  renderPreview();
});

preview.addEventListener("pointerup", () => {
  cropInteraction = null;
});

cropAspectInput.addEventListener("change", () => {
  if (!cropRect || !capturedImage) return;
  cropRect = fitExistingCropToAspect(cropRect, capturedImage.width, capturedImage.height);
  applyCropButton.disabled = cropRect.width < 8 || cropRect.height < 8;
  renderPreview();
});

applyCropButton.addEventListener("click", async () => {
  if (!capturedImage || !cropRect || cropRect.width < 8 || cropRect.height < 8) return;
  const canvas = document.createElement("canvas");
  canvas.width = cropRect.width;
  canvas.height = cropRect.height;
  canvas.getContext("2d").drawImage(
    capturedImage,
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height,
    0,
    0,
    cropRect.width,
    cropRect.height,
  );
  tileSourceImage = canvas;
  baseName = `${baseName}_crop`;
  meta.textContent = `${capturedImage.width} x ${capturedImage.height} · 输出 ${tileSourceImage.width} x ${tileSourceImage.height}`;
  applyCropButton.disabled = true;
  resetCropButton.disabled = !originalImage;
  makeTiles();
});

resetCropButton.addEventListener("click", () => {
  if (!originalImage) return;
  capturedImage = originalImage;
  tileSourceImage = originalImage;
  cropRect = null;
  baseName = baseName.replace(/_crop(?:_crop)*$/, "") || "ai-image";
  meta.textContent = `${capturedImage.width} x ${capturedImage.height}`;
  applyCropButton.disabled = true;
  resetCropButton.disabled = true;
  makeTiles();
});

stitchFilesInput.addEventListener("change", async () => {
  stitchFiles = [...stitchFilesInput.files];
  stitchPlacedItems = [];
  stitchDrag = null;
  selectedStitchItem = null;
  stitchPlacementMode = "";
  stitchTilesButton.disabled = !stitchFiles.length;
  autoAlignButton.disabled = true;
  fullscreenStitchButton.disabled = true;
  deleteSelectedTileButton.disabled = true;
  clearStitchTilesButton.disabled = true;
  downloadMergedButton.disabled = true;
  stitchResult.hidden = true;
  stitchStatus.textContent = getStitchReadyText();
  if (!stitchFiles.length) return;
  try {
    await stitchProcessedTiles();
  } catch (error) {
    stitchTilesButton.disabled = false;
    autoAlignButton.disabled = true;
    fullscreenStitchButton.disabled = true;
    deleteSelectedTileButton.disabled = true;
    clearStitchTilesButton.disabled = true;
    downloadMergedButton.disabled = true;
    stitchResult.hidden = true;
    stitchStatus.textContent = "图片放置失败。请确认选择的是图片文件，然后再试一次。";
  }
});

stitchTilesButton.addEventListener("click", async () => {
  if (stitchPlacedItems.length) {
    redrawStitchPreview();
    stitchStatus.textContent = "已按当前手动位置重新拼合。可以继续拖动、自动对齐，或下载拼合图。";
    return;
  }
  if (!stitchFiles.length) return;
  try {
    await stitchProcessedTiles();
  } catch (error) {
    stitchTilesButton.disabled = false;
    autoAlignButton.disabled = true;
    fullscreenStitchButton.disabled = true;
    deleteSelectedTileButton.disabled = true;
    clearStitchTilesButton.disabled = true;
    downloadMergedButton.disabled = true;
    stitchResult.hidden = true;
    stitchStatus.textContent = "拼合失败。请确认选择的是图片文件，然后再试一次。";
  }
});

autoAlignButton.addEventListener("click", () => {
  if (stitchPlacedItems.length < 2) return;
  autoAlignButton.disabled = true;
  stitchStatus.textContent = "正在尝试按重叠区域自动对齐...";
  autoAlignPlacedItems();
  redrawStitchPreview();
  autoAlignButton.disabled = false;
  downloadMergedButton.disabled = false;
  stitchStatus.textContent = "已尝试自动对齐。AI 重绘变化太大的地方，仍然可以手动拖动微调。";
});

fullscreenStitchButton.addEventListener("click", () => {
  if (!stitchPlacedItems.length) return;
  stitchResult.classList.add("is-fullscreen");
  updateStitchActionButtons();
});

closeFullscreenStitchButton.addEventListener("click", () => {
  stitchResult.classList.remove("is-fullscreen");
  updateStitchActionButtons();
});

deleteSelectedTileButton.addEventListener("click", () => {
  deleteSelectedStitchItem();
});

clearStitchTilesButton.addEventListener("click", () => {
  stitchPlacedItems = [];
  stitchDrag = null;
  selectedStitchItem = null;
  stitchPlacementMode = "";
  resizeStitchCanvasToItems();
  redrawStitchPreview();
  updateStitchActionButtons();
  stitchStatus.textContent = "已清空拼合结果。可以重新选择切片，或点“拼合”重新放回这一组图。";
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && stitchResult.classList.contains("is-fullscreen")) {
    stitchResult.classList.remove("is-fullscreen");
    updateStitchActionButtons();
    return;
  }
  if ((event.key === "Delete" || event.key === "Backspace") && selectedStitchItem) {
    event.preventDefault();
    deleteSelectedStitchItem();
  }
});

downloadMergedButton.addEventListener("click", () => {
  const outputCanvas = renderStitchOutputCanvas();
  outputCanvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `${baseName}_stitched.png`);
  }, "image/png");
});

stitchPreview.addEventListener("pointerdown", (event) => {
  if (!stitchPlacedItems.length) return;
  const point = stitchCanvasPoint(event);
  if (!point) return;
  const index = findStitchItemAt(point);
  if (index < 0) return;
  const [item] = stitchPlacedItems.splice(index, 1);
  stitchPlacedItems.push(item);
  selectedStitchItem = item;
  deleteSelectedTileButton.disabled = false;
  stitchDrag = {
    item,
    dx: point.x - item.x,
    dy: point.y - item.y,
    startX: item.x,
    startY: item.y,
  };
  stitchPreview.setPointerCapture(event.pointerId);
  redrawStitchPreview();
});

stitchPreview.addEventListener("pointermove", (event) => {
  if (!stitchDrag) return;
  const point = stitchCanvasPoint(event);
  if (!point) return;
  stitchDrag.item.x = Math.round(point.x - stitchDrag.dx);
  stitchDrag.item.y = Math.round(point.y - stitchDrag.dy);
  redrawStitchPreview();
});

stitchPreview.addEventListener("pointerup", () => {
  if (!stitchDrag) return;
  const didSwap = maybeSwapStitchItem(stitchDrag.item, stitchDrag.startX, stitchDrag.startY);
  stitchDrag = null;
  redrawStitchPreview();
  stitchStatus.textContent = didSwap
    ? "已识别为大格调整，并交换两个格子。小范围拖动仍然是自由微调。"
    : "位置已调整。可以继续拖动、自动对齐，或下载拼合图。";
});

stitchPreview.addEventListener("pointercancel", () => {
  stitchDrag = null;
});

function wireImageImport() {
  document.addEventListener("paste", async (event) => {
    const file = [...event.clipboardData.files].find((item) => item.type.startsWith("image/"));
    if (file) {
      event.preventDefault();
      await loadSourceFile(file);
      return;
    }

    const item = [...event.clipboardData.items].find((entry) => entry.type.startsWith("image/"));
    if (item) {
      event.preventDefault();
      await loadSourceFile(item.getAsFile());
    }
  });

  fileInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (file) await loadSourceFile(file);
  });

  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("is-over");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("is-over");
  });

  dropZone.addEventListener("drop", async (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-over");
    const file = [...event.dataTransfer.files].find((item) => item.type.startsWith("image/"));
    if (file) await loadSourceFile(file);
  });
}

async function loadSourceFile(file) {
  const image = await loadImage(URL.createObjectURL(file));
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext("2d").drawImage(image, 0, 0);
  URL.revokeObjectURL(image.src);
  baseName = cleanBaseName(file.name || "ai-image");
  if (hasChromeStorage) await chrome.storage.local.remove("overlapSlicerCapture");
  await setSourceCanvas(canvas, baseName);
}

async function loadSourceData(source) {
  const image = await loadImage(source.dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext("2d").drawImage(image, 0, 0);
  baseName = cleanBaseName(source.name || source.pageTitle || "ai-image");
  await setSourceCanvas(canvas, baseName);
}

async function loadSourceRecord(source) {
  const src = source.blob ? URL.createObjectURL(source.blob) : source.dataUrl;
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext("2d").drawImage(image, 0, 0);
  if (source.blob) URL.revokeObjectURL(src);
  baseName = cleanBaseName(source.name || source.pageTitle || "ai-image");
  await setSourceCanvas(canvas, baseName);
}

async function setSourceCanvas(canvas, name) {
  originalImage = canvas;
  capturedImage = canvas;
  tileSourceImage = canvas;
  baseName = cleanBaseName(name || "ai-image");
  meta.textContent = `${capturedImage.width} x ${capturedImage.height}`;
  dropZone.classList.add("is-hidden");
  cropRect = null;
  applyCropButton.disabled = true;
  resetCropButton.disabled = true;
  makeTiles();
}

copyNextButton.addEventListener("click", async () => {
  if (!tiles.length) return;
  await copyTile(tiles[nextCopyIndex]);
  nextCopyIndex = (nextCopyIndex + 1) % tiles.length;
  copyNextButton.textContent = `复制下一张 R${tiles[nextCopyIndex].row + 1} C${tiles[nextCopyIndex].col + 1}`;
});

downloadAllButton.addEventListener("click", async () => {
  for (const tile of tiles) {
    downloadCanvas(tile.canvas, tile.name);
    await wait(120);
  }
});

downloadPlanButton.addEventListener("click", () => {
  const plan = {
    version: 1,
    name: baseName,
    width: tileSourceImage.width,
    height: tileSourceImage.height,
    cols: getInt(colsInput.value, 1, 12),
    rows: getInt(rowsInput.value, 1, 12),
    overlapPercent: Math.max(0, Number(overlapInput.value) || 0),
    aspectRatio: cropAspectInput.value,
    tiles: tiles.map(({ canvas, ...tile }) => tile),
  };
  downloadBlob(
    new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" }),
    `${baseName}_layout.json`,
  );
});

async function cropCapture(capture) {
  const image = await loadImage(capture.dataUrl);
  const scaleX = image.naturalWidth / capture.viewport.width;
  const scaleY = image.naturalHeight / capture.viewport.height;
  const sx = Math.round(capture.rect.x * scaleX);
  const sy = Math.round(capture.rect.y * scaleY);
  const sw = Math.round(capture.rect.width * scaleX);
  const sh = Math.round(capture.rect.height * scaleY);

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  canvas.getContext("2d").drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas;
}

function makeTiles() {
  if (!tileSourceImage) return;
  stitchResult.hidden = true;
  downloadMergedButton.disabled = true;
  autoAlignButton.disabled = true;
  fullscreenStitchButton.disabled = true;
  deleteSelectedTileButton.disabled = true;
  clearStitchTilesButton.disabled = true;
  stitchResult.classList.remove("is-fullscreen");
  stitchPlacedItems = [];
  stitchDrag = null;
  selectedStitchItem = null;
  tiles = calculateTiles().map((tile) => {
    const canvas = document.createElement("canvas");
    canvas.width = tile.width;
    canvas.height = tile.height;
    canvas.getContext("2d").drawImage(
      tileSourceImage,
      tile.x,
      tile.y,
      tile.width,
      tile.height,
      0,
      0,
      tile.width,
      tile.height,
    );
    return { ...tile, canvas };
  });

  nextCopyIndex = 0;
  copyNextButton.disabled = !tiles.length;
  downloadAllButton.disabled = !tiles.length;
  downloadPlanButton.disabled = !tiles.length;
  stitchTilesButton.disabled = !stitchFiles.length;
  autoAlignButton.disabled = true;
  fullscreenStitchButton.disabled = true;
  deleteSelectedTileButton.disabled = true;
  clearStitchTilesButton.disabled = true;
  stitchStatus.textContent = getStitchReadyText();
  copyNextButton.textContent = tiles.length ? `复制下一张 R1 C1` : "复制下一张";
  renderPreview();
  renderTiles();
}

function clearPreview() {
  const rect = preview.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  preview.width = Math.max(1, Math.round(rect.width * dpr));
  preview.height = Math.max(1, Math.round(rect.height * dpr));
  previewContext.clearRect(0, 0, preview.width, preview.height);
  previewMetrics = null;
  cropRect = null;
  cropInteraction = null;
  applyCropButton.disabled = true;
  resetCropButton.disabled = true;
  tilesNode.innerHTML = "";
}

function calculateTiles() {
  const cols = getInt(colsInput.value, 1, 12);
  const rows = getInt(rowsInput.value, 1, 12);
  const overlapPercent = Math.max(0, Number(overlapInput.value) || 0);
  const baseW = tileSourceImage.width / cols;
  const baseH = tileSourceImage.height / rows;
  const overlapX = Math.round((baseW * overlapPercent) / 100);
  const overlapY = Math.round((baseH * overlapPercent) / 100);
  const result = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const innerX = Math.round(col * baseW);
      const innerY = Math.round(row * baseH);
      const innerRight = Math.round((col + 1) * baseW);
      const innerBottom = Math.round((row + 1) * baseH);
      const x = Math.max(0, innerX - overlapX);
      const y = Math.max(0, innerY - overlapY);
      const right = Math.min(tileSourceImage.width, innerRight + overlapX);
      const bottom = Math.min(tileSourceImage.height, innerBottom + overlapY);
      const baseRect = { x, y, width: right - x, height: bottom - y };
      const aspect = getTileAspect(baseRect);
      const crop = expandRectToAspect(baseRect, aspect.ratio, tileSourceImage.width, tileSourceImage.height);
      const actualRatio = crop.width / crop.height;
      const ratioDelta = Math.abs(Math.log(actualRatio / aspect.ratio));

      result.push({
        row,
        col,
        x: crop.x,
        y: crop.y,
        width: crop.width,
        height: crop.height,
        aspect: aspect.label,
        aspectMatched: ratioDelta < 0.015,
        innerX,
        innerY,
        innerWidth: innerRight - innerX,
        innerHeight: innerBottom - innerY,
        overlapX: x,
        overlapY: y,
        overlapWidth: right - x,
        overlapHeight: bottom - y,
        name: `${baseName}_row-${row + 1}_col-${col + 1}_${aspect.label.replace(":", "-")}.png`,
      });
    }
  }

  return result;
}

function getTileAspect(rect) {
  const selected = cropAspectInput.value;
  if (selected !== "free") {
    return SUPPORTED_ASPECTS.find((item) => item.label === selected) || SUPPORTED_ASPECTS[1];
  }

  const ratio = rect.width / rect.height;
  return SUPPORTED_ASPECTS.reduce((best, item) => {
    const bestDistance = Math.abs(Math.log(best.ratio / ratio));
    const itemDistance = Math.abs(Math.log(item.ratio / ratio));
    return itemDistance < bestDistance ? item : best;
  }, SUPPORTED_ASPECTS[0]);
}

function expandRectToAspect(rect, targetRatio, imageWidth, imageHeight) {
  let width = rect.width;
  let height = rect.height;
  const currentRatio = width / height;

  if (currentRatio > targetRatio) {
    height = Math.ceil(width / targetRatio);
  } else {
    width = Math.ceil(height * targetRatio);
  }

  if (width > imageWidth) {
    width = imageWidth;
    height = Math.ceil(width / targetRatio);
  }

  if (height > imageHeight) {
    height = imageHeight;
    width = Math.ceil(height * targetRatio);
  }

  width = Math.max(rect.width, Math.min(imageWidth, Math.round(width)));
  height = Math.max(rect.height, Math.min(imageHeight, Math.round(height)));

  let x = rect.x - (width - rect.width) / 2;
  let y = rect.y - (height - rect.height) / 2;
  x = Math.round(Math.max(0, Math.min(imageWidth - width, x)));
  y = Math.round(Math.max(0, Math.min(imageHeight - height, y)));

  if (x > rect.x) x = rect.x;
  if (y > rect.y) y = rect.y;
  if (x + width < rect.x + rect.width) x = rect.x + rect.width - width;
  if (y + height < rect.y + rect.height) y = rect.y + rect.height - height;

  x = Math.round(Math.max(0, Math.min(imageWidth - width, x)));
  y = Math.round(Math.max(0, Math.min(imageHeight - height, y)));

  return { x, y, width, height };
}

function renderPreview() {
  const rect = preview.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  preview.width = Math.round(rect.width * dpr);
  preview.height = Math.round(rect.height * dpr);
  previewContext.clearRect(0, 0, preview.width, preview.height);

  const scale = Math.min(preview.width / capturedImage.width, preview.height / capturedImage.height);
  const drawW = capturedImage.width * scale;
  const drawH = capturedImage.height * scale;
  const drawX = (preview.width - drawW) / 2;
  const drawY = (preview.height - drawH) / 2;
  previewMetrics = { scale, drawX, drawY, drawW, drawH };

  previewContext.drawImage(capturedImage, drawX, drawY, drawW, drawH);
  previewContext.lineWidth = 2;
  previewContext.font = "14px Microsoft YaHei, sans-serif";

  if (tileSourceImage === capturedImage) {
    for (const tile of tiles) {
      previewContext.fillStyle = "rgba(86, 183, 255, 0.13)";
      previewContext.strokeStyle = "rgba(86, 183, 255, 0.9)";
      previewContext.fillRect(drawX + tile.x * scale, drawY + tile.y * scale, tile.width * scale, tile.height * scale);
      previewContext.strokeRect(drawX + tile.x * scale, drawY + tile.y * scale, tile.width * scale, tile.height * scale);
      previewContext.strokeStyle = "rgba(128, 210, 132, 0.95)";
      previewContext.strokeRect(
        drawX + tile.innerX * scale,
        drawY + tile.innerY * scale,
        tile.innerWidth * scale,
        tile.innerHeight * scale,
      );
    }
  }

  if (cropRect) {
    previewContext.save();
    previewContext.fillStyle = "rgba(0, 0, 0, 0.32)";
    previewContext.fillRect(drawX, drawY, drawW, drawH);
    previewContext.drawImage(
      capturedImage,
      cropRect.x,
      cropRect.y,
      cropRect.width,
      cropRect.height,
      drawX + cropRect.x * scale,
      drawY + cropRect.y * scale,
      cropRect.width * scale,
      cropRect.height * scale,
    );
    previewContext.strokeStyle = "rgba(255, 255, 255, 0.95)";
    previewContext.lineWidth = 2;
    previewContext.strokeRect(
      drawX + cropRect.x * scale,
      drawY + cropRect.y * scale,
      cropRect.width * scale,
      cropRect.height * scale,
    );
    previewContext.fillStyle = "rgba(17, 19, 25, 0.76)";
    previewContext.fillRect(
      drawX + cropRect.x * scale,
      Math.max(drawY + cropRect.y * scale - 24, drawY),
      116,
      22,
    );
    previewContext.fillStyle = "#f3f5f7";
    previewContext.font = "13px Microsoft YaHei, sans-serif";
    previewContext.fillText(
      `${cropRect.width} x ${cropRect.height}`,
      drawX + cropRect.x * scale + 8,
      Math.max(drawY + cropRect.y * scale - 19, drawY + 5),
    );
    previewContext.restore();
  }
}

function renderTiles() {
  tilesNode.innerHTML = "";
  for (const tile of tiles) {
    const card = document.createElement("article");
    card.className = "tile";
    const visibleCanvas = tile.canvas.cloneNode();
    visibleCanvas.getContext("2d").drawImage(tile.canvas, 0, 0);

    const footer = document.createElement("footer");
    const title = document.createElement("strong");
    title.textContent = `R${tile.row + 1} C${tile.col + 1}`;
    const size = document.createElement("small");
    size.textContent = `${tile.width} x ${tile.height}px · ${tile.aspect}${tile.aspectMatched ? "" : " 接近"}`;
    const actions = document.createElement("div");
    actions.className = "tile-actions";
    const copyButton = document.createElement("button");
    copyButton.textContent = "复制";
    copyButton.addEventListener("click", () => copyTile(tile));
    const downloadButton = document.createElement("button");
    downloadButton.textContent = "下载";
    downloadButton.addEventListener("click", () => downloadCanvas(tile.canvas, tile.name));

    actions.append(copyButton, downloadButton);
    footer.append(title, size, actions);
    card.append(visibleCanvas, footer);
    tilesNode.append(card);
  }
}

async function stitchProcessedTiles() {
  const stitchPlan = await buildStitchPlan();
  const assignments = stitchPlan.assignments;
  const assignedCount = assignments.filter((item) => item.file).length;
  if (!assignedCount) {
    stitchStatus.textContent = "没有找到可以拼合的图片。请重新选择处理后的切片。";
    downloadMergedButton.disabled = true;
    stitchResult.hidden = true;
    return;
  }

  stitchTilesButton.disabled = true;
  stitchStatus.textContent = `正在拼合 ${assignedCount} / ${assignments.length} 张...`;
  stitchPreview.width = stitchPlan.width;
  stitchPreview.height = stitchPlan.height;
  stitchPlacedItems = [];
  stitchPlacementMode = stitchPlan.mode;

  for (const { tile, file } of assignments) {
    if (!file) continue;
    const url = URL.createObjectURL(file);
    const image = await loadImage(url);
    const canvas = makeFeatheredTile(image, tile, stitchPlan.width, stitchPlan.height);
    URL.revokeObjectURL(url);
    const context = canvas.getContext("2d");
    stitchPlacedItems.push({
      canvas,
      pixels: context.getImageData(0, 0, canvas.width, canvas.height).data,
      name: file.name,
      x: tile.x,
      y: tile.y,
      slotX: tile.x,
      slotY: tile.y,
      width: tile.width,
      height: tile.height,
    });
  }
  redrawStitchPreview();

  stitchResult.hidden = false;
  stitchTilesButton.disabled = false;
  selectedStitchItem = stitchPlacedItems.at(-1) || null;
  updateStitchActionButtons();
  const missingCount = assignments.length - assignedCount;
  stitchStatus.textContent = missingCount
    ? `已拼合 ${assignedCount} 张，缺 ${missingCount} 张。缺的区域会保持深色。`
    : `已放上 ${assignedCount} 张${stitchPlan.mode === "layout" ? "" : "（按当前行列顺序）"}。如果位置不对，直接拖动图片调整。`;
}

function redrawStitchPreview() {
  stitchPreviewContext.clearRect(0, 0, stitchPreview.width, stitchPreview.height);
  stitchPreviewContext.fillStyle = "#0c0d10";
  stitchPreviewContext.fillRect(0, 0, stitchPreview.width, stitchPreview.height);
  for (const item of stitchPlacedItems) {
    stitchPreviewContext.drawImage(item.canvas, item.x, item.y);
  }
  if (selectedStitchItem && stitchPlacedItems.includes(selectedStitchItem)) {
    stitchPreviewContext.save();
    stitchPreviewContext.lineWidth = Math.max(3, Math.round(Math.min(stitchPreview.width, stitchPreview.height) * 0.003));
    stitchPreviewContext.strokeStyle = "#56b7ff";
    stitchPreviewContext.setLineDash([14, 8]);
    stitchPreviewContext.strokeRect(
      selectedStitchItem.x + 1,
      selectedStitchItem.y + 1,
      selectedStitchItem.width - 2,
      selectedStitchItem.height - 2,
    );
    stitchPreviewContext.restore();
  }
}

function deleteSelectedStitchItem() {
  if (!selectedStitchItem) return;
  const index = stitchPlacedItems.indexOf(selectedStitchItem);
  if (index >= 0) stitchPlacedItems.splice(index, 1);
  selectedStitchItem = null;
  stitchDrag = null;
  compactImageOnlyStitchGrid();
  resizeStitchCanvasToItems();
  redrawStitchPreview();
  updateStitchActionButtons();
  stitchStatus.textContent = "已删除选中的拼合图。删错了可以点“拼合”重新放回这一组图。";
}

function updateStitchActionButtons() {
  const hasPlaced = stitchPlacedItems.length > 0;
  downloadMergedButton.disabled = !hasPlaced;
  autoAlignButton.disabled = stitchPlacedItems.length < 2;
  fullscreenStitchButton.disabled = !hasPlaced || stitchResult.classList.contains("is-fullscreen");
  deleteSelectedTileButton.disabled = !selectedStitchItem;
  clearStitchTilesButton.disabled = !hasPlaced;
}

function compactImageOnlyStitchGrid() {
  if (stitchPlacementMode !== "image-only" || !stitchPlacedItems.length) return;

  const sorted = [...stitchPlacedItems].sort((a, b) => {
    const ay = a.slotY ?? a.y;
    const by = b.slotY ?? b.y;
    if (Math.abs(ay - by) > 8) return ay - by;
    return (a.slotX ?? a.x) - (b.slotX ?? b.x);
  });
  stitchPlacedItems = sorted;

  const count = stitchPlacedItems.length;
  const inputCols = getInt(colsInput.value, 1, 12);
  const inputRows = getInt(rowsInput.value, 1, 12);
  const cols = inputCols * inputRows >= count ? inputCols : Math.ceil(Math.sqrt(count));
  const tileWidth = Math.max(...stitchPlacedItems.map((item) => item.width));
  const tileHeight = Math.max(...stitchPlacedItems.map((item) => item.height));
  const overlapPercent = Math.max(0, Number(overlapInput.value) || 0) / 100;
  const stepX = cols > 1 ? Math.max(1, Math.round(tileWidth / (1 + overlapPercent))) : tileWidth;
  const rows = Math.max(1, Math.ceil(count / cols));
  const stepY = rows > 1 ? Math.max(1, Math.round(tileHeight / (1 + overlapPercent))) : tileHeight;

  stitchPlacedItems.forEach((item, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    item.x = col * stepX;
    item.y = row * stepY;
    item.slotX = item.x;
    item.slotY = item.y;
  });
}

function resizeStitchCanvasToItems() {
  if (!stitchPlacedItems.length) {
    stitchPreview.width = 1;
    stitchPreview.height = 1;
    return;
  }

  const bounds = getStitchItemsBounds();
  const width = Math.max(1, Math.ceil(bounds.right - bounds.left));
  const height = Math.max(1, Math.ceil(bounds.bottom - bounds.top));

  for (const item of stitchPlacedItems) {
    item.x = Math.round(item.x - bounds.left);
    item.y = Math.round(item.y - bounds.top);
    if (typeof item.slotX === "number") item.slotX = Math.round(item.slotX - bounds.left);
    if (typeof item.slotY === "number") item.slotY = Math.round(item.slotY - bounds.top);
  }

  stitchPreview.width = width;
  stitchPreview.height = height;
}

function getStitchItemsBounds() {
  return stitchPlacedItems.reduce(
    (bounds, item) => ({
      left: Math.min(bounds.left, item.x),
      top: Math.min(bounds.top, item.y),
      right: Math.max(bounds.right, item.x + item.width),
      bottom: Math.max(bounds.bottom, item.y + item.height),
    }),
    {
      left: Number.POSITIVE_INFINITY,
      top: Number.POSITIVE_INFINITY,
      right: Number.NEGATIVE_INFINITY,
      bottom: Number.NEGATIVE_INFINITY,
    },
  );
}

function renderStitchOutputCanvas() {
  const canvas = document.createElement("canvas");
  if (!stitchPlacedItems.length) {
    canvas.width = 1;
    canvas.height = 1;
    return canvas;
  }

  const bounds = getStitchItemsBounds();
  canvas.width = Math.max(1, Math.ceil(bounds.right - bounds.left));
  canvas.height = Math.max(1, Math.ceil(bounds.bottom - bounds.top));
  const context = canvas.getContext("2d");
  context.fillStyle = "#0c0d10";
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (const item of stitchPlacedItems) {
    context.drawImage(item.canvas, item.x - bounds.left, item.y - bounds.top);
  }
  return canvas;
}

function stitchCanvasPoint(event) {
  const rect = stitchPreview.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    x: (event.clientX - rect.left) * (stitchPreview.width / rect.width),
    y: (event.clientY - rect.top) * (stitchPreview.height / rect.height),
  };
}

function findStitchItemAt(point) {
  for (let index = stitchPlacedItems.length - 1; index >= 0; index -= 1) {
    const item = stitchPlacedItems[index];
    if (point.x >= item.x && point.y >= item.y && point.x <= item.x + item.width && point.y <= item.y + item.height) {
      return index;
    }
  }
  return -1;
}

function maybeSwapStitchItem(item, startX, startY) {
  const moved = Math.hypot(item.x - startX, item.y - startY);
  const swapThreshold = Math.max(36, Math.min(item.width, item.height) * 0.18);
  if (moved < swapThreshold) return false;

  const itemCenter = {
    x: item.x + item.width / 2,
    y: item.y + item.height / 2,
  };
  let target = null;
  let targetDistance = Number.POSITIVE_INFINITY;

  for (const candidate of stitchPlacedItems) {
    if (candidate === item) continue;
    const slotX = candidate.slotX ?? candidate.x;
    const slotY = candidate.slotY ?? candidate.y;
    const slotCenter = {
      x: slotX + candidate.width / 2,
      y: slotY + candidate.height / 2,
    };
    const insideSlot =
      itemCenter.x >= slotX &&
      itemCenter.x <= slotX + candidate.width &&
      itemCenter.y >= slotY &&
      itemCenter.y <= slotY + candidate.height;
    const distance = Math.hypot(itemCenter.x - slotCenter.x, itemCenter.y - slotCenter.y);
    const snapRadius = Math.max(48, Math.min(candidate.width, candidate.height) * 0.42);
    if ((insideSlot || distance < snapRadius) && distance < targetDistance) {
      target = candidate;
      targetDistance = distance;
    }
  }

  if (!target) return false;

  const itemSlot = {
    x: item.slotX ?? startX,
    y: item.slotY ?? startY,
  };
  const targetSlot = {
    x: target.slotX ?? target.x,
    y: target.slotY ?? target.y,
  };

  item.x = targetSlot.x;
  item.y = targetSlot.y;
  target.x = itemSlot.x;
  target.y = itemSlot.y;
  item.slotX = targetSlot.x;
  item.slotY = targetSlot.y;
  target.slotX = itemSlot.x;
  target.slotY = itemSlot.y;
  return true;
}

function autoAlignPlacedItems() {
  const maxShift = 48;
  const step = 4;
  for (let index = 1; index < stitchPlacedItems.length; index += 1) {
    const item = stitchPlacedItems[index];
    let best = { x: item.x, y: item.y, score: Number.POSITIVE_INFINITY };

    for (let dy = -maxShift; dy <= maxShift; dy += step) {
      for (let dx = -maxShift; dx <= maxShift; dx += step) {
        const score = scoreStitchPosition(item, item.x + dx, item.y + dy, index);
        if (score < best.score) {
          best = { x: item.x + dx, y: item.y + dy, score };
        }
      }
    }

    if (Number.isFinite(best.score)) {
      item.x = best.x;
      item.y = best.y;
    }
  }
}

function scoreStitchPosition(item, x, y, compareUntilIndex) {
  let total = 0;
  let count = 0;
  const sampleStep = 8;

  for (let otherIndex = 0; otherIndex < compareUntilIndex; otherIndex += 1) {
    const other = stitchPlacedItems[otherIndex];
    const left = Math.max(x, other.x);
    const top = Math.max(y, other.y);
    const right = Math.min(x + item.width, other.x + other.width);
    const bottom = Math.min(y + item.height, other.y + other.height);
    if (right <= left || bottom <= top) continue;

    for (let py = top; py < bottom; py += sampleStep) {
      for (let px = left; px < right; px += sampleStep) {
        const itemOffset = (Math.floor(py - y) * item.width + Math.floor(px - x)) * 4;
        const otherOffset = (Math.floor(py - other.y) * other.width + Math.floor(px - other.x)) * 4;
        const itemAlpha = item.pixels[itemOffset + 3];
        const otherAlpha = other.pixels[otherOffset + 3];
        if (itemAlpha < 32 || otherAlpha < 32) continue;
        const dr = item.pixels[itemOffset] - other.pixels[otherOffset];
        const dg = item.pixels[itemOffset + 1] - other.pixels[otherOffset + 1];
        const db = item.pixels[itemOffset + 2] - other.pixels[otherOffset + 2];
        total += dr * dr + dg * dg + db * db;
        count += 1;
      }
    }
  }

  return count > 24 ? total / count : Number.POSITIVE_INFINITY;
}

function getStitchReadyText() {
  if (!stitchFiles.length) return "处理后的切片会在这里回拼，不会覆盖左侧原图。";
  if (tiles.length) {
    return `已选择 ${stitchFiles.length} 张处理后切片。当前布局需要 ${tiles.length} 张；选好后点击“拼合”。`;
  }
  const cols = getInt(colsInput.value, 1, 12);
  const rows = Math.ceil(stitchFiles.length / cols);
  return `已选择 ${stitchFiles.length} 张处理后图片。没有旧切片布局时，会先按 ${cols} 列 ${rows} 行放上来，你可以手动拖位置。`;
}

async function buildStitchPlan() {
  if (tiles.length && tileSourceImage) {
    return {
      mode: "layout",
      width: tileSourceImage.width,
      height: tileSourceImage.height,
      assignments: buildLayoutStitchAssignments(tiles),
    };
  }

  if (tileSourceImage) {
    const layoutTiles = calculateTiles();
    return {
      mode: "layout",
      width: tileSourceImage.width,
      height: tileSourceImage.height,
      assignments: buildLayoutStitchAssignments(layoutTiles),
    };
  }

  return buildImageOnlyStitchPlan();
}

function buildLayoutStitchAssignments(layoutTiles) {
  const keyedFiles = new Map();
  const unkeyedFiles = [];

  for (const file of stitchFiles) {
    const key = keyFromFilename(file.name);
    if (key && !keyedFiles.has(key)) {
      keyedFiles.set(key, file);
    } else {
      unkeyedFiles.push(file);
    }
  }

  let orderIndex = 0;
  return layoutTiles.map((tile) => {
    const key = `${tile.row + 1}-${tile.col + 1}`;
    const file = keyedFiles.get(key) || unkeyedFiles[orderIndex] || null;
    if (!keyedFiles.get(key) && unkeyedFiles[orderIndex]) orderIndex += 1;
    return { tile, file };
  });
}

async function buildImageOnlyStitchPlan() {
  const loaded = [];
  for (const file of stitchFiles) {
    const url = URL.createObjectURL(file);
    const image = await loadImage(url);
    loaded.push({ file, image, width: image.naturalWidth || image.width, height: image.naturalHeight || image.height });
    URL.revokeObjectURL(url);
  }

  const count = loaded.length;
  const inputCols = getInt(colsInput.value, 1, 12);
  const inputRows = getInt(rowsInput.value, 1, 12);
  const inferredCols = inputCols * inputRows >= count ? inputCols : Math.ceil(Math.sqrt(count));
  const cols = Math.max(1, Math.min(12, inferredCols));
  const rows = Math.max(1, Math.ceil(count / cols));
  const tileWidth = Math.max(...loaded.map((item) => item.width));
  const tileHeight = Math.max(...loaded.map((item) => item.height));
  const overlapPercent = Math.max(0, Number(overlapInput.value) || 0) / 100;
  const stepX = cols > 1 ? Math.max(1, Math.round(tileWidth / (1 + overlapPercent))) : tileWidth;
  const stepY = rows > 1 ? Math.max(1, Math.round(tileHeight / (1 + overlapPercent))) : tileHeight;
  const width = stepX * (cols - 1) + tileWidth;
  const height = stepY * (rows - 1) + tileHeight;

  return {
    mode: "image-only",
    width,
    height,
    assignments: loaded.map((item, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      return {
        file: item.file,
        tile: {
          row,
          col,
          x: col * stepX,
          y: row * stepY,
          width: item.width,
          height: item.height,
        },
      };
    }),
  };
}

function makeFeatheredTile(image, tile, targetWidth, targetHeight) {
  const canvas = document.createElement("canvas");
  canvas.width = tile.width;
  canvas.height = tile.height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, tile.width, tile.height);

  const feather = Math.max(8, Math.round(Math.min(tile.width, tile.height) * 0.08));
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const leftFeather = tile.x > 0 ? feather : 0;
  const topFeather = tile.y > 0 ? feather : 0;
  const rightFeather = tile.x + tile.width < targetWidth ? feather : 0;
  const bottomFeather = tile.y + tile.height < targetHeight ? feather : 0;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      let alpha = 1;
      if (leftFeather) alpha = Math.min(alpha, x / leftFeather);
      if (topFeather) alpha = Math.min(alpha, y / topFeather);
      if (rightFeather) alpha = Math.min(alpha, (canvas.width - 1 - x) / rightFeather);
      if (bottomFeather) alpha = Math.min(alpha, (canvas.height - 1 - y) / bottomFeather);
      data[(y * canvas.width + x) * 4 + 3] = Math.round(data[(y * canvas.width + x) * 4 + 3] * Math.max(0, Math.min(1, alpha)));
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

function keyFromFilename(name) {
  const match = name.match(/row-(\d+)_col-(\d+)/i) || name.match(/r(\d+)[^\d]?c(\d+)/i);
  return match ? `${Number(match[1])}-${Number(match[2])}` : "";
}

function canvasPointToImage(event) {
  if (!previewMetrics) return null;
  const rect = preview.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const canvasX = (event.clientX - rect.left) * dpr;
  const canvasY = (event.clientY - rect.top) * dpr;
  const x = (canvasX - previewMetrics.drawX) / previewMetrics.scale;
  const y = (canvasY - previewMetrics.drawY) / previewMetrics.scale;
  if (x < 0 || y < 0 || x > capturedImage.width || y > capturedImage.height) return null;
  return {
    x: Math.round(x),
    y: Math.round(y),
  };
}

function normalizeImageRect(start, end, imageWidth, imageHeight) {
  const x1 = Math.max(0, Math.min(imageWidth, start.x));
  const y1 = Math.max(0, Math.min(imageHeight, start.y));
  const x2 = Math.max(0, Math.min(imageWidth, end.x));
  const y2 = Math.max(0, Math.min(imageHeight, end.y));
  return {
    x: Math.round(Math.min(x1, x2)),
    y: Math.round(Math.min(y1, y2)),
    width: Math.round(Math.abs(x2 - x1)),
    height: Math.round(Math.abs(y2 - y1)),
  };
}

function makeCropRect(start, end, imageWidth, imageHeight) {
  const ratio = getCropAspectRatio();
  if (!ratio) return normalizeImageRect(start, end, imageWidth, imageHeight);

  const signX = end.x >= start.x ? 1 : -1;
  const signY = end.y >= start.y ? 1 : -1;
  const rawW = Math.abs(end.x - start.x);
  const rawH = Math.abs(end.y - start.y);
  let width = rawW;
  let height = width / ratio;

  if (height > rawH) {
    height = rawH;
    width = height * ratio;
  }

  if (width < 1 || height < 1) {
    width = Math.max(1, rawW);
    height = Math.max(1, width / ratio);
  }

  width = Math.round(Math.min(width, imageWidth));
  height = Math.round(Math.min(height, imageHeight));

  let x = signX > 0 ? start.x : start.x - width;
  let y = signY > 0 ? start.y : start.y - height;

  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + width > imageWidth) x = imageWidth - width;
  if (y + height > imageHeight) y = imageHeight - height;

  return {
    x: Math.round(x),
    y: Math.round(y),
    width,
    height,
  };
}

function moveRect(rect, dx, dy, imageWidth, imageHeight) {
  return {
    ...rect,
    x: Math.round(Math.max(0, Math.min(imageWidth - rect.width, rect.x + dx))),
    y: Math.round(Math.max(0, Math.min(imageHeight - rect.height, rect.y + dy))),
  };
}

function fitExistingCropToAspect(rect, imageWidth, imageHeight) {
  const ratio = getCropAspectRatio();
  if (!ratio) return rect;
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  let width = rect.width;
  let height = width / ratio;

  if (height > rect.height) {
    height = rect.height;
    width = height * ratio;
  }

  if (width < 8 || height < 8) {
    width = Math.min(imageWidth, Math.max(8, rect.width));
    height = width / ratio;
  }

  if (width > imageWidth) {
    width = imageWidth;
    height = width / ratio;
  }
  if (height > imageHeight) {
    height = imageHeight;
    width = height * ratio;
  }

  width = Math.round(width);
  height = Math.round(height);
  return moveRect(
    {
      x: Math.round(centerX - width / 2),
      y: Math.round(centerY - height / 2),
      width,
      height,
    },
    0,
    0,
    imageWidth,
    imageHeight,
  );
}

function getCropAspectRatio() {
  if (cropAspectInput.value === "free") return null;
  return SUPPORTED_ASPECTS.find((item) => item.label === cropAspectInput.value)?.ratio || null;
}

function pointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x <= rect.x + rect.width &&
    point.y <= rect.y + rect.height
  );
}

async function copyTile(tile) {
  const blob = await canvasToBlob(tile.canvas);
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function downloadCanvas(canvas, name) {
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, name);
  }, "image/png");
}

function downloadBlob(blob, name) {
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
}

function getInt(value, min, max) {
  return Math.max(min, Math.min(max, Number.parseInt(value, 10) || min));
}

function cleanBaseName(value) {
  return String(value || "ai-image")
    .replace(/\.[^.]+$/, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "ai-image";
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
