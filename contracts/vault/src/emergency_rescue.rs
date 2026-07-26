//! Emergency rescue flow for tokens stranded in the vault.
//!
//! Tokens are occasionally sent to the vault address by mistake — an airdrop, a
//! wrong-address transfer, a strategy refund on a retired asset. Rescuing them
//! is a privileged move, so the flow is deliberately narrow:
//!
//! 1. the caller must be one of the two configured emergency approvers
//!    (see [`crate::emergency`]), and must sign for the call;
//! 2. both approvers must be configured and distinct — a single compromised key
//!    is not enough to configure a rescue path;
//! 3. the vault's own underlying asset can **never** be rescued, so user
//!    deposits stay out of reach of this flow;
//! 4. the destination must not be the vault itself, and the amount must be
//!    positive.
//!
//! [`check_rescue_authorization`] is a pure guard so the rules are unit-testable
//! without contract storage; [`authorize_rescue`] wires it to the stored
//! approvers and enforces the signature.

use crate::emergency::{primary_approver, secondary_approver};
use crate::errors::VaultError;
use soroban_sdk::{contracttype, Address, Env};

/// A requested rescue of a non-vault token.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RescueRequest {
    /// Approver initiating the rescue.
    pub caller: Address,
    /// Token contract to rescue from the vault's balance.
    pub asset: Address,
    /// Recipient of the rescued tokens.
    pub destination: Address,
    /// Amount to rescue, in the asset's own decimals.
    pub amount: i128,
}

/// Pure authorization guard for a rescue request.
///
/// # Errors
/// - [`VaultError::InvalidAmount`] — non-positive amount.
/// - [`VaultError::GovernanceSignersNotConfigured`] — approvers missing or equal.
/// - [`VaultError::RescueUnauthorized`] — caller is not an approver, the asset
///   backs user deposits, or the destination is the vault itself.
pub fn check_rescue_authorization(
    request: &RescueRequest,
    primary: &Option<Address>,
    secondary: &Option<Address>,
    vault_address: &Address,
    vault_asset: &Address,
) -> Result<(), VaultError> {
    if request.amount <= 0 {
        return Err(VaultError::InvalidAmount);
    }

    let (primary, secondary) = match (primary, secondary) {
        (Some(p), Some(s)) => (p, s),
        _ => return Err(VaultError::GovernanceSignersNotConfigured),
    };

    // A rescue path guarded by one key twice is a single point of failure.
    if primary == secondary {
        return Err(VaultError::GovernanceSignersNotConfigured);
    }

    if &request.caller != primary && &request.caller != secondary {
        return Err(VaultError::RescueUnauthorized);
    }

    // User deposits are never rescuable, whatever the approvers agree on.
    if &request.asset == vault_asset {
        return Err(VaultError::RescueUnauthorized);
    }

    // Rescuing back into the vault would be a no-op that still emits an event.
    if &request.destination == vault_address {
        return Err(VaultError::RescueUnauthorized);
    }

    Ok(())
}

/// Authorizes a rescue against the stored emergency approvers.
///
/// Requires the caller's signature and returns the validated request; the
/// caller performs the token transfer once this succeeds.
pub fn authorize_rescue(
    env: &Env,
    request: &RescueRequest,
    vault_asset: &Address,
) -> Result<(), VaultError> {
    request.caller.require_auth();

    check_rescue_authorization(
        request,
        &primary_approver(env),
        &secondary_approver(env),
        &env.current_contract_address(),
        vault_asset,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    struct Fixture {
        env: Env,
        primary: Address,
        secondary: Address,
        vault: Address,
        vault_asset: Address,
        stray_asset: Address,
        destination: Address,
    }

    fn fixture() -> Fixture {
        let env = Env::default();
        Fixture {
            primary: Address::generate(&env),
            secondary: Address::generate(&env),
            vault: Address::generate(&env),
            vault_asset: Address::generate(&env),
            stray_asset: Address::generate(&env),
            destination: Address::generate(&env),
            env,
        }
    }

    fn request(f: &Fixture, caller: &Address, asset: &Address, amount: i128) -> RescueRequest {
        RescueRequest {
            caller: caller.clone(),
            asset: asset.clone(),
            destination: f.destination.clone(),
            amount,
        }
    }

    fn check(f: &Fixture, req: &RescueRequest) -> Result<(), VaultError> {
        check_rescue_authorization(
            req,
            &Some(f.primary.clone()),
            &Some(f.secondary.clone()),
            &f.vault,
            &f.vault_asset,
        )
    }

    #[test]
    fn primary_approver_may_rescue_stray_asset() {
        let f = fixture();
        let req = request(&f, &f.primary, &f.stray_asset, 100);
        assert_eq!(check(&f, &req), Ok(()));
    }

    #[test]
    fn secondary_approver_may_rescue_stray_asset() {
        let f = fixture();
        let req = request(&f, &f.secondary, &f.stray_asset, 100);
        assert_eq!(check(&f, &req), Ok(()));
    }

    #[test]
    fn outsider_cannot_rescue() {
        let f = fixture();
        let outsider = Address::generate(&f.env);
        let req = request(&f, &outsider, &f.stray_asset, 100);
        assert_eq!(check(&f, &req), Err(VaultError::RescueUnauthorized));
    }

    #[test]
    fn vault_asset_is_never_rescuable() {
        let f = fixture();
        let req = request(&f, &f.primary, &f.vault_asset, 100);
        assert_eq!(check(&f, &req), Err(VaultError::RescueUnauthorized));
    }

    #[test]
    fn rejects_non_positive_amount() {
        let f = fixture();
        assert_eq!(
            check(&f, &request(&f, &f.primary, &f.stray_asset, 0)),
            Err(VaultError::InvalidAmount)
        );
        assert_eq!(
            check(&f, &request(&f, &f.primary, &f.stray_asset, -1)),
            Err(VaultError::InvalidAmount)
        );
    }

    #[test]
    fn rejects_destination_equal_to_vault() {
        let f = fixture();
        let mut req = request(&f, &f.primary, &f.stray_asset, 100);
        req.destination = f.vault.clone();
        assert_eq!(check(&f, &req), Err(VaultError::RescueUnauthorized));
    }

    #[test]
    fn rejects_unconfigured_approvers() {
        let f = fixture();
        let req = request(&f, &f.primary, &f.stray_asset, 100);

        assert_eq!(
            check_rescue_authorization(
                &req,
                &None,
                &Some(f.secondary.clone()),
                &f.vault,
                &f.vault_asset
            ),
            Err(VaultError::GovernanceSignersNotConfigured)
        );
        assert_eq!(
            check_rescue_authorization(
                &req,
                &Some(f.primary.clone()),
                &None,
                &f.vault,
                &f.vault_asset
            ),
            Err(VaultError::GovernanceSignersNotConfigured)
        );
    }

    #[test]
    fn rejects_identical_approvers() {
        let f = fixture();
        let req = request(&f, &f.primary, &f.stray_asset, 100);
        assert_eq!(
            check_rescue_authorization(
                &req,
                &Some(f.primary.clone()),
                &Some(f.primary.clone()),
                &f.vault,
                &f.vault_asset,
            ),
            Err(VaultError::GovernanceSignersNotConfigured)
        );
    }

    #[test]
    fn amount_check_precedes_authorization_check() {
        // A zero-amount call from an outsider still reports the amount problem,
        // so the guard never leaks approver membership through error codes.
        let f = fixture();
        let outsider = Address::generate(&f.env);
        let req = request(&f, &outsider, &f.stray_asset, 0);
        assert_eq!(check(&f, &req), Err(VaultError::InvalidAmount));
    }
}
