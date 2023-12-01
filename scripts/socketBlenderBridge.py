import sys
import time
import socket
import threading

import bpy


def start_server(port=3264):
    # Создает сокет, AF_INET - сетевой сокет (IPv4), SOCK_STREAM - сокет TCP
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    # Привязывает сокет к адресу localhost и порту
    server.bind(('localhost', port))
    # Максимальное количество входящих соединений, которые ожидают обработки, помещенные в очередь
    server.listen(4)
    print(f"Сервер запущен на порту {port}")

    while True:
        # Ожидает входящее соединение от клиента
        client_sock, address = server.accept()
        print(f"Подключено к {address}")
        try:
            # Собираем все части кода по 4096 байт
            data_parts = []
            while True:
                # Получает данные от клиента
                part = client_sock.recv(4096)
                data_parts.append(part)
                # Ждем все части сообщения пока не придет остаточное сообщение
                if len(part) < 4096:
                    break
            data = b''.join(data_parts)
            
            # Декодирует полученные байты данных
            command = data.decode('utf-8')
            # Выполняет строку как Python код
            exec(command)
            # Обновляет текущий видовой слой в Blender, что необходимо
            bpy.context.view_layer.update()
        except Exception as e:
            print(f"Ошибка обработки соединения: {e}")
        finally:
            # После получения всех частей код и его заупска - закрываем соединение
            client_sock.close()


def check_blender_status():
    start_time = time.time()
    while True:
        try:
            count = len(bpy.data.scenes)
            if count == 0:
                raise Exception(f'Blender перестал отвечать\nCODE: {count}')

            elapsed_time = time.time() - start_time
            print(f'RUN: {int(elapsed_time)} секунд')
        except Exception as e:
            print('Останавка сервера:', e)
            sys.exit(0)
        time.sleep(4)



def server_run():
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    check_thread = threading.Thread(target=check_blender_status, daemon=True)
    check_thread.start()


server_run()
