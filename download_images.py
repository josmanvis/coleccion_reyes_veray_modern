import os
import json
import urllib.request
import ssl
from concurrent.futures import ThreadPoolExecutor

ssl._create_default_https_context = ssl._create_unverified_context

json_file = '/Users/admin/Developer/coleccion_reyes_veray_modern/frontend/src/data/artworks.json'
base_dir = '/Users/admin/Developer/coleccion_reyes_veray_modern/coleccionreyesveray.com'

with open(json_file, 'r') as f:
    artworks = json.load(f)

# Collect all unique image paths
image_paths = set()
for art in artworks:
    for img in art['images']:
        image_paths.add(img)

print(f"Total unique images to download: {len(image_paths)}")

def download_image(path):
    if not path.startswith('/wp-content'):
        return
        
    local_path = base_dir + path
    
    # We will download a thumbnail version by querying Jetpack CDN with ?resize=600,600
    base, ext = os.path.splitext(local_path)
    thumb_path = f"{base}-thumb{ext}"
    
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    
    remote_url_high = f"https://i0.wp.com/coleccionreyesveray.com{path}"
    remote_url_thumb = f"https://i0.wp.com/coleccionreyesveray.com{path}?resize=600,800"
    
    if not os.path.exists(local_path) or os.path.getsize(local_path) == 0:
        try:
            urllib.request.urlretrieve(remote_url_high, local_path)
        except Exception as e:
            pass
            
    if not os.path.exists(thumb_path) or os.path.getsize(thumb_path) == 0:
        try:
            urllib.request.urlretrieve(remote_url_thumb, thumb_path)
        except Exception as e:
            pass

# Run in parallel to speed up download
with ThreadPoolExecutor(max_workers=50) as executor:
    executor.map(download_image, image_paths)

print("Download complete.")
