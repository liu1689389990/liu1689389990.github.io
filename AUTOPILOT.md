# 无人值守 SEO 内容流水线政策

## 范围
- 仅维护本静态站及其中文、英文版本；中文页面不得放入英文目录/英文频道，英文页面不得放入中文频道。
- 每周最多发布 1 个双语常青实用指南（中文与英文分别撰写，不机械翻译）。只处理 `content/editorial-backlog.json` 中的预设主题；遇到缺少权威来源或事实争议时，停止该主题并记录原因，不编造填空。
- 自动流程：选题 → 一手来源研究 → 双语原创稿 → 技术/来源检查 → 本地构建校验 → commit/push 到 `main` → 检查 GitHub Pages 的两个网址与 sitemap。未通过任一门禁不得发布。
- 每篇指南需具备：一个明确用户问题、原创步骤/决策清单、清楚的适用边界、最少 2 个直接相关的一手来源、独立中文/英文 title 与 description、canonical、双向 hreflang、自身语言导航/内链，以及风险提示。

## 不可绕过的门禁
- 不提供买卖建议、收益预测、投资回报承诺、金融产品推荐、规避监管/安全控制的指引；不陈述未经来源支持的数值、当前市场状态、费用或平台政策。
- 来源必须实际访问并核对；优先 Bitcoin.org、Bitcoin Developer Documentation、Ethereum.org、具体协议/服务官方文档或官方监管文件。摘要与引用不得冒充已实测。
- 英中稿分别校对事实与术语；任一语种事实不确定则本轮不得发布该主题。
- 新增页面必须进入 sitemap，必须能从对应语言页面的内部导航到达；不得制造相似关键词门页、批量低价值内容或堆砌词语。
- 自动上线只允许在本项目 `main` 分支经验证后正常提交、普通 push；禁止 force push、改写历史或提交无关文件。
- 发布后检查两条页面 URL 返回 200、canonical 对应页面、双向语言链接、sitemap 可解析。若 GitHub Pages 未及时更新，报告为“已推送、线上待发布/验证”，不可声称已上线。

## 分发与分析
- 网站是长期搜索入口；Telegram 是独立分发渠道。每次指南发布必须同步更新语言隔离的 `feed-zh.xml` 和 `feed-en.xml`（最新文章在前、最多保留 10 篇），并各自只列对应语言的 canonical URL。
- 已授权后台 worker 每日定时读取这两个专用 feed；中文指南只进入 `@CryptoDailyZH`，英文指南只进入 `@CryptoWeb3NewsDaily`，并生成相应语言的实用指南摘要和 UTM 链接。worker 只接受本域 `/guides/` 或 `/en/guides/` 页面，并在发送前执行语言—频道绑定校验；不得进入 `@aitoolku`、`@haodongxibiji` 或搜索交流群。RSS 新闻来源仍与原创指南分开。
- 只能依赖后台已授权且已配置的 Bot/目标，不能复制、读取或在本机保存 Token/session，也不能绕过后台。投递失败或结果不确定时，不得自动切换 Bot 或重发；以后台 `post_deliveries` 状态和 Telegram message ID 为准，不以 feed 入队作为送达证据。
- 不买流量/链接，不刷搜索、点击、订阅或互动，不自动私聊，不启用群轮替。
- Search Console/Analytics 数据只能在存在有效授权数据时引用；无数据就写“未连接/无数据”。不保证排名、点击或流量。

## 状态定义
- `queued`: 等待自动研究；`researching`: 收集来源；`draft`: 已起草但未过门禁；`blocked`: 记录明确阻塞原因；`published`: 两个语言页面已通过验证且在线。
- 仅 `published` 表示线上已验证。commit、push、排期或定时器成功都不能替代 HTTP/页面/Telegram 投递验证。
