MyPaint brushlib in Javascript

Ported from 
	brushlib - The MyPaint Brush Library
	Copyright (C) 2007-2011 Martin Renold <martinxyz@gmx.ch>

	
Author: Yap Cheah Shen  yapcheahshen@gmail.com

Online demo:
http://www.ksana.tw/mypaint/

Wacom Browser Plugin can be download from 
http://www.wacom.com/CustomerCare/Plugin.aspx

# Live demo:
[https://alekpet.github.io/brushlib.js/](https://alekpet.github.io/brushlib.js/)

* Rewrite code for ES6 and support pen.
* Write module brushConvert on Nodejs for convert old and new version myb to the support brushlib javascript version
  and auto add load list brush to select brush element in HTML, use fetch to generated brushConvert json file incontain brushes directories with brush names.
* Add support brush image if exists in the directory.
* Add set color in input type color html tag
* Add set brush size

brushConvert support two actions:
1. Convert old and new myb
2. Create json contains all brushes and direcoryies

## Links
Library : https://github.com/mypaint/libmypaint

Brush library: https://github.com/mypaint/mypaint-brushes

## Convert information:

All avaiables convertered brushes written indise in the file **brushes_data.json**

### Use brushConverter.py (python)

**run_converter_python.cmd**

##### Convert brushes (python)

```bash
python brushConverter.py convert
```

##### Generate list brushes (python)

```bash
python brushConverter.py brushes
```

### Use brushConverter.js (nodejs)

##### Convert brushes (nodejs)

```bash
npm run convert
```

##### Generate list brushes (nodejs)

```bash
npm run brushes
```

### Read more in file txt inside folder packs_brushes
