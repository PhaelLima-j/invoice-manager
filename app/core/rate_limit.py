"""Rate limiting simples em memória (janela deslizante).

Objetivo: mitigar força bruta / abuso em endpoints sensíveis (login, cadastro)
sem introduzir dependências novas.

Limitação conhecida: o estado é por processo. Em produção com múltiplos
workers/instâncias, troque por um limitador compartilhado (ex.: Redis).
"""

import time
from collections import defaultdict
from threading import Lock

_attempts: dict[str, list[float]] = defaultdict(list)
_lock = Lock()


def check_rate_limit(key: str, *, max_attempts: int, window_seconds: int) -> bool:
    """Registra uma tentativa e diz se ainda está dentro do limite.

    Retorna True se permitido; False se o limite foi excedido na janela.
    """
    now = time.time()
    with _lock:
        recent = [t for t in _attempts[key] if now - t < window_seconds]
        recent.append(now)
        _attempts[key] = recent
        return len(recent) <= max_attempts


def reset() -> None:
    """Limpa todo o estado. Usado nos testes para isolar cada caso."""
    with _lock:
        _attempts.clear()
