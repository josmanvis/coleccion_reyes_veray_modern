import {test} from 'node:test';
import assert from 'node:assert/strict';
import loader from '../src/lib/image-loader';
import {getImageUrl} from '../src/lib/getImageUrl';
const source='https://storage.googleapis.com/gravy-meta-orc-web/v1/wp-content/uploads/Pe%C3%B1a.jpg';
test('responsive images use the next available precomputed width',()=>{
 assert.equal(loader({src:source,width:500}),source+'.w640.webp');
 assert.equal(loader({src:source,width:900}),source+'.w960.webp');
 assert.equal(loader({src:source,width:3840}),source+'.w1600.webp');
});
test('thumbnail resolution never adds provider-specific resize parameters',()=>{
 assert.equal(getImageUrl(source,true),source);
 assert.equal(getImageUrl(source+'?resize=800,800',true),source);
});
test('existing variants and local SVGs stay valid',()=>{
 assert.equal(loader({src:source+'.w640.webp',width:900}),source+'.w960.webp');
 assert.equal(loader({src:'/file.svg',width:500}),'/file.svg');
});
