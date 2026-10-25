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
    if not nuevos and len(vistos) == len(campos.get("videosVistos") or []):
        return

    # Volver a leer justo antes de guardar, por si Manu agregó o quitó algo mientras tanto.
    doc = json.loads(pedir(DOC))
    actuales = [v for v in de_fs(doc.get("fields", {}).get("videos", {"arrayValue": {}})) or [] if isinstance(v, dict)]
    claves = {f"{v.get('red')}:{v.get('codigo')}" for v in actuales}
    lista = [v for v in nuevos if f"{v['red']}:{v['codigo']}" not in claves] + actuales
    while len(lista) > MAX_VIDEOS and any(v.get("auto") for v in lista):
        i = max(i for i, v in enumerate(lista) if v.get("auto"))
        lista.pop(i)
    cuerpo = {"fields": {"videos": a_fs(lista), "videosVistos": a_fs(vistos[-MAX_VISTOS:])}}
    url = DOC + "?updateMask.fieldPaths=videos&updateMask.fieldPaths=videosVistos"
    pedir(url, json.dumps(cuerpo).encode(), "PATCH")
    print(f"Agregados {len(nuevos)} videos. Total en la lista: {len(lista)}.")


if __name__ == "__main__":
    main()
