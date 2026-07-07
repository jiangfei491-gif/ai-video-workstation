import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { resolveDesktopFile } from "@/app/lib/storage/desktop-veo";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ass": "text/plain",
  ".srt": "application/x-subrip",
};

type ResolvedFile = {
  filepath: string;
  ext: string;
  size: number;
};

async function resolveFile(
  segments: string[]
): Promise<ResolvedFile | null> {
  const rel = segments.join("/");
  const filepath = resolveDesktopFile(rel);
  if (!filepath) return null;
  try {
    const stat = await fs.promises.stat(filepath);
    if (!stat.isFile()) return null;
    return {
      filepath,
      ext: path.extname(filepath).toLowerCase(),
      size: stat.size,
    };
  } catch {
    return null;
  }
}

function fileHeaders(
  file: ResolvedFile,
  extra?: Record<string, string>
): Record<string, string> {
  return {
    "Content-Type": MIME[file.ext] ?? "application/octet-stream",
    "Content-Disposition": `inline; filename="${path.basename(file.filepath)}"`,
    "Accept-Ranges": "bytes",
    "Content-Length": String(file.size),
    ...extra,
  };
}

function parseByteRange(
  rangeHeader: string,
  fileSize: number
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return null;

  let start: number;
  let end: number;

  if (match[1] === "" && match[2] !== "") {
    const suffixLength = parseInt(match[2], 10);
    if (Number.isNaN(suffixLength)) return null;
    start = Math.max(0, fileSize - suffixLength);
    end = fileSize - 1;
  } else {
    start = match[1] !== "" ? parseInt(match[1], 10) : 0;
    end = match[2] !== "" ? parseInt(match[2], 10) : fileSize - 1;
    if (Number.isNaN(start) || Number.isNaN(end)) return null;
  }

  if (start > end || start >= fileSize) return null;
  end = Math.min(end, fileSize - 1);
  return { start, end };
}

async function readFileSlice(
  filepath: string,
  start: number,
  end: number
): Promise<Buffer> {
  const length = end - start + 1;
  const handle = await fs.promises.open(filepath, "r");
  try {
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, start);
    return buffer;
  } finally {
    await handle.close();
  }
}

async function serveFile(req: Request, segments: string[]): Promise<NextResponse> {
  const file = await resolveFile(segments);
  if (!file) {
    return NextResponse.json({ error: "文件未找到" }, { status: 404 });
  }

  const rangeHeader = req.headers.get("range");
  if (rangeHeader) {
    const range = parseByteRange(rangeHeader, file.size);
    if (!range) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${file.size}` },
      });
    }

    const body = await readFileSlice(file.filepath, range.start, range.end);
    return new NextResponse(new Uint8Array(body), {
      status: 206,
      headers: fileHeaders(file, {
        "Content-Length": String(body.length),
        "Content-Range": `bytes ${range.start}-${range.end}/${file.size}`,
      }),
    });
  }

  const body = await fs.promises.readFile(file.filepath);
  return new NextResponse(new Uint8Array(body), {
    headers: fileHeaders(file),
  });
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await ctx.params;
  return serveFile(req, segments);
}

export async function HEAD(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await ctx.params;
  const file = await resolveFile(segments);
  if (!file) {
    return new NextResponse(null, { status: 404 });
  }

  const rangeHeader = req.headers.get("range");
  if (rangeHeader) {
    const range = parseByteRange(rangeHeader, file.size);
    if (!range) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${file.size}` },
      });
    }
    const length = range.end - range.start + 1;
    return new NextResponse(null, {
      status: 206,
      headers: fileHeaders(file, {
        "Content-Length": String(length),
        "Content-Range": `bytes ${range.start}-${range.end}/${file.size}`,
      }),
    });
  }

  return new NextResponse(null, { headers: fileHeaders(file) });
}
