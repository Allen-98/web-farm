# 0.3.3 正式部署

- 用户授权：本次地图优化完成后发布上线。
- 版本：0.3.3；存档：farm-v3.4；发布编号：farm-0.3.3-20261107-compact。
- 发布时间：2026-11-07T05:33:09.9757574+08:00。
- 目标：C:/inetpub/wwwroot/games/farm。
- 备份：C:/game-backups/farm-0.3.3-20261107-compact/previous-farm，11 个旧文件逐一验证。
- 经已有 SSH/SCP 配置发布，保持主机密钥校验与网卡绑定。
- 8 个安装文件与发布清单 SHA256 一致，资源先安装、入口最后替换，旧哈希资源保留。
- 5 个其他站点入口保持原哈希。
- 两个正式域名共 16 项入口、JS、CSS、PNG 图集、版本元数据和许可文件检查通过；默认入口无需查询参数也匹配新版，PNG MIME 正常。
- TypeScript、正式构建与 58 项测试通过；含三章自动经营、旧存档完整经济值、调度状态、地图通达性与凹角寻路回归。
- 鲜明立体 2.5D 素材及紧凑 L 形布局一同上线。旧地图鸡舍至烤炉寻路约 40.2 米，新地图约 23.2 米，减少约 42%。
- 地图与素材已离线合成目视核对，见 docs/images/compact-map-20261107.png；不是浏览器截图。浏览器画面与实际输入验收待完成，电脑控制工具不支持当前 Windows 浏览器 URL 策略校验。

正式入口：https://zhaocai7.cn/games/farm/

证据：server-deployment-0.3.3.json、published-0.3.3.json、compact-map-tests.log。
