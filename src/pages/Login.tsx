import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authService } from '@/services/auth.service';
import { toast } from 'sonner';

export default function Login() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [registrationCode, setRegistrationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await authService.login({ email, password });
        toast.success('登录成功');
        // WebSocket 连接由 App.tsx 的 ProtectedRoute 处理
        navigate('/');
      } else {
        if (!registrationCode.trim()) {
          toast.error('请输入注册码');
          return;
        }
        await authService.register({ email, password, name, registrationCode: registrationCode.trim().toUpperCase() });
        toast.success('注册成功！系统已自动激活 License');
        // WebSocket 连接由 App.tsx 的 ProtectedRoute 处理
        navigate('/');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">
            {isLogin ? '登录' : '注册'}
          </CardTitle>
          <CardDescription>
            {isLogin ? '登录到日麻直播记分系统' : '创建新账户'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">姓名</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                  placeholder="输入您的姓名"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="输入您的邮箱"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="输入您的密码"
              />
            </div>
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="registrationCode">注册码</Label>
                <Input
                  id="registrationCode"
                  type="text"
                  value={registrationCode}
                  onChange={(e) => setRegistrationCode(e.target.value.toUpperCase())}
                  required={!isLogin}
                  placeholder="输入注册码（8位大写字母和数字）"
                  className="uppercase"
                  maxLength={8}
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '处理中...' : isLogin ? '登录' : '注册'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? '没有账户？注册' : '已有账户？登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
