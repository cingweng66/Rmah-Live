import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Player } from '../../types/game';

interface PlayerDisplayCardProps {
  player: Player;
}

export const PlayerDisplayCard: React.FC<PlayerDisplayCardProps> = ({ player }) => {
  return (
    <Card className="bg-black/80 border-white/20 text-white backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">
              {player.position}
            </div>
            <span className="font-medium text-lg">{player.name}</span>
          </div>
          {player.isRiichi && (
            <Badge variant="destructive" className="animate-pulse bg-red-600 text-white">
              立直
            </Badge>
          )}
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-mono font-bold">
            {player.score.toLocaleString()}
          </div>
          <div className="text-sm text-white/70">点</div>
        </div>
      </CardContent>
    </Card>
  );
};