import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { adminService, RegistrationCode, User } from '@/services/admin.service';
import { authService } from '@/services/auth.service';
import { toast } from 'sonner';
import { Plus, Trash2, Power, Copy, Check, Users, KeyRound, RefreshCw } from 'lucide-react';

const ADMIN_EMAIL = 'pylzh2002@gmail.com';

export default function Admin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('codes');
  const [codes, setCodes] = useState<RegistrationCode[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [newCodeNote, setNewCodeNote] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{ 
    open: boolean; 
    userId: string | null; 
    userName: string;
    userEmail: string;
    newPassword: string;
    showResult: boolean;
  }>({
    open: false,
    userId: null,
    userName: '',
    userEmail: '',
    newPassword: '',
    showResult: false,
  });

  useEffect(() => {
    // 检查是否为管理员
    const user = authService.getCurrentUser();
    if (!user || user.email !== ADMIN_EMAIL) {
      toast.error('无权访问');
      navigate('/');
      return;
    }
    loadCodes();
    loadUsers();
  }, [navigate]);

  const loadCodes = async () => {
    setLoading(true);
    try {
      const data = await adminService.getAllCodes();
      setCodes(data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCode = async () => {
    setLoading(true);
    try {
      const newCode = await adminService.createCode(newCodeNote || undefined);
      setCodes([newCode, ...codes]);
      setNewCodeNote('');
      toast.success('注册码创建成功');
    } catch (error: any) {
      toast.error(error.response?.data?.message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCode = async (id: string) => {
    if (!confirm('确定要删除这个注册码吗？')) {
      return;
    }
    setLoading(true);
    try {
      await adminService.deleteCode(id);
      setCodes(codes.filter(c => c.id !== id));
      toast.success('注册码已删除');
    } catch (error: any) {
      toast.error(error.response?.data?.message || '删除失败');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string) => {
    setLoading(true);
    try {
      const updated = await adminService.toggleCodeStatus(id);
      setCodes(codes.map(c => c.id === id ? updated : c));
      toast.success(updated.isActive ? '注册码已启用' : '注册码已停用');
    } catch (error: any) {
      toast.error(error.response?.data?.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      toast.error('复制失败');
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await adminService.getAllUsers();
      setUsers(data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (userId: string, customPassword?: string) => {
    setLoading(true);
    try {
      const result = await adminService.resetUserPassword(userId, customPassword);
      const user = users.find(u => u.id === userId);
      setResetPasswordDialog({
        open: true,
        userId,
        userName: user?.name || '',
        userEmail: user?.email || '',
        newPassword: result.newPassword,
        showResult: true,
      });
      toast.success('密码重置成功');
    } catch (error: any) {
      toast.error(error.response?.data?.message || '重置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserStatus = async (id: string) => {
    setLoading(true);
    try {
      const result = await adminService.toggleUserStatus(id);
      setUsers(users.map(u => u.id === id ? result.user : u));
      toast.success(result.message);
    } catch (error: any) {
      toast.error(error.response?.data?.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">系统管理</h1>
          <Button
            onClick={() => navigate('/')}
            variant="outline"
            className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
          >
            返回主页
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="codes" className="data-[state=active]:bg-slate-700 text-white">
              <KeyRound className="h-4 w-4 mr-2" />
              注册码管理
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-slate-700 text-white">
              <Users className="h-4 w-4 mr-2" />
              用户管理
            </TabsTrigger>
          </TabsList>

          {/* 注册码管理标签页 */}
          <TabsContent value="codes" className="mt-4">
            {/* 创建新注册码 */}
            <Card className="mb-6 bg-gradient-to-r from-slate-800/80 to-slate-900/80 border-slate-700 backdrop-blur-sm shadow-2xl">
              <CardHeader>
                <CardTitle className="text-white">创建新注册码</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="备注（可选）"
                    value={newCodeNote}
                    onChange={(e) => setNewCodeNote(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateCode();
                      }
                    }}
                  />
                  <Button
                    onClick={handleCreateCode}
                    disabled={loading}
                    className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    创建
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 注册码列表 */}
            <Card className="bg-gradient-to-r from-slate-800/80 to-slate-900/80 border-slate-700 backdrop-blur-sm shadow-2xl">
              <CardHeader>
                <CardTitle className="text-white">注册码列表</CardTitle>
              </CardHeader>
              <CardContent>
                {loading && codes.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">加载中...</div>
                ) : codes.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">暂无注册码</div>
                ) : (
                  <div className="space-y-2">
                    {codes.map((code) => (
                      <div
                        key={code.id}
                        className={`p-4 rounded-lg border transition-all ${
                          code.isActive
                            ? 'bg-slate-700/50 border-slate-600'
                            : 'bg-slate-800/50 border-slate-700 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-mono text-lg font-bold text-white tracking-widest">
                                {code.code}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyCode(code.code)}
                                className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                                title="复制注册码"
                              >
                                {copiedCode === code.code ? (
                                  <Check className="h-3 w-3 text-green-400" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                              {code.isActive ? (
                                <Badge className="bg-green-500 text-white">启用</Badge>
                              ) : (
                                <Badge variant="outline" className="border-slate-500 text-slate-400">
                                  停用
                                </Badge>
                              )}
                              {code.usedBy && (
                                <Badge variant="outline" className="border-blue-500 text-blue-400">
                                  已使用
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 space-y-1">
                              {code.note && <div>备注：{code.note}</div>}
                              {code.usedBy && (
                                <div>使用人：{code.usedBy}（{formatDate(code.usedAt)}）</div>
                              )}
                              <div>创建时间：{formatDate(code.createdAt)}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Button
                              onClick={() => handleToggleStatus(code.id)}
                              variant="ghost"
                              size="sm"
                              disabled={loading || !!code.usedBy}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                              title={code.isActive ? '停用' : '启用'}
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => handleDeleteCode(code.id)}
                              variant="ghost"
                              size="sm"
                              disabled={loading}
                              className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                              title="删除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 用户管理标签页 */}
          <TabsContent value="users" className="mt-4">
            <Card className="bg-gradient-to-r from-slate-800/80 to-slate-900/80 border-slate-700 backdrop-blur-sm shadow-2xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">用户列表</CardTitle>
                  <Button
                    onClick={loadUsers}
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                    刷新
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading && users.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">加载中...</div>
                ) : users.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">暂无用户</div>
                ) : (
                  <div className="space-y-2">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        className={`p-4 rounded-lg border transition-all ${
                          user.isActive
                            ? 'bg-slate-700/50 border-slate-600'
                            : 'bg-slate-800/50 border-slate-700 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-lg font-bold text-white">
                                {user.name || '未设置'}
                              </span>
                              <span className="text-sm text-slate-400 font-mono">
                                {user.email}
                              </span>
                              {user.isActive ? (
                                <Badge className="bg-green-500 text-white">启用</Badge>
                              ) : (
                                <Badge variant="outline" className="border-slate-500 text-slate-400">
                                  停用
                                </Badge>
                              )}
                              {user.email === ADMIN_EMAIL && (
                                <Badge className="bg-purple-500 text-white">管理员</Badge>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 space-y-1">
                              <div>注册时间：{formatDate(user.createdAt)}</div>
                              <div>最后更新：{formatDate(user.updatedAt)}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Dialog open={resetPasswordDialog.open && resetPasswordDialog.userId === user.id && !resetPasswordDialog.showResult} onOpenChange={(open) => {
                              if (!open) {
                                setResetPasswordDialog({ open: false, userId: null, userName: '', userEmail: '', newPassword: '', showResult: false });
                              }
                            }}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={loading}
                                  className="h-8 px-3 text-slate-400 hover:text-white"
                                  title="重置密码"
                                  onClick={() => setResetPasswordDialog({
                                    open: true,
                                    userId: user.id,
                                    userName: user.name || '',
                                    userEmail: user.email,
                                    newPassword: '',
                                    showResult: false,
                                  })}
                                >
                                  <KeyRound className="h-4 w-4 mr-1" />
                                  重置密码
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="bg-slate-800 border-slate-700 text-white">
                                <DialogHeader>
                                  <DialogTitle>重置密码</DialogTitle>
                                  <DialogDescription className="text-slate-400">
                                    为 {user.name || user.email} 重置密码
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 mt-4">
                                  <div>
                                    <label className="text-sm text-slate-300 mb-2 block">
                                      新密码（留空将自动生成8位随机密码）
                                    </label>
                                    <Input
                                      type="text"
                                      placeholder="留空自动生成"
                                      value={resetPasswordDialog.newPassword}
                                      onChange={(e) => setResetPasswordDialog({
                                        ...resetPasswordDialog,
                                        newPassword: e.target.value,
                                      })}
                                      className="bg-slate-700 border-slate-600 text-white"
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() => handleResetPassword(user.id, resetPasswordDialog.newPassword || undefined)}
                                      disabled={loading}
                                      className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white flex-1"
                                    >
                                      确认重置
                                    </Button>
                                    <Button
                                      variant="outline"
                                      onClick={() => setResetPasswordDialog({ open: false, userId: null, userName: '', userEmail: '', newPassword: '', showResult: false })}
                                      className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                                    >
                                      取消
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button
                              onClick={() => handleToggleUserStatus(user.id)}
                              variant="ghost"
                              size="sm"
                              disabled={loading || user.email === ADMIN_EMAIL}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                              title={user.isActive ? '停用' : '启用'}
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 密码重置结果对话框 */}
        <Dialog open={resetPasswordDialog.open && resetPasswordDialog.showResult} onOpenChange={(open) => {
          if (!open) {
            setResetPasswordDialog({ open: false, userId: null, userName: '', userEmail: '', newPassword: '', showResult: false });
          }
        }}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle>密码重置成功</DialogTitle>
              <DialogDescription className="text-slate-400">
                用户 {resetPasswordDialog.userName || resetPasswordDialog.userEmail} 的新密码已生成，请妥善保管
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm text-slate-300 mb-2 block">新密码：</label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={resetPasswordDialog.newPassword}
                    readOnly
                    className="bg-slate-700 border-slate-600 text-white font-mono"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(resetPasswordDialog.newPassword);
                      toast.success('已复制到剪贴板');
                    }}
                    className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button
                onClick={() => setResetPasswordDialog({ open: false, userId: null, userName: '', userEmail: '', newPassword: '', showResult: false })}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white"
              >
                确定
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
