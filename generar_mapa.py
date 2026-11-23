import os
import math
import time
import zipfile
import xml.etree.ElementTree as ET
import requests
from pmtiles.writer import Writer
from pmtiles.tile import zxy_to_tileid, TileType, Compression

# Configuración
KMZ_PATH = "rutas/rutas_finales.kmz"
OUTPUT_PMTILES = "mapa-base.pmtiles"
MIN_ZOOM = 13
MAX_ZOOM = 18  # Máxima nitidez sin pesar demasiado (puedes subir a 19 si deseas más detalle)
MARGEN_GRADOS = 0.006  # ~650 metros alrededor de las pistas

def obtener_limites_kmz(kmz_path):
    with zipfile.ZipFile(kmz_path, 'r') as z:
        kml_name = [n for n in z.namelist() if n.lower().endswith('.kml')][0]
        kml_data = z.read(kml_name)

    root = ET.fromstring(kml_data)
    lons, lats = [], []
    for elem in root.iter():
        if elem.tag.endswith('coordinates') and elem.text:
            for coord in elem.text.strip().split():
                partes = coord.split(',')
                if len(partes) >= 2:
                    lons.append(float(partes[0]))
                    lats.append(float(partes[1]))

    return (
        min(lons) - MARGEN_GRADOS,
        min(lats) - MARGEN_GRADOS,
        max(lons) + MARGEN_GRADOS,
        max(lats) + MARGEN_GRADOS
    )

def deg2num(lat_deg, lon_deg, zoom):
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return (xtile, ytile)

def main():
    if not os.path.exists(KMZ_PATH):
        print(f"Error: No se encuentra {KMZ_PATH}")
        return

    min_lon, min_lat, max_lon, max_lat = obtener_limites_kmz(KMZ_PATH)
    print(f"Área detectada: {min_lon:.4f}, {min_lat:.4f} a {max_lon:.4f}, {max_lat:.4f}")

    # Calcular lista de teselas (tiles) a descargar
    tiles_a_descargar = []
    for z in range(MIN_ZOOM, MAX_ZOOM + 1):
        x_min, y_max = deg2num(min_lat, min_lon, z)
        x_max, y_min = deg2num(max_lat, max_lon, z)
        for x in range(x_min, x_max + 1):
            for y in range(y_min, y_max + 1):
                tiles_a_descargar.append((zxy_to_tileid(z, x, y), z, x, y))

    # Ordenar por tileid (requisito estricto del formato PMTiles)
    tiles_a_descargar.sort(key=lambda t: t[0])
    total = len(tiles_a_descargar)
    print(f"Descargando {total} imágenes satelitales en alta resolución...")

    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0"})

    with open(OUTPUT_PMTILES, "wb") as f:
        writer = Writer(f)
        for idx, (tile_id, z, x, y) in enumerate(tiles_a_descargar, 1):
            url = f"https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
            resp = session.get(url, timeout=15)
            if resp.status_code == 200:
                writer.write_tile(tile_id, resp.content)
            
            if idx % 50 == 0 or idx == total:
                print(f"Progreso: {idx}/{total} ({(idx/total)*100:.1f}%)")
            time.sleep(0.03)  # Pausa breve para evitar bloqueos del servidor

        writer.finalize(
            header={
                "tile_type": TileType.JPEG,
                "tile_compression": Compression.NONE,
                "min_zoom": MIN_ZOOM,
                "max_zoom": MAX_ZOOM,
                "min_lon_e7": int(min_lon * 1e7),
                "min_lat_e7": int(min_lat * 1e7),
                "max_lon_e7": int(max_lon * 1e7),
                "max_lat_e7": int(max_lat * 1e7),
                "center_zoom": 15,
                "center_lon_e7": int(((min_lon + max_lon) / 2) * 1e7),
                "center_lat_e7": int(((min_lat + max_lat) / 2) * 1e7),
            },
            metadata={"name": "Montenoa Bike Park Satelite"}
        )

    peso_mb = os.path.getsize(OUTPUT_PMTILES) / (1024 * 1024)
    print(f"\n¡Listo! Archivo '{OUTPUT_PMTILES}' creado ({peso_mb:.2f} MB).")

if __name__ == "__main__":
    main()