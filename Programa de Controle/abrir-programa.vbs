Set shell = CreateObject("WScript.Shell")
basePath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
pythonPath = "C:\Users\Deron\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
serverPath = basePath & "\server.py"

If CreateObject("Scripting.FileSystemObject").FileExists(pythonPath) Then
  shell.Run """" & pythonPath & """ """ & serverPath & """", 0, False
Else
  shell.Run "python """ & serverPath & """", 0, False
End If

WScript.Sleep 1800
shell.Run "http://127.0.0.1:4173/index.html", 1, False
