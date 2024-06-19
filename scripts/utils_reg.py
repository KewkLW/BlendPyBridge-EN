import gc
import sys
import inspect
import bpy

# Deregister old version
#### Analyze the running file to find classes for deregistration
def UNregister(package_name):
    print(f'\n\033[38;5;208m * def UNregister(package_name)  \033[0m')

    class_registered = []

    for cls_name in dir(bpy.types):
        # Get a reference to the item in bpy.types
        cls = getattr(bpy.types, cls_name)
        # If the reference is a class
        if isinstance(cls, type):
            # And it starts with the user's module name
            if cls.__module__.startswith(package_name):
                # print(' + ', cls)
                class_registered.append(cls.__name__)

                try:
                    bpy.utils.unregister_class(cls)
                    print(f'\t- {class_registered[-1]} unregistered')
                except Exception as e:
                    print(f'\t* Error while unregistering {class_registered[-1]}: {e}')

    if class_registered:
        print('\n')
        print('Gentlemen heading to the scaffold')
        print(class_registered)
        print('\n')

    addon_modules = [mod for mod in sys.modules if mod.startswith(package_name)]

    for module_name in addon_modules:
        try:
            # Remove the module from sys.modules
            del sys.modules[module_name]
            print(f'* Module {module_name} removed from sys.modules')
        except KeyError:
            # Module was already removed from sys.modules
            print(f'* Module {module_name} was already removed from sys.modules')
        except Exception as e:
            # Handling other potential exceptions
            print(f'* Error while removing module {module_name}: {e}')

    print(f'\n\033[92m#### The magic has ended ####\033[0m')
    print('\n')
