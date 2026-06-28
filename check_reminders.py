#!/usr/bin/env python3
"""Revisa reminders.json y manda alertas por Telegram.

Pensado para GitHub Actions. No necesita instalar paquetes externos.
"""
from __future__ import annotations

import json
import os
import sys
import html
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

try:
    from zoneinfo import ZoneInfo
except Exception:  # pragma: no cover
    ZoneInfo = None  # type: ignore

ROOT = Path(__file__).resolve().parents[1]
REMINDERS_FILE = ROOT / "reminders.json"
STATE_FILE = ROOT / ".alert_state.json"

OFFSETS = {
    "7d": timedelta(days=7),
    "3d": timedelta(days=3),
    "1d": timedelta(days=1),
    "12h": timedelta(hours=12),
    "1h": timedelta(hours=1),
    "15m": timedelta(minutes=15),
    "due": timedelta(seconds=0),
}

LABELS = {
    "7d": "faltan 7 días",
    "3d": "faltan 3 días",
    "1d": "falta 1 día",
    "12h": "faltan 12 horas",
    "1h": "falta 1 hora",
    "15m": "faltan 15 minutos",
    "due": "es el momento",
}

@dataclass
class Reminder:
    id: str
    title: str
    due: datetime
    notify: list[str]
    notes: str = ""
    color: str = "purple"


def get_timezone():
    tz_name = os.getenv("APP_TIMEZONE", "America/Mexico_City")
    if ZoneInfo:
        try:
            return ZoneInfo(tz_name)
        except Exception:
            print(f"Zona horaria inválida {tz_name!r}. Uso UTC.")
    return timezone.utc


def parse_due(value: str, tz) -> datetime:
    value = value.strip().replace("Z", "+00:00")
    if "T" not in value and " " in value:
        value = value.replace(" ", "T", 1)
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=tz)
    return dt.astimezone(tz)


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def save_json(path: Path, data: Any) -> None:
    with path.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2, sort_keys=True)
        fh.write("\n")


def load_reminders(tz) -> list[Reminder]:
    raw = load_json(REMINDERS_FILE, [])
    if not isinstance(raw, list):
        raise ValueError("reminders.json debe ser una lista/arreglo JSON")
    reminders: list[Reminder] = []
    for item in raw:
        try:
            reminder = Reminder(
                id=str(item["id"]),
                title=str(item["title"]),
                due=parse_due(str(item["due"]), tz),
                notify=[str(x) for x in item.get("notify", ["1d", "1h", "due"]) if str(x) in OFFSETS],
                notes=str(item.get("notes", "")),
                color=str(item.get("color", "purple")),
            )
            reminders.append(reminder)
        except Exception as exc:
            print(f"No pude leer un recordatorio: {item!r}. Error: {exc}")
    return reminders


def telegram_send(text: str) -> bool:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        print("Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID en GitHub Secrets. No envié Telegram.")
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = urllib.parse.urlencode({
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": "true",
    }).encode("utf-8")

    request = urllib.request.Request(url, data=data, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            if response.status >= 400:
                print(f"Telegram respondió HTTP {response.status}")
                return False
        return True
    except Exception as exc:
        print(f"Error mandando Telegram: {exc}")
        return False


def format_datetime(dt: datetime) -> str:
    return dt.strftime("%d/%m/%Y %H:%M")


def build_message(reminder: Reminder, alert_code: str, now: datetime) -> str:
    title = html.escape(reminder.title)
    label = html.escape(LABELS.get(alert_code, alert_code))
    notes = html.escape(reminder.notes.strip())
    app_url = os.getenv("APP_BASE_URL", "").strip()

    lines = [
        "⏰ <b>CuentaAlerta</b>",
        f"<b>{title}</b>",
        f"Aviso: <b>{label}</b>",
        f"Fecha límite: <b>{html.escape(format_datetime(reminder.due))}</b>",
        f"Revisado: {html.escape(format_datetime(now))}",
    ]
    if notes:
        lines.append(f"Notas: {notes}")
    if app_url:
        lines.append(f"Abrir app: {html.escape(app_url)}")
    return "\n".join(lines)


def should_send(now: datetime, due: datetime, alert_code: str) -> bool:
    offset = OFFSETS[alert_code]
    target = due - offset

    # Las alertas previas se mandan en la primera corrida posterior al objetivo,
    # siempre y cuando el recordatorio no haya vencido todavía.
    if alert_code != "due":
        return target <= now <= due

    # La alerta exacta permite retrasos moderados de GitHub Actions.
    due_grace_minutes = int(os.getenv("DUE_GRACE_MINUTES", "180"))
    return due <= now <= due + timedelta(minutes=due_grace_minutes)


def main() -> int:
    tz = get_timezone()
    now = datetime.now(tz)
    state: dict[str, Any] = load_json(STATE_FILE, {})
    reminders = load_reminders(tz)
    sent_count = 0

    print(f"CuentaAlerta revisando {len(reminders)} recordatorio(s) en {format_datetime(now)}")

    for reminder in reminders:
        for alert_code in reminder.notify:
            state_key = f"{reminder.id}|{reminder.due.isoformat()}|{alert_code}"
            if state.get(state_key):
                continue
            if not should_send(now, reminder.due, alert_code):
                continue

            message = build_message(reminder, alert_code, now)
            if telegram_send(message):
                state[state_key] = {
                    "sent_at": now.isoformat(),
                    "title": reminder.title,
                    "alert": alert_code,
                    "due": reminder.due.isoformat(),
                }
                sent_count += 1
                print(f"Enviado: {reminder.title} / {alert_code}")
            else:
                print(f"Pendiente de enviar: {reminder.title} / {alert_code}")

    save_json(STATE_FILE, state)
    print(f"Alertas enviadas: {sent_count}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
