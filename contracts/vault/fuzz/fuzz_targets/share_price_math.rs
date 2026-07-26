//! libFuzzer harness for vault share-price math invariants.
//!
//! Mirrors the pure-math properties in `src/fuzz_math.rs` and is seeded from
//! `fuzz/seed_fixtures/` JSON fixtures (encoded to 32-byte corpus files).

#![no_main]

use libfuzzer_sys::fuzz_target;
use share_price_math::fuzz_invariants::{assert_share_price_invariants, decode_vault_math_input};

fuzz_target!(|data: &[u8]| {
    let Some((assets, total_shares, total_assets, yield_amount)) = decode_vault_math_input(data)
    else {
        return;
    };

    assert_share_price_invariants(assets, total_shares, total_assets, yield_amount);
});
