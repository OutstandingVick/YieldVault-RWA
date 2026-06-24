# Fuzz math seed corpus

JSON fixtures in `seed_fixtures/` document representative inputs for the
`share_price_math` libFuzzer target (`fuzz_targets/share_price_math.rs`).

Each fixture maps to a 32-byte seed file under `corpus/share_price_math/`:

| Fixture | Corpus file | Scenario |
|---------|-------------|----------|
| `bootstrap_first_deposit.json` | `bootstrap_first_deposit` | Empty vault, 1:1 mint |
| `round_trip_truncation.json` | `round_trip_truncation` | Non-trivial share price with round-down |
| `yield_accrual.json` | `yield_accrual` | Yield increases redemption value |
| `proportional_vault.json` | `proportional_vault` | 50% share redemption |

## Encoding

Seeds are four little-endian `i128` values (8 bytes each):

1. `assets` — deposit or probe amount (must be positive)
2. `total_shares` — vault share supply before the operation (may be zero)
3. `total_assets` — vault asset balance before the operation (may be zero)
4. `yield_amount` — extra assets accrued (must be positive)

Use `share_price_math::fuzz_invariants::encode_vault_math_input` to regenerate corpus bytes
from JSON parameters.

## Running locally

```bash
cd contracts/vault
cargo install cargo-fuzz
rustup install nightly
cargo +nightly fuzz run share_price_math -- -max_total_time=60
```

Property tests in `src/fuzz_math.rs` cover the same invariants with proptest;
this corpus feeds libFuzzer for continuous exploration in CI.
