<!--
author:   Cedric Vogel
language: de

comment:  Test page for the glpython macro's features= / large options: one
          block per course profile, two blocks with the same profile, a
          program of two files, and a wrong option.

import:   https://raw.githubusercontent.com/cedricvogel-leo/glpython-liascript/main/README.md

@Code.erkunden: @GLPython.eval(features=run,repl,visualize,reset @0)

@Code.rezept: @GLPython.eval(features=run,repl,visualize,tests,reset @0)

@Code.pruefung: @GLPython.eval(features=run,reset @0)

@Code.voll: @GLPython.eval(@0)

@Code.demo: @GLPython.visual(large @0)
-->

# glpython-Profile

Jede Folie zeigt ein Profil des Kurses. Die Profile sind Makros des Kurses, die
`@GLPython.eval` bzw. `@GLPython.visual` mit festen Optionen aufrufen:

| Profil   | Optionen                                       |
|----------|------------------------------------------------|
| erkunden | `features=run,repl,visualize,reset`            |
| rezept   | `features=run,repl,visualize,tests,reset`      |
| pruefung | `features=run,reset`                           |
| voll     | (alles)                                        |
| demo     | `@GLPython.visual(large)`                      |

## erkunden

Ausführen, REPL, Visualisieren, Zurücksetzen - keine Tests, kein Export.

```python
def quadrat(x):
    return x * x

print(quadrat(7))
```
@Code.erkunden

## rezept

Wie erkunden, zusätzlich Tests (Doctests).

```python
def quadrat(x):
    """
    Gibt das Quadrat von x zurück.

    >>> quadrat(3)
    9
    """
    return x * x
```
@Code.rezept

## pruefung

Nur Ausführen und Zurücksetzen - wie in einer Prüfung.

```python
def quadrat(x):
    return x * x

print(quadrat(7))
```
@Code.pruefung

## voll

Ohne `features=`: alles wie bisher.

```python
def quadrat(x):
    """
    >>> quadrat(3)
    9
    """
    return x * x

print(quadrat(7))
```
@Code.voll

## demo

Nur der Visualisierer, gross - für den Projektor.

```python
def quadrat(x):
    return x * x

quadrat(2 + 3)
```
@Code.demo

## Zwei Blöcke

Zweimal dasselbe Profil auf einer Folie; die Blöcke sind unabhängig.

```python
print("erster Block")
```
@Code.erkunden

```python
print("zweiter Block")
```
@Code.erkunden

## Zwei Dateien

```python -helpers.py
def doppelt(x):
    return 2 * x

if __name__ == "__main__":
    print("helpers.py direkt ausgeführt")
```
```python +main.py
from helpers import doppelt

print(doppelt(21))
```
@Code.erkunden

## Falsche Option

`features=` mit einem Tippfehler zeigt eine Warnung.

```python
print("hallo")
```
@GLPython.eval(features=run,rpl)
