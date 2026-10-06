#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Verifica el contraste AA de la paleta de ACTAMOON (tinta + petroleo).

Comprueba cada par texto/fondo que usa la interfaz y los contornos y focos
(WCAG 1.4.11, 3:1). La app no pone texto sobre fotos: todo son pares planos.

Los colores se leen de assets/css/tokens.css, asi que no hay copia que
mantener. Lo que si hay que mantener es la lista de pares: si la interfaz
estrena una combinacion texto/fondo, se anade aqui.

Uso:  python scripts/verifica-contraste.py
Sale con codigo 1 si algo baja de su minimo o falta un token.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKENS = os.path.join(ROOT, 'assets', 'css', 'tokens.css')

AA = 4.5       # texto
AA_UI = 3.0    # foco visible, bordes de control y marcas graficas

with open(TOKENS, encoding='utf-8') as fh:
    P = dict(re.findall(r'--([\w-]+):\s*(#[0-9a-fA-F]{6})\b', fh.read()))

fallos = []


def _lin(c):
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lum(hx):
    hx = hx.lstrip('#')
    r, g, b = (int(hx[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b)


def ratio(a, b):
    la, lb = sorted((lum(P[a]), lum(P[b])), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def bloque(titulo, pares):
    print(f"\n=== {titulo} ===")
    for t, f, m, uso in pares:
        etiqueta = f'--{t} sobre --{f} - {uso}'
        faltan = [x for x in (t, f) if x not in P]
        if faltan:
            fallos.append(f'{etiqueta}: falta --{faltan[0]} en tokens.css')
            print(f"    {etiqueta:<66} FALTA TOKEN")
            continue
        r = ratio(t, f)
        ok = r >= m
        if not ok:
            fallos.append(f'{etiqueta}: {r:.2f} (min {m})')
        print(f"    {etiqueta:<66} {r:6.2f}:1  {'OK' if ok else 'FALLA'}")


FONDOS = ['bg', 'surface', 'surface-2']

bloque('1 - Texto sobre fondos de pagina', [
    (t, f, AA, uso)
    for t, uso in (('ink', 'titulares y cifras'), ('ink-2', 'parrafos'),
                   ('muted', 'secundario y ayudas'), ('accent', 'enlaces'),
                   ('accent-hover', 'enlace en hover'))
    for f in FONDOS
])

bloque('2 - Botones y barras', [
    ('surface', 'accent', AA, 'boton principal'),
    ('surface', 'accent-hover', AA, 'boton principal en hover'),
    ('ink', 'surface', AA, 'boton secundario'),
    ('ink', 'surface-2', AA, 'boton secundario en hover'),
    ('surface', 'err', AA, 'boton destructivo (reiniciar demo)'),
    ('surface', 'err-hover', AA, 'boton destructivo en hover'),
    ('on-dark', 'ink', AA, 'texto en la barra inferior'),
    ('on-dark-muted', 'ink', AA, 'destino inactivo en la barra inferior'),
    ('accent-on-dark', 'ink', AA_UI, 'marca del destino activo en la barra inferior'),
    ('accent', 'accent-tint', AA, 'destino activo en lateral, perfil activo'),
    ('ink', 'accent-tint', AA, 'texto del perfil activo'),
    ('ink-2', 'accent-tint', AA, 'secundario del perfil activo'),
    ('ink', 'aviso', AA, 'banner de demo'),
])

bloque('3 - Estados (siempre con icono y texto, nunca solo color)', [
    ('ok', 'ok-tint', AA, 'icono y borde del aviso de exito'),
    ('ink', 'ok-tint', AA, 'texto del aviso de exito'),
    ('pend', 'pend-tint', AA, 'chip pendiente / sin acta'),
    ('ink', 'pend-tint', AA, 'texto del aviso de perfiles simulados'),
    ('err', 'err-tint', AA, 'icono y borde del aviso de error'),
    ('ink', 'err-tint', AA, 'texto del aviso de error'),
])

bloque('4 - Contornos y foco (3:1)', [
    *[('line-strong', f, AA_UI, 'borde de control') for f in FONDOS],
    *[('accent', f, AA_UI, 'foco visible') for f in FONDOS],
    ('accent', 'accent-tint', AA_UI, 'foco y borde del perfil activo'),
    ('aviso', 'ink', AA_UI, 'foco sobre la barra inferior'),
    ('ink', 'aviso', AA_UI, 'foco sobre el banner'),
    ('pend', 'pend-tint', AA_UI, 'borde del aviso de perfiles simulados'),
])

# El logo lleva sus colores dentro del SVG; son los de --ink y --accent.
bloque('5 - Cabecera clara y logo', [
    ('ink', 'surface', AA, 'perfil activo en la cabecera'),
    ('ink', 'surface-2', AA, 'perfil activo en hover'),
    ('muted', 'surface', AA, 'ambito de la eleccion'),
    ('line-strong', 'surface', AA_UI, 'borde del boton de perfil'),
    ('ink', 'surface', AA_UI, 'rotulo del logo'),
    ('accent', 'surface', AA_UI, 'sello del logo y foco del enlace de marca'),
])

bloque('6 - Portada', [
    ('muted', 'surface', AA, 'nota del hero'),
    ('accent', 'bg', AA, 'numero de paso y su aro'),
    ('on-dark', 'ink', AA, 'titulos de la banda "Que no hace"'),
    ('on-dark-muted', 'ink', AA, 'texto de la banda "Que no hace"'),
    ('aviso', 'ink', AA_UI, 'icono de la banda "Que no hace"'),
    ('accent', 'bg', AA_UI, 'icono de privacidad'),
])

print()
if fallos:
    print(f"RESULTADO: {len(fallos)} comprobacion(es) por debajo de su minimo")
    for f in fallos:
        print("  - " + f)
    sys.exit(1)
print("RESULTADO: 0 fallos - texto >= 4.5:1 y contornos >= 3:1 (AA)")
