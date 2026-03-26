import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import WalletConnect from "./WalletConnect";
import ThemeToggle from "./ThemeToggle";
import { Layers } from "./icons";

interface NavbarProps {
  walletAddress: string | null;
  onConnect: (address: string) => void;
  onDisconnect: () => void;
}

const Navbar: React.FC<NavbarProps> = ({
  walletAddress,
  onConnect,
  onDisconnect,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="app-nav" aria-label="Primary navigation">
      <div className="container flex justify-between items-center">
        <div className="flex items-center gap-xl">
          <NavLink
            to="/"
            className="flex items-center gap-sm"
            onClick={closeMenu}
            style={{ textDecoration: "none" }}
          >
            <div
              style={{
                background:
                  "linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))",
                padding: "8px",
                borderRadius: "12px",
                boxShadow: "0 0 15px rgba(0, 240, 255, 0.2)",
              }}
            >
              <Layers size={24} color="#000" />
            </div>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "1.25rem",
                letterSpacing: "-0.02em",
                color: "var(--text-primary)",
                marginLeft: "8px",
              }}
            >
              YieldVault{" "}
              <span style={{ color: "var(--accent-cyan)" }}>RWA</span>
            </span>
          </NavLink>

          <button
            type="button"
            className="nav-menu-toggle btn btn-outline"
            aria-expanded={menuOpen}
            aria-controls="app-navigation-links"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            Menu
          </button>
          <div
            id="app-navigation-links"
            className={`nav-links ${menuOpen ? "nav-links-open" : ""}`}
          >
            <NavLink
              to="/"
              onClick={closeMenu}
              style={({ isActive }) => ({
                color: isActive
                  ? "var(--accent-cyan)"
                  : "var(--text-secondary)",
                textDecoration: "none",
                fontWeight: 500,
                fontSize: "0.95rem",
              })}
            >
              Vaults
            </NavLink>
            <NavLink
              to="/portfolio"
              onClick={closeMenu}
              style={({ isActive }) => ({
                color: isActive
                  ? "var(--accent-cyan)"
                  : "var(--text-secondary)",
                textDecoration: "none",
                fontWeight: 500,
                fontSize: "0.95rem",
              })}
            >
              Portfolio
            </NavLink>
            <NavLink
              to="/analytics"
              onClick={closeMenu}
              style={({ isActive }) => ({
                color: isActive
                  ? "var(--accent-cyan)"
                  : "var(--text-secondary)",
                textDecoration: "none",
                fontWeight: 500,
                fontSize: "0.95rem",
              })}
            >
              Analytics
            </NavLink>
            <NavLink
              to="/transactions"
              onClick={closeMenu}
              style={({ isActive }) => ({
                color: isActive
                  ? "var(--accent-cyan)"
                  : "var(--text-secondary)",
                textDecoration: "none",
                fontWeight: 500,
                fontSize: "0.95rem",
              })}
            >
              Transactions
            </NavLink>
          </div>
        </div>

        <div className="flex items-center gap-md nav-actions">
          <ThemeToggle />
          <WalletConnect
            walletAddress={walletAddress}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
          />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
