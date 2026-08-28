import os
import json
import glob
from bs4 import BeautifulSoup
import urllib.parse

base_dir = '/Users/admin/Developer/coleccion_reyes_veray_modern/coleccionreyesveray.com'
output_file = '/Users/admin/Developer/coleccion_reyes_veray_modern/frontend/src/data/artworks.json'

artworks = []

print("Scanning for HTML files...")
html_files = glob.glob(os.path.join(base_dir, '**', 'index.html'), recursive=True)

print(f"Found {len(html_files)} HTML files. Processing...")

for file_path in html_files:
    if 'wp-content' in file_path or 'wp-includes' in file_path or 'wp-json' in file_path or 'page' in file_path:
        continue
    
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        
    soup = BeautifulSoup(content, 'html.parser')
    
    # Try to find title
    title_tag = soup.find('h1', class_='page-title') or soup.find('title')
    title = title_tag.text.strip().replace(' - Colección Reyes Veray', '').replace(' &#8211; Colección Reyes Veray', '') if title_tag else "Unknown"
    
    if title == "Unknown" or title == "Colección Reyes Veray":
        continue
        
    # Find images
    images = []
    for img in soup.find_all('img'):
        src = img.get('src', '')
        if src and 'wp-content/uploads' in src and not src.endswith('button.png'):
            # Strip resize params if present
            clean_src = urllib.parse.urlunparse(urllib.parse.urlparse(src)._replace(query=""))
            # Make it absolute to our symlinked folder
            clean_src = clean_src.replace('https://i0.wp.com/coleccionreyesveray.com', '').replace('https://coleccionreyesveray.com', '')
            if clean_src not in images:
                images.append(clean_src)
                
    # Extract description text (history, provenance, dimensions)
    description_html = ""
    # Usually in WordPress it's in entry-content or similar. We will just grab all paragraphs that aren't empty.
    paragraphs = soup.find_all('p')
    desc_lines = []
    for p in paragraphs:
        text = p.get_text(separator='\n').strip()
        if text and len(text) > 5 and 'Colección Reyes Veray' not in text:
            desc_lines.append(text)
    
    description = "\n".join(desc_lines)
    
    if images or description:
        artworks.append({
            'title': title,
            'url': file_path.replace(base_dir, ''),
            'images': images,
            'description': description
        })

print(f"Extracted {len(artworks)} items.")
os.makedirs(os.path.dirname(output_file), exist_ok=True)
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(artworks, f, indent=2, ensure_ascii=False)
print(f"Saved to {output_file}")
