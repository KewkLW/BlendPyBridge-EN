import * as os from 'os';
import * as net from 'net';
import * as path from 'path';
import * as vscode from 'vscode';

// Function to get paths: pathCurrPyFile, pathWorkspace, pathInitFile of the project
async function getPathsProject() {
    const activeEditor = vscode.window.activeTextEditor;

    let pathWorkspace;
    if (activeEditor) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
        pathWorkspace = workspaceFolder ? workspaceFolder.uri.fsPath : undefined;
    }

    let pathCurrPyFile;
    if (activeEditor && activeEditor.document.languageId === 'python') {
        pathCurrPyFile = activeEditor.document.uri.fsPath;
    } else {
        pathCurrPyFile = undefined;
    }

    let pathInitFile;
    if (pathWorkspace) {
        const initFilePath = path.join(pathWorkspace, '__init__.py');
        const initFileUri = vscode.Uri.file(initFilePath);
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
function sendCommandToBlender(pathWorkspace: string, pathPyFile: string) {
    const client = new net.Socket();
    const port = 3264;
    const host = 'localhost';

    client.connect(port, host, () => {
        console.log('Connected to Blender server');
        const command = `${pathWorkspace}\n${pathPyFile}`;
        client.write(command, 'utf-8', () => {
            console.log('Command sent to Blender');
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

export function activate(context: vscode.ExtensionContext) {
    const terminalName = "BlendPyBridge";
    let terminal: vscode.Terminal | undefined;

    let disposableStart = vscode.commands.registerCommand('blendpybridge.startBlender', async () => {
        if (terminal) {
            vscode.window.showWarningMessage('An instance is already running');
            return;
        }
        
        const pathExecBlender = context.globalState.get<string>('pathExecBlender');
        if (!pathExecBlender) {
            vscode.window.showErrorMessage('You need to specify the path to Blender');
            return;
        }

        const scriptServerSocket = path.join(context.extensionPath, 'scripts', 'socketBlenderBridge.py');

        console.log('%cBlender executable:', 'color: yellow');
        const pathEnd = path.basename(pathExecBlender);
        const pathBegin = pathExecBlender.slice(0, pathExecBlender.lastIndexOf(pathEnd));
        console.log(`%c${pathBegin}%c${pathEnd}`, 'color: normal', 'color: orange');

        console.log('%cServer script:', 'color: yellow');
        const scriptEnd = path.basename(scriptServerSocket);
        const scriptBegin = scriptServerSocket.slice(0, scriptServerSocket.lastIndexOf(scriptEnd));
        console.log(`%c${scriptBegin}%c${scriptEnd}`, 'color: normal', 'color: orange');

        console.log('\n------->->>-->>>->>>> %cSTART_BRIDGE%c <<<<-<<<--<<-<-------', 'color: #FF69B4', 'color: reset');

        terminal = vscode.window.createTerminal({
            name: terminalName,
            shellPath: pathExecBlender,
            shellArgs: ["--python", scriptServerSocket]
        });
        
        terminal.show();

        const onDidCloseTerminal = vscode.window.onDidCloseTerminal(closedTerminal => {
            if (closedTerminal === terminal) {
                terminal = undefined;
            }
        });

        context.subscriptions.push(onDidCloseTerminal);
    });

    context.subscriptions.push(disposableStart);

    let disposableRunCurrScript = vscode.commands.registerCommand('blendpybridge.runCurrScript', async () => {
        if (!terminal) {
            vscode.window.showErrorMessage('Blender is not running, nowhere to send.');
            return;
        }

        const { pathWorkspace, pathCurrPyFile } = await getPathsProject();
        if (typeof pathCurrPyFile === 'string' && typeof pathWorkspace === 'string') {
            sendCommandToBlender(pathWorkspace, pathCurrPyFile);
        } else {
            vscode.window.showErrorMessage('The selected file is not *.py');
        }
    });

    let disposableRunEntirePackage = vscode.commands.registerCommand('blendpybridge.runEntirePackage', async () => {
        if (!terminal) {
            vscode.window.showErrorMessage('Blender is not running, nowhere to send.');
            return;
        }

        const { pathWorkspace, pathInitFile } = await getPathsProject();
        if (typeof pathInitFile === 'string' && typeof pathWorkspace === 'string') {
            sendCommandToBlender(pathWorkspace, pathInitFile);
        } else {
            vscode.window.showErrorMessage('The __init__ file is missing in the root of the project');
        }
    });

    context.subscriptions.push(disposableRunCurrScript, disposableRunEntirePackage);

    let disposablePathExecSel = vscode.commands.registerCommand('blendpybridge.pathExecSel', async () => {
        if (terminal) {
            vscode.window.showWarningMessage('Cannot change the path to Blender while it is running');
            return;
        }

        const platform = os.platform();
        const filters = platform === "win32" ? 
            { 'Executable Files': ['exe'], 'All Files': ['*'] } : 
            { 'All Files': ['*'], 'Executable Files': ['sh'] };

        const options: vscode.OpenDialogOptions = {
            canSelectMany: false,
            openLabel: 'Select',
            filters: filters
        };

        const fileUri = await vscode.window.showOpenDialog(options);
        if (fileUri && fileUri[0]) {
            let pathExecBlender = fileUri[0].fsPath;
            const fileName = path.basename(pathExecBlender);
            if ((platform === "win32" && fileName === "blender.exe") || (platform !== "win32" && fileName.startsWith("blender"))) {
                await context.globalState.update('pathExecBlender', pathExecBlender);
                vscode.window.showInformationMessage(`Blender path selected:\n${pathExecBlender}`);
            } else {
                vscode.window.showErrorMessage(`The selected file does not match the expected name. Expected "blender" for Unix or "blender.exe" for Windows.`);
            }
        } else {
            vscode.window.showWarningMessage('Blender executable not selected');
        }
    });

    context.subscriptions.push(disposablePathExecSel);

    let disposablePathExecClean = vscode.commands.registerCommand('blendpybridge.pathExecClean', async () => {
        if (terminal) {
            vscode.window.showWarningMessage('Cannot clean paths while Blender is running');
            return;
        }

        const keysToDelete = ['blenderPaths', 'pathBlenderExe', 'pathExecBlender', 'pathExecPython'];
        keysToDelete.forEach(async (key) => {
            await context.globalState.update(key, undefined);
        });

        vscode.window.showInformationMessage('The path to Blender has been removed from global variables');
    });

    context.subscriptions.push(disposablePathExecClean);

    let disposablePathExecShow = vscode.commands.registerCommand('blendpybridge.pathExecShow', async () => {
        const pathExecBlender = context.globalState.get<string>('pathExecBlender');
        if (pathExecBlender) {
            vscode.window.showInformationMessage(`Current Blender path: ${pathExecBlender}`, 'OK');
        } else {
            vscode.window.showWarningMessage(`Current Blender path is not defined`);
        }
    });

    context.subscriptions.push(disposablePathExecShow);

    let disposableShowPathsProject = vscode.commands.registerCommand('blendpybridge.showPathsProject', async () => {
        const { pathWorkspace, pathCurrPyFile, pathInitFile } = await getPathsProject();
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

export function deactivate() {}
