import { UTApi } from "uploadthing/server";
import fs from "fs";

// Initialize with the provided token
const utapi = new UTApi({ token: "eyJhcGlLZXkiOiJza19saXZlXzU4N2RhYmI0YWY3ZWFmZDViYzU4ZDk3MWNkODA5ZjhmNzUxZDY2YmMwODA4MDAwYzJjZTdiOTVhOTk0NzEzNGIiLCJhcHBJZCI6Ino5ZThiZjQ3OGkiLCJyZWdpb25zIjpbInNlYTEiXX0=" });

const artworksFile = './src/data/artworks.json';
const artworks = JSON.parse(fs.readFileSync(artworksFile, 'utf8'));

async function processArtworks() {
  console.log(`Processing ${artworks.length} artworks...`);
  
  // We'll process them in batches so we don't overwhelm the API
  const batchSize = 10;
  let updatedCount = 0;

  for (let i = 0; i < artworks.length; i += batchSize) {
    const batch = artworks.slice(i, i + batchSize);
    const urlsToUpload = [];
    const mappings = []; // Keep track of which URL belongs to which artwork

    for (const art of batch) {
      if (art.images && art.images.length > 0) {
        const localPath = art.images[0]; // e.g. /wp-content/uploads/2021/01/Tabales.jpg
        
        // We need both the high-res and the thumb
        // Let's just upload the high-res, and let Next.js optimize it, 
        // OR upload both from the original CDN URLs
        const highResUrl = `https://i0.wp.com/coleccionreyesveray.com${localPath}`;
        const ext = localPath.substring(localPath.lastIndexOf('.'));
        const thumbLocalPath = localPath.replace(ext, `-thumb${ext}`);
        const thumbUrl = `https://i0.wp.com/coleccionreyesveray.com${localPath}?resize=600,800`;

        // Uploadthing uploadFilesFromUrl can take an array of strings
        urlsToUpload.push(highResUrl, thumbUrl);
        mappings.push(
          { art, type: 'high' },
          { art, type: 'thumb' }
        );
      }
    }

    if (urlsToUpload.length > 0) {
      try {
        console.log(`Uploading batch ${i/batchSize + 1} (${urlsToUpload.length} files)...`);
        const response = await utapi.uploadFilesFromUrl(urlsToUpload);
        
        // Update the JSON with the new Uploadthing URLs
        response.forEach((res, index) => {
          if (res.data && res.data.url) {
            const map = mappings[index];
            if (map.type === 'high') {
              map.art.ut_high = res.data.url;
            } else {
              map.art.ut_thumb = res.data.url;
            }
          } else {
            console.error("Failed to upload:", urlsToUpload[index], res.error);
          }
        });
        
        updatedCount += batch.length;
        // Save incrementally in case it crashes
        fs.writeFileSync(artworksFile, JSON.stringify(artworks, null, 2));
      } catch (err) {
        console.error(`Batch ${i/batchSize + 1} failed:`, err);
      }
    }
  }
  
  console.log(`Finished updating ${updatedCount} artworks!`);
}

processArtworks();
