# GFM Markdown 示例

> 这篇文档展示 GitHub Flavored Markdown（GFM）的完整语法。你可以用它测试渐晰的渲染效果。

---

## 标题

```markdown
# H1
## H2
### H3
#### H4
##### H5
###### H6
```

---

## 强调

**粗体**、*斜体*、***粗斜体***、`行内代码`、~~删除线~~

---

## 列表

### 无序列表

- 项目一
- 项目二
  - 嵌套项目
  - 另一个嵌套

### 有序列表

1. 第一步
2. 第二步
3. 第三步

### 任务列表

- [x] 已完成任务
- [ ] 未完成任务
- [ ] 另一个待办

---

## 链接和图片

[渐晰官网](https://clairis.dev)

![渐晰 Logo](https://clairis.dev/logo.png)

---

## 引用

> 这是引用文字。
> 可以多行。

---

## 代码块

### 行内代码

使用 `console.log("hello")` 打印。

### 代码块

```typescript
function greet(name: string): string {
  return `Hello, ${name}!`;
}

console.log(greet("Clairis"));
```

```html
<!DOCTYPE html>
<html>
  <body>
    <h1>Hello World</h1>
  </body>
</html>
```

---

## 表格

| 功能 | 快捷键 | 说明 |
|------|--------|------|
| 打开文件夹 | `Cmd + O` | 选择工作目录 |
| 新建文档 | `Cmd + N` | 创建空白页 |
| 文件面板 | `Cmd + P` | 搜索文件 |
| 沉浸阅读 | `Esc` | 全屏阅读 |

---

## 分割线

---

## 脚注

这是一段带脚注的文字[^1]。

[^1]: 这是脚注内容。

---

**现在试试把这些内容复制到你的 Markdown 文件里吧！**
