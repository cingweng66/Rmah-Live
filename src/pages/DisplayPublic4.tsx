import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { DisplayView4 } from "@/components/game/DisplayView4";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const DisplayPublic4 = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [gameId, setGameId] = useState<string>(searchParams.get('room') || '');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string>('');

  const handleConnect = () => {
    const trimmedGameId = gameId.trim();
    
    // 验证：必须是6位数字
    if (!trimmedGameId) {
      setError('请输入房间号');
      return;
    }
    
    if (!/^\d{6}$/.test(trimmedGameId)) {
      setError('房间号必须是6位数字');
      return;
    }
    
    setError('');
    setIsConnected(true);
    navigate(`/display-public4?room=${trimmedGameId}`, { replace: true });
  };

  useEffect(() => {
    const roomFromUrl = searchParams.get('room');
    console.log('DisplayPublic4: roomFromUrl:', roomFromUrl);
    if (roomFromUrl) {
      // 验证URL中的房间号
      if (/^\d{6}$/.test(roomFromUrl)) {
        setGameId(roomFromUrl);
        setIsConnected(true);
        console.log('DisplayPublic4: Connected with gameId:', roomFromUrl);
      } else {
        console.log('DisplayPublic4: Invalid room format in URL');
        setError('房间号格式错误，必须是6位数字');
        setIsConnected(false);
      }
    } else {
      console.log('DisplayPublic4: No room parameter, showing input form');
    }
  }, [searchParams]);

  if (!isConnected || !gameId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">显示设备连接</CardTitle>
            <CardDescription>输入6位数字房间号以连接 broadcast（布局4）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="请输入6位数字房间号（如：123456）"
                value={gameId}
                maxLength={6}
                onChange={(e) => {
                  // 只允许数字输入
                  const value = e.target.value.replace(/\D/g, '');
                  setGameId(value);
                  setError('');
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleConnect();
                  }
                }}
                className="text-lg text-center tracking-widest"
              />
              {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
              {!error && gameId.length > 0 && gameId.length < 6 && (
                <p className="text-sm text-muted-foreground mt-2">
                  还需输入 {6 - gameId.length} 位数字
                </p>
              )}
            </div>
            <Button 
              onClick={handleConnect} 
              className="w-full" 
              size="lg"
              disabled={gameId.length !== 6}
            >
              连接
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              提示：房间号由控制设备提供，必须是6位数字
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <DisplayView4 gameId={gameId} readOnly={true} />;
};

export default DisplayPublic4;
