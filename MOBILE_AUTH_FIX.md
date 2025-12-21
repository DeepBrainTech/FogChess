# 移动端用户认证修复说明

## 问题描述

在电脑浏览器上，从游戏合集主页登录后打开迷雾棋，可以正常获取用户名并自动填入创建房间界面。但在真实的手机和iPad设备上，用户信息无法正确传递，导致创建/加入房间时无法获取用户名。

## 问题原因

主要原因是**移动设备浏览器对跨域Cookie的限制更严格**：

1. **Cookie的`sameSite`策略限制**：
   - 移动浏览器（特别是iOS Safari）对`sameSite: 'none'`的Cookie有严格限制
   - `sameSite: 'none'`必须配合`secure: true`（HTTPS）才能生效
   - 非HTTPS环境下，移动浏览器会拒绝此类Cookie

2. **第三方Cookie阻止**：
   - 移动设备的浏览器隐私保护更激进，默认阻止第三方Cookie
   - iOS Safari和移动Chrome对跨域Cookie的处理更严格

3. **纯Cookie依赖的局限性**：
   - 原有实现完全依赖Cookie来存储会话信息
   - 一旦Cookie被阻止，用户信息就完全丢失

## 解决方案

采用**Cookie + localStorage双重存储**的混合策略：

### 1. 前端改进 - `auth.ts`

**新增功能**：
- 在localStorage中持久化存储用户信息
- 启动时自动从localStorage恢复用户信息
- 网络请求失败时，回退到localStorage
- 所有用户状态变更都同步到localStorage

**关键代码**：
```typescript
const LOCAL_STORAGE_KEY = 'fogchess_user';

// 初始化时从localStorage加载
initFromLocalStorage();

// 保存到localStorage
const saveToLocalStorage = (userData: AuthUser | null) => {
  if (userData) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userData));
  } else {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
};

// 新增setUser方法，允许直接设置用户信息
const setUser = (userData: AuthUser | null) => {
  user.value = userData;
  saveToLocalStorage(userData);
};
```

### 2. 前端改进 - `main.ts`

**Token交换逻辑优化**：
- 从后端Token交换接口直接获取用户信息
- 立即保存到localStorage
- 添加详细的console日志，便于调试
- 失败时有完整的错误处理

**关键改进**：
```typescript
const data = await response.json();
if (data.user) {
  authStore.setUser(data.user);  // 直接保存用户信息
  console.log('User saved from token exchange:', data.user);
}
```

### 3. 后端改进 - `server.ts`

#### 3.1 Token交换接口返回用户信息

原来只返回`{ ok: true }`，现在返回完整用户信息：

```typescript
return res.json({ 
  ok: true, 
  user: { 
    id: claims.user_id, 
    username: claims.username 
  } 
});
```

这样移动端可以直接获取用户信息，无需再依赖Cookie发送额外请求。

#### 3.2 改进Cookie策略

```typescript
function setSessionCookie(res: express.Response, jwtToken: string) {
  const isProduction = process.env.NODE_ENV === 'production';
  const isHttps = process.env.USE_HTTPS === 'true' || process.env.RAILWAY_ENVIRONMENT;
  
  res.cookie(SESSION_COOKIE, jwtToken, {
    httpOnly: true,
    secure: isProduction && isHttps,
    sameSite: (isProduction && isHttps) ? 'none' : 'lax',
    maxAge: SESSION_TTL_SEC * 1000,
    path: '/'
  });
}
```

**改进点**：
- 只在HTTPS环境下使用`sameSite: 'none'`
- 非HTTPS环境使用`sameSite: 'lax'`，移动设备兼容性更好
- 通过环境变量`USE_HTTPS`明确控制

## 工作原理

### 桌面浏览器（原有流程）
1. 从游戏主页跳转，URL携带token参数
2. 后端交换token，设置Cookie（成功）
3. 前端通过Cookie认证获取用户信息（成功）
4. 创建房间时自动填入用户名 ✅

### 移动设备（新流程）
1. 从游戏主页跳转，URL携带token参数
2. 后端交换token，尝试设置Cookie（可能被阻止）
3. **前端直接从响应中获取用户信息**（新增）
4. **保存到localStorage**（新增）
5. 创建房间时从localStorage读取用户名 ✅
6. 即使Cookie失效，下次打开仍能从localStorage恢复 ✅

## 优势

1. **向后兼容**：桌面浏览器的Cookie机制继续工作
2. **移动友好**：通过localStorage解决Cookie限制问题
3. **双重保障**：Cookie + localStorage，任一可用即可
4. **持久化**：localStorage在浏览器关闭后仍然保留
5. **调试友好**：添加了详细的console日志

## 注意事项

### 安全性考虑

虽然localStorage可以被JavaScript访问（不像httpOnly Cookie），但这里只存储：
- 用户ID（数字）
- 用户名（公开信息）

**没有存储敏感信息**（如密码、token等），因此安全风险可控。

真正的认证仍然通过后端的JWT验证（从Cookie读取），localStorage只是用于**UI显示的用户信息缓存**。

### 清理localStorage

如果需要完全登出，调用：
```typescript
authStore.clear();  // 会同时清除内存和localStorage
```

## 测试建议

### 桌面浏览器测试
1. 从主页登录
2. 打开迷雾棋
3. 检查用户名是否自动填入
4. 检查浏览器DevTools中的Cookie
5. 检查localStorage中的`fogchess_user`

### 移动设备测试
1. 从主页登录
2. 打开迷雾棋
3. 检查用户名是否自动填入
4. 使用Safari/Chrome的远程调试查看Console日志：
   - `Token found in URL, exchanging...`
   - `Token exchange successful`
   - `User saved from token exchange: {id: X, username: "..."}`
5. 关闭浏览器重新打开，检查用户名是否仍然存在
6. 检查localStorage（Safari: 设置 → 高级 → 网站数据）

### 日志关键词
成功的流程应该看到：
```
Token found in URL, exchanging...
Token exchange successful: {ok: true, user: {id: X, username: "..."}}
User saved from token exchange: {id: X, username: "..."}
User saved to localStorage: {id: X, username: "..."}
```

如果Cookie失败但localStorage成功：
```
Failed to fetch user from server, trying localStorage...
User loaded from localStorage: {id: X, username: "..."}
```

## 环境变量

如果部署在HTTPS环境（如生产环境），确保设置：
```bash
NODE_ENV=production
USE_HTTPS=true  # 或者使用Railway等平台会自动设置 RAILWAY_ENVIRONMENT
```

这样Cookie策略会自动切换到`sameSite: 'none'` + `secure: true`。

## 总结

这个修复采用了**渐进增强**的策略：
- 保留Cookie机制（服务器端认证）
- 添加localStorage机制（客户端缓存）
- 两者相互补充，确保在各种设备和浏览器上都能正常工作

特别是针对移动设备的严格Cookie策略，localStorage提供了可靠的备用方案。

