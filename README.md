# Blender Python Bridge for "VS Code"

## Description

This extension creates a software bridge between Blender and VS Code, allowing Blender to operate in listening mode and process individual commands, entire scripts, packages, or multi-file add-ons from the client, where the client is VS Code. Data exchange is carried out through a network socket, ensuring efficient interaction between Blender (as a server) and VS Code.

## Features

- **Direct code transfer**: Run developed scripts/add-ons directly in Blender without the need for installation or file manipulation.
- **Full project support**: Work with scripts, packages, and multi-file add-ons.
- **Integration with VS Code**: Convenient use through commands in the VS Code menu or hotkeys.
- **Support for VS Code workspaces**: Allows working with multiple projects in different locations added to the workspace.

## Installation and setup of the extension in VS Code

- Install the extension via the built-in Marketplace;
- Press `Ctrl+Shift+P`, find and run the **"Select Blender Executable"** command;
- Specify the path to the Blender executable file;
- (Optional) Configure the terminal encoding for correct Cyrillic display (instructions included);
- Open your code in Workspace;
- Run the code (how, see below);

## General overview

The user creates a script/package/add-on in VS Code, then runs the code and sees the result in Blender.

- `Shift+F7` - Start Blender with a network socket for listening to commands;
- `Shift+F8` - Run the entire package from the current workspace, regardless of which script is open and in which folder, `__init__.py` is run, emulating the work as if the add-on was fully installed;
- `Shift+F9` - Run the currently open script.

The code is transferred to Blender and runs as if you had packed it into a zip archive and installed it through the Blender interface. The difference is that it all happens on the fly without actual installation and file manipulation on the disk. Blender receives the project paths and performs class registration from the actual project location on your hard drive in your project folder.

When the code is restarted, all classes and modules are first unregistered and removed from memory to clear the previous result. After starting the new code, there will be no intersections with the previous work result.

After turning off Blender, your script/package/add-on is completely cleaned from memory since it was not installed but used on the fly.

The namespace is supported similarly to Blender's structure, allowing you to pack your creation into a zip and install it permanently or pass it on without fear of problems with absolute and relative import paths (those who have worked through IDE will understand).

## Available commands

- `pathExecSel`: Select the Blender executable file  
- `pathExecClean`: Clear the Blender path  
- `pathExecShow`: Show the Blender path  
- `showPathsProject`: Show project paths  
- `startBlender`: Start Blender with the socket server `Shift+F7`  
- `runEntirePackage`: Run the entire package in Blender `Shift+F8`  
- `runCurrScript`: Run the current script in Blender `Shift+F9`  

## Dependencies

The extension has no direct dependencies. The extension requires specifying the path to the Blender executable file.

Be sure that the code will work since it uses the built-in Blender interpreter.

Installing Python in VS Code is optional and does not affect the extension's operation, only your convenience, syntax highlighting, and developing your personal projects not related to Blender.

## Terminal encoding settings (Optional)

- (for GNU/Linux) encoding in most repositories should be correct by default;

- (for Windows users) In Windows, the system terminal uses encoding 866, which does not allow Cyrillic to be displayed in the terminal when receiving messages from Blender to the terminal (not from the python interpreter to the terminal, but exactly the program's errors). Cyrillic in VS Code and scripts is supported without problems since the extension decodes the output into UTF-8.

  - **CMD**  
To permanently switch the system "CMD" terminal to UTF-8, go to the registry
`"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Command Processor"`
Create a "String Value" named **Autorun** with the value
`@chcp 65001>nul`

  - **PowerShell**  
Create a folder with a file if it does not exist at
`C:\Users\a_zhitkov\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1`  
Inside the file, one line with the config to switch the terminal  
`[System.Console]::OutputEncoding = [System.Text.Encoding]::UTF8`

    This will automatically execute the encoding change command before launching the terminal at the system level. I leave this task to the user as I do not want to make system changes on behalf of the user.

## For developers

### Setting up the development environment

- Install `Node.js` on the system
- Run `npm install` in the project to install all dependencies into the node_modules folder, if it doesn't exist, it will appear
- Check if the `npm run watch` command works
- If everything works, check the extension in debug mode, press `F5`

A new VS Code window should open with the extension code running, where you can test the project logic, including commands.

### Build the *.vsix extension for installation in VS Code

- In the VS Code project terminal, install the packaging utility `vsce`  
`npm install -g @vscode/vsce`

- Pack the project into an `*.vsix` extension  
`vsce package`

The result will be a file like `blendpybridge-2401.21.1.vsix` ready for installation in VS Code or publication in the marketplace.
