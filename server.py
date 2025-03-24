import asyncio
import websockets

connected_clients = set()
chat_log = []

async def broadcast(message):
    if connected_clients:
        await asyncio.wait([client.send(message) for client in connected_clients])

async def chat_handler(websocket, path):
    for msg in chat_log:
        await websocket.send(msg)
    
    connected_clients.add(websocket)
    try:
        async for message in websocket:
            chat_log.append(message)
            await broadcast(message)
    except websockets.ConnectionClosed:
        pass
    finally:
        connected_clients.remove(websocket)

start_server = websockets.serve(chat_handler, "localhost", 8765)
print("? Chat server running on ws://localhost:8765")

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
