"""
为 openaudio-s1-mini 生成 HF 格式 tokenizer（tokenizer.json + tokenizer_config.json）。
原因：镜像里 FishTokenizer 用 AutoTokenizer.from_pretrained(dir)，但官方模型只发了
tokenizer.tiktoken + special_tokens.json，缺 HF tokenizer 文件 → dual_ar KeyError。
用官方 fish-speech v1.5.1 的 tiktoken 构造逻辑本地补齐。
"""
import json, base64, sys
from pathlib import Path

CKPT = "checkpoints/openaudio-s1-mini"

# 官方 fish-speech v1.5.1 的 pat_str
FISH_TIKTOKEN_PATTERN = "|".join([
    r"(?i:'s|'t|'re|'ve|'m|'ll|'d)",
    r"\p{P}",
    r"[^\r\n\p{L}\p{N}]?\p{L}+",
    r"\p{N}",
    r" ?[^\s\p{L}\p{N}]+[\r\n]*",
    r"\s*[\r\n]+",
    r"\s+(\?!\S)",
    r"\s+",
])

# 1. 加载 mergeable ranks（每行: base64(token) rank）
ranks = {}
for line in Path(f"{CKPT}/tokenizer.tiktoken").read_text().splitlines():
    if not line.strip():
        continue
    tok, rank = line.split()
    ranks[base64.b64decode(tok)] = int(rank)
print("mergeable ranks:", len(ranks))

# 2. 特殊 token（已含精确 id，按 id 升序）
special = json.load(open(f"{CKPT}/special_tokens.json"))
special = dict(sorted(special.items(), key=lambda kv: kv[1]))
print("special tokens:", len(special), "range", min(special.values()), "->", max(special.values()))

# 3. 猴子补丁：绕过 tiktoken 的 blobfile 依赖（离线，直接喂已加载的 ranks）
import tiktoken.load
tiktoken.load.load_tiktoken_bpe = lambda *a, **k: ranks

# 4. 用 TikTokenConverter 直接生成 fast tokenizer → 写 tokenizer.json
from transformers.convert_slow_tokenizer import TikTokenConverter
conv = TikTokenConverter(
    vocab_file=f"{CKPT}/tokenizer.tiktoken",   # 值不重要，load 已被补丁
    pattern=FISH_TIKTOKEN_PATTERN,
    additional_special_tokens=special,          # dict → 取 keys()，按 id 升序追加
)
fast = conv.converted()
fast.save(f"{CKPT}/tokenizer.json")
print("tokenizer.json 已生成，vocab:", fast.get_vocab_size())

# 5. 写 tokenizer_config.json（声明 fast 类，避免 AutoTokenizer 回退去读 config.json）
cfg = {
    "tokenizer_class": "PreTrainedTokenizerFast",
    "bos_token": "<|begin_of_text|>",
    "eos_token": "<|end_of_text|>",
    "pad_token": "<|pad|>",
    "clean_up_tokenization_spaces": False,
    "model_max_length": 8192,
}
json.dump(cfg, open(f"{CKPT}/tokenizer_config.json", "w"), ensure_ascii=False, indent=2)
print("tokenizer_config.json 已写入")

# 6. 校验
from transformers import AutoTokenizer
tk = AutoTokenizer.from_pretrained(CKPT)
checks = {"<|begin_of_text|>": 151643, "<|im_end|>": 151647, "<|semantic:0|>": 151658}
ok = True
for t, expect in checks.items():
    got = tk.convert_tokens_to_ids(t)
    flag = "OK" if got == expect else "!!MISMATCH!!"
    if got != expect:
        ok = False
    print(f"  {t}: got={got} expect={expect} {flag}")

# 往返（英文 + 中文）
for s in ["Hello world.", "你好，世界。"]:
    ids = tk.encode(s, add_special_tokens=False)
    back = tk.decode(ids)
    rt = "OK" if back == s else f"!!ROUNDTRIP DIFF: {back!r}!!"
    if back != s:
        ok = False
    print(f"  encode {s!r} -> {len(ids)} toks, decode={back!r} {rt}")

from fish_speech.tokenizer import FishTokenizer
ft = FishTokenizer.from_pretrained(CKPT)
print("  FishTokenizer semantic range:", ft.semantic_begin_id, "->", ft.semantic_end_id,
      "(expect 151658 -> 155753)")
if not (ft.semantic_begin_id == 151658 and ft.semantic_end_id == 155753):
    ok = False

print("RESULT:", "ALL_OK" if ok else "HAS_ISSUES")
sys.exit(0 if ok else 1)
