# Aiflow 智流

> 全栈可视化 AI 工作流编排平台 —— 通过拖拽式节点编排，快速构建、测试和部署复杂 AI 工作流。

Aiflow 智流 旨在降低 AI 应用开发门槛，让开发者和业务人员能通过直观的画布交互，组合 LLM、RAG、条件分支等能力，搭建端到端的 AI 处理流程，并实时观察每个节点的执行状态。

## 功能特性

### 可视化工作流编排
- 基于 React Flow 的拖拽式画布，支持节点自由拖拽、缩放、连线
- 丰富的节点类型：
  - **用户输入节点**：声明式接收终端用户输入字段
  - **LLM 节点**：自定义系统提示词、任务指令、模型、温度，支持自动/自定义 Prompt 模板
  - **RAG 检索节点**：从知识库召回相关文档作为上下文
  - **RAG 写入节点**：直接调用大模型生成结构化内容并写入知识库
  - **条件分支节点**：可视化配置判断条件，True/False 双分支分流
  - **技能/工具节点**：调用内置工具或自定义技能（MCP 协议）
  - **输出节点**：汇聚最终结果
- 撤销/重做（双栈实现）
- 变量引用系统：`{{nodeId.fieldName}}` 模板语法，下拉选择器自动列出上游可用变量，并以标签展示已引用变量

### RAG 知识库管理
- 文档全生命周期管理：上传、切片、向量化、检索
- 检索测试工具，编排前即可验证召回效果
- 支持 writeRag 节点动态构建知识库（大模型生成 + 自动写入）

### 工作流执行引擎
- 基于 Kahn 拓扑排序的 DAG 调度，自动检测环路
- 变量池（VariablePool）按需解析，节点间显式声明数据依赖
- SSE 流式推送每个节点的执行状态，前端实时可见
- 条件分支运行时 True/False 分流，跳过不可达路径

### 调试中心
- AI 聊天：关联知识库的对话问答，附带参考文档与相似度
- 工作流执行可视化：逐节点状态追踪、最终输出文本化渲染


## 技术栈

### 前端（AIflow-frontend）
| 类别 | 技术 |
|------|------|
| 核心框架 | React 18 + Vite 5 |
| 状态管理 | Zustand |
| UI 组件库 | Ant Design 5 |
| 流程图引擎 | react (React Flow) 12 |
| 样式方案 | Tailwind CSS |
| 路由 | React Router v6 |
| 流式响应 | eventsource-parser（SSE 解析） |
| Markdown 渲染 | react-markdown |

### 后端（AIflow-backend）
| 类别 | 技术 |
|------|------|
| 核心框架 | NestJS 10 |
| 数据库 | Prisma ORM + SQLite |
| 认证安全 | JWT + Passport + bcryptjs |
| 参数校验 | Zod / class-validator |
| MCP 协议 | @modelcontextprotocol/sdk |
| HTTP 安全 | Helmet |
| 文件上传 | Multer |

## 项目结构

```text
aiflow-studio-main/
├── AIflow-frontend/              # 前端工程
│   ├── src/components/workflow/  # 工作流画布、节点、配置面板
│   ├── src/pages/                # 业务页面（调试中心、知识库、技能等）
│   ├── src/store/                # Zustand 状态切片
│   ├── src/router/               # 路由配置
│   ├── src/types/                # TypeScript 类型定义
│   └── src/utils/                # 工具函数（上游变量计算、SSE 解析等）
└── AIflow-backend/               # 后端工程
    ├── src/modules/              # 业务模块（AI、Workflow、RAG、User、Skill、MCP）
    ├── src/common/               # 公共组件（过滤器、拦截器、守卫、装饰器）
    ├── src/config/               # 环境变量配置
    └── prisma/                   # 数据库 Schema 与种子数据
```



- **拓扑排序**：Kahn 算法确定节点执行顺序，自动检测环路
- **变量池**：每个节点输出写入池中，下游通过 `{{nodeId.field}}` 显式引用
- **条件分流**：运行时求值，只执行命中分支，跳过不可达路径
- **SSE 推送**：每个节点开始/完成/失败事件实时推送到前端

## 快速开始

### 环境要求
- Node.js v18+
- npm v9+

### 后端启动
```bash
cd AIflow-backend
npm install
cp .env.example .env          # 配置环境变量（务必填入 LLM_API_KEY）
npx prisma db push             # 同步数据库结构
npx prisma db seed             # 写入演示数据
npm run start:dev              # 启动开发服务器（默认 3000 端口）
```

### 前端启动
```bash
cd AIflow-frontend
npm install
npm run dev                    # 启动开发服务器（默认 5173 端口）
```

浏览器访问 http://localhost:5173 即可开始编排。

### 默认账号（演示用）
- 用户名：`admin`
- 密码：`admin123`

## 核心优化

### 构建优化
- **gzip + brotli 双压缩**：10KB 以上产物自动压缩，Nginx 按需分发
- **Chunk 体积监控**：自研 chunkBudgetPlugin，超阈值构建告警
- **代码分割**：路由级懒加载，按业务语义拆分 Chunk
- **构建分析**：rollup-plugin-visualizer 生成依赖可视化报告

### 执行引擎优化
- 拓扑排序保证执行顺序，环检测避免死循环
- 显式变量引用，节点间数据解耦，禁止隐式全量读取
- SSE 流式推送，前端实时感知每个节点状态

### 前端体验优化
- Zustand 受控画布，画布操作与全局状态原子同步
- 撤销/重做双栈实现，操作可回溯
- 变量选择器：已引用变量以标签展示，未引用变量下拉可选
- 条件分支画布显示 True/False 标签与条件摘要

### LLM 调用优化
- maxTokens 可选配置：留空则由模型自由控制输出长度，避免人为截断
- finish_reason 截断检测：输出达上限时打印警告，便于排查
- model 参数环境变量回退：空值自动读取 LLM_MODEL，避免 API 报错
- 自动/自定义 Prompt 模板：自动模式检测上游 RAG 节点并构建结构化提示词

## 验证 RAG（最短路径）
1. 使用默认账号登录
2. 打开「知识库管理」，确认存在「默认知识库」及演示文档
3. 打开「调试中心」→「AI 聊天」，关联知识库选择「默认知识库」
4. 发送问题：`Aiflow 智流 有什么核心特性？`
5. 查看返回结果下方的「参考文档」区域，可见命中文档片段与相似度




