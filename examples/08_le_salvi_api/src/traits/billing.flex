// Camada de Regra de Negócio: Traits e Cálculos Financeiros

trait PricingPolicy {
    func calculate_total(base_price: Float) -> Float;
}

struct LoyaltyBilling {
    discount_rate: Float,
    service_tax: Float
}

impl PricingPolicy for LoyaltyBilling {
    func calculate_total(self, base_price: Float) -> Float {
        let discount = base_price * self.discount_rate;
        let discounted = base_price - discount;
        return discounted + self.service_tax;
    }
}
