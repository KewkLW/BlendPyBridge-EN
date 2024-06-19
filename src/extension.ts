import * as os from 'os';
import * as net from 'net';
import * as path from 'path';
import * as vscode from 'vscode';



// Function to get paths: pathCurrPyFile, pathWorkspace, pathInitFile of the project
async function getPathsProject() {
    // Get the active text editor object, currently open
    const activeEditor = vscode.window.activeTextEditor;

    // Path of the active workspace, currently open file
    let pathWorkspace;
    if (activeEditor) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
        pathWorkspace = workspaceFolder ? workspaceFolder.uri.fsPath : undefined;
    }

    // If there is an active text editor and it is identified as a python file, then output its path
    let pathCurrPyFile;
    if (activeEditor && activeEditor.document.languageId === 'python') {
        // If the active editor is open and contains a Python file
        pathCurrPyFile = activeEditor.document.uri.fsPath;
    } else {
        // If the active editor is not open or does not contain a Python file
        pathCurrPyFile = undefined;
    }

    let pathInitFile;
    if (pathWorkspace) {
        // Cross-platform formation of the path to the __init__.py file
        const initFilePath = path.join(pathWorkspace, '__init__.py');
        const initFileUri = vscode.Uri.file(initFilePath);

        // Check if the file exists
        try {
            await vscode.workspace.fs.stat(initFileUri);
            pathInitFile = initFileUri.fsPath;
        } catch (error) {
            pathInitFile = undefined;
        }
    }

    return { pathWorkspace, pathCurrPyFile, pathInitFile };
}




// Network socket client for sending paths to Blender
// Async is not needed since connect and write functions are already asynchronous
function sendCommandToBlender(pathWorkspace: string, pathPyFile: string) {
    const client = new net.Socket();
    // Specify the port on which your Python server is listening
    const port = 3264;
    const host = 'localhost';

    client.connect(port, host, () => {
        console.log('Connected to Blender server');
        const command = `${pathWorkspace}\n${pathPyFile}`;
        client.write(command, 'utf-8', () => {
            console.log('Command sent to Blender');
            // Close the connection after sending
            client.end();
        });
    });

    client.on('error', (err) => {
        console.error('Connection error:', err);
        vscode.window.showErrorMessage('Connection error to Blender');
    });

    client.on('close', () => {
        console.log('Connection closed');
    });
}




// activate triggers when the extension is activated
export function activate(context: vscode.ExtensionContext) {

    // Terminal name
    const terminalName = "BlendPyBridge";
    // Reference to the created terminal
    let terminal: vscode.Terminal | undefined;

    // Registering the 'blendpybridge.start' command in the extension context, defined in package.json
    let disposableStart = vscode.commands.registerCommand('blendpybridge.startBlender', async () => {

        // Check if the terminal is currently running to block duplicate starts
        if (terminal) {
            vscode.window.showWarningMessage('An instance is already running');
            return;
        }
        
        // Using the saved path to Blender
        const pathExecBlender = context.globalState.get<string>('pathExecBlender');
        if (!pathExecBlender) {
            vscode.window.showErrorMessage('You need to specify the path to Blender');
            return;
        }


        let pathEnd;
        let pathBegin;
        const scriptServerSocket = path.join(context.extensionPath, 'scripts', 'socketBlenderBridge.py');

        console.log('%cBlender executable:', 'color: yellow');
        // Get the last component of the path and color it
        pathEnd = path.basename(pathExecBlender);
        pathBegin = pathExecBlender.slice(0, pathExecBlender.lastIndexOf(pathEnd));
        console.log(`%c${pathBegin}%c${pathEnd}`, 'color: normal', 'color: orange');

        console.log('%cServer script:', 'color: yellow');
        pathEnd = path.basename(scriptServerSocket);
        pathBegin = scriptServerSocket.slice(0, scriptServerSocket.lastIndexOf(pathEnd));
        console.log(`%c${pathBegin}%c${pathEnd}`, 'color: normal', 'color: orange');

        console.log('\n------->->>-->>>->>>> %cSTART_BRIDGE%c <<<<-<<<--<<-<-------', 'color: #FF69B4', 'color: reset');


        // [HKEY_LOCAL_MACHINE\Software\Microsoft\Command Processor\Autorun]
        // New String -> Autorun -> @chcp 65001>nul
        // Create a terminal and start Blender with the Socket server
        terminal = vscode.window.createTerminal({
            name: terminalName,
            shellPath: pathExecBlender,
            shellArgs: ["--python", scriptServerSocket]
        });
        

        // Show the terminal window if it was hidden and switch to it
        terminal.show();

        // Terminal lifecycle handler
        const onDidCloseTerminal = vscode.window.onDidCloseTerminal(closedTerminal => {
            if (closedTerminal === terminal) {
                terminal = undefined;
            }
        });

        context.subscriptions.push(onDidCloseTerminal);
    });

    context.subscriptions.push(disposableStart);




    // Command handler to run the current script
    let disposableRunCurrScript = vscode.commands.registerCommand('blendpybridge.runCurrScript', async () => {
        // Check if the Blender terminal is currently running
        if (!terminal) {
            vscode.window.showErrorMessage('Blender is not running, nowhere to send.');
            return;
        }

        const { pathWorkspace, pathCurrPyFile } = await getPathsProject();
        // console.log(pathCurrPyFile);

        if (typeof pathCurrPyFile === 'string' && typeof pathWorkspace === 'string') {
            sendCommandToBlender(pathWorkspace, pathCurrPyFile);
        } else {
            // Handling the case where one of the paths is not defined
            vscode.window.showErrorMessage('The selected file is not *.py');
        }
    });

    // Command handler to run the entire package
    let disposableRunEntirePackage = vscode.commands.registerCommand('blendpybridge.runEntirePackage', async () => {
        // Check if the Blender terminal is currently running
        if (!terminal) {
            vscode.window.showErrorMessage('Blender is not running, nowhere to send.');
            return;
        }

        const { pathWorkspace, pathInitFile } = await getPathsProject();
        // console.log(pathInitFile);

        if (typeof pathInitFile === 'string' && typeof pathWorkspace === 'string') {
            sendCommandToBlender(pathWorkspace, pathInitFile);
        } else {
            // Handling the case where one of the paths is not defined
            vscode.window.showErrorMessage('The __init__ file is missing in the root of the project');
        }
    });

    context.subscriptions.push(disposableRunCurrScript, disposableRunEntirePackage);




    // Selecting the path to Blender
    let disposablePathExecSel = vscode.commands.registerCommand('blendpybridge.pathExecSel', async () => {

        // Check if the terminal is currently running
        if (terminal) {
            vscode.window.showWarningMessage('Cannot change the path to Blender while it is running');
            return;
        }

        // 'win32' ? 'windows' : 'linux'
        const platform = os.platform();

        let filters;
        if (platform === "win32") {
            // For Windows, show only .exe and all files
            filters = {
                'Executable Files': ['exe'],
                'All Files': ['*']
            };
        } else {
            // For Linux (and other non-Windows systems), show all files
            filters = {
                'All Files': ['*'],
                'Executable Files': ['sh'],
            };
        }
    
        const options: vscode.OpenDialogOptions = {
            canSelectMany: false,
            openLabel: 'Select',
            filters: filters
        };


        // Display the dialog and wait for the user to select a file
        const fileUri = await vscode.window.showOpenDialog(options);
        if (fileUri && fileUri[0]) {
            // If a file is selected, get its path
            let pathExecBlender = fileUri[0].fsPath;

            // Get the file name from the full path
            const fileName = path.basename(pathExecBlender);

            // Check if the file name starts with 'blender' or 'blender.exe' for different OS
            if ((platform === "win32" && fileName === "blender.exe") || (platform !== "win32" && fileName.startsWith("blender"))) {
                // Break async and save the variable in the global space of VS Code
                await context.globalState.update('pathExecBlender', pathExecBlender);
                vscode.window.showInformationMessage(`Blender path selected:\n${pathExecBlender}`);
            } else {
                vscode.window.showErrorMessage(`The selected file does not match the expected name. Expected "blender" for Unix or "blender.exe" for Windows.`);
            }

        } else {
            // If no file was selected, show a warning message
            vscode.window.showWarningMessage('Blender executable not selected');
        }
    });

    // Add commands to the extension context subscriptions for cleanup after the extension is disabled
    context.subscriptions.push(disposablePathExecSel);


    // Cleanup global variables
    let disposablePath

ExecClean = vscode.commands.registerCommand('blendpybridge.pathExecClean', async () => {

        // Check if the terminal is currently running
        if (terminal) {
            vscode.window.showWarningMessage('Cannot clean paths while Blender is running');
            return;
        }

        // List of keys you want to delete
        const keysToDelete = ['blenderPaths', 'pathBlenderExe', 'pathExecBlender', 'pathExecPython'];

        keysToDelete.forEach(async (key) => {
            await context.globalState.update(key, undefined);
        });

        vscode.window.showInformationMessage('The path to Blender has been removed from global variables');
    });

    context.subscriptions.push(disposablePathExecClean);




    // ######## ######## ######## ######## DEBUG ZONE ######## ######## ######## ########
    // Display paths to Blender and Python in pop-up windows
    let disposablePathExecShow = vscode.commands.registerCommand('blendpybridge.pathExecShow', async () => {
        // Get paths from the global variable space of VS Code
        const pathExecBlender = context.globalState.get<string>('pathExecBlender');

        if (pathExecBlender) {
            vscode.window.showInformationMessage(`Current Blender path: ${pathExecBlender}`, 'OK');
        } else {
            vscode.window.showWarningMessage(`Current Blender path is not defined`);
        }
    });

    context.subscriptions.push(disposablePathExecShow);



    // Display all paths to form commands
    let disposableShowPathsProject = vscode.commands.registerCommand('blendpybridge.showPathsProject', async () => {
        // Get project paths
        const { pathWorkspace, pathCurrPyFile, pathInitFile } = await getPathsProject();

        // If there is a workspace
        if (pathWorkspace) {
            vscode.window.showInformationMessage(`Path to the main project folder: ${pathWorkspace}`, 'OK');

            if (pathCurrPyFile) {
                vscode.window.showInformationMessage(`Path to the executable Python file: ${pathCurrPyFile}`, 'OK');
            } else {
                vscode.window.showWarningMessage('No active Python file');
            }

            if (pathInitFile) {
                vscode.window.showInformationMessage(`There is an __init__.py file in the workspace - this is a package: ${pathInitFile}`, 'OK');
            } else {
                vscode.window.showWarningMessage('There is no __init__.py file in the workspace - the project is not a package');
            }
        } else {
            vscode.window.showWarningMessage('No workspace');
        }
    });

    context.subscriptions.push(disposableShowPathsProject);


}




// Function triggered when the addon is deactivated
export function deactivate() {}
