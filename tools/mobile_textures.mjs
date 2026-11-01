import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { textureCompress, meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
const [,, inp, out, size] = process.argv;
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(inp);
for (const m of doc.getRoot().listMaterials()) { const t = m.getNormalTexture(); if (t) m.setNormalTexture(null); const r = m.getMetallicRoughnessTexture(); if (r) m.setMetallicRoughnessTexture(null); }
for (const t of doc.getRoot().listTextures()) if (!t.listParents().some((p) => p !== doc.getRoot())) t.dispose();
const S = +size;
await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'png', resize: [S, S], quality: 70, effort: 80 }));
for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === 'EXT_texture_webp') e.dispose();
await io.write(out, doc);
