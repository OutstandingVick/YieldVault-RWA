# Secure Whitelist Module - Quick Reference Guide

**For:** Developers and DevOps  
**Duration:** 5-minute read  
**Last Updated:** June 2, 2026

---

## Quick Start

### Overview

The **SecureWhitelist** module manages approved strategy contract IDs in the YieldVault protocol.

```rust
// ✅ Check if strategy is whitelisted
if vault.is_strategy_whitelisted(&strategy) {
    // Strategy can be used
}

// ✅ Add strategy to whitelist (admin-only)
vault.whitelist_strategy(&strategy, &true);

// ✅ Remove strategy from whitelist (admin-only)
vault.whitelist_strategy(&strategy, &false);

// ✅ Set as active strategy (requires whitelisting)
vault.set_strategy(&strategy);
```

---

## Common Operations

### 1. Whitelist a Strategy

```rust
// Admin whitelists a new strategy
vault.whitelist_strategy(&new_strategy_address, &true);

// Now other functions can check and use it
assert!(vault.is_strategy_whitelisted(&new_strategy_address));
```

**Use Cases:**
- Adding a new strategy for allocation
- Approving a strategy after security audit
- Enabling an upgraded strategy

### 2. Check Whitelist Status

```rust
// Any user can check whitelist status
let is_approved = vault.is_strategy_whitelisted(&strategy_address);

if is_approved {
    println!("Strategy is approved for use");
} else {
    println!("Strategy is not approved");
}
```

**Use Cases:**
- UI validation before strategy selection
- Smart contract validation
- Monitoring and alerting
- Off-chain strategy listing

### 3. Unwhitelist a Strategy

```rust
// Admin removes strategy from whitelist
vault.whitelist_strategy(&strategy_address, &false);

// Now it cannot be used for allocation
assert!(!vault.is_strategy_whitelisted(&strategy_address));
```

**Use Cases:**
- Deactivating a failed strategy
- Revoking approval after security incident
- Retiring old strategy implementation

### 4. Switch Active Strategy

```rust
// Can only set whitelisted strategies as active
vault.set_strategy(&whitelisted_strategy);

// This will panic if strategy is not whitelisted:
vault.set_strategy(&non_whitelisted_strategy); // ❌ Panics!

// Correct approach:
vault.whitelist_strategy(&strategy, &true);
vault.set_strategy(&strategy); // ✅ Works
```

**Use Cases:**
- Transitioning to new strategy
- Failover to backup strategy
- Testing strategy in production

---

## Test Patterns

### Unit Test Pattern

```rust
#[test]
fn test_my_strategy_whitelist() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (vault, _, _, admin) = setup_vault(&env);
    let my_strategy = Address::generate(&env);
    
    // Verify initial state
    assert!(!vault.is_strategy_whitelisted(&my_strategy));
    
    // Add to whitelist
    vault.whitelist_strategy(&my_strategy, &true);
    assert!(vault.is_strategy_whitelisted(&my_strategy));
    
    // Remove from whitelist
    vault.whitelist_strategy(&my_strategy, &false);
    assert!(!vault.is_strategy_whitelisted(&my_strategy));
}
```

### Integration Test Pattern

```rust
#[test]
fn test_whitelist_with_allocation() {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();
    
    let (vault, usdc, _, admin) = setup_vault(&env);
    let user = Address::generate(&env);
    let strategy = Address::generate(&env);
    
    // Setup deposits
    usdc.mint(&user, &1000);
    vault.deposit(&user, &100);
    
    // Whitelist strategy
    vault.whitelist_strategy(&strategy, &true);
    
    // Now strategy can be set and used
    vault.set_strategy(&strategy);
    
    // Verify whitelist persists after operations
    assert!(vault.is_strategy_whitelisted(&strategy));
}
```

---

## Authorization

### Who Can Do What?

| Operation | Required | Who |
|-----------|----------|-----|
| `whitelist_strategy()` | Admin Auth | Vault Admin Only |
| `is_strategy_whitelisted()` | None | Anyone |
| `set_strategy()` | Admin Auth | Vault Admin Only |

### Example: Authorization Enforcement

```rust
let admin = Address::generate(&env);
let non_admin = Address::generate(&env);
let strategy = Address::generate(&env);

let (vault, _, _, _) = setup_vault_with_admin(&env, &admin);

// ✅ Admin can whitelist
env.as_contract(&admin, || {
    vault.whitelist_strategy(&strategy, &true);
});

// ❌ Non-admin cannot whitelist
env.as_contract(&non_admin, || {
    vault.whitelist_strategy(&strategy, &false); // Panics!
});

// ✅ Anyone can check status
assert!(vault.is_strategy_whitelisted(&strategy));
```

---

## Storage & Persistence

### How Whitelist Data is Stored

```
Key: ("whitelist", strategy_address)
Value: true (whitelisted) or not present (not whitelisted)
Storage: Instance Storage (persists across operations)
```

### Persistence Across Operations

```rust
// Whitelist survives vault operations
vault.whitelist_strategy(&strategy, &true);

// Vault operations
vault.deposit(&user, &1000);
vault.accrue_yield(&50);
vault.withdraw(&user, &500);

// Whitelist still there
assert!(vault.is_strategy_whitelisted(&strategy));
```

---

## Error Handling

### Expected Error Scenarios

```rust
// ❌ Setting non-whitelisted strategy panics
match std::panic::catch_unwind(|| {
    vault.set_strategy(&non_whitelisted);
}) {
    Err(_) => println!("Caught expected panic"),
    Ok(_) => println!("Unexpected success"),
}

// ✅ Non-admin auth fails
env.as_contract(&non_admin, || {
    // This will require proper auth and panic if not provided
    vault.whitelist_strategy(&strategy, &true);
});
```

### Handling Errors in Production

```rust
// Check before using
if vault.is_strategy_whitelisted(&candidate_strategy) {
    vault.set_strategy(&candidate_strategy);
} else {
    // Handle: strategy not approved
    log_error("Strategy not whitelisted");
    return Err(StrategyError::NotApproved);
}
```

---

## Debugging

### Common Issues & Solutions

#### "strategy not whitelisted" Panic

```rust
// ❌ Problem
vault.set_strategy(&strategy); // Panics!

// ✅ Solution
if vault.is_strategy_whitelisted(&strategy) {
    vault.set_strategy(&strategy);
} else {
    vault.whitelist_strategy(&strategy, &true);
    vault.set_strategy(&strategy);
}
```

#### Whitelist Not Persisting

```rust
// ✅ Correct: Uses instance storage (persists)
vault.whitelist_strategy(&strategy, &true);

// ❌ Issue: Using session storage (doesn't persist)
// Don't do this with local variables
```

#### Authorization Failures

```rust
// ✅ Correct: Admin provides auth
env.mock_all_auths(); // Mocks auth in tests

// In production: Admin calls via signed transaction

// ❌ Common mistake: Calling without auth
vault.whitelist_strategy(&strategy, &true); // No auth context!
```

---

## Performance

### Operation Speeds (Estimated)

| Operation | Time |
|-----------|------|
| Add to whitelist | < 1ms |
| Remove from whitelist | < 1ms |
| Check whitelist | < 1ms |
| Set strategy | < 1ms |

### Scaling Characteristics

```
Strategies    Memory    Query Time
─────────────────────────────────
10            ~400B     < 1ms
100           ~4KB      < 1ms
1000          ~40KB     < 1ms
10000         ~400KB    < 1ms

No degradation with scale (constant time O(1))
```

---

## Best Practices

### DO ✅

```rust
// ✅ Check before using
if vault.is_strategy_whitelisted(&strategy) {
    vault.set_strategy(&strategy);
}

// ✅ Whitelist after testing
vault.whitelist_strategy(&tested_strategy, &true);

// ✅ Remove when decommissioning
vault.whitelist_strategy(&old_strategy, &false);

// ✅ Log whitelist changes
emit_event!(WhitelistUpdated { strategy, approved: true });

// ✅ Audit whitelist regularly
for strategy in get_all_strategies() {
    if vault.is_strategy_whitelisted(&strategy) {
        verify_strategy_health(&strategy);
    }
}
```

### DON'T ❌

```rust
// ❌ Don't assume strategy is whitelisted
vault.set_strategy(&unknown_strategy); // Might panic!

// ❌ Don't use non-whitelisted strategies
if !vault.is_strategy_whitelisted(&strategy) {
    vault.set_strategy(&strategy); // Panics!
}

// ❌ Don't bypass authorization
// vault.whitelist_strategy(&strategy, &true); // This needs auth!

// ❌ Don't forget to test edge cases
// Test: Add/Remove/Check combinations

// ❌ Don't modify storage directly
// Use vault.whitelist_strategy() instead of raw storage ops
```

---

## Testing Checklist

When adding new strategy code, verify:

- [ ] Strategy can be added to whitelist
- [ ] Strategy can be checked if whitelisted
- [ ] Strategy can be removed from whitelist
- [ ] Non-whitelisted strategy rejected by set_strategy()
- [ ] Authorization checks work correctly
- [ ] Whitelist persists after vault operations
- [ ] Multiple strategies can coexist
- [ ] Whitelist state is consistent across queries

---

## Integration Examples

### Example 1: Multi-Strategy Selection UI

```rust
// Backend endpoint to list available strategies
pub fn list_available_strategies(vault: &YieldVaultClient) -> Vec<StrategyInfo> {
    let all_strategies = get_known_strategies();
    
    all_strategies
        .into_iter()
        .filter(|s| vault.is_strategy_whitelisted(&s.address))
        .map(|s| StrategyInfo {
            address: s.address,
            name: s.name,
            apy: s.current_apy,
            status: "active".to_string(),
        })
        .collect()
}

// Frontend can then render available options
// User selection calls: vault.set_strategy(&selected)
```

### Example 2: Automated Strategy Health Check

```rust
// Periodic task to verify whitelisted strategies are healthy
pub fn health_check_whitelisted_strategies(vault: &YieldVaultClient) {
    for strategy in get_all_known_strategies() {
        if vault.is_strategy_whitelisted(&strategy.address) {
            match check_strategy_health(&strategy) {
                StrategyHealth::Healthy => continue,
                StrategyHealth::Degraded => {
                    alert!("Degraded strategy: {:?}", strategy.address);
                }
                StrategyHealth::Failed => {
                    vault.whitelist_strategy(&strategy.address, &false);
                    alert!("Removed failed strategy: {:?}", strategy.address);
                }
            }
        }
    }
}
```

### Example 3: Safe Strategy Upgrade

```rust
// To safely upgrade a strategy:

// 1. Deploy new strategy
let new_strategy = deploy_new_strategy_version();

// 2. Whitelist it
vault.whitelist_strategy(&new_strategy, &true);

// 3. Test in production (optional, with limited usage)
vault.invest(&test_amount);

// 4. If successful, set as active
vault.set_strategy(&new_strategy);

// 5. Optionally remove old strategy
// vault.whitelist_strategy(&old_strategy, &false);
```

---

## Reference

### Files

- **Module:** `contracts/vault/src/whitelist.rs` (150 lines)
- **Tests:** `contracts/vault/src/test.rs` (13 tests)
- **Integration:** `contracts/vault/src/lib.rs`
- **Docs:** `WHITELIST_MODULE_TESTING.md`
- **Summary:** `WHITELIST_IMPLEMENTATION_SUMMARY.md`

### Key Functions

```rust
// In YieldVaultClient<'a>

// Check if strategy is whitelisted
pub fn is_strategy_whitelisted(&self, strategy: &Address) -> bool

// Whitelist or un-whitelist a strategy
pub fn whitelist_strategy(&self, strategy: &Address, approved: &bool)

// Set the active strategy (requires whitelisting)
pub fn set_strategy(&self, strategy: &Address)

// Get the active strategy
pub fn strategy(&self) -> Option<Address>
```

---

## Support

### Getting Help

1. **Module Questions:** See `WHITELIST_IMPLEMENTATION_SUMMARY.md`
2. **Test Issues:** See `WHITELIST_MODULE_TESTING.md`
3. **Architecture:** See `docs/CONTRACTS_ARCHITECTURE.md`
4. **Code Examples:** See `contracts/vault/src/test.rs`

### Reporting Issues

If you find issues:
1. Run the test suite: `cargo test --lib test_whitelist`
2. Check the troubleshooting guide
3. Review error messages carefully
4. Search existing issues
5. Report with clear reproduction steps

---

**Document Version:** 1.0  
**Status:** Complete  
**For:** Development Team
