use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
enum DataKey {
    Admin,
    PriceData,
    StaleData,
    ZeroPrice,
    NegativePrice,
    InvalidDecimals,
}

pub type PriceData = (i128, u64, u32);

pub fn price_data_new(price: i128, timestamp: u64, decimals: u32) -> PriceData {
    (price, timestamp, decimals)
}

#[contract]
pub struct MockPriceOracle;

#[contractimpl]
impl MockPriceOracle {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::StaleData, &false);
        env.storage().instance().set(&DataKey::ZeroPrice, &false);
        env.storage()
            .instance()
            .set(&DataKey::NegativePrice, &false);
        env.storage()
            .instance()
            .set(&DataKey::InvalidDecimals, &false);
    }

    pub fn set_price(env: Env, price: i128, timestamp: u64, decimals: u32) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        let price_data = price_data_new(price, timestamp, decimals);
        env.storage()
            .instance()
            .set(&DataKey::PriceData, &price_data);
    }

    pub fn set_stale_data_mode(env: Env, stale: bool) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::StaleData, &stale);
    }

    pub fn set_zero_price_mode(env: Env, zero: bool) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::ZeroPrice, &zero);
    }

    pub fn set_negative_price_mode(env: Env, negative: bool) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::NegativePrice, &negative);
    }

    pub fn set_invalid_decimals_mode(env: Env, invalid: bool) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::InvalidDecimals, &invalid);
    }

    pub fn get_price(env: Env, _base: Address, _quote: Address) -> PriceData {
        let is_stale = env
            .storage()
            .instance()
            .get::<_, bool>(&DataKey::StaleData)
            .unwrap_or(false);
        let is_zero = env
            .storage()
            .instance()
            .get::<_, bool>(&DataKey::ZeroPrice)
            .unwrap_or(false);
        let is_negative = env
            .storage()
            .instance()
            .get::<_, bool>(&DataKey::NegativePrice)
            .unwrap_or(false);
        let has_invalid_decimals = env
            .storage()
            .instance()
            .get::<_, bool>(&DataKey::InvalidDecimals)
            .unwrap_or(false);

        let price_data: Option<PriceData> = env.storage().instance().get(&DataKey::PriceData);

        if let Some(mut data) = price_data {
            if is_stale {
                data.1 = env.ledger().timestamp().saturating_sub(7200);
            }
            if is_zero {
                data.0 = 0;
            }
            if is_negative {
                data.0 = -1000000000i128;
            }
            if has_invalid_decimals {
                data.2 = 35;
            }
            data
        } else {
            price_data_new(1_000_000_000i128, env.ledger().timestamp(), 18)
        }
    }
}
