import React from 'react';

interface OverlayProps {
  children: React.ReactNode;
  className?: string;
}

const Overlay: React.FC<OverlayProps> = ({ children, className = '' }) => {
  return (
    <div className={`absolute inset-0 flex items-end justify-center bg-black/10 z-50 py-4 px-4 ${className}`}>
      <div className="bg-white rounded-lg px-5 py-3  w-[90%] max-w-md relative shadow-md">
        {children}
      </div>
    </div>
  );
};

export default Overlay; 