# 项目移交说明 · PROJECT HANDOFF

项目名称：ai-video-workstation

项目定位：
AI 视频生产工作台。

这不是单一“AI 生图工具”或“自动剪辑工具”。

项目目标是建立完整 AI 视频生产链：

```
内容/脚本
↓
导演理解
↓
Narrative Beat
↓
视觉动作拆解
↓
Narrative Shot
↓
Image Budget Planner
↓
ImageTask
↓
Provider Prompt
↓
批量生图
↓
Score QC
↓
Visual QC
↓
Repair
↓
媒体资产池
↓
AI 自动剪辑
↓
Edit Plan
↓
EditGraph
↓
Timeline
↓
OpenCut / ZoomPan
↓
字幕 / 配音 / 音乐 / 转场
↓
Render
↓
最终视频
```

==================================================

## 一、项目当前核心原则

==================================================

1. 不允许按照“视频时长 ÷ 单镜头时长”机械计算镜头数量。

旧逻辑：

```
shotCount = ceil(duration / shotDuration)
```

已经废弃。

视频时长只提供生产上下文。

镜头数量必须来自真实叙事和视觉动作。

2. 图片数量与镜头数量必须分离。

Shot != ImageTask

一个 Narrative Shot 是摄影表达。

一个 ImageTask 是一次生图任务/视觉资产生产单元。

允许：

```
1 Shot → 1 ImageTask
N Shot → 1 ImageTask
1 ImageTask → N Timeline Clip
```

禁止默认：

```
1 Shot = 1 Image = 1 Clip
```

3. Image Budget 是成本预算，不是镜头数量。

当前模式：

```
省钱
标准
高质量
自定义
```

8 分钟基准图片预算：

```
省钱：28
标准：45
高质量：70
```

其他时长按比例缩放。

Image Budget Planner 负责：

```
Narrative Shot[]
↓
分析视觉复用关系
↓
生成 ImageTask[]
```

必须满足：

```
ImageTasks.length <= imageBudget
```

Planner 只能合并 ImageTask。

Planner 禁止删除 Narrative Shot。

Planner 禁止减少故事视觉事件。

4. Narrative Shot 数量由视觉叙事决定。

禁止为了满足 imageBudget 减少 Shot。

禁止为了降低 oneToOneMappingRatio 强制合并 Shot。

oneToOneMappingRatio 仅作为审计指标。

不是质量 KPI。

5. 当前阶段严禁修改剪辑层。

剪辑层必须先完成真实代码审计。

禁止根据文件名猜测模块功能。

==================================================

## 二、当前已完成升级

==================================================

PHASE 1
Shot Count / Image Budget 分离

已完成。

新增：

```
app/lib/shot-control/image-budget.ts
```

Image Budget 模式：

```
省钱
标准
高质量
自定义
```

buildShotPlan() 已重写。

当前输出核心字段：

```
targetDurationMinutes
targetDurationSec
imageBudget
imageBudgetMode
```

旧 shotCount / shotDurationSec 不再作为镜头规划依据。

工作台状态新增：

```
imageBudget
imageBudgetMode
```

旧项目 hydrate 时自动补全预算。

VideoSettingsPanel 已调整。

视频时长：

```
1
3
5
8
10
15 分钟
+
手动输入
```

图片预算：

```
省钱
标准
高质量
自定义
```

==================================================

## 三、旧 Narrative Shot 问题

==================================================

第一次审计发现：

Beat 层和 Shot 层存在严重机械拆分。

旧结果：

```
Narrative Beat = 64
Narrative Shot = 71
```

平均：

```
1.11 Shot / Beat
```

根因：

规则 fallback 按段落/句子机械切分。

实际表现类似：

```
段落 = Beat
句子 = Shot
```

不是 GPT 路径设计目标。

==================================================

## 四、Narrative Beat 修复

==================================================

Narrative Beat 已重新定义。

Beat 不是：

```
句子
段落
单一信息点
```

Beat 是：

完整微型剧情过程。

例如：

“进入果园检查苹果并发现异常”

这是一个 Beat。

Beat 内允许包含：

```
beatGoal
actionProcess
reactionProcess
informationReveal
visualProgression
```

8 分钟脚本目标：

约 8～20 个 Narrative Beat。

当前 fixture 测试结果：

```
Narrative Beat = 9
```

说明 Beat 层已经从：

```
64 句级 Beat
```

修复为：

```
9 个章节级/微型剧情 Beat
```

当前结论：

Beat 层通过。

不要重新拆 Beat。

==================================================

## 五、Narrative Shot 第一轮问题

==================================================

Beat 修复后：

```
Narrative Beat = 9
Narrative Shot = 68
```

但审计发现：

Shot 仍然机械。

部分 Beat：

actionProcess 中每一个句子直接生成一个 Shot。

存在：

```
1 actionProcess sentence → 1 Shot
```

部分 reaction / informationReveal 使用模板补镜。

存在大量：

```
果园局部画面变化
环境细节
人物反应
空 action 镜头
```

结论：

Beat 已修。

Shot 未真正视觉化。

==================================================

## 六、Visual Action Decomposition

==================================================

为解决 Shot 机械拆分问题，新增视觉动作层。

当前架构：

```
Narrative Beat
↓
deriveBeatProcess()
↓
Visual Action Decomposition
↓
VisualActionUnit[]
↓
Narrative Shot Director
↓
NarrativeShot[]
```

核心原则：

Narrative Shot 不能直接来自：

```
sourceText
actionProcess sentence
旁白句子
```

必须先理解：

这段剧情在画面中实际发生什么。

然后拆成：

可拍摄的视觉动作单元。

==================================================

## 七、VisualActionUnit 定义

==================================================

核心 Schema 文件：

```
app/lib/narrative/visual-action-types.ts
```

VisualActionUnit 当前包含/扩展过的语义：

```
startState
endState
location
evidenceOf
reaction {
    subject
    visibleBehavior
}
```

以及：

```
subject
visibleAction
object
visualFocus
cameraIntent
sourceRef
sourceIntent
type
```

Visual Action 类型包括：

```
establish
action
detail
reaction
reveal
transition
```

核心原则：

visibleAction 必须是摄像机可以拍到的行为或状态。

禁止抽象词直接成为画面：

```
发现
意识到
决定
害怕
担心
受到压力
生态变化
情况恶化
```

这些必须转成视觉证据。

例如：

“发现农药破坏生态”

不能生成：

```
果园局部画面变化
```

应该生成：

```
翻阅农业资料
↓
手指停在药剂使用记录
↓
枯黄叶片上的死昆虫
↓
裸土没有活虫
↓
对照笔记
↓
主角视线停住/眉头紧锁
```

==================================================

## 八、Abstract Narrative Visualizer

==================================================

当前新增：

```
abstract-narrative-visualizer.ts
```

职责：

识别抽象叙事意图。

包括：

```
decision
realization
fear
social_pressure
以及其他抽象 Narrative Intent
```

然后转换成可拍摄证据。

例如：

STOP_USING_PESTICIDE

原文：

“他决定彻底停止使用农药”

视觉化：

```
关闭喷雾器阀门
↓
卸下肩上喷雾器
↓
放到仓库角落
↓
关上仓库门
```

例如：

WIFE_FINANCIAL_FEAR

原文：

“妻子担心全家人的生活来源”

视觉化：

```
妻子坐在餐桌
↓
翻账本
↓
手指停在欠款数字
↓
看桌上少量现金
↓
看向窗外果园
↓
握紧账本边缘
```

==================================================

## 九、Narrative Shot Director

==================================================

核心文件：

```
shot-director.ts
```

当前职责：

```
VisualActionUnit[]
↓
NarrativeShot[]
```

当前已经允许：

```
1 VisualActionUnit → N Shot
N VisualActionUnit → 1 Shot
```

禁止严格 1:1 映射。

允许自然 1:1。

Narrative Shot 当前核心字段：

```
shotId
beatId
character
action
reaction
camera
visualFocus
shotPurpose
narrationRef
```

Narrative Shot 是摄影表达层。

VisualActionUnit 是视觉事件原子层。

两者禁止混为一层。

==================================================

## 十、Narrative Shot 当前审计结果

==================================================

当前 fixture 全量 QA：

```
visualActionUnitCount: 142
shotCount: 140

unitToShotRatio: 0.986
oneToOneMappingRatio: 0.986
```

以下指标全部为 0：

```
genericVisualActionCount
abstractReactionCount
subjectMismatchCount
reactionSubjectMismatchCount
duplicateVisualUnitCount
semanticLossCount
textCopyShotCount
actionTooLongCount
multiActionShotCount
emptyReactionActionCount
weakActionShotCount
```

当前：

```
cameraMonotonyCount = 32
```

注意：

cameraMonotony 当前只是人工检查项。

不要立即修改 Narrative Shot。

必须先审计剪辑层是否已经负责镜头节奏和图片运动。

==================================================

## 十一、BEAT_003 重点审计

==================================================

BEAT_003：

第二章：拒绝农药

当前四段核心剧情已经实现静音可理解。

A. 农药破坏生态

sourceIntent:

PESTICIDE_HARMS_ECOSYSTEM

Visual Action：

```
木村翻阅农业资料
↓
手指停在药剂记录页
↓
枯黄叶片上的死昆虫
↓
树根裸土没有活虫
↓
对照笔记
↓
视线停住/眉头紧锁
```

Narrative Shot：

```
资料记录
↓
死昆虫
↓
裸土
↓
人物反应
```

B. 停止使用农药

sourceIntent:

STOP_USING_PESTICIDE

Visual Action：

```
关闭喷雾器阀门
↓
卸下喷雾器
↓
放到仓库角落
↓
关闭仓库门
```

形成连续视觉决定。

C. 邻居嘲笑

sourceIntent:

NEIGHBORS_MOCK

Visual Action：

```
邻居站在篱笆外
↓
指向果园
↓
相互发笑
↓
木村停止修剪
↓
转头
↓
低头继续工作
```

形成：

```
社会压力
↓
主角反应
↓
主角选择
```

D. 妻子担心生计

sourceIntent:

WIFE_FINANCIAL_FEAR

Visual Action：

```
妻子坐在餐桌
↓
翻账本
↓
停在欠款数字
↓
看少量钞票
↓
望向果园
↓
握紧账本
```

形成完整视觉情绪表达。

当前结论：

BEAT_003 已达到静音视觉可理解。

==================================================

## 十二、ImageTask 架构

==================================================

ImageTask 已从 Storyboard / Shot 中分离。

核心目录：

```
app/lib/image-task/
```

当前 Schema：

```
type ImageTask = {
    imageTaskId: string
    primaryShotId: string
    supportingShotIds: string[]
    sourceShotIndexes: number[]
    character: string
    actionCoverage: string[]
    environment: string
    cameraIntent: string
    visualFocus: string[]
    priority: "critical" | "normal" | "support"
    budgetReason: string
    providerPrompt?: string
}
```

映射结构：

```
type ImageTaskMapping = {
    shotToImageTaskMap: Record<string, string>
    imageTaskToShotIds: Record<string, string[]>
}
```

例如：

```
SHOT_001 → IMAGE_TASK_001

IMAGE_TASK_001 → [
    SHOT_001,
    SHOT_002,
    SHOT_003
]
```

==================================================

## 十三、ImageTask Compatibility Adapter

==================================================

已建立兼容 Adapter。

包括：

```
build-compat-tasks.ts
adapt-generation-input.ts
generate-provider-prompt-for-task.ts
resolve-frames.ts
sync-dual-write.ts
```

作用：

旧链路暂时继续工作。

新链路逐步迁移 ImageTask。

当前兼容读取逻辑：

```
shotId
↓
imageTaskId
↓
frame
```

如果新结构不存在：

```
fallback shotFrames[]
```

当前部分链路采用 dual write：

```
imageTaskFrames[imageTaskId]
```

同时兼容：

```
shotFrames[shotIndex]
```

禁止现在删除 legacy。

==================================================

## 十四、Image Budget Planner

==================================================

当前已存在：

```
app/lib/image-task/plan-budget.ts
```

目标：

```
NarrativeShot[]
+
imageBudget
↓
ImageTask[]
```

Planner 必须理解：

```
primaryShot
supportingShots
actionCoverage
visualFocus
cameraIntent
```

Planner 的工作不是删 Shot。

Planner 的工作是：

判断哪些 Shot 可以共享视觉资产。

例如：

```
同一人物
同一场景
连续动作
视觉构图接近
可通过裁切/ZoomPan/时间线重新表达
```

可以合并到一个 ImageTask。

必须保证：

```
ImageTasks.length <= imageBudget
```

同时：

Narrative Shot 数量保持不变。

==================================================

## 十五、生图链

==================================================

当前生产链设计：

```
ImageTask
↓
Provider Prompt
↓
Generate
↓
Score QC
↓
Visual QC
↓
Repair
↓
最终 Frame / Asset
```

相关模块/路径曾涉及：

```
generate-provider-prompts
generate-provider-prompt-for-task.ts
run-batch-images.ts
generate-shot-frame.ts
runTieredShotPipeline
score-assets
visual-qc
repair
```

当前 ImageTask Prompt 应综合：

```
primaryShot
supportingShots
actionCoverage
visualFocus
cameraIntent
character
environment
```

禁止重新按照 Storyboard index 机械生图。

当前生图循环已经迁移为：

```
for (task of imageTasks)
```

而不是：

```
for (prompt index)
```

当前要求：

生图 API 调用数量 = ImageTask 数量

不是 Narrative Shot 数量。

==================================================

## 十六、当前真实生产方向

==================================================

项目主要生产模式当前重点是：

```
静态 AI 图片
+
图片运动
+
字幕
+
配音
+
音乐
+
自动剪辑
```

不是要求每个镜头生成 I2V 真视频。

同一张图片允许通过：

```
Zoom
Pan
Crop
Scale
Position
Duration
不同 Timeline Clip
```

形成不同镜头表达。

因此：

```
1 ImageTask
↓
1 Image Asset
↓
N Narrative Shot
↓
N Timeline Clip
```

理论上成立。

但必须审计当前真实剪辑代码是否真正支持。

==================================================

## 十七、剪辑层已知模块

==================================================

项目历史存在以下模块/概念：

AI Director

Material Center

Video Creation

Image / Video Generation

Voice Center

Subtitle Center

EditGraph v2

AI Cut v3

QA Center

Music Center

Special Effects Center

OpenCut

ZoomPan

Timeline

Render

FFmpeg

AI Cut 设计目标：

```
Director Plan
+
Clip Agent
+
OpenCut
```

EditGraph v2 设计目标：

多轨时间线执行图。

但注意：

这些是历史设计和已有代码概念。

禁止直接认为全部已经真实接通。

必须根据真实代码审计。

==================================================

## 十八、当前剪辑层禁区

==================================================

用户明确要求：

不要修改剪辑层。

先查完整剪辑层真实工作方式。

当前 Narrative Shot 修复过程中：

```
runAutoEditPipeline
generateEditPlan
AI Cut
EditGraph
Timeline
OpenCut
ZoomPan
Render
FFmpeg
```

全部禁止修改。

必须先完成只读审计。

==================================================

## 十九、当前最后停留点

==================================================

Narrative Shot 第三轮审计已完成。

当前结论：

```
Narrative Beat：通过

Abstract Narrative Visualizer：通过

Visual Action Decomposition：通过

VisualActionUnit：通过

Narrative Shot Director：基本通过

Image Budget：已与 Shot Count 分离

ImageTask：已建立独立实体

ImageTask Compatibility Adapter：已建立

生图入口：已经开始迁移 ImageTask

剪辑层：尚未进行本轮真实架构审计
```

当前唯一明显审计项：

```
cameraMonotonyCount = 32
```

禁止现在直接修 cameraMonotony。

原因：

必须先判断现有剪辑层是否消费：

```
camera
shotPurpose
visualFocus
```

以及是否已经通过：

```
ZoomPan
Crop
Scale
Position
Edit Plan
AI Cut
```

处理镜头表达和节奏。

==================================================

## 二十、Claude 接手后的第一任务

==================================================

不要写代码。

不要修改代码。

不要重构。

不要新增模块。

不要删除 legacy。

不要进入生图优化。

不要继续修改 Narrative Shot。

第一任务：

执行“现有剪辑层全量架构与真实执行链审计”。

必须基于真实代码。

禁止根据文件名猜测。

重点搜索：

```
runAutoEditPipeline
generateEditPlan
AI Cut
EditGraph
Timeline
OpenCut
ZoomPan
build-sequence
build-media-pool
run-orchestrator
run-director-pipeline
render
FFmpeg
```

以及：

```
字幕轨
配音轨
音乐轨
转场
镜头时长
镜头节奏
camera
shotPurpose
visualFocus
```

必须输出真实链：

```
Narrative Shot
↓
ImageTask
↓
生图 / QC / Repair
↓
资产
↓
剪辑入口
↓
Edit Plan
↓
AI Cut
↓
EditGraph
↓
Timeline
↓
OpenCut
↓
ZoomPan
↓
字幕
↓
配音
↓
音乐
↓
转场
↓
Render
↓
最终视频
```

对每层输出：

1. 模块名称
2. 真实文件路径
3. 输入数据
4. 输出数据
5. 核心函数
6. 上游调用者
7. 下游消费者
8. 是否真实执行
9. 是否 Mock
10. 是否 Legacy
11. 是否断链
12. 是否重复实现

必须明确回答：

A. 当前 AI 自动剪辑是否真的执行？

B. runAutoEditPipeline 的真实入口在哪里？

C. generateEditPlan 是否消费 Narrative Shot？

D. camera 是否被剪辑层消费？

E. shotPurpose 是否被剪辑层消费？

F. visualFocus 是否被剪辑层消费？

G. cameraMonotony 应该由 Narrative Shot 修，还是剪辑层处理？

H. 当前 140 个 Narrative Shot 是否最终变成 140 个 Timeline Clip？

I. ImageTask 与 Timeline Clip 的真实映射关系是什么？

J. 一个 ImageTask 被多个 Shot 复用时，剪辑层能否生成多个 Clip？

K. ZoomPan 是否可以让同一图片生成不同镜头表达？

L. AI Cut 是否执行：

```
clip selection
duration planning
rhythm planning
shot ordering
transition planning
zoom/pan planning
```

M. EditGraph 是真实执行图还是数据结构？

N. OpenCut 是真实剪辑执行器，还是 UI / Adapter / 未接通？

O. 最终 Render 的唯一真实入口是什么？

==================================================

## 二十一、必须输出的审计文档

==================================================

《现有剪辑层真实架构图》

《真实执行链》

《断链点》

《重复实现》

《Mock / Legacy 清单》

《Narrative Shot 字段消费矩阵》

字段至少：

```
shotId
beatId
character
action
reaction
camera
visualFocus
shotPurpose
narrationRef
imageTaskId
```

消费模块：

```
AI Cut
Edit Plan
EditGraph
Timeline
ZoomPan
OpenCut
Render
```

只允许标：

```
READ
WRITE
IGNORE
UNKNOWN
```

最后必须给出结论：

1. 现有剪辑层是否可以直接承接新版 Narrative Shot

2. 哪些 Narrative Shot 字段已经被利用

3. 哪些字段完全浪费

4. cameraMonotony 应在哪一层解决

5. 是否需要升级剪辑层

6. 如果需要升级，只指出最小升级边界

完成审计后停止。

等待确认。

禁止直接开始修改剪辑层。
