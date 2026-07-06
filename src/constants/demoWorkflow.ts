/**
 * 示例工作流数据：自纠错写作助手（条件分支选择「构建RAG」或「写作+自纠错」）
 *
 * 工作流结构（前面一个判断分出两条互斥分支，各自走到底，不汇合）：
 *
 *   开始 → 用户输入(topic) ─┐
 *          用户输入(buildRag) ─┘→ 条件1(判断 buildRag)
 *                              ├─ true  → 写入RAG → 输出(RAG构建完成)
 *                              └─ false → RAG检索 → LLM写作 → LLM纠错评分 → 条件2(质量是否达标)
 *                                                                          ├─ true  → 输出(最终稿)
 *                                                                          └─ false → LLM修改 → 输出(修改稿)
 *
 * 使用方法：
 *   1. 在「知识库」页新建一个知识库，把 writeRag 节点和 rag 节点的「知识库」都指向它（同一个）
 *   2. 第一次运行：调试输入 {"topic":"量子计算入门","buildRag":true} → 走 true 分支，自动生成资料写入知识库
 *   3. 第二次运行：调试输入 {"topic":"量子计算入门","buildRag":false} → 走 false 分支，检索RAG并写作+自纠错
 *
 * 说明：writeRag 节点直接调用已配置的 LLM，根据主题生成结构化资料后写入知识库；
 *       RAG 跨执行持久化，第一次构建后第二次可直接检索使用。
 */

export const DEMO_NODES = [
  {
    id: 'start_1',
    type: 'start',
    position: { x: 40, y: 340 },
    data: {
      label: '开始',
    },
  },
  {
    id: 'userInput_1',
    type: 'userInput',
    position: { x: 260, y: 280 },
    data: {
      label: '输入主题',
      inputField: 'topic',
    },
  },
  {
    id: 'userInput_2',
    type: 'userInput',
    position: { x: 260, y: 420 },
    data: {
      label: '是否构建RAG',
      inputField: 'buildRag',
    },
  },
  {
    id: 'condition_1',
    type: 'condition',
    position: { x: 480, y: 340 },
    data: {
      label: '是否构建RAG',
      conditions: [
        {
          variable: '{{buildRag}}',
          operator: '===',
          value: true,
        },
      ],
    },
  },
  // ===== true 分支：构建 RAG（上方）=====
  {
    id: 'writeRag_1',
    type: 'writeRag',
    position: { x: 720, y: 180 },
    data: {
      label: '写入RAG',
      knowledgeBaseId: '',
      content: '{{userInput_1.result}}',
    },
  },
  {
    id: 'output_1',
    type: 'output',
    position: { x: 960, y: 180 },
    data: {
      label: 'RAG构建完成',
      outputValue: '✅ 已将搜索资料写入知识库。\n\n{{writeRag_1.result}}',
    },
  },
  // ===== false 分支：写作 + 自纠错（下方）=====
  {
    id: 'rag_1',
    type: 'rag',
    position: { x: 720, y: 500 },
    data: {
      label: 'RAG检索',
      knowledgeBaseId: '',
      query: '{{userInput_1.result}}',
      topK: 5,
      similarityThreshold: 0.7,
    },
  },
  {
    id: 'llm_1',
    type: 'llm',
    position: { x: 960, y: 500 },
    data: {
      label: '写作',
      model: 'deepseek-chat',
      systemPrompt:
        '你是一位专业写作者。请围绕给定主题，参考提供的资料，撰写一篇结构清晰、内容充实的文章。',
      promptTemplate: 'custom',
      userPrompt:
        '写作主题：{{userInput_1.result}}\n\n参考资料：\n{{rag_1.result}}\n\n请围绕上述主题，结合参考资料，撰写一篇文章。',
      temperature: 0.7,
      maxTokens: 1024,
    },
  },
  {
    id: 'llm_2',
    type: 'llm',
    position: { x: 1200, y: 500 },
    data: {
      label: '纠错评分',
      model: 'deepseek-chat',
      systemPrompt:
        '你是写作评审专家。请评审文章初稿，指出事实错误、逻辑问题、表达不清之处，并给出修改建议。最后给出1-10的质量评分，并明确标注是否达标。',
      promptTemplate: 'custom',
      userPrompt:
        '写作主题：{{userInput_1.result}}\n\n参考资料：\n{{rag_1.result}}\n\n文章初稿：\n{{llm_1.result}}\n\n请评审上述初稿，给出修改建议。最后必须单独两行输出：\n评分：N（N为1-10的整数，7分及以上为达标）\n判定：【达标】或【不达标】',
      temperature: 0.3,
      maxTokens: 512,
    },
  },
  {
    id: 'condition_2',
    type: 'condition',
    position: { x: 1440, y: 500 },
    data: {
      label: '质量是否达标',
      conditions: [
        {
          variable: '{{llm_2.result}}',
          operator: 'contains',
          value: '【达标】',
        },
      ],
    },
  },
  {
    id: 'output_2',
    type: 'output',
    position: { x: 1680, y: 400 },
    data: {
      label: '输出最终稿',
      outputValue: '✅ 质量达标，最终稿如下：\n\n{{llm_1.result}}',
    },
  },
  {
    id: 'llm_3',
    type: 'llm',
    position: { x: 1680, y: 600 },
    data: {
      label: '修改',
      model: 'deepseek-chat',
      systemPrompt:
        '你是写作修改专家。请根据评审意见修改文章初稿，输出修改后的完整文章。',
      promptTemplate: 'custom',
      userPrompt:
        '写作主题：{{userInput_1.result}}\n\n参考资料：\n{{rag_1.result}}\n\n文章初稿：\n{{llm_1.result}}\n\n评审意见：\n{{llm_2.result}}\n\n请根据评审意见修改初稿，输出修改后的完整文章。',
      temperature: 0.5,
      maxTokens: 1024,
    },
  },
  {
    id: 'output_3',
    type: 'output',
    position: { x: 1920, y: 600 },
    data: {
      label: '输出修改稿',
      outputValue: '📝 质量未达标，已根据评审意见修改：\n\n{{llm_3.result}}',
    },
  },
]

export const DEMO_EDGES = [
  { id: 'e-start-input1', source: 'start_1', target: 'userInput_1' },
  { id: 'e-start-input2', source: 'start_1', target: 'userInput_2' },
  { id: 'e-input1-cond1', source: 'userInput_1', target: 'condition_1' },
  { id: 'e-input2-cond1', source: 'userInput_2', target: 'condition_1' },
  // condition_1 分支
  {
    id: 'e-cond1-writeRag',
    source: 'condition_1',
    target: 'writeRag_1',
    sourceHandle: 'true',
    label: '是(构建RAG)',
  },
  {
    id: 'e-cond1-rag',
    source: 'condition_1',
    target: 'rag_1',
    sourceHandle: 'false',
    label: '否(写作)',
  },
  // true 分支
  { id: 'e-writeRag-out1', source: 'writeRag_1', target: 'output_1' },
  // false 分支
  { id: 'e-rag-llm1', source: 'rag_1', target: 'llm_1' },
  { id: 'e-llm1-llm2', source: 'llm_1', target: 'llm_2' },
  { id: 'e-llm2-cond2', source: 'llm_2', target: 'condition_2' },
  // condition_2 分支
  {
    id: 'e-cond2-out2',
    source: 'condition_2',
    target: 'output_2',
    sourceHandle: 'true',
    label: '达标',
  },
  {
    id: 'e-cond2-llm3',
    source: 'condition_2',
    target: 'llm_3',
    sourceHandle: 'false',
    label: '不达标',
  },
  { id: 'e-llm3-out3', source: 'llm_3', target: 'output_3' },
]

/** 示例应用名称标记，用于识别是否已创建过 */
export const DEMO_APP_NAME = '📖 示例应用 — 自纠错写作助手'
