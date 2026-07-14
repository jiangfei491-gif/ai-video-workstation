/**
 * 运行：npx tsx --test app/lib/auto-edit/ffmpeg/mux-final.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAudioMixCommand } from "./mux-final";

describe("buildAudioMixCommand", () => {
  it("trims voice before adelay so later shots are not silent", () => {
    const cmd = buildAudioMixCommand({
      outputPath: "/tmp/mixed.aac",
      mix: {
        voicePaths: [
          { path: "/a/shot0.mp3", startSec: 0, durationSec: 8 },
          { path: "/a/shot1.mp3", startSec: 10, durationSec: 5 },
        ],
        totalDurationSec: 60,
      },
    });
    assert.ok(cmd);
    const graph = cmd!.args[cmd!.args.indexOf("-filter_complex") + 1] as string;
    assert.match(graph, /\[0:a\]atrim=0:8\.000,asetpts=PTS-STARTPTS\[vsrc0\]/);
    assert.match(graph, /\[vsrc0\]adelay=0\|0,volume=1\[va0\]/);
    assert.match(graph, /\[1:a\]atrim=0:5\.000,asetpts=PTS-STARTPTS\[vsrc1\]/);
    assert.match(graph, /\[vsrc1\]adelay=10000\|10000,volume=1\[va1\]/);
    assert.match(graph, /amix=inputs=2:duration=longest:dropout_transition=0:normalize=0\[voicebus\]/);
  });
});
