#!/usr/bin/env python3
"""Gimnasia en redes: agrega solos los videos nuevos de los perfiles de la lista.

Lo corre GitHub Actions dos veces al día (.github/workflows/redes-videos.yml). Lee los perfiles de Firebase
(redesAKC/estado.perfiles; en la app de prueba, redesAKC_prueba), busca los videos más recientes de cada uno y pone
los nuevos al principio de redesAKC/estado.videos (con auto=true). Lo que ya revisó queda en videosVistos, así un video
que Manu quite no vuelve a aparecer y la primera vez no se llena con videos viejos.

- Instagram: la página pública del perfil para insertar (/<usuario>/embed/) trae sus últimas publicaciones; solo se
  toman los videos (reels).
- TikTok: la página para insertar el perfil (/embed/@<usuario>) trae algunos de sus videos; el número de video lleva
  la fecha, así que el más alto es el más nuevo.
- YouTube: la lista pública (RSS) del canal.
No usa contraseñas ni llaves: las reglas de Firebase permiten leer y escribir esa colección.
Uso: python3 scripts/redes_videos.py [--probar]   (--probar solo muestra lo que agregaría)
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

PROYECTO = "akc-con-reporte"
COLECCION = os.environ.get("COLECCION", "redesAKC_prueba")
DOC = f"https://firestore.googleapis.com/v1/projects/{PROYECTO}/databases/(default)/documents/{COLECCION}/estado"
POR_PERFIL = int(os.environ.get("POR_PERFIL", "2"))   # videos nuevos por perfil en cada vuelta
MAX_VIDEOS = 200                                      # los automáticos más viejos salen al pasar de aquí
MAX_VISTOS = 4000
NAVEGADOR = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
             "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
USUARIO_OK = re.compile(r"^[A-Za-z0-9._-]{1,40}$")


def pedir(url, datos=None, metodo="GET"):
    cab = {"User-Agent": NAVEGADOR, "Accept-Language": "es-MX,es;q=0.9,en;q=0.8"}
    if datos is not None:
        cab["Content-Type"] = "application/json"
    r = urllib.request.Request(url, data=datos, method=metodo, headers=cab)
    with urllib.request.urlopen(r, timeout=30) as resp:
        return resp.read().decode("utf-8", "replace")


# ---- Firestore (API REST) ----
def de_fs(v):
    if "stringValue" in v:
        return v["stringValue"]
    if "integerValue" in v:
        return int(v["integerValue"])
    if "doubleValue" in v:
        return v["doubleValue"]
    if "booleanValue" in v:
        return v["booleanValue"]
    if "timestampValue" in v:
        return v["timestampValue"]
    if "arrayValue" in v:
        return [de_fs(x) for x in v["arrayValue"].get("values", [])]
    if "mapValue" in v:
        return {k: de_fs(x) for k, x in v["mapValue"].get("fields", {}).items()}
    return None


def a_fs(v):
    if isinstance(v, bool):
        return {"booleanValue": v}
    if isinstance(v, int):
        return {"integerValue": str(v)}
    if isinstance(v, float):
        return {"doubleValue": v}
    if isinstance(v, str):
        return {"stringValue": v}
    if isinstance(v, list):
        return {"arrayValue": {"values": [a_fs(x) for x in v]}}
    if isinstance(v, dict):
        return {"mapValue": {"fields": {k: a_fs(x) for k, x in v.items()}}}
    return {"nullValue": None}


# ---- Videos de cada red (los más nuevos primero) ----
def videos_instagram(usuario):
    h = pedir(f"https://www.instagram.com/{urllib.parse.quote(usuario)}/embed/").replace('\\"', '"')
    if f'"username":"{usuario}"' not in h:
        raise RuntimeError("no se encontró el perfil")
    m = re.findall(r'"shortcode_media":\{"__typename":"(\w+)","id":"\d+","shortcode":"([\w-]+)","is_video":(true|false)', h)
    return [codigo for tipo, codigo, video in m if video == "true" or tipo == "GraphVideo"]


def videos_tiktok(usuario):
    h = pedir(f"https://www.tiktok.com/embed/@{urllib.parse.quote(usuario)}")
    ids = set(re.findall(r"tiktok\.com/@" + re.escape(usuario) + r"/video/(\d{15,25})", h, re.I))
    return sorted(ids, key=int, reverse=True)


def videos_youtube(usuario):
    h = pedir(f"https://www.youtube.com/@{urllib.parse.quote(usuario)}")
    m = re.search(r'<link rel="canonical" href="https://www\.youtube\.com/channel/(UC[\w-]{22})"', h) or \
        re.search(r'"externalId":"(UC[\w-]{22})"', h)
    if not m:
        raise RuntimeError("no se encontró el canal")
    x = pedir(f"https://www.youtube.com/feeds/videos.xml?channel_id={m.group(1)}")
    return re.findall(r"<yt:videoId>([\w-]{11})</yt:videoId>", x)


BUSCAR = {"instagram": videos_instagram, "tiktok": videos_tiktok, "youtube": videos_youtube}


# ---- Archivo de cada video, para que la app lo reproduzca sola, en pantalla completa y sin tocar play ----
# Instagram y TikTok dan en su página para insertar la dirección del archivo .mp4 y de su imagen. Esas direcciones
# vencen en alrededor de un día, por eso se renuevan en cada vuelta. Si no se consigue, la app usa el reproductor
# oficial de la red.
def _desescapar(t):
    """Quita las capas de escape de JSON (barras, \\uXXXX y comillas) que traen estas páginas."""
    for _ in range(4):
        n = t.replace('\\/', '/').replace('\\"', '"')
        n = re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), n)
        n = n.replace('\\\\', '\\')
        if n == t:
            break
        t = n
    return t


def medio_instagram(codigo):
    h = _desescapar(pedir(f"https://www.instagram.com/p/{urllib.parse.quote(codigo)}/embed/captioned/"))
    m = re.search(r'"video_url":"(https://[^"]+)"', h)
    if not m:
        return None
    img = re.search(r'"display_url":"(https://[^"]+)"', h)
    return {"mp4": m.group(1), "imagen": img.group(1) if img else ""}


def medio_tiktok(codigo):
    h = pedir(f"https://www.tiktok.com/embed/v2/{urllib.parse.quote(codigo)}")
    h = _desescapar(h)
    # Las publicaciones de fotos (carrusel con música) traen como "video" solo el audio: no son videos.
    if "photomode" in h or not re.search(r'"width":[1-9]\d*', h):
        return {"foto": True}
    # El archivo del video está en "video":{"urls":[...]} (ojo: "playUrl" es la canción, no el video).
    m = re.search(r'"video":\{"urls":\["(https://[^"]+)"', h)
    if not m:
        return None
    img = re.search(r'"(https://[^"]+\.(?:jpeg|jpg|webp|image)[^"]*)"\],"video":\{"urls"', h)
    return {"mp4": m.group(1), "imagen": img.group(1) if img else ""}


MEDIO = {"instagram": medio_instagram, "tiktok": medio_tiktok}


def abre(url):
    """¿El archivo se puede pedir desde cualquier lado, sin galletas? (algunos de TikTok responden 403)."""
    try:
        r = urllib.request.Request(url, headers={"User-Agent": NAVEGADOR, "Range": "bytes=0-1"})
        with urllib.request.urlopen(r, timeout=20) as resp:
            return resp.status in (200, 206) and (resp.headers.get("Content-Type") or "").startswith("video")
    except Exception:
        return False


def renovar(lista):
    """Devuelve {red:codigo: {mp4, imagen, renovado}} de los videos de Instagram y TikTok de la lista."""
    medios, fallas = {}, 0
    for v in lista:
        red, codigo = v.get("red"), str(v.get("codigo") or "")
        if red not in MEDIO or not codigo:
            continue
        try:
            m = MEDIO[red](codigo)
        except Exception:
            m = None
        if m and m.get("foto"):
            medios[f"{red}:{codigo}"] = m
        elif m and not abre(m["mp4"]):
            medios[f"{red}:{codigo}"] = {"noabre": True}
            fallas += 1
        elif m:
            m["renovado"] = int(time.time())
            medios[f"{red}:{codigo}"] = m
        else:
            fallas += 1
        time.sleep(0.8)
    listos = sum(1 for m in medios.values() if "mp4" in m)
    fotos = sum(1 for m in medios.values() if m.get("foto"))
    print(f"Archivos de video renovados: {listos} · fotos (no son video): {fotos} · sin archivo o no abren: {fallas}")
    return medios


def main():
    probar = "--probar" in sys.argv
    doc = json.loads(pedir(DOC))
    campos = {k: de_fs(v) for k, v in doc.get("fields", {}).items()}
    perfiles = [p for p in campos.get("perfiles") or [] if isinstance(p, dict)]
    videos = [v for v in campos.get("videos") or [] if isinstance(v, dict)]
    vistos = [s for s in campos.get("videosVistos") or [] if isinstance(s, str)]
    ya = set(vistos) | {f"{v.get('red')}:{v.get('codigo')}" for v in videos}

    nuevos, errores = [], []
    for p in perfiles:
        red, usuario = p.get("red"), str(p.get("usuario") or "")
        if red not in BUSCAR or not USUARIO_OK.match(usuario):
            continue
        try:
            codigos = BUSCAR[red](usuario)
        except Exception as e:  # una red caída o un perfil que cambió no detiene a los demás
            errores.append(f"{red} @{usuario}: {e}")
            continue
        sin_ver = [c for c in codigos if f"{red}:{c}" not in ya]
        for c in sin_ver[:POR_PERFIL]:
            nuevos.append({"id": f"a{int(time.time() * 1000):x}{len(nuevos):02d}", "red": red, "codigo": c,
                           "auto": True, "perfil": usuario})
        for c in codigos:  # todo lo revisado queda como visto, también lo que no se agregó por ser viejo
            k = f"{red}:{c}"
            if k not in ya:
                ya.add(k)
                vistos.append(k)
        print(f"{red:9} @{usuario:22} {len(codigos):2} videos, {min(len(sin_ver), POR_PERFIL)} nuevos")
        time.sleep(1.5)

    for e in errores:
        print("ERROR", e)
    if errores and len(errores) == len([p for p in perfiles if p.get("red") in BUSCAR]):
        sys.exit("Ningún perfil respondió: puede que la red haya bloqueado la tarea o cambiado su página.")
    if not nuevos and not errores:
        print("Sin videos nuevos.")
    if probar:
        print(json.dumps(nuevos, ensure_ascii=False, indent=1))
        return
    medios = renovar(nuevos + videos)
    nuevos = [v for v in nuevos if not medios.get(f"{v['red']}:{v['codigo']}", {}).get("foto")]

    # Volver a leer justo antes de guardar, por si Manu agregó o quitó algo mientras tanto.
    doc = json.loads(pedir(DOC))
    actuales = [v for v in de_fs(doc.get("fields", {}).get("videos", {"arrayValue": {}})) or [] if isinstance(v, dict)]
    claves = {f"{v.get('red')}:{v.get('codigo')}" for v in actuales}
    lista = [v for v in nuevos if f"{v['red']}:{v['codigo']}" not in claves] + actuales
    for v in lista:
        m = medios.get(f"{v.get('red')}:{v.get('codigo')}")
        if m and (m.get("foto") or m.get("noabre")):
            for k in ("mp4", "imagen", "renovado"):
                v.pop(k, None)
            if m.get("foto"):
                v["foto"] = True      # publicación de fotos: la app no la muestra
            # si no abre, queda sin archivo (la app no lo muestra) y se vuelve a probar en la siguiente vuelta
        elif m:
            v.update(m)
    while len(lista) > MAX_VIDEOS and any(v.get("auto") for v in lista):
        i = max(i for i, v in enumerate(lista) if v.get("auto"))
        lista.pop(i)
    cuerpo = {"fields": {"videos": a_fs(lista), "videosVistos": a_fs(vistos[-MAX_VISTOS:])}}
    url = DOC + "?updateMask.fieldPaths=videos&updateMask.fieldPaths=videosVistos"
    pedir(url, json.dumps(cuerpo).encode(), "PATCH")
    print(f"Agregados {len(nuevos)} videos. Total en la lista: {len(lista)}.")


if __name__ == "__main__":
    main()
