
import React from 'react';
import { cn } from "@/lib/utils";

interface LottoBallProps {
  number: number;
  isStar?: boolean;
  size?: 'sm' | 'md' | 'lg';
  status?: 'default' | 'hot' | 'cold' | 'selected';
  className?: string;
}

export const LottoBall = ({ number, isStar = false, size = 'md', status = 'default', className }: LottoBallProps) => {
  const sizeClasses = {
    sm: "w-[32px] h-[32px] text-[16px]",
    md: "w-[44px] h-[44px] text-[22px]",
    lg: "w-[60px] h-[60px] text-[28px]"
  };

  const statusColors = {
    default: isStar ? "from-yellow-300 via-yellow-500 to-yellow-700 text-black" : "from-gray-100 via-white to-gray-300 text-black",
    hot: "from-red-500 via-red-600 to-red-800 text-white border-red-300",
    cold: "from-blue-400 via-blue-500 to-blue-700 text-white border-blue-300",
    selected: "from-green-400 via-green-500 to-green-700 text-white border-green-300"
  };

  return (
    <div className={cn(
      "rounded-full flex items-center justify-center font-bold shadow-[inset_-5px_-5px_10px_rgba(0,0,0,0.5),5px_5px_10px_rgba(0,0,0,0.5)] relative border border-white/20",
      "bg-gradient-to-br",
      sizeClasses[size],
      statusColors[status],
      className
    )}>
      {/* Star icon removed per user request */}
      {/* {isStar && <span className="mr-0.5 text-[0.8em]">★</span>} */}
      <span className="drop-shadow-sm z-10">{number}</span>
      
      {/* Specular highlight for 3D effect REMOVED per user request */}
      {/* <div className="absolute top-[15%] left-[20%] w-[30%] h-[20%] bg-white rounded-full opacity-60 blur-[1px]" /> */}
    </div>
  );
};
