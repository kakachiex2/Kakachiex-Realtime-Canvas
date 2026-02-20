'''
 * Title: BrushConverter
 * Author: Aleksey Petrov (AlekPet)
 * Guthub: https://github.com/AlekPet
 *
 * Info:
 * Old brush packs: https://github.com/mypaint/mypaint-brushes/releases/tag/pre_json_brushes
 * Folder "packs_brushes" it is packs brushes to convert
 * Folder "brushes" folder converted brush from mybrushlib.js
 * File "brushes_data.json" includes list all availables brushes after converter.
 * -----------------------------------
 '''
import os
import sys
import re
import json
import shutil
from collections import deque
from functools import reduce


def convertBrushMain(*args:tuple) -> None:
    try:
        sourceDir = args[3] or None
        distDir = args[4] or None
    except:
        sourceDir = None
        distDir = None

    packs_brushes_dir_name = 'packs_brushes'
    currentDir:str = os.path.dirname(__file__)
    srcDirMyb:str = sourceDir if sourceDir and sourceDir.strip() else packs_brushes_dir_name
    pathBrushes:str = os.path.join(currentDir, srcDirMyb)

    if not os.path.exists(pathBrushes):
        print(f'File path not exists "{pathBrushes}"')
        raise FileExistsError
    
    saveBrushes:str = os.path.join(currentDir, distDir.strip() if distDir else 'brushes')
    filterPropsMissing:list = ['#']
    useJsonFile:bool = True

    def isInvalidProp(str:str) -> bool:
        for p in filterPropsMissing:
            if str.startswith(p):
                return True
            
        return False
    
    def correctionFileName(filename:str) -> str:
        if re.search('^[0-9]', filename):
            filenameDigit:str = re.match('^([0-9]+)', filename)[0]
            filename = filename.replace(filenameDigit, '') + filenameDigit

        if "-" in filename:
            filename:str = filename.replace('-', '_')
        filename:str = re.sub("%W+",'',filename)

        return filename
    

    # Old version myb:
    def getData(strval:str) -> dict:
        obj:dict = {}
        
        if "|" in strval:
            vals = list(map(lambda v: v.strip(), strval.split("|")))
            if len(vals) == 2:
                name, propValue = list(map(lambda v: v.strip(), vals[0].split(" ")))
                propval = deque(map(lambda v: v.strip(), vals[1].split(" ")))

                propname = propval.popleft()
                propval = list(map(lambda v: float(re.sub("[(),]", "", v)), propval))
                
                obj[name] = {
                    "base_value": float(propValue),
                    "pointsList": {},
                }                    
                obj[name]["pointsList"][propname] = propval
                
            else:
                name, propValue = list(map(lambda v: v.strip(), vals[0].split(" ")))
                
                if isinstance(propValue, str) and propValue.replace(".", "", 1).isdigit():
                    propValue = float(propValue)
                
                obj[name] = {
                    "base_value": propValue,
                    "pointsList": {},
                }

                for i in range(1, len(vals)):
                    propval = deque(map(lambda v: v.strip(), vals[i].split(" ")))
                    propname = propval.popleft()
                    propval =  list(map(lambda v: float(re.sub("[(),]", "", v)), propval))

                    obj[name]['pointsList'][propname] = propval
        else:
            name, propValue = list(map(lambda v: v.strip(), strval.split(" ")))
            
            if isinstance(propValue, str) and propValue.replace(".", "", 1).isdigit():
                propValue = float(propValue)
            
            obj[name] = {
                "base_value": propValue,
            }

        return obj 


    def readDataOldMyb(data:list):
        lines:list[str] = data
        lines = filter(lambda line: line.strip() != "" and not isInvalidProp(line), lines)
        lines = list(map(lambda line: getData(line), lines))

        nulls = list(filter(lambda v: v is None, lines))
        if len(nulls) > 0:
            return None
        
        endObj = {
        }

        for prop in lines:
            key, value = list(prop.items())[0]
            endObj[key] = value
        
        return endObj
    # eld - Old version myb:
    
    # New version myb (json)
    def getDataJSON(data):
        mybjs = {}

        for prop in data['settings']:
            base_value = data['settings'][prop]['base_value']
            pointsList = data['settings'][prop]['inputs']
            if len(pointsList.keys()):
                objp = {}
                for key, val in pointsList.items():
                    if isinstance(val, list):
                        objp[key] = [i for cval in val for i in cval]
                
                mybjs[prop] = {
                    'base_value': base_value,
                    'pointsList': objp
                    }
            else:
                mybjs[prop] = {
                    'base_value': base_value,
                }
                
        return mybjs
    # end - New version myb (json)
    
    
    def readFile(pathFile):
        endObj = {}
        isJson = None  
        
        # Check file is JSON
        with open(pathFile, "r", encoding='utf-8') as checkFile:  
            try:
                json.loads(checkFile.read())
                isJson = True
            except:
                # Not json file
                isJson = False
                
        
        with open(pathFile, "r", encoding='utf-8') as fileOpen: 
            if isJson:
                jsonData = json.loads(fileOpen.read())
                endObj = getDataJSON(jsonData)
            else:
                endObj = readDataOldMyb(fileOpen.readlines())
                if len(endObj.keys()) == 0:
                    endObj = {}
            

        return endObj


    def readPacksDir(_dir):
        dir_basename = os.path.basename(_dir)
        propFiles = []

        for root, dirs, files in os.walk(_dir):
            for file in files:
                file_basename = os.path.basename(root)
                pathToFile = os.path.join(root, file)
                if os.path.isfile(pathToFile) and file.endswith('.myb') or file.endswith('.png'):                    
                    destDir = os.path.join(saveBrushes, file_basename if dir_basename != file_basename else '')
                    
                    makedir = os.path.join(saveBrushes, file_basename)
                    if dir_basename != file_basename and not os.path.exists(makedir):
                        os.mkdir(makedir)

                    filename_tmp:list = file.split('.')
                    if len(filename_tmp) > 1:
                        filename = '.'.join(filename_tmp[0:len(filename_tmp)-1])
                        ext = filename_tmp[-1]
                    else:
                        filename = filename_tmp[0]
                        ext = ""

                    if ext == "myb" or ext == "png":
                        if not useJsonFile:
                            filename = correctionFileName(filename)

                    if ext == "myb":
                        propFiles.append({'data': readFile(pathToFile),
                                          'options':{
                                              'filename': filename,
                                              'dest': destDir
                                              }
                                          })

                    if ext == "png":
                        if not useJsonFile:
                            filename = filename.replace("_prev", "") + '.' + ext
                        else:
                            filename = file
                            
                        savePath = os.path.join(destDir, filename)
                        if not os.path.exists(savePath):
                            shutil.copyfile(pathToFile, savePath)
        return propFiles


    propFiles = readPacksDir(pathBrushes)
    
    # Save reading wiles in js or json
    countComplete = 0
    if propFiles:
        for props in propFiles:
            data = props['data']
            filename = props['options']['filename']
            dest = props['options']['dest']

            try:
                dataToText = f"var {filename} = {json.dumps(data)}" if not useJsonFile else json.dumps(data, indent=2)

                with open(os.path.join(dest, f"{filename}.myb.{'js' if not useJsonFile else 'json'}"), 'w', encoding="utf-8") as fsave:
                    fsave.write(dataToText)                    
                    countComplete+=1
            except:
                print(f'Error file JSON serializable: {filename}')
                
                
        print(f"Files converted {countComplete} of {len(propFiles)}!")
        
        # Create json avaibles all brushes
        if input("Make json file avaiables brushes?: ").lower() in ['yes','1','y', 'ok']:
            getAvailableBrushes()
    else:
        print('No files to save!')


def getAvailableBrushes():
    listBrushes = {
        'brushes': {
            "items":[],
            "path": "/",
            "settings": {
                "enabled": True
            }
        }
    }
    currentDir:str = os.path.dirname(__file__)
    sourceDir = os.path.join(currentDir, 'brushes')
    sourceDirBaseName = os.path.basename(sourceDir)

    for root, dirs, files in os.walk(sourceDir):

        for folder in dirs:
            if folder not in listBrushes:
                listBrushes[folder] = {
                    "items": [],
                    "path": folder,
                    "settings": {
                        "enabled": True
                    }
                }

        for file in files:
            file_basename = os.path.basename(root)

            filename_tmp:list = os.path.splitext(file)
            if len(filename_tmp) > 1:                                      
                filename = filename_tmp[0]
                ext = filename_tmp[-1]
            else:
                filename = filename_tmp[0]
                ext = ""

            if ext == '.json':
                keyObj = file_basename
                if file_basename == '': # myb in the root folder brushes
                    keyObj = 'brushes'

                listBrushes[keyObj]["items"].append(filename.replace(".myb", ""))
                
                # listBrushes[keyObj]["items"].append({
                #     # 'file': file
                #     'filename': filename,
                #     'path': file_basename if file_basename != sourceDirBaseName else '/',
                #     # 'path_json': pathToFile
                # })
    
    with open(os.path.join(currentDir, 'js', 'brushes_data.json'), 'w', encoding='utf-8') as jsonSave:
        json.dump(listBrushes, jsonSave, indent=2)
        print(f"""Complete:
Brushes files get: {reduce(lambda acc,cur: acc + len(listBrushes[cur]["items"]), listBrushes.keys(), 0)}, foldres {len(listBrushes)}""")
        


def init():
    print('''========== Script BrushConverter ==========
* Title: BrushConverter on the Python
* Author: Aleksey Petrov alexepetrof@gmail.com
* Description: Convert brushes inside direcory (default: "packs_brushes")
  to the filder "brushes"
  
* Available commands:
    convert
    brushes

    Example: python brushConvereter.py convert src(optional) dst(optional)    
===========================================
''')
    if 'convert' in sys.argv or len(sys.argv) == 1:
        convertBrushMain(sys.argv)
    
    if 'brushes' in sys.argv:
        getAvailableBrushes()
        


if __name__ == "__main__":
    init()
