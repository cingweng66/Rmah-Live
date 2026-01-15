# 修复 Azure CLI SSL 证书验证错误

## 问题描述

当运行部署脚本时，可能会遇到以下错误：

```
HTTPSConnectionPool(host='management.azure.com', port=443): Max retries exceeded
Certificate verification failed. This typically happens when using Azure CLI behind a proxy that intercepts traffic with a self-signed certificate.
```

## 解决方案

### 方案 1：配置代理证书（推荐）

如果您在使用代理服务器，需要将代理的证书添加到信任列表：

```bash
# 1. 导出代理证书
# 方法 A：从浏览器导出
# - Chrome: 设置 > 隐私和安全 > 安全 > 管理证书 > 导出中间证书颁发机构证书
# - 保存为 cert.pem

# 方法 B：使用 openssl 从代理获取
openssl s_client -showcerts -connect management.azure.com:443 -proxy your-proxy:port > cert.pem

# 2. 配置 Azure CLI 使用证书
export REQUESTS_CA_BUNDLE=/path/to/cert.pem

# 3. 重新运行部署脚本
./deploy-azure.sh
```

### 方案 2：配置系统证书（macOS）

```bash
# 1. 找到证书文件（通常在代理软件目录）
# 例如：/Applications/YourProxy.app/Contents/Resources/cert.pem

# 2. 添加到系统信任列表
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain /path/to/cert.pem

# 3. 重新运行部署脚本
./deploy-azure.sh
```

### 方案 3：临时禁用 SSL 验证（仅用于测试，不推荐）

⚠️ **警告**：这会降低安全性，仅用于测试环境。

```bash
# 临时禁用 SSL 验证
export AZURE_CLI_DISABLE_CONNECTION_VERIFICATION=1

# 运行部署脚本
./deploy-azure.sh

# 完成后恢复（取消设置）
unset AZURE_CLI_DISABLE_CONNECTION_VERIFICATION
```

### 方案 4：使用 Azure Portal 手动创建

如果 SSL 问题无法解决，可以：

1. **手动创建 Container Apps Environment**：
   - 访问 Azure Portal
   - 创建新的 Container Apps Environment
   - 记录环境名称

2. **手动创建 Container App**：
   - 在 Container Apps Environment 中创建新的 Container App
   - 使用已构建的 Docker 镜像
   - 配置环境变量

3. **修改脚本**：
   - 注释掉自动创建的部分
   - 使用已存在的资源名称

## 检查代理设置

```bash
# 检查是否设置了代理
echo $HTTP_PROXY
echo $HTTPS_PROXY

# 如果不需要代理，可以取消设置
unset HTTP_PROXY
unset HTTPS_PROXY
```

## 网络诊断

```bash
# 测试 Azure API 连接
curl -v https://management.azure.com

# 如果使用代理，测试代理连接
curl -v --proxy your-proxy:port https://management.azure.com
```

## 常见问题

### Q: 如何找到代理证书？

A: 
- 检查代理软件的安装目录
- 查看代理软件的文档
- 从浏览器导出（如果浏览器已配置代理）

### Q: 证书配置后仍然失败？

A:
- 确保证书路径正确
- 检查证书是否有效：`openssl x509 -in cert.pem -text -noout`
- 尝试使用完整证书链

### Q: 可以跳过某些步骤吗？

A: 可以，脚本已经添加了重试机制。如果仍然失败，可以：
- 手动在 Azure Portal 中创建资源
- 修改脚本使用已存在的资源

## 参考链接

- [Azure CLI 代理配置](https://learn.microsoft.com/cli/azure/use-cli-effectively#work-behind-a-proxy)
- [Azure Container Apps 文档](https://learn.microsoft.com/azure/container-apps/)
