# This file is run by Blender at startup
# blender --python self_script.py

import os
import sys
import time
import socket
import importlib
import threading
import bpy

# Add the script directory to sys.path
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.append(script_dir)

from utils_reg import UNregister

# ANSI color codes for terminal output formatting
class Color:
    RED     = '\033[91m'        # Text color: Red
    GREEN   = '\033[92m'        # Text color: Green
    YELLOW  = '\033[93m'        # Text color: Yellow
    ORANGE  = '\033[38;5;208m'  # ANSI code for orange color
    MAGENTA = '\033[95m'        # Text color: Magenta
    RESET   = '\033[0m'         # Reset color to default

    # BLUE = '\033[94m'
    # CYAN = '\033[96m'
    # WHITE = '\033[97m'

    BG_BLUE = '\033[44m'      # Background: Blue
    BG_GREEN = '\033[42m'     # Background: Green
    BG_YELLOW = '\033[43m'    # Background: Yellow

# Start/restart the project
def start_project(package_name):
    print(f'{Color.YELLOW}Starting project{Color.RESET}')

    # Start the project by importing it
    module = importlib.import_module(package_name)
    
    # The package's __name__ will be the package name, __name__ != "__main__"
    # Call the 'register' function from the imported module
    if hasattr(module, 'register'):
        module.register()
    else:
        print("The 'register' function was not found in the module")

    print(f'{Color.YELLOW}Done{Color.RESET}')

# Since a full deregister is not created yet, it doesn't make sense to remove the path from sys.path without restarting.
# This is because I can only use it at startup and essentially unload and load it immediately.
# It's pointless, and I'll mix the logic of the restarter with the deregister.
def path_append_to_syspath(added_path):
    if added_path not in sys.path:
        sys.path.append(added_path)

def blExec(message):
    print(f'\n{Color.GREEN}#### Magic Happening ####{Color.RESET}')
    print(f'\n{Color.ORANGE} * def blExec(message){Color.RESET}')
    # Paths received from the client to start the project
    pathWorkspace, pathPyFile = message.split('\n')
    
    # Path to the file being run in VS Code (__init__ or script)
    path_dir, name_file = os.path.split(pathPyFile)

    # Determine the type of run - script/add-on
    if path_dir == pathWorkspace and name_file == '__init__.py':
        print('This is the main package __init__.py')
        
        # The received name is the package name,
        # Considering the nested level of the running file relative to the root
        module_name = os.path.basename(path_dir)
        
        # Deregister the old version of the add-on
        UNregister(module_name)

        # Add the root directory of the project to sys.path
        # From Blender's perspective, it's necessary to specify not the project folder,
        # but the root directory where the project folder is located
        path_to_add = os.path.dirname(pathWorkspace)
        path_append_to_syspath(path_to_add)
        # print(*sys.path, sep='\n')

        # Start the project
        start_project(module_name)

    elif name_file.endswith('.py'):
        print(f'This is a standalone script: {name_file}')

        # File name without extension
        module_name = os.path.splitext(name_file)[0]

        # Deregister the old version of the add-on
        UNregister(module_name)
        
        # Add the script directory to sys.path
        path_append_to_syspath(path_dir)
        # print(*sys.path, sep='\n')

        # Start the script
        start_project(module_name)

    else:
        print('Error: This is not a *.py file')
        sys.exit(0)

def handle_client(client_sock):
    try:
        # Gather all code parts in 4096-byte chunks
        data_parts = []
        while True:
            # Receive data from the client
            part = client_sock.recv(1024)
            # If the part is empty, all data has been received
            if not part:
                break
            data_parts.append(part)
            
        # Concatenate the binary data
        data = b''.join(data_parts)

        if data:
            # Decode the received bytes
            message = data.decode('utf-8')
            
            # Delimiting line before executing the received code
            print('*' * 50)
            
            # Special check to prevent the user from interrupting the server along with their add-on
            try:
                # exec in its own local context, not seeing global variables
                # exec(command, globals())
                blExec(message)
                # pass
            except SystemExit:
                print(f'{Color.ORANGE}Called {Color.RED}sys.exit(){Color.ORANGE}, but the server will continue running{Color.RESET}')
            except Exception as e:
                print(f"Error while executing the command: {e}")
        else:
            print('No data received')

        # Update the current view layer in Blender, if necessary
        # bpy.context.view_layer.update()

    except Exception as e:
        print(f'Error handling connection: {e}')
    finally:
        # After receiving all code parts and running it, close the connection
        client_sock.close()
        print(f'{Color.YELLOW}Connection closed{Color.RESET}')

# The listening server itself
# If Blender is restarted quickly, the server won't stop in time and will complain about the double start
def start_server(port=3264):
    # Create a socket, AF_INET - network socket (IPv4), SOCK_STREAM - TCP socket
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    # Bind the socket to localhost and the port
    server.bind(('localhost', port))
    # Maximum number of incoming connections that are queued for processing
    server.listen(1)
    print(f'{Color.YELLOW}Server started on port {Color.GREEN}{port}{Color.RESET}')

    while True:
        # Wait for an incoming connection from the client, stopping the thread until a message is received
        client_sock, address = server.accept()
        print(f'{Color.YELLOW}Connected to {Color.GREEN}{address}{Color.RESET}')
        # Assemble the received packet and execute it
        handle_client(client_sock)

# Emergency auto-shutdown process in case of a freeze or specific Blender crash
# It also checks the current server status with feedback
def check_blender_status():
    start_time = time.time()
    while True:
        try:
            count = len(bpy.data.scenes)
            if count == 0:
                raise Exception(f'Blender stopped responding\nCODE: {count}')

            elapsed_time = time.time() - start_time
            print(f'{Color.MAGENTA}RUN: {int(elapsed_time)} seconds{Color.RESET}')
        except Exception as e:
            print(f'{Color.YELLOW}Stopping server:{Color.RESET}', e)
            sys.exit(0)
        time.sleep(8)

# Background processes (daemon threads)
def server_run():
    # Listening server process
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    # Feedback and status process
    check_thread = threading.Thread(target=check_blender_status, daemon=True)
    check_thread.start()

# Start the whole thing
server_run()
