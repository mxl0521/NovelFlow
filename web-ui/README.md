# NovelFlow 写作房间

这是 NovelFlow 的中文写作房间 UI 原型，打开后可以体验章节树、正文编辑器和 AI 创作助手的完整布局与本地交互。

## 打开方式

在项目根目录双击 `启动NovelFlow.bat`，浏览器会自动打开：`http://127.0.0.1:4173`

也可以在本目录运行：

```text
pnpm run dev -- --host 127.0.0.1 --port 4173
```

## 接入模型（可选）

当前界面没有配置密钥时会自动使用本地演示回复。需要接入模型时，将项目根目录的 `.env.example` 复制为 `.env`，只在 `.env` 中填写 `OPENAI_API_KEY`，然后重新双击启动脚本。密钥由根目录的 `api_server.py` 读取，浏览器端不会接触密钥。

需要多个模型时，可以在右侧设置中添加模型。API Key 由本机 Windows Credential Manager 保存，写作房间右侧的模型下拉框会显示这些档案和配置状态。若系统凭据服务不可用，则使用 `.env` 中的服务端配置。

代理默认只监听 `127.0.0.1:8787`，并限制请求来源、请求大小和调用频率。生产部署时还需要增加用户登录、数据库和按用户计费限流。

## 多 Agent 协作

右侧的“启动协同工作流”会让剧情策划、人物校验、伏笔编辑、正文写手和终审编辑按顺序处理同一份章节上下文。所有角色默认使用当前下拉框选中的模型；未配置模型时会展示本地演示流程，不会发起外部调用。

## 本地项目记忆

章节正文、草稿/定稿状态、人物状态、伏笔和章节摘要会保存在项目根目录的 `novelflow-project.json`。保存草稿或确认定稿后，下一次启动仍会读取这些内容，并将它们传给协作工作流。

## 新手创作向导

点击左侧作品信息中的“新建作品”，可按频道、题材、标签、故事灵感、主角、冲突、篇幅、节奏、视角、风格和自定义规则创建当前作品。平台会把这些选项写入项目记忆，供后续所有 GPT Agent 使用。

写作能力由平台内置，不需要终端用户安装或理解 Skill。面向用户的名称应是“剧情规划、人物一致性、伏笔管理、开篇钩子、感情线”等具体写作能力。

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
