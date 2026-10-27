# backend/app/core/ws_manager.py
"""
Registro em memória de conexões WebSocket do módulo WhatsApp.

Versão simplificada da do slzfood-api: lá é multi-tenant (salas por
tenant_id) e broadcast é chamado de rotas síncronas (por isso
run_coroutine_threadsafe). Aqui é single-tenant — uma sala só — e todo
chamador já está dentro de uma rota `async def`, então dá pra fazer
`await manager.broadcast(...)` direto, sem cruzar thread/loop.

Assume um único processo (uvicorn sem --workers, igual ao resto do backend).
"""
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger("ws_manager")


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)

    async def broadcast(self, message: dict[str, Any]) -> None:
        for ws in list(self._connections):
            try:
                await ws.send_json(message)
            except Exception:
                logger.warning("Falha ao enviar mensagem WebSocket — removendo conexão.")
                self._connections.discard(ws)


manager = ConnectionManager()


class UserConnectionManager:
    """Conexões WebSocket por usuário — avisos (notificações) vão só pra quem é o destinatário.

    Mesma premissa do gerenciador acima: um único processo."""

    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int) -> None:
        await websocket.accept()
        self._connections.setdefault(user_id, set()).add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int) -> None:
        sockets = self._connections.get(user_id)
        if sockets is None:
            return
        sockets.discard(websocket)
        if not sockets:
            self._connections.pop(user_id, None)

    def is_connected(self, user_id: int) -> bool:
        return bool(self._connections.get(user_id))

    async def send_to_user(self, user_id: int, message: dict[str, Any]) -> None:
        for ws in list(self._connections.get(user_id, ())):
            try:
                await ws.send_json(message)
            except Exception:
                logger.warning("Falha ao enviar aviso por WebSocket — removendo conexão.")
                self.disconnect(ws, user_id)


user_manager = UserConnectionManager()
