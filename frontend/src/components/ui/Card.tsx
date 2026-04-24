import React from "react";
import "./Card.css";

interface CardProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  noHover?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  header,
  footer,
  className = "",
  noPadding = false,
  noHover = false,
  style,
  onClick,
}) => {
  return (
    <div
      className={`glass-card ${noHover ? "no-hover" : ""} ${
        onClick ? "is-clickable" : ""
      } ${className}`}
      onClick={onClick}
      style={style}
    >
      {header && <div className="card-header">{header}</div>}
      <div className={`card-body ${noPadding ? "no-padding" : ""}`}>{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
};
