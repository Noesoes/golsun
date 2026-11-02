import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { textureCompress, prune, dedup } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
const [,, inp, png, out] = process.argv;
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(inp);
const tex = doc.createTexture('skin').setImage(fs.readFileSync(png)).setMimeType('image/png');
for (const m of doc.getRoot().listMaterials()) { m.setBaseColorTexture(tex); m.setBaseColorFactor([1, 1, 1, 1]); m.setMetallicFactor(0); m.setRoughnessFactor(0.9); }
await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'png', resize: [256, 256], quality: 75 }));
await io.write(out, doc);
