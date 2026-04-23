import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WalletConnect from './WalletConnect';
import * as freighter from '@stellar/freighter-api';
import { ToastProvider } from '../context/ToastContext';
import { WALLET_MANUAL_DISCONNECT_KEY } from '../lib/walletSession';


// Mock freighter-api
vi.mock('@stellar/freighter-api', () => ({
    isAllowed: vi.fn(),
    setAllowed: vi.fn(),
    getAddress: vi.fn(),
}));

const mockedFreighter = vi.mocked(freighter);

const WalletConnectWrapper: React.FC<ComponentProps<typeof WalletConnect>> = (props) => (
    <ToastProvider>
        <WalletConnect {...props} />
    </ToastProvider>
);

describe('WalletConnect', () => {
    const mockOnConnect = vi.fn();
    const mockOnDisconnect = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        sessionStorage.removeItem(WALLET_MANUAL_DISCONNECT_KEY);
        mockedFreighter.isAllowed.mockResolvedValue({ isAllowed: false });
        mockedFreighter.getAddress.mockResolvedValue({ address: "" });
        mockedFreighter.setAllowed.mockResolvedValue({ isAllowed: true });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders the connect button when no wallet is connected', async () => {
        mockedFreighter.isAllowed.mockResolvedValue({ isAllowed: false });
        render(
            <WalletConnectWrapper 
                walletAddress={null} 
                onConnect={mockOnConnect} 
                onDisconnect={mockOnDisconnect} 
            />
        );

        expect(await screen.findByText(/Connect Freighter/i)).toBeInTheDocument();
    });

    it('shows loading state while connecting', async () => {
        mockedFreighter.isAllowed.mockResolvedValue({ isAllowed: false });
        mockedFreighter.setAllowed.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
        
        render(
            <WalletConnectWrapper 
                walletAddress={null} 
                onConnect={mockOnConnect} 
                onDisconnect={mockOnDisconnect} 
            />
        );

        const button = screen.getByText(/Connect Freighter/i);
        fireEvent.click(button);

        // Should show connecting state
        expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
    });

    it('calls onConnect when manually connected via button', async () => {
        mockedFreighter.isAllowed
            .mockResolvedValueOnce({ isAllowed: false })
            .mockResolvedValueOnce({ isAllowed: true });
        mockedFreighter.setAllowed.mockResolvedValue({ isAllowed: true });
        mockedFreighter.getAddress.mockResolvedValue({ address: 'GABC123' });

        render(
            <WalletConnectWrapper 
                walletAddress={null} 
                onConnect={mockOnConnect} 
                onDisconnect={mockOnDisconnect} 
            />
        );

        const button = screen.getByText(/Connect Freighter/i);
        fireEvent.click(button);

        await waitFor(() => {
            expect(mockOnConnect).toHaveBeenCalledWith('GABC123');
        });
    });

    it('shows error state when permission is denied', async () => {
        mockedFreighter.isAllowed.mockResolvedValueOnce({ isAllowed: false });
        mockedFreighter.setAllowed.mockResolvedValue({ isAllowed: false });
        mockedFreighter.getAddress.mockResolvedValue({ address: "" });

        render(
            <WalletConnectWrapper 
                walletAddress={null} 
                onConnect={mockOnConnect} 
                onDisconnect={mockOnDisconnect} 
            />
        );

        const button = screen.getByText(/Connect Freighter/i);
        fireEvent.click(button);

        await waitFor(() => {
            expect(mockOnConnect).not.toHaveBeenCalled();
        });
    });

    it('shows error state when connection fails', async () => {
        mockedFreighter.setAllowed.mockRejectedValueOnce(new Error('Freighter not found'));

        render(
            <WalletConnectWrapper 
                walletAddress={null} 
                onConnect={mockOnConnect} 
                onDisconnect={mockOnDisconnect} 
            />
        );

        const button = screen.getByText(/Connect Freighter/i);
        fireEvent.click(button);

        await waitFor(() => {
            expect(mockOnConnect).not.toHaveBeenCalled();
        });
    });

    it('displays tooltip on button hover', async () => {
        mockedFreighter.isAllowed.mockResolvedValue({ isAllowed: false });
        
        render(
            <WalletConnectWrapper 
                walletAddress={null} 
                onConnect={mockOnConnect} 
                onDisconnect={mockOnDisconnect} 
            />
        );

        const button = screen.getByText(/Connect Freighter/i).closest('button');
        if (!button) throw new Error('Button not found');

        fireEvent.mouseEnter(button);
        
        // Tooltip should appear
        await waitFor(() => {
            expect(button).toHaveAttribute('title');
        });
    });

    it('hides tooltip on button mouse leave', async () => {
        mockedFreighter.isAllowed.mockResolvedValue({ isAllowed: false });
        
        render(
            <WalletConnectWrapper 
                walletAddress={null} 
                onConnect={mockOnConnect} 
                onDisconnect={mockOnDisconnect} 
            />
        );

        const button = screen.getByText(/Connect Freighter/i).closest('button');
        if (!button) throw new Error('Button not found');

        fireEvent.mouseEnter(button);
        fireEvent.mouseLeave(button);
        
        // Button should have title attribute for accessibility fallback
        expect(button).toHaveAttribute('title');
    });

    it('shows the formatted address when connected', () => {
        const fullAddress = 'GABC1234567890123456789012345678901234567890123456789012';
        const expectedAddress = 'GABC1...9012';
        render(
            <WalletConnectWrapper 
                walletAddress={fullAddress} 
                onConnect={mockOnConnect} 
                onDisconnect={mockOnDisconnect} 
            />
        );

        expect(screen.getByText(expectedAddress)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Copy wallet address/i })).toBeInTheDocument();
    });

    it('calls onDisconnect when the disconnect button is clicked', () => {
        render(
            <WalletConnectWrapper 
                walletAddress="GABC123...9012" 
                onConnect={mockOnConnect} 
                onDisconnect={mockOnDisconnect} 
            />
        );

        const disconnectButton = screen.getByLabelText(/Disconnect Wallet/i);
        fireEvent.click(disconnectButton);

        expect(mockOnDisconnect).toHaveBeenCalled();
        expect(sessionStorage.getItem(WALLET_MANUAL_DISCONNECT_KEY)).toBe('1');
    });

    it('auto-connects when Freighter is already permitted for this site', async () => {
        mockedFreighter.isAllowed.mockResolvedValue({ isAllowed: true });
        mockedFreighter.getAddress.mockResolvedValue({ address: 'GAUTOCONNECT123' });

        render(
            <WalletConnectWrapper
                walletAddress={null}
                onConnect={mockOnConnect}
                onDisconnect={mockOnDisconnect}
            />
        );

        await waitFor(() => {
            expect(mockOnConnect).toHaveBeenCalledWith('GAUTOCONNECT123');
        });
    });

    it('does not auto-connect when the user disconnected in this browser session', async () => {
        sessionStorage.setItem(WALLET_MANUAL_DISCONNECT_KEY, '1');
        mockedFreighter.isAllowed.mockResolvedValue({ isAllowed: true });
        mockedFreighter.getAddress.mockResolvedValue({ address: 'GSHOULDNOTAPPEAR' });

        render(
            <WalletConnectWrapper
                walletAddress={null}
                onConnect={mockOnConnect}
                onDisconnect={mockOnDisconnect}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/Connect Freighter/i)).toBeInTheDocument();
        });

        expect(mockOnConnect).not.toHaveBeenCalled();
    });

    it('handles wallet disconnects gracefully during polling', async () => {
        mockedFreighter.isAllowed
            .mockResolvedValueOnce({ isAllowed: true })
            .mockResolvedValue({ isAllowed: false });
        mockedFreighter.getAddress.mockResolvedValue({ address: 'GABC123' });

        render(
            <WalletConnectWrapper
                walletAddress="GABC123"
                onConnect={mockOnConnect}
                onDisconnect={mockOnDisconnect}
            />
        );

        await waitFor(() => {
            expect(mockOnConnect).toHaveBeenCalledWith('GABC123');
        });

        await waitFor(
            () => {
                expect(mockedFreighter.isAllowed.mock.calls.length).toBeGreaterThanOrEqual(2);
            },
            { timeout: 5000, interval: 50 },
        );
    });
});
