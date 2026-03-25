import React from 'react';
import { NavLink } from 'react-router-dom';
import WalletConnect from './WalletConnect';
import ThemeToggle from './ThemeToggle';
import { Layers } from './icons';

interface NavbarProps {
    walletAddress: string | null;
    onConnect: (address: string) => void;
    onDisconnect: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ walletAddress, onConnect, onDisconnect }) => {
    return (
        <nav style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            background: 'var(--bg-surface)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid var(--border-glass)',
            padding: '16px 0'
        }}>
            <div className="container flex justify-between items-center navbar-container">
                <div className="flex items-center gap-xl flex-wrap-mobile justify-center-mobile">
                    <NavLink to="/" className="flex items-center gap-sm" style={{ textDecoration: 'none' }}>
                        <div style={{
                            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
                            padding: '8px',
                            borderRadius: '12px',
                            boxShadow: '0 0 15px rgba(0, 240, 255, 0.2)'
                        }}>
                            <Layers size={24} color="#000" />
                        </div>
                        <span style={{
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            fontSize: '1.25rem',
                            letterSpacing: '-0.02em',
                            color: 'var(--text-primary)',
                            marginLeft: '8px'
                        }}>
                            YieldVault <span style={{ color: 'var(--accent-cyan)' }}>RWA</span>
                        </span>
                    </NavLink>

                    <div className="flex gap-lg navbar-links">
                        <NavLink
                            to="/"
                            className="nav-link"
                            style={({ isActive }) => ({
                                color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                textDecoration: 'none',
                                fontWeight: 500,
                                fontSize: '0.95rem'
                            })}
                        >
                            Vaults
                        </NavLink>
                        <NavLink
                            to="/portfolio"
                            className="nav-link"
                            style={({ isActive }) => ({
                                color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                textDecoration: 'none',
                                fontWeight: 500,
                                fontSize: '0.95rem'
                            })}
                        >
                            Portfolio
                        </NavLink>
                        <NavLink
                            to="/analytics"
                            className="nav-link"
                            style={({ isActive }) => ({
                                color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                textDecoration: 'none',
                                fontWeight: 500,
                                fontSize: '0.95rem'
                            })}
                        >
                            Analytics
                        </NavLink>
                    </div>
                </div>

                <div className="flex items-center gap-md flex-wrap-mobile justify-center-mobile">
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
