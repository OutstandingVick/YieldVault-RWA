//! Packed storage layout for the small scalar vault parameters.
//!
//! Each Soroban storage entry carries its own key, entry header and rent
//! footprint, so four separate `u32` parameters cost four reads on every
//! deposit/withdraw path. All four fit in a single `u128` word, which collapses
//! them into one entry: **4 reads -> 1 read**, and one rent-bearing key instead
//! of four.
//!
//! Layout (most significant bits first):
//!
//! ```text
//! bits 96..127 : fee_bps
//! bits 64..95  : liquidity_buffer_bps
//! bits 32..63  : withdrawal_cooldown_secs
//! bits  0..31  : max_batch_size
//! ```
//!
//! The packing is lossless and round-trip stable — see the tests below.

use crate::errors::VaultError;
use soroban_sdk::contracttype;

/// Bit offset of each field within the packed word.
const FEE_SHIFT: u32 = 96;
const BUFFER_SHIFT: u32 = 64;
const COOLDOWN_SHIFT: u32 = 32;
const BATCH_SHIFT: u32 = 0;

const FIELD_MASK: u128 = u32::MAX as u128;

/// Basis-point denominator.
const BPS_DENOMINATOR: u32 = 10_000;

/// The scalar vault parameters that share one storage word.
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub struct PackedVaultParams {
    /// Protocol fee taken on accrued yield, in basis points.
    pub fee_bps: u32,
    /// Idle liquidity that must stay in the vault, in basis points.
    pub liquidity_buffer_bps: u32,
    /// Cooldown between deposit and withdrawal, in seconds.
    pub withdrawal_cooldown_secs: u32,
    /// Maximum number of items processed in one batch call.
    pub max_batch_size: u32,
}

impl PackedVaultParams {
    /// Rejects values that cannot be represented or are out of protocol range.
    pub fn validate(&self) -> Result<(), VaultError> {
        if self.fee_bps > BPS_DENOMINATOR {
            return Err(VaultError::InvalidFeeBps);
        }
        if self.liquidity_buffer_bps > BPS_DENOMINATOR {
            return Err(VaultError::InvalidLiquidityBuffer);
        }
        if self.max_batch_size == 0 {
            return Err(VaultError::InvalidMaxBatchSize);
        }
        Ok(())
    }

    /// Packs the parameters into a single storage word.
    pub fn pack(&self) -> u128 {
        ((self.fee_bps as u128) << FEE_SHIFT)
            | ((self.liquidity_buffer_bps as u128) << BUFFER_SHIFT)
            | ((self.withdrawal_cooldown_secs as u128) << COOLDOWN_SHIFT)
            | ((self.max_batch_size as u128) << BATCH_SHIFT)
    }

    /// Packs after validating; use on the admin write path.
    pub fn try_pack(&self) -> Result<u128, VaultError> {
        self.validate()?;
        Ok(self.pack())
    }

    /// Unpacks a storage word written by [`PackedVaultParams::pack`].
    pub fn unpack(word: u128) -> Self {
        Self {
            fee_bps: ((word >> FEE_SHIFT) & FIELD_MASK) as u32,
            liquidity_buffer_bps: ((word >> BUFFER_SHIFT) & FIELD_MASK) as u32,
            withdrawal_cooldown_secs: ((word >> COOLDOWN_SHIFT) & FIELD_MASK) as u32,
            max_batch_size: ((word >> BATCH_SHIFT) & FIELD_MASK) as u32,
        }
    }
}

/// Reads a single field without unpacking the whole struct.
///
/// Hot paths that only need the cooldown or the buffer avoid materialising the
/// other three fields.
pub fn fee_bps(word: u128) -> u32 {
    ((word >> FEE_SHIFT) & FIELD_MASK) as u32
}

/// See [`fee_bps`].
pub fn liquidity_buffer_bps(word: u128) -> u32 {
    ((word >> BUFFER_SHIFT) & FIELD_MASK) as u32
}

/// See [`fee_bps`].
pub fn withdrawal_cooldown_secs(word: u128) -> u32 {
    ((word >> COOLDOWN_SHIFT) & FIELD_MASK) as u32
}

/// See [`fee_bps`].
pub fn max_batch_size(word: u128) -> u32 {
    ((word >> BATCH_SHIFT) & FIELD_MASK) as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    fn params() -> PackedVaultParams {
        PackedVaultParams {
            fee_bps: 250,
            liquidity_buffer_bps: 1_000,
            withdrawal_cooldown_secs: 86_400,
            max_batch_size: 50,
        }
    }

    #[test]
    fn pack_unpack_round_trips() {
        let p = params();
        assert_eq!(PackedVaultParams::unpack(p.pack()), p);
    }

    #[test]
    fn pack_unpack_round_trips_at_field_maximums() {
        let p = PackedVaultParams {
            fee_bps: u32::MAX,
            liquidity_buffer_bps: u32::MAX,
            withdrawal_cooldown_secs: u32::MAX,
            max_batch_size: u32::MAX,
        };
        assert_eq!(PackedVaultParams::unpack(p.pack()), p);
        assert_eq!(p.pack(), u128::MAX);
    }

    #[test]
    fn zeroed_word_unpacks_to_zeroed_params() {
        let p = PackedVaultParams::unpack(0);
        assert_eq!(p.fee_bps, 0);
        assert_eq!(p.liquidity_buffer_bps, 0);
        assert_eq!(p.withdrawal_cooldown_secs, 0);
        assert_eq!(p.max_batch_size, 0);
    }

    #[test]
    fn fields_do_not_bleed_into_neighbours() {
        let only_fee = PackedVaultParams {
            fee_bps: u32::MAX,
            liquidity_buffer_bps: 0,
            withdrawal_cooldown_secs: 0,
            max_batch_size: 0,
        };
        let word = only_fee.pack();
        assert_eq!(fee_bps(word), u32::MAX);
        assert_eq!(liquidity_buffer_bps(word), 0);
        assert_eq!(withdrawal_cooldown_secs(word), 0);
        assert_eq!(max_batch_size(word), 0);
    }

    #[test]
    fn field_accessors_match_unpack() {
        let word = params().pack();
        let p = PackedVaultParams::unpack(word);
        assert_eq!(fee_bps(word), p.fee_bps);
        assert_eq!(liquidity_buffer_bps(word), p.liquidity_buffer_bps);
        assert_eq!(withdrawal_cooldown_secs(word), p.withdrawal_cooldown_secs);
        assert_eq!(max_batch_size(word), p.max_batch_size);
    }

    #[test]
    fn try_pack_rejects_out_of_range_fee() {
        let p = PackedVaultParams {
            fee_bps: 10_001,
            ..params()
        };
        assert_eq!(p.try_pack(), Err(VaultError::InvalidFeeBps));
    }

    #[test]
    fn try_pack_rejects_out_of_range_buffer() {
        let p = PackedVaultParams {
            liquidity_buffer_bps: 10_001,
            ..params()
        };
        assert_eq!(p.try_pack(), Err(VaultError::InvalidLiquidityBuffer));
    }

    #[test]
    fn try_pack_rejects_zero_batch_size() {
        let p = PackedVaultParams {
            max_batch_size: 0,
            ..params()
        };
        assert_eq!(p.try_pack(), Err(VaultError::InvalidMaxBatchSize));
    }

    #[test]
    fn try_pack_accepts_valid_params() {
        assert_eq!(params().try_pack(), Ok(params().pack()));
    }
}
