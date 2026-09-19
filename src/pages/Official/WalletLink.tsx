import React, { useEffect, useState } from 'react';
import { Link2, Shield, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBlockchain } from '../../context/BlockchainContext';
import apiClient from '../../lib/apiClient';
import { getWeb3Provider } from '../../lib/web3';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

const shortenWallet = (address?: string | null) => {
  if (!address) return 'Not linked';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const WalletLink = () => {
  const { user, token, refreshCurrentUser } = useAuth();
  const { isWeb3Connected, walletAddress, connectToWeb3 } = useBlockchain();
  const [isLinking, setIsLinking] = useState(false);
  const [detectedWallet, setDetectedWallet] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    const loadDetectedWallet = async () => {
      const provider = getWeb3Provider();
      if (!provider) return;

      try {
        const accounts = await provider.listAccounts();
        setDetectedWallet(accounts[0] || null);
      } catch {
        setDetectedWallet(null);
      }
    };

    loadDetectedWallet().catch(() => undefined);
  }, [walletAddress]);

  if (!user) {
    return <div className="p-8 text-center text-red-500 font-bold">Unauthorized access. Please login.</div>;
  }

  const handleLinkWallet = async () => {
    if (!token) {
      setStatusError('You must be logged in to link a wallet.');
      return;
    }

    const provider = getWeb3Provider();
    if (!provider) {
      setStatusError('MetaMask or another Web3 wallet is required to link your account.');
      return;
    }

    try {
      setIsLinking(true);
      setStatusError(null);
      setStatusMessage(null);

      await provider.send('eth_requestAccounts', []);
      const signer = provider.getSigner();
      const selectedWallet = await signer.getAddress();
      const challenge = await apiClient.requestWalletLinkChallenge(token) as { message: string; expiresAt: string };
      const signature = await signer.signMessage(challenge.message);

      await apiClient.verifyWalletLink(token, selectedWallet, signature);
      await refreshCurrentUser();

      setDetectedWallet(selectedWallet);
      setStatusMessage('Wallet linked successfully. Admin can now grant your on-chain role and activate this account.');
    } catch (error: any) {
      setStatusError(error?.message || 'Wallet linking failed.');
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Wallet className="h-6 w-6 text-blue-600" />
            Link Wallet
          </CardTitle>
          <CardDescription>
            Prove ownership of your MetaMask wallet by signing a challenge message. This does not send a blockchain transaction and does not consume gas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Account</div>
              <div className="mt-2 text-sm font-medium text-slate-900">{user.name}</div>
              <div className="text-sm text-slate-500">{user.role}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Linked Wallet</div>
              <div className="mt-2 text-sm font-mono text-slate-900">{shortenWallet(user.walletAddress)}</div>
              <div className="text-xs text-slate-500">
                {user.walletAddress ? 'Saved on your profile' : 'No wallet linked yet'}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Portal Wallet</div>
              <div className="mt-2 text-sm font-mono text-slate-900">{shortenWallet(walletAddress || detectedWallet)}</div>
              <div className="text-xs text-slate-500">
                {isWeb3Connected ? 'Connected to the portal' : 'Detected from MetaMask when available'}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
              <div>
                <p className="font-medium">Real wallet linking flow</p>
                <p className="mt-1 text-blue-800">
                  Create account = admin. Link wallet = user. Grant on-chain role = admin. Activate account = admin after wallet link and confirmed role grant.
                </p>
              </div>
            </div>
          </div>

          {statusMessage && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              {statusMessage}
            </div>
          )}

          {statusError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {statusError}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {!isWeb3Connected && (
              <Button type="button" variant="outline" onClick={connectToWeb3}>
                Connect Wallet to Portal
              </Button>
            )}
            <Button type="button" className="bg-blue-600 hover:bg-blue-700" onClick={handleLinkWallet} disabled={isLinking}>
              <Link2 className="mr-2 h-4 w-4" />
              {isLinking ? 'Linking Wallet...' : user.walletAddress ? 'Relink Wallet with Signature' : 'Link Wallet with Signature'}
            </Button>
          </div>

          <div className="text-sm text-slate-500">
            Use the same wallet that will receive your on-chain role. After linking, ask Admin to grant your blockchain role and activate your account.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
