#!/usr/bin/env node

const path = require('path');
const {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} = require(path.resolve(__dirname, '..', 'backend', 'node_modules', '@stellar', 'stellar-sdk'));

const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const friendbotUrl = process.env.STELLAR_FRIENDBOT_URL || 'https://friendbot.stellar.org';
const assetCode = process.env.TESTNET_USDC_ASSET_CODE || 'USDC';
const issuerPublicKey = process.env.TESTNET_USDC_ISSUER;
const issuerSecret = process.env.TESTNET_USDC_ISSUER_SECRET;
const tokenAmount = process.env.TESTNET_USDC_AMOUNT || '1000';
const accountSecret = process.env.TESTNET_SECRET_KEY;

if (!accountSecret) {
  fail('TESTNET_SECRET_KEY is required');
}

let accountKeypair;
try {
  accountKeypair = Keypair.fromSecret(accountSecret);
} catch {
  fail('TESTNET_SECRET_KEY is not a valid Stellar secret key');
}

const server = new Horizon.Server(horizonUrl);

async function fundWithFriendbot(publicKey) {
  const response = await fetch(`${friendbotUrl}?addr=${encodeURIComponent(publicKey)}`);
  if (response.ok) {
    console.log(`Friendbot funded ${publicKey}`);
    return;
  }

  const body = await response.text();
  if (response.status === 400 && /funded|create/i.test(body)) {
    console.log(`Account ${publicKey} is already funded`);
    return;
  }

  throw new Error(`Friendbot request failed (${response.status}): ${body}`);
}

async function submit(sourceKeypair, operation) {
  const account = await server.loadAccount(sourceKeypair.publicKey());
  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(operation)
    .setTimeout(60)
    .build();

  transaction.sign(sourceKeypair);
  return server.submitTransaction(transaction);
}

async function ensureTrustline() {
  if (!issuerPublicKey) {
    console.log('TESTNET_USDC_ISSUER is not set; skipping classic USDC trustline setup');
    return;
  }

  const asset = new Asset(assetCode, issuerPublicKey);
  const account = await server.loadAccount(accountKeypair.publicKey());
  const hasTrustline = account.balances.some(
    (balance) =>
      balance.asset_type !== 'native' &&
      balance.asset_code === assetCode &&
      balance.asset_issuer === issuerPublicKey
  );

  if (hasTrustline) {
    console.log(`${assetCode} trustline already exists`);
    return;
  }

  await submit(accountKeypair, Operation.changeTrust({ asset }));
  console.log(`Created ${assetCode} trustline to ${issuerPublicKey}`);
}

async function mintTestTokens() {
  if (!issuerSecret) {
    if (issuerPublicKey) {
      console.log(
        'TESTNET_USDC_ISSUER_SECRET is not set; trustline is ready, but token funding was skipped'
      );
    }
    return;
  }

  const issuerKeypair = Keypair.fromSecret(issuerSecret);
  if (issuerPublicKey && issuerKeypair.publicKey() !== issuerPublicKey) {
    fail('TESTNET_USDC_ISSUER_SECRET does not match TESTNET_USDC_ISSUER');
  }

  await fundWithFriendbot(issuerKeypair.publicKey());
  const asset = new Asset(assetCode, issuerKeypair.publicKey());
  await submit(
    issuerKeypair,
    Operation.payment({
      destination: accountKeypair.publicKey(),
      asset,
      amount: tokenAmount,
    })
  );
  console.log(`Sent ${tokenAmount} ${assetCode} to ${accountKeypair.publicKey()}`);
}

async function main() {
  await fundWithFriendbot(accountKeypair.publicKey());
  await ensureTrustline();
  await mintTestTokens();
  console.log('Testnet account setup complete');
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
