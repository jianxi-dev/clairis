# 标月 Biaoyue｜App Store Connect新建App完整填写清单

> 方案：**单条 App 记录，iOS\+macOS 通用购买（一次购买双端可用）**
> ⚠️SKU 一旦创建**永久不可修改**；上传第一个构建包后 Bundle ID 不可修改
> 
> 

## 一、新建 App 弹窗（\+ → 新建 App）

|配置项|填写值|备注|
|---|---|---|
|平台|✅iOS、✅macOS|只建 1 条记录，不要分开建 2 个 App|
|名称（Name）|`标月`|主语言下商店名称，≤30 字符，App Store 全局不能重名|
|主要语言 \(Primary Language\)|`简体中文(Chinese(Simplified))`|默认兜底语言，后期修改成本很高|
|Bundle ID|`com.yourdomain.biaoyue`|**必须和 Xcode iOS、macOS 两个 Target 完全一致**；先在开发者证书后台注册好 ID 再下拉选择|
|SKU（内部 ID，用户看不见）|`biaoyue‑ios`|账号内唯一；字母数字横杠下划线，不能中文空格；创建后不可改|
|用户访问权限|Full Access（完全访问）|个人开发者选此项|

> 点击【Create】创建 App 记录。
> 
> 

## 二、App 信息 → 本地化配置（商店页中英文切换）

> 商店页面名称、副标题、描述、截图，**按语言分开维护**，修改后需要版本审核生效。
> 
> 

1. 添加语言：`Chinese(Simplified)简体中文`、`English(U.S.)英文(美国)`

### 简体中文（zh‑Hans）

- App 名称：`标月`

- 副标题：填写中文副标题（≤30 字符）

- App 描述、关键词、支持网址、隐私政策 URL（共用一套链接即可）

- 上传 iOS、macOS 中文商店截图

### English\(U\.S\.\)

- App 名称：`Biaoyue`

- 副标题：填写英文副标题（≤30 字符）

- App 描述、关键词

- 上传 iOS、macOS 英文商店截图

> 缺失语言会自动回退到【主要语言 = 简体中文】。
> 
> 

## 三、Xcode 工程配置（桌面图标 / Dock 名称跟随系统语言切换）

> 控制手机桌面、Mac Dock 显示的 App 名字；**二进制打包生效，模拟器切换系统语言即可测试，不需要提交 App Store 审核**。
> 
> 

1. Xcode 开启本地化：勾选`简体中文`、`English(U.S.)`

2. 使用 **InfoPlist\.xcstrings（String Catalog）**

    - key：`CFBundleDisplayName`

        - zh‑Hans：`标月`

        - en‑US：`Biaoyue`

3. Info\.plist 新增键值（macOS 必须配置，Dock 本地化名称生效）

```xml
<key>LSHasLocalizedDisplayName</key>
<true/>
```

4. iOS Target、macOS Target **Bundle ID 统一为 ****`com.yourdomain.biaoyue`**

> ✅区分：
> 
> - App Store Connect：控制**商店页面展示名称**
> 
> - Xcode InfoPlist\.xcstrings：控制**设备桌面 / Dock 图标下名称**
> 两处都配置，商店、桌面才会跟随系统语言同时切换。
> 
> 

## 四、通用购买重要约束（iOS\+macOS 单记录必看）

1. 两个平台均审核通过后自动开启**通用购买**：用户买一份，iOS、macOS 全部可用

2. **一旦开启通用购买，无法删除其中一个平台，不能单独下架 macOS**，只能整体下架 App

3. 内购、订阅一套即可，双端共享；不要新建两套内购产品

4. iOS、macOS 可以使用**不同版本号、不同构建号**，截图素材各自独立上传。

## 五、必填元数据（App 信息页面）

1. **隐私政策 URL【必填】**：公开可访问 https 链接，iOS/macOS 都强制要求，链接不能 404

2. App 支持网址：填写官网 `jianxi.me`

3. 类别：按产品业务选择

4. App 审核信息：如果 App 需要登录，必须提供**可用演示账号密码**，否则会被拒审

## 六、常见踩坑清单

1. ❌SKU 不要填中文、空格，不能以`‑ . _`开头；重复报错就换一个 SKU 字符串。

2. ❌Bundle ID 上传构建包后不能修改，Xcode 两个 Target 必须完全一致。

3. ❌macOS 不配置`LSHasLocalizedDisplayName=YES`，Dock 永远显示原始 CFBundleName，不会切换英文名称。

4. ❌商店名称≠桌面显示名称，二者两套配置，不要混淆。

5. ❌不要为 iOS/macOS 建立两条独立 App 记录，一旦分开后期**永远不能合并**，评论评分互相隔离。

## 七、备选方案：如果未来需要拆分为两个独立 App（仅供参考，当前不推荐）

> 当希望 iOS、Mac 定价独立、两个商店产品页、评论隔离时才用。
> 
> 

1. iOS 记录：SKU=`biaoyue‑ios`，BundleID=`com.yourdomain.biaoyue.ios`，名称`标月`

2. macOS 记录：SKU=`biaoyue‑mac`，BundleID=`com.yourdomain.biaoyue.mac`，名称`标月 Mac`

> Mac 名称必须加后缀，完全同名苹果审核拒绝。
> 
> 

如果你需要，我可以继续输出一份**归档上传构建包 \+ TestFlight 测试 \+ 提交审核的检查清单**。

> （注：部分内容可能由 AI 生成）
