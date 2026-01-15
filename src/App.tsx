import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Index from "./pages/Index";
import Display from "./pages/Display";
import Display2 from "./pages/Display2";
import Display3 from "./pages/Display3";
import Display4 from "./pages/Display4";
import DisplayPublic from "./pages/DisplayPublic";
import DisplayPublic2 from "./pages/DisplayPublic2";
import DisplayPublic3 from "./pages/DisplayPublic3";
import DisplayPublic4 from "./pages/DisplayPublic4";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import { authService } from "./services/auth.service";
import { websocketService } from "./services/websocket.service";

const queryClient = new QueryClient();

// 授权保护组件
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      if (authService.isAuthenticated()) {
        try {
          // 验证 Token 是否有效
          await authService.getProfile();
          setIsAuthenticated(true);
          
          // 连接 WebSocket（只在控制面板页面，不在公开显示页面）
          if (!window.location.hash.includes('display-public')) {
            // 延迟连接，确保页面完全加载
            const connectWebSocket = () => {
              // 检查是否已经在公开显示页面（路由可能已变化）
              if (window.location.hash.includes('display-public')) {
                console.log('App: Skipping WebSocket connection (now on public display page)');
                return;
              }
              
              if (!websocketService.isConnected()) {
                console.log('App: Connecting WebSocket for control panel');
                // 获取或生成6位数字房间号
                const stored = localStorage.getItem('mahjong-room-id');
                let roomId = stored && /^\d{6}$/.test(stored) ? stored : null;
                if (!roomId) {
                  // 生成新的6位数字房间号
                  roomId = String(Math.floor(100000 + Math.random() * 900000));
                  localStorage.setItem('mahjong-room-id', roomId);
                }
                console.log('App: Using roomId:', roomId);
                websocketService.connect(roomId, false);
                websocketService.on('game-state', (state: any) => {
                  // 状态更新已在 gameStore 中处理
                });
              } else {
                console.log('App: WebSocket already connected, skipping');
              }
            };
            // 延迟连接，避免与其他初始化代码冲突
            setTimeout(connectWebSocket, 200);
          }
        } catch (error) {
          setIsAuthenticated(false);
          authService.logout();
        }
      } else {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// 管理员路由保护组件
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const ADMIN_EMAIL = 'pylzh2002@gmail.com';

  useEffect(() => {
    const checkAdmin = async () => {
      if (authService.isAuthenticated()) {
        try {
          await authService.getProfile();
          const user = authService.getCurrentUser();
          setIsAdmin(user?.email === ADMIN_EMAIL);
        } catch (error) {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, []);

  if (isAdmin === null) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  }

  return isAdmin ? <>{children}</> : <Navigate to="/" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <Admin />
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            }
          />
          <Route
            path="/display"
            element={
              <ProtectedRoute>
                <Display />
              </ProtectedRoute>
            }
          />
          <Route
            path="/display2"
            element={
              <ProtectedRoute>
                <Display2 />
              </ProtectedRoute>
            }
          />
          <Route
            path="/display3"
            element={
              <ProtectedRoute>
                <Display3 />
              </ProtectedRoute>
            }
          />
          <Route
            path="/display4"
            element={
              <ProtectedRoute>
                <Display4 />
              </ProtectedRoute>
            }
          />
          {/* 公开显示路由（不需要认证） */}
          <Route path="/display-public" element={<DisplayPublic />} />
          <Route path="/display-public2" element={<DisplayPublic2 />} />
          <Route path="/display-public3" element={<DisplayPublic3 />} />
          <Route path="/display-public4" element={<DisplayPublic4 />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
