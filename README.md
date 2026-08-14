# Discourse Choujiang Component v1.3.0

抽奖插件的独立前端主题组件。

包含：

- 抽奖正文 `[抽奖]...[/抽奖]` 卡片解析和 DOM 渲染
- 回复参与资格印章生成
- 抽奖活动卡片样式
- 参与状态印章样式
- 抽奖管理页面辅助样式
- 移动端与深色模式相关样式

插件负责：

- 保存和同步抽奖数据
- 等级与成就点数资格判断
- 向帖子序列化结果输出 `choujiang_participation`
- doc-api 内部接口和开奖逻辑

组件负责全部浏览器端 JavaScript 与 CSS。以后修改卡片结构、印章文字、颜色、尺寸、位置或交互，只需更新组件，不需要 rebuild 插件。

依赖：discourse-choujiang v3.3.3 或更高版本（开奖结果结构化数据）。


## v1.2.0

- 开奖后自动识别回复中的“第 N 位中奖者”。
- 中奖回复优先显示金色“恭喜中奖”印章。
- 该效果完全由主题组件实现，无需更新或 rebuild 插件。

## v1.2.1

- Only the first successful participation reply displays `参与成功`.
- Later duplicate eligible replies display no participation stamp.


## v1.3.0

- 新增开奖结果卡片：显示名次、奖品、用户名、用户 ID、开奖 ID 与开奖时间。
- 开奖结果结构和样式完全由主题组件负责。
