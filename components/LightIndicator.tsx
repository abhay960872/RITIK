
import React from 'react';

interface LightIndicatorProps {
  isOn: boolean;
  brightness: number;
}

export const LightIndicator: React.FC<LightIndicatorProps> = ({ isOn, brightness }) => {
  const color = isOn ? 'text-yellow-300' : 'text-slate-500';
  const glow = isOn ? 'shadow-[0_0_15px_5px_rgba(252,211,77,0.4)]' : '';
  const brightnessLevel = isOn ? brightness / 100 : 0.3;

  return (
    <div
      className={`relative w-10 h-10 flex items-center justify-center transition-all duration-500 ${glow} rounded-full`}
      style={{ opacity: brightnessLevel + 0.2 }}
    >
      <svg
        className={`w-8 h-8 transition-colors duration-500 ${color}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor"
        viewBox="0 0 16 16"
      >
        <path d="M2 6a6 6 0 1 1 10.174 4.31c-.203.196-.359.4-.453.619l-.762 1.769A.5.5 0 0 1 10.5 13h-5a.5.5 0 0 1-.46-.302l-.761-1.77a1.964 1.964 0 0 0-.453-.618A5.984 5.984 0 0 1 2 6zm6-5a5 5 0 0 0-3.479 8.592c.263.254.514.564.676.941L5.83 12h4.342l.632-1.467c.162-.377.413-.687.676-.941A5 5 0 0 0 8 1z" />
        <path d="M9.05.435c-.58-.58-1.52-.58-2.1 0l-.5.5c-.58.58-.58 1.52 0 2.1l.5.5c.58.58 1.52.58 2.1 0l.5-.5c.58-.58.58-1.52 0-2.1l-.5-.5zM6 13.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5z" />
      </svg>
    </div>
  );
};
