import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalPath, variantPath } from './asset-paths.mjs';
test('WordPress, Photon and encoded references resolve to the same asset', () => {
 const expected = '/wp-content/uploads/2021/01/Peña obra.jpg';
 assert.equal(canonicalPath(expected), expected);
 assert.equal(canonicalPath('https://i0.wp.com/coleccionreyesveray.com/wp-content/uploads/2021/01/Pe%C3%B1a%20obra.jpg?resize=800,800&ssl=1'), expected);
 assert.equal(canonicalPath('https://coleccionreyesveray.com/wp-content/uploads/2021/01/Pe%C3%B1a%20obra.jpg'), expected);
});
test('unrelated providers and traversal are rejected', () => {
 for (const input of ['https://example.com/wp-content/x.jpg', '/wp-content/%2e%2e/secret', '/wp-content/a/../secret', '/wp-content/a%2fb.jpg', '/wp-content/a\\b.jpg']) assert.equal(canonicalPath(input), null);
});
test('variants retain distinct original filenames', () => {
 assert.equal(variantPath('/wp-content/a.jpg',640), '/wp-content/a.jpg.w640.webp');
 assert.equal(variantPath('/wp-content/a.png',640), '/wp-content/a.png.w640.webp');
});
test('known malformed Photon import prefix resolves without allowing traversal', () => {
 assert.equal(canonicalPath('https://i0.wp.com/coleccionreyesveray.com../wp-content/uploads/2024/12/Scan-1.tiff'), '/wp-content/uploads/2024/12/Scan-1.tiff');
 assert.equal(canonicalPath('https://i0.wp.com/coleccionreyesveray.com../wp-content/../../secret'), null);
});
