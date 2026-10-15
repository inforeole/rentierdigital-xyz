import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp from "sharp";

const SCHEMA_VERSION = 1;
const IMAGE_PATTERN = /\.(jpg|jpeg|png|webp)$/i;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedSettings(settings = {}) {
  return {
    width768: settings.width768 ?? 768,
    quality768: settings.quality768 ?? 40,
    width480: settings.width480 ?? 480,
    quality480: settings.quality480 ?? 35,
  };
}

function fingerprintFor(settings) {
  return JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    width768: settings.width768,
    quality768: settings.quality768,
    width480: settings.width480,
    quality480: settings.quality480,
    sharpVersion: sharp.versions.sharp,
    libvipsVersion: sharp.versions.vips,
  });
}

function outputBase(sourceName) {
  return sourceName.replace(/\.[^.]+$/, "");
}

function outputName(sourceName, width) {
  return `${outputBase(sourceName)}${width === 480 ? "-480w" : ""}.avif`;
}

function sourcePriority(sourceName) {
  const extension = sourceName.slice(sourceName.lastIndexOf(".") + 1).toLowerCase();
  if (extension === "png") return 0;
  if (extension === "webp") return 1;
  return 2;
}

function selectedSources(files) {
  const selected = new Map();
  for (const file of [...files].sort((left, right) => left < right ? -1 : left > right ? 1 : 0)) {
    const base = outputBase(file);
    const current = selected.get(base);
    if (!current || sourcePriority(file) < sourcePriority(current)) selected.set(base, file);
  }
  return [...selected.values()];
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isValidIndex(index) {
  return isPlainObject(index)
    && index.schemaVersion === SCHEMA_VERSION
    && isPlainObject(index.outputs)
    && Object.values(index.outputs).every(isSha256);
}

function isValidManifest(manifest, fingerprint, sourceDigest) {
  if (!isPlainObject(manifest)
    || manifest.schemaVersion !== SCHEMA_VERSION
    || manifest.fingerprint !== fingerprint
    || manifest.sourceDigest !== sourceDigest
    || !isPlainObject(manifest.variants)) return false;

  return ["768w.avif", "480w.avif"].every((name) => isPlainObject(manifest.variants[name])
    && isSha256(manifest.variants[name].digest));
}

function assertNoDestinationCollisions(files) {
  const destinations = new Map();
  for (const sourceName of files) {
    for (const width of [768, 480]) {
      const destination = outputName(sourceName, width);
      const existing = destinations.get(destination);
      if (existing && existing !== sourceName) {
        throw new Error(`Generated AVIF destination collision: ${destination} (${existing}, ${sourceName})`);
      }
      destinations.set(destination, sourceName);
    }
  }
}

function temporaryPath(path) {
  return `${path}.${process.pid}.${randomUUID()}.tmp`;
}

async function digestFile(path) {
  return sha256(await readFile(path));
}

async function atomicCopyIfDifferent(source, destination) {
  try {
    if (await digestFile(source) === await digestFile(destination)) return false;
  } catch {
    // A missing or unreadable destination must be restored from the verified cache.
  }

  await mkdir(dirname(destination), { recursive: true });
  const temp = temporaryPath(destination);
  try {
    await copyFile(source, temp);
    await rename(temp, destination);
    return true;
  } finally {
    await rm(temp, { force: true });
  }
}

async function atomicWriteJson(destination, value) {
  await mkdir(dirname(destination), { recursive: true });
  const temp = temporaryPath(destination);
  try {
    await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`);
    await rename(temp, destination);
  } finally {
    await rm(temp, { force: true });
  }
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

async function cacheRootWasEmpty(cacheDir) {
  try {
    return (await readdir(cacheDir)).length === 0;
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    throw error;
  }
}

async function isValidVariant(cachePath, digest) {
  if (typeof digest !== "string") return false;
  try {
    return (await digestFile(cachePath)) === digest;
  } catch {
    return false;
  }
}

async function defaultEncoder({ sourcePath, width, quality, outputPath }) {
  await sharp(sourcePath)
    .resize({ width, withoutEnlargement: true })
    .avif({ quality })
    .toFile(outputPath);
}

export async function convertBlogImages({
  sourceDir,
  cacheDir,
  conversionSettings = {},
  logger = console,
}) {
  const settings = normalizedSettings(conversionSettings);
  const fingerprint = fingerprintFor(settings);
  const encoder = conversionSettings.encoder ?? defaultEncoder;
  const files = selectedSources((await readdir(sourceDir)).filter((file) => IMAGE_PATTERN.test(file)));
  assertNoDestinationCollisions(files);
  const isColdCacheRoot = await cacheRootWasEmpty(cacheDir);
  const indexPath = join(cacheDir, "index.json");
  const savedIndex = await readJson(indexPath);
  const index = isValidIndex(savedIndex)
    ? savedIndex
    : { schemaVersion: SCHEMA_VERSION, outputs: {} };
  let indexChanged = savedIndex !== index;
  const result = { sources: files.length, encodedVariants: 0, cacheHits: 0, restoredOutputs: 0, prunedCacheEntries: 0, items: [] };

  for (const sourceName of files) {
    const sourcePath = join(sourceDir, sourceName);
    const sourceBytes = await readFile(sourcePath);
    const sourceDigest = sha256(sourceBytes);
    const key = sha256(Buffer.concat([sourceBytes, Buffer.from(fingerprint)]));
    const base = outputBase(sourceName);
    const itemCachePath = join(cacheDir, key);
    const manifestPath = join(itemCachePath, "manifest.json");
    const variantSpecs = [
      { width: settings.width768, quality: settings.quality768, cacheName: "768w.avif", outputPath: join(sourceDir, outputName(sourceName, 768)) },
      { width: settings.width480, quality: settings.quality480, cacheName: "480w.avif", outputPath: join(sourceDir, outputName(sourceName, 480)) },
    ];
    const indexedKey = index.outputs[base];
    const publicDigests = await Promise.all(variantSpecs.map(async (variant) => {
      try {
        return await digestFile(variant.outputPath);
      } catch {
        return null;
      }
    }));
    let manifest = await readJson(manifestPath);
    const manifestMatches = isValidManifest(manifest, fingerprint, sourceDigest);
    const canBootstrap = isColdCacheRoot && !indexedKey && !manifestMatches && publicDigests.some(Boolean);
    let encodedForSource = 0;
    if (canBootstrap) {
      manifest = {
        schemaVersion: SCHEMA_VERSION,
        fingerprint,
        sourceDigest,
        variants: {},
      };
      for (let position = 0; position < variantSpecs.length; position++) {
        const variant = variantSpecs[position];
        const cachePath = join(itemCachePath, variant.cacheName);
        if (publicDigests[position]) {
          await atomicCopyIfDifferent(variant.outputPath, cachePath);
          manifest.variants[variant.cacheName] = { digest: publicDigests[position] };
          continue;
        }
        await mkdir(itemCachePath, { recursive: true });
        const tempPath = temporaryPath(cachePath);
        try {
          await encoder({ sourcePath, width: variant.width, quality: variant.quality, outputPath: tempPath });
          await rename(tempPath, cachePath);
        } finally {
          await rm(tempPath, { force: true });
        }
        manifest.variants[variant.cacheName] = { digest: await digestFile(cachePath) };
        encodedForSource++;
        result.encodedVariants++;
      }
      await atomicWriteJson(manifestPath, manifest);
    } else {
      if (!manifestMatches) {
        manifest = {
          schemaVersion: SCHEMA_VERSION,
          fingerprint,
          sourceDigest,
          variants: {},
        };
      }

      for (const variant of variantSpecs) {
        const cachePath = join(itemCachePath, variant.cacheName);
        const valid = manifestMatches && await isValidVariant(cachePath, manifest.variants[variant.cacheName]?.digest);
        if (valid) continue;

        await mkdir(itemCachePath, { recursive: true });
        const tempPath = temporaryPath(cachePath);
        try {
          await encoder({ sourcePath, width: variant.width, quality: variant.quality, outputPath: tempPath });
          await rename(tempPath, cachePath);
        } finally {
          await rm(tempPath, { force: true });
        }
        manifest.variants[variant.cacheName] = { digest: await digestFile(cachePath) };
        encodedForSource++;
        result.encodedVariants++;
      }

      if (encodedForSource > 0 || !manifestMatches) {
        await atomicWriteJson(manifestPath, manifest);
      } else {
        result.cacheHits++;
      }
    }

    if (index.outputs[base] !== key) {
      index.outputs[base] = key;
      indexChanged = true;
    }
    for (const variant of variantSpecs) {
      const cachePath = join(itemCachePath, variant.cacheName);
      if (await atomicCopyIfDifferent(cachePath, variant.outputPath)) result.restoredOutputs++;
    }

    result.items.push({ sourceName, key, cachePath: itemCachePath });
    logger?.log?.(`${sourceName}: ${canBootstrap ? "cache bootstrapped" : encodedForSource ? `${encodedForSource} AVIF encoded` : "cache hit"}`);
  }

  const activeBases = new Set(files.map(outputBase));
  for (const base of Object.keys(index.outputs)) {
    if (activeBases.has(base)) continue;
    delete index.outputs[base];
    indexChanged = true;
  }
  if (indexChanged) await atomicWriteJson(indexPath, index);

  const activeKeys = new Set(Object.values(index.outputs));
  for (const entry of await readdir(cacheDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !isSha256(entry.name) || activeKeys.has(entry.name)) continue;
    await rm(join(cacheDir, entry.name), { recursive: true, force: true });
    result.prunedCacheEntries++;
  }
  return result;
}
