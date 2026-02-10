import { Prisma } from 'prisma/generated/client';

enum OrderType {
  NEWEST = 0,
  PRICE_LOW_TO_HIGH = 1,
  PRICE_HIGH_TO_LOW = 2,
  MOST_POPULAR = 3,
}

export function buildOrder(
  orderType?: number | null,
): Prisma.PropertyOrderByWithRelationInput {
  switch (orderType) {
    case OrderType.PRICE_LOW_TO_HIGH:
      return { monthly_price: 'asc' };

    case OrderType.PRICE_HIGH_TO_LOW:
      return { monthly_price: 'desc' };

    case OrderType.MOST_POPULAR:
      return { totalViews: 'desc' };

    case OrderType.NEWEST:
    default:
      return { createdAt: 'desc' };
  }
}
