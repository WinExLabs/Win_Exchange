#!/usr/bin/env node

/**
 * Backfill Script: Create missing wallets for existing deposit addresses
 *
 * This script finds deposit addresses that don't have corresponding wallets
 * and creates them. Also resets last_checked_balance to 0 so deposits can be re-detected.
 */

const { query } = require('../src/config/database');
const Wallet = require('../src/models/Wallet');
const logger = require('../src/config/logger');

async function backfillMissingWallets() {
  console.log('\n=== BACKFILLING MISSING WALLETS ===\n');

  try {
    // Find all deposit addresses
    const addressesResult = await query(
      `SELECT DISTINCT user_id, currency, address
       FROM deposit_addresses
       ORDER BY user_id, currency`
    );

    console.log(`Found ${addressesResult.rows.length} deposit address(es)\n`);

    let walletsCreated = 0;
    let balancesReset = 0;

    for (const addr of addressesResult.rows) {
      // Check if wallet exists
      const existingWallet = await Wallet.findByUserAndCurrency(addr.user_id, addr.currency);

      if (!existingWallet) {
        console.log(`Creating missing wallet:`);
        console.log(`  User: ${addr.user_id}`);
        console.log(`  Currency: ${addr.currency}`);
        console.log(`  Address: ${addr.address}`);

        try {
          const wallet = await Wallet.create({
            user_id: addr.user_id,
            currency: addr.currency,
            balance: 0
          });

          console.log(`  ✓ Wallet created: ${wallet.id}\n`);
          walletsCreated++;

          // Reset last_checked_balance so deposits can be re-detected
          await query(
            `UPDATE deposit_addresses
             SET last_checked_balance = NULL
             WHERE user_id = $1 AND currency = $2`,
            [addr.user_id, addr.currency]
          );

          console.log(`  ✓ Reset last_checked_balance to trigger re-detection\n`);
          balancesReset++;

        } catch (error) {
          console.log(`  ✗ Error creating wallet: ${error.message}\n`);
        }
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Wallets created: ${walletsCreated}`);
    console.log(`Balances reset: ${balancesReset}`);
    console.log('');

    if (walletsCreated > 0) {
      console.log('Next steps:');
      console.log('1. The monitoring service will now be able to create deposit transactions');
      console.log('2. On the next monitoring cycle (within 15 seconds), deposits will be detected');
      console.log('3. After 12 confirmations, deposits will be credited to user wallets');
    }

    console.log('\n=== COMPLETE ===\n');
    process.exit(0);

  } catch (error) {
    console.error('\n✗ Fatal error:', error);
    process.exit(1);
  }
}

backfillMissingWallets();
