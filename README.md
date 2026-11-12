# BGA 回放快捷栏

为 Board Game Arena（BGA）的原版回放增加底部快捷栏，保留原版棋盘和玩家视角。已在 Chrome 的《方舟动物园》三人局验证回放页和预览流程。

**English** — BGA Replay Toolbar adds keyboard shortcuts and a toolbar to Board Game Arena replays while keeping the original board and player perspective. Step backward or forward, play until the next player starts their turn, or preview public actions in Chinese before jumping to a specific step. Tested in Chrome with a three-player Ark Nova replay.

| 按键 | 操作 |
| --- | --- |
| ← 或数字小键盘 4 | 上一步 |
| → 或数字小键盘 6 | 下一步 |
| Enter | 播放到下一位玩家开始行动 |

输入步数后，先查看目标步及前后各两条带文字的公开行动，再点「确认跳转」。向后跳转会重新载入原版回放，因此比前进慢。预览翻译常见行动模板；玩家昵称保留原样，未收录的专有名称和新模板可保留原文。

## 安装

1. Chrome 安装 [Tampermonkey](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)，并在扩展详情中开启「允许运行用户脚本」。
2. 在仓库里打开 [bga-replay.user.js](bga-replay.user.js)，点 **Raw**。如果没有弹出安装页，在 Tampermonkey 新建脚本、粘贴完整源码并保存。
3. 打开一场已结束的 BGA 对局，点「观看游戏重播」，选择玩家视角，刷新棋盘页。
4. 输入步数后，可以从预览面板导入该局的 BGA 原始回放 JSON。导入仅用于本机预览；没有日志也能使用快捷键和确认跳转。

安装与使用须遵循 BGA 原有的登录和回放访问权限。本项目与 BGA 无官方关联。

## 文件

- `bga-replay.user.js`：可直接安装的通用脚本，无需构建。
- `demo/`：完全虚构的演示数据。在仓库根目录运行 `python3 -m http.server 8000`，然后打开 `http://localhost:8000/demo/`。
- `CHANGELOG.md`：版本记录。

通用脚本不包含真实对局数据、账号信息或部署配置。脚本只在 BGA 回放页运行；导入的原始日志不会被上传，仅将用于预览的公开行动保留在当前浏览器会话中。

参考：[BGA Replay Auto-Next](https://gist.github.com/GhoulofGSG9/655015ed98256505692d136340b0865b) 和 [BGA replay with keys](https://github.com/yzemaze/bga-scripts/blob/main/replay-with-keys.user.js) 的公开控件定位方式。
