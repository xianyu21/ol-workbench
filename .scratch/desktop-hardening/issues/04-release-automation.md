# 04: Release 自动化（tag → 安装包 + Release 草稿）

**What to build:** 新增发布工作流：推送 v* tag 时自动构建 NSIS + portable 安装包，并创建 GitHub Release **草稿**（不上传正式发布，遵守项目"发版前必须询问用户、不自动发版"的规则；正式发布仍由维护者确认后手动完成）。构建沿用现有 electron-builder 配置与发布仓库。注意环境曾出现 publish 冲突，草稿模式下由人工接管上传。

**Blocked by:** None (can start immediately).

**Status:** ready-for-human

- [ ] 推送 v* tag 触发构建，产出 NSIS + portable 安装包（**待验证**：需推一个 tag 跑一次 Actions）
- [ ] 自动创建 Release 草稿并附安装包，不出正式版（**待验证**：同上）
- [x] 维护者确认后可从草稿一键发布（草稿模式由 softprops/action-gh-release 实现，发布动作在维护者手中）

## Result

新增 GitHub Actions 发布工作流（windows-latest）：v* tag → npm ci ×2 → 构建 viewer → electron-builder --publish never → softprops/action-gh-release 创建草稿并上传 AxHub-Setup-*.exe / AxHub-Portable-*.exe / latest.yml（正式发布人工点击，遵守不自动发版）。打包产物改英文命名避免中文文件名资产。工作流需推 tag 后在 Actions 验证一次。
