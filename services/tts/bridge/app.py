"""
AI Video OS — 本地 TTS 标准 HTTP 桥接层

官方 API 形态各异，本服务统一暴露：
  GET  /health
  POST /synthesize  (JSON → audio/wav 或 JSON base64)
  GET  /docs        (FastAPI OpenAPI)

环境变量：
  BRIDGE_KIND   fish-speech | cosyvoice | f5-tts
  UPSTREAM_URL  官方服务根地址，如 http://fish-speech:8080
  BRIDGE_PORT   监听端口，默认 9080
"""

from __future__ import annotations

import base64
import io
import os
import wave
from typing import Any

import httpx
import ormsgpack
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

KIND = os.environ.get("BRIDGE_KIND", "fish-speech").strip().lower()
UPSTREAM = os.environ.get("UPSTREAM_URL", "http://127.0.0.1:8080").rstrip("/")
PORT = int(os.environ.get("BRIDGE_PORT", "9080"))

app = FastAPI(
    title=f"AI Video OS TTS Bridge ({KIND})",
    description=f"Wraps official {KIND} upstream at {UPSTREAM}",
    version="1.0.0",
)


class SynthesizeBody(BaseModel):
    text: str
    voice_id: str | None = None
    speed: float | None = None
    pitch: float | None = None
    emotion: str | None = None
    language: str | None = None


def _pcm_to_wav(pcm: bytes, channels: int = 1, sample_width: int = 2, rate: int = 22050) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsamplewidth(sample_width)
        wf.setframerate(rate)
        wf.writeframes(pcm)
    return buf.getvalue()


async def probe_upstream() -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        if KIND == "fish-speech":
            for path in ("/v1/health", "/health", "/docs"):
                try:
                    r = await client.get(f"{UPSTREAM}{path}")
                    if r.status_code < 500:
                        return {
                            "ok": r.status_code < 400,
                            "healthPath": path,
                            "status": r.status_code,
                            "body": r.text[:200],
                        }
                except Exception as e:
                    last = str(e)
            return {"ok": False, "error": last if "last" in dir() else "unreachable"}

        if KIND == "cosyvoice":
            for path in ("/docs", "/openapi.json", "/inference_sft"):
                try:
                    r = await client.get(f"{UPSTREAM}{path}")
                    if r.status_code < 500:
                        return {
                            "ok": path in ("/docs", "/openapi.json") and r.status_code == 200,
                            "healthPath": path,
                            "status": r.status_code,
                        }
                except Exception as e:
                    last = str(e)
            return {"ok": False, "error": last if "last" in dir() else "unreachable"}

        if KIND == "f5-tts":
            for path in ("/health", "/docs", "/"):
                try:
                    r = await client.get(f"{UPSTREAM}{path}")
                    if r.status_code < 500:
                        return {"ok": r.status_code < 400, "healthPath": path, "status": r.status_code}
                except Exception as e:
                    last = str(e)
            return {"ok": False, "error": last if "last" in dir() else "unreachable"}

        r = await client.get(f"{UPSTREAM}/health")
        return {"ok": r.is_success, "healthPath": "/health", "status": r.status_code}


@app.get("/health")
async def health():
    probe = await probe_upstream()
    return {
        "status": "ok" if probe.get("ok") else "degraded",
        "bridge": KIND,
        "upstream": UPSTREAM,
        "upstreamProbe": probe,
    }


@app.post("/synthesize")
async def synthesize(body: SynthesizeBody):
    text = body.text.strip()
    if not text:
        raise HTTPException(400, "text required")

    async with httpx.AsyncClient(timeout=300.0) as client:
        if KIND == "fish-speech":
            payload = {
                "text": text,
                "references": [],
                "reference_id": body.voice_id,
                "format": "wav",
                "streaming": False,
            }
            r = await client.post(
                f"{UPSTREAM}/v1/tts",
                params={"format": "msgpack"},
                content=ormsgpack.packb(payload),
                headers={"content-type": "application/msgpack"},
            )
            if not r.is_success:
                raise HTTPException(r.status_code, r.text[:500])
            return Response(content=r.content, media_type="audio/wav")

        if KIND == "cosyvoice":
            spk = body.voice_id or "中文女"
            r = await client.post(
                f"{UPSTREAM}/inference_sft",
                data={"tts_text": text, "spk_id": spk},
            )
            if not r.is_success:
                raise HTTPException(r.status_code, r.text[:500])
            pcm = r.content
            wav = _pcm_to_wav(pcm)
            return Response(content=wav, media_type="audio/wav")

        if KIND == "f5-tts":
            r = await client.post(
                f"{UPSTREAM}/tts",
                data={"gen_text": text},
            )
            if not r.is_success:
                raise HTTPException(r.status_code, r.text[:500])
            return Response(content=r.content, media_type="audio/wav")

        r = await client.post(f"{UPSTREAM}/synthesize", json=body.model_dump())
        if not r.is_success:
            raise HTTPException(r.status_code, r.text[:500])
        ct = r.headers.get("content-type", "")
        if "json" in ct:
            return JSONResponse(content=r.json())
        return Response(content=r.content, media_type=ct or "audio/wav")


@app.get("/")
async def root():
    return {"service": "ai-video-os-tts-bridge", "kind": KIND, "upstream": UPSTREAM, "docs": "/docs"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
