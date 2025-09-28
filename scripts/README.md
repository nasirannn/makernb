# R2存储清理工具

这个工具用于清理R2存储中不再被数据库引用的无用文件，包括音频文件和封面图片。

## 功能

- 🔍 扫描数据库中所有有效的文件引用
- 📂 列出R2存储中的所有文件
- 🗑️ 识别没有被数据库引用的无用文件
- 💾 显示存储使用统计信息
- 🛡️ 支持DRY RUN模式，安全预览要删除的文件

## 使用方法

### 1. 预览模式（推荐先运行）

```bash
npm run cleanup-r2
```

这会扫描并显示将要删除的文件，但不会实际删除任何文件。

### 2. 实际删除模式

```bash
npm run cleanup-r2:delete
```

⚠️ **警告**: 这会实际删除无用文件，请确保先运行预览模式确认无误。

## 工作原理

### 1. 数据库扫描

工具会扫描以下数据库表来找出有效的文件引用：

#### 音频文件引用
- 表：`music_tracks` + `music_generations`
- 条件：
  - `music_tracks.audio_url IS NOT NULL`
  - `music_tracks.is_deleted = FALSE` 或 `NULL`
  - `music_generations.is_deleted = FALSE` 或 `NULL`

#### 封面图片引用
- 表：`cover_images` + `music_tracks` + `music_generations`
- 条件：
  - `cover_images.r2_url IS NOT NULL`
  - 如果关联了track，则track和generation必须未删除
  - 如果未关联track，则保留（可能是待关联的封面）

### 2. R2存储扫描

扫描R2存储桶中的所有文件，按以下结构组织：
- `audio/{userId}/{taskId}/{filename}` - 音频文件
- `covers/{userId}/{taskId}/{filename}` - 封面图片

### 3. 对比和清理

找出在R2中存在但不在数据库引用中的文件，这些就是可以安全删除的无用文件。

## 输出示例

```
🚀 开始R2存储清理...

ℹ️  运行在DRY RUN模式，不会实际删除文件

🔍 扫描数据库中的有效文件引用...
  📀 扫描音频文件引用...
    ✓ 音频: audio/user123/task456/track_a.mp3 (track: abc-123)
    ✓ 音频: audio/user123/task456/track_b.mp3 (track: def-456)
  🖼️  扫描封面图片引用...
    ✓ 封面: covers/user123/task456/cover_1.png (cover: ghi-789)

📊 找到 3 个有效文件引用

📂 扫描R2存储中的所有文件...
📊 R2存储中共有 15 个文件
💾 总存储大小: 45.2 MB

🔍 查找无用文件...
📊 找到 12 个无用文件
  📀 音频文件: 8 个
  🖼️  封面文件: 4 个
  📄 其他文件: 0 个

📋 无用文件示例:
  🗑️  audio/user456/old_task/track_a.mp3
  🗑️  audio/user456/old_task/track_b.mp3
  🗑️  covers/user456/old_task/cover_1.png
  ... 还有 9 个文件

🔍 DRY RUN - 以下文件将被删除（实际未删除）:
  🗑️  audio/user456/old_task/track_a.mp3
  🗑️  audio/user456/old_task/track_b.mp3
  ...

💡 要实际删除这些文件，请运行: npm run cleanup-r2 -- --delete

✅ R2存储清理完成!
```

## 安全性

- ✅ **DRY RUN默认**: 默认只预览，不实际删除
- ✅ **多重验证**: 检查多个表的关联关系
- ✅ **软删除支持**: 正确处理软删除的记录
- ✅ **错误处理**: 单个文件删除失败不影响整体流程
- ✅ **详细日志**: 记录所有操作和结果

## 注意事项

1. **备份重要**: 运行删除操作前，建议备份重要数据
2. **生产环境**: 在生产环境运行前，先在测试环境验证
3. **并发安全**: 避免在有用户上传文件时运行清理
4. **权限检查**: 确保有R2存储桶的删除权限

## 环境变量

确保设置了以下环境变量：

```env
# R2存储配置
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket_name

# 数据库配置
DATABASE_URL=your_database_url
```

## 故障排除

### 权限错误
```
Error: Access Denied
```
检查R2访问密钥是否有正确的权限。

### 数据库连接错误
```
Error: connection to server failed
```
检查DATABASE_URL是否正确配置。

### 文件删除失败
部分文件可能因为权限或其他原因删除失败，工具会继续处理其他文件并在最后显示统计信息。
