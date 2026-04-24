import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  circle?: boolean;
  style?: React.CSSProperties;
}

const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
  borderRadius,
  circle,
  style,
}) => {
  const baseStyle: React.CSSProperties = {
    width: width,
    height: height,
    borderRadius: circle ? '50%' : borderRadius,
    ...style,
  };

  return (
    <div
      className={`skeleton ${className}`}
      style={baseStyle}
      aria-hidden="true"
    />
  );
};

export default Skeleton;
