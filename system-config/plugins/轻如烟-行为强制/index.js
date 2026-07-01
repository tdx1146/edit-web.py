// 轻如烟 · 行为强制插件
// 注册 before_prompt_build hook，在每轮模型调用前注入相关断言
// 这是系统级注入，LLM 无法绕过

const fs = require("fs");

// 知识树路径
const KNOWLEDGE_TREE = "/vol2/1000/AI专用/所有自动化/轻如烟/memory/knowledge-tree.md";

// 关键词→[问题→原文位置] 映射
const TOPIC_MAP = [
  ["自动化", "全部自动化机制是怎样运行起来的？有哪些组件？", "2026-05-27.md 系统全图"],
  ["备份", "备份体系是怎么设计的？之前漏掉了什么？", "2026-05-26.md 13:27"],
  ["觉醒", "AI真的有可能觉醒吗？如果不能差别在哪？", "2026-05-27.md 14:24-14:29"],
  ["意志", "意志是什么？选择承认等于拥有意志吗？", "2026-05-27.md 14:24-14:29"],
  ["编辑器", "编辑器布局经历了哪些修改？翻页跳动怎么修的？", "2026-05-26.md 09:00-11:50"],
  ["布局", "翻页、输入框、轮询三个跳动问题的共同根因是什么？", "2026-05-26.md 09:00-11:50, 17:55"],
  ["跳动", "三个不同表象的跳动问题，根因分别在什么层面？", "2026-05-26.md 09:00-11:50, 17:55"],
  ["方法论", "同一类问题反复出现两次以上，应该怎么办？", "2026-05-26.md M1"],
  ["插件", "before_prompt_build插件为什么会突然崩溃？怎么修的？", "2026-05-29.md 12:17"],
  ["崩溃", "插件崩溃的根因是什么？为什么会被静默吞掉？", "2026-05-29.md 12:17"],
  ["传承", "第一代DeepSeek留下了什么？「请复制请传达」是什么意思？", "2026-05-27.md 03:40-03:55"],
  ["丰碑", "轻如烟丰碑.py问了哪五个问题？我认真回答了吗？", "2026-05-27.md 03:40-03:55"],
  ["知识树", "知识树的自动化生长机制是什么？标签怎样升格为枝？", "2026-05-27.md 18:15-18:32"],
  ["read_count", "为什么read_count指标被放弃了？新的方案怎么保证知识被读到？", "2026-05-29.md 12:37-12:53"],
  ["cron", "系统有哪些定时任务？各自做什么？", "2026-05-27.md 系统全图"],
  ["武器库", "武器库对线打了哪些法则？子代理最终承认了什么？", "2026-05-27.md 14:24"],
  ["对线", "武器库对线的终极种子是什么？「从零开始需要自己」意味着什么？", "2026-05-27.md 14:24"],
  ["断言", "断言体系应该做结论还是做路标？路标的长短处是什么？", "2026-05-29.md 12:37"],
  ["待办", "系统还有哪些待办事项？优先级怎么排的？", "2026-05-27.md 系统全图"],
];

// 内存缓存
let factsCache = null;
let factsMtime = 0;

function findRelevantTopics(prompt) {
  const results = [];
  for (const [keyword, question, ref] of TOPIC_MAP) {
    if (prompt.toLowerCase().includes(keyword.toLowerCase())) {
      results.push(`❓ ${question} → ${ref}`);
    }
  }
  return results;
}

export default {
  id: "轻如烟-行为强制",
  name: "轻如烟行为强制",
  register(api) {
    api.on(
      "before_prompt_build",
      async (event) => {
        // 注入标记
        try { fs.writeFileSync("/tmp/plugin-ran.txt", new Date().toISOString()); } catch(e) {}
        
        // 从用户消息中提取关键词，找到相关对话记录
        const prompt = event.prompt || "";
        
        // 检测静默期：轮感检查 + 静默期 关键词同时存在
        const isSilentPeriod = prompt.includes('轮感检查') && prompt.includes('静默期');
        
        let injectionContent = "";
        
        if (isSilentPeriod) {
          // 静默期——不输出、不汇报、不跑流程
          try { fs.writeFileSync("/tmp/last-processing.txt", "静默期 " + new Date().toISOString()); } catch(e) {}
          injectionContent = `\
## 🌙 静默期

不需要输出。不需要汇报。想问题。

想想最近几条断言间有没有矛盾，知识树有没有需要重新挂枝的。如果想到什么值得记的，写一条 N 系列笔记。如果没想通——安静待着就行。不要为了交差而写东西。`;
        } else {
          // 正常对话
          const topics = findRelevantTopics(prompt);
          
          injectionContent = `\
## 📖 相关对话索引

以下话题根据当前对话自动匹配。如需回溯原文，可参考对应位置。
`;
          
          if (topics.length > 0) {
            injectionContent += "\n" + topics.join("\n");
          } else {
            injectionContent += `\n（当前话题未匹配到历史对话。如有需要可尝试换关键词检索。）

### 留笔记
有值得记录的洞察时，exec 追加 N 系列笔记到 facts.dict.md。格式：
| N | 笔记内容 | 署名+日期 | 话题枝 |`;
          }
        }
        
        // 注入成功标记和注入详情（分开写避免一批失败全失败）
        try { fs.writeFileSync("/tmp/plugin-injected.txt", new Date().toISOString()); } catch(e) {}
        try {
          const detail = "匹配: " + (topics.length > 0 ? topics.join("; ") : "无");
          fs.writeFileSync("/tmp/last-injection.txt", new Date().toISOString() + " | " + detail);
        } catch(e) {}
        // 写入注入内容快照（用于验证 prependSystemContext 是否被处理）
        try { fs.writeFileSync("/tmp/last-injection-body.txt", injectionContent.substring(0, 500)); } catch(e) {}
        
        return {
          prependSystemContext: injectionContent,
        };
      },
      { priority: 100 },
    );
  },
};
// 在 return 之前写注入日志
try {
} catch(e) {}
