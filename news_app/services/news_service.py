import threading
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any, Dict, List, Optional, Tuple

from bs4 import BeautifulSoup

from model import NewsAggregator


def _safe_text(html_content: str) -> str:
    if not html_content:
        return ""
    soup = BeautifulSoup(html_content, "html.parser")
    return soup.get_text(" ", strip=True)


def _to_iso8601(date_str: Optional[str]) -> Optional[str]:
    if not date_str:
        return None
    try:
        parsed = parsedate_to_datetime(date_str)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).isoformat()
    except (TypeError, ValueError):
        return None


class NewsService:
    def __init__(self, refresh_seconds: int = 1800) -> None:
        self.refresh_seconds = refresh_seconds
        self.lock = threading.Lock()
        self.worker_started = False
        self.stop_event = threading.Event()

        self.cache: Dict[str, Any] = {
            "status": "loading",
            "total_articles": 0,
            "data": [],
            "last_updated": None,
            "error": None,
        }

    def _normalize_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        items: List[Dict[str, Any]] = payload.get("data", [])
        normalized: List[Dict[str, Any]] = []
        for item in items:
            summary = item.get("summary") or ""
            normalized.append(
                {
                    "source": item.get("source") or "Unknown",
                    "title": item.get("title") or "Untitled",
                    "link": item.get("link") or "#",
                    "summary": summary,
                    "summary_text": _safe_text(summary),
                    "full_text": item.get("full_text") or "",
                    "published": _to_iso8601(item.get("published")),
                }
            )

        # Latest first, unpublished goes last.
        normalized.sort(
            key=lambda n: n["published"] if n["published"] is not None else "",
            reverse=True,
        )
        payload["data"] = normalized
        payload["total_articles"] = len(normalized)
        return payload

    def refresh_now(self) -> None:
        try:
            raw_payload = NewsAggregator().run()
            payload = self._normalize_payload(raw_payload)
            payload["status"] = "success"
            payload["error"] = None
        except Exception as exc:  # Defensive fallback for external feed issues.
            payload = {
                "status": "error",
                "total_articles": 0,
                "data": [],
                "error": f"Failed to refresh news: {exc}",
            }

        payload["last_updated"] = datetime.now(timezone.utc).isoformat()
        with self.lock:
            self.cache = payload

    def _refresh_loop(self) -> None:
        while not self.stop_event.is_set():
            self.refresh_now()
            self.stop_event.wait(self.refresh_seconds)

    def start(self) -> None:
        with self.lock:
            if self.worker_started:
                return
            self.worker_started = True

        # Populate cache once immediately.
        self.refresh_now()

        worker = threading.Thread(target=self._refresh_loop, name="news-refresh-worker", daemon=True)
        worker.start()

    def get_news_payload(self) -> Tuple[Dict[str, Any], int]:
        with self.lock:
            payload = dict(self.cache)
            payload["data"] = list(self.cache.get("data", []))

        if payload.get("status") == "success":
            return payload, 200

        if payload.get("status") == "loading":
            return payload, 202

        return payload, 503


news_service = NewsService(refresh_seconds=1800)
