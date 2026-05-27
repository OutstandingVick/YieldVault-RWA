import React from 'react';

export interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  circle?: boolean;
  style?: React.CSSProperties;
}

export const SkeletonBlock: React.FC<SkeletonProps> = ({
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

export const SkeletonCircle: React.FC<Omit<SkeletonProps, 'circle' | 'borderRadius'>> = (props) => (
  <SkeletonBlock {...props} circle={true} />
);

interface SkeletonTextProps extends Omit<SkeletonProps, 'circle'> {
  lines?: number;
  lineHeight?: string | number;
  gap?: string | number;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 1,
  lineHeight = '1em',
  gap = '0.5em',
  className = '',
  width,
  ...props
}) => {
  if (lines === 1) {
    return <SkeletonBlock className={`skeleton-text ${className}`} height={lineHeight} width={width || '100%'} {...props} />;
  }

  return (
    <div className="skeleton-text-wrapper" style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock
          key={i}
          className={`skeleton-text ${className}`}
          height={lineHeight}
          width={i === lines - 1 && lines > 1 ? '70%' : width || '100%'}
          {...props}
        />
      ))}
    </div>
  );
};

export const TableSkeleton: React.FC<{ columns?: number; rows?: number }> = ({
  columns = 4,
  rows = 5,
}) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={`table-skeleton-row-${rowIndex}`} className="data-table-row">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={`table-skeleton-col-${colIndex}`}>
              <SkeletonText
                width={colIndex === 0 ? "80%" : "50%"}
                lineHeight="1.2em"
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

export const DashboardCardSkeleton: React.FC = () => {
  return (
    <div
      className="glass-panel"
      style={{
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
      aria-hidden="true"
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <SkeletonCircle width={20} height={20} />
        <SkeletonText width="40%" lineHeight="1em" />
      </div>
      <SkeletonText width="60%" lineHeight="2rem" />
      <SkeletonText width="80%" lineHeight="0.85rem" />
    </div>
  );
};

// Default export for backward compatibility
export default SkeletonBlock;
