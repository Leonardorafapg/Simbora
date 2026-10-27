# backend/app/services/notification_worker.py
"""Laço em segundo plano que cria os lembretes (agenda e prazos) e os entrega em tempo real."""
import asyncio
import logging
import threading

from app.core.database import SessionLocal
from app.core.timeutil import utcnow
from app.services import notifications, reminders

logger = logging.getLogger("notification_worker")

LOOP_SECONDS = 60


class NotificationWorker:
    """Uma thread por processo: a cada minuto roda `reminders.run_all`. Se houver dois processos, a
    chave anti-repetição dos avisos garante que cada lembrete sai uma vez só."""

    def __init__(self) -> None:
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._loop: asyncio.AbstractEventLoop | None = None

    def start(self, loop: asyncio.AbstractEventLoop | None = None) -> None:
        if self._thread is not None:
            return
        self._loop = loop
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="notification-worker", daemon=True)
        self._thread.start()
        logger.info("[avisos] laço de lembretes iniciado")

    def stop(self) -> None:
        self._stop.set()
        self._thread = None

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                self.tick()
            except Exception:
                logger.exception("[avisos] rodada de lembretes falhou")
            self._stop.wait(LOOP_SECONDS)

    def tick(self) -> int:
        """Uma rodada. Devolve quantos avisos foram criados."""
        db = SessionLocal()
        try:
            created = reminders.run_all(db, utcnow())
            items = [notifications.payload_of(n) for n in created]
        finally:
            db.close()
        self._deliver(items)
        return len(items)

    def _deliver(self, items: list) -> None:
        """Empurra pro navegador de quem está online (o loop do servidor é de outra thread)."""
        if not items or self._loop is None or self._loop.is_closed():
            return
        asyncio.run_coroutine_threadsafe(notifications.publish_payloads(items), self._loop)


worker = NotificationWorker()
